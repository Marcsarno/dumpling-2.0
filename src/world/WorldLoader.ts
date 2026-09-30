import {
  Box3, BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, Object3D, PlaneGeometry, SphereGeometry,
  type BufferGeometry, type Material,
} from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {RegionFile, WorldNode} from './format';
import {MaterialLibrary} from './materials';
import {batchStatic} from './staticBatch';
import type {GroundSurface} from '../characters/CharacterAnimator';

/** PlayCanvas procedural primitives at their default dimensions (unit size, same segment counts). */
const PRIMITIVES: Record<string, () => BufferGeometry> = {
  box: () => new BoxGeometry(1, 1, 1),
  sphere: () => new SphereGeometry(.5, 16, 16),
  cylinder: () => new CylinderGeometry(.5, .5, 1, 20, 5),
  cone: () => new ConeGeometry(.5, 1, 18, 5),
  plane: () => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  capsule: () => new CapsuleGeometry(.5, 1, 8, 20),
};
const primitiveGeometry = new Map<string, BufferGeometry>();
const primitive = (type: string) => {
  let g = primitiveGeometry.get(type);
  if (!g) { g = PRIMITIVES[type](); primitiveGeometry.set(type, g); }
  return g;
};

/** Shared, reference-counted GLB cache: regions acquire models on load and release them on dispose. */
const gltfLoader = new GLTFLoader();
const models = new Map<string, {gltf: Promise<GLTF>; users: number}>();
function acquire(url: string) {
  let entry = models.get(url);
  if (!entry) { entry = {gltf: gltfLoader.loadAsync(url), users: 0}; models.set(url, entry); }
  entry.users++;
  return entry.gltf;
}
function release(url: string) {
  const entry = models.get(url);
  if (!entry || --entry.users > 0) return;
  models.delete(url);
  void entry.gltf.then(gltf => gltf.scene.traverse(o => {
    const mesh = o as Mesh; if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of ([] as Material[]).concat(mesh.material)) { for (const v of Object.values(m)) if (v && (v as {isTexture?: boolean}).isTexture) (v as {dispose(): void}).dispose(); m.dispose(); }
  }));
}

/** Meshes of an instantiated object in PlayCanvas meshInstance order (pre-order, primitives before child nodes). */
function primitiveMeshes(root: Object3D) {
  const out: Mesh[] = [];
  root.traverse(o => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
}

/**
 * The primitives of one glTF mesh. GLTFLoader reuses a mesh's object as its node, so
 * child nodes may already hang off it; keep only this mesh's own primitive meshes.
 */
function meshOnly(gltf: GLTF, source: Object3D, meshIndex: number): Object3D {
  const own = (o: Object3D) => { const a = gltf.parser.associations.get(o) as {meshes?: number; primitives?: number} | undefined; return a?.meshes === meshIndex && a.primitives !== undefined; };
  if ((source as Mesh).isMesh) return source.clone(false);
  const group = new Group(); group.name = source.name;
  for (const child of source.children) if (own(child)) group.add(child.clone(false));
  return group;
}

export interface LoadedRegion {
  region: string;
  root: Group;
  data: RegionFile;
  problems: string[];
  surfaces: GroundSurface[];
  stats: {nodes: number; meshes: number; triangles: number; hiddenNodes: number; batches: number; batchedMeshes: number};
  dispose(): void;
}

export async function loadRegion(region: string, base = import.meta.env.BASE_URL, batch = true): Promise<LoadedRegion> {
  const data = await (await fetch(`${base}world/${region}.json`)).json() as RegionFile;
  const library = new MaterialLibrary(data.materials, base), problems: string[] = [];
  const urls = data.models.map(m => base + m.src);
  const [gltfs] = await Promise.all([Promise.all(urls.map(acquire)), library.preload()]);

  const assign = (meshes: Mesh[], materials: (number | null)[], vertices: number[], label: string, paint: boolean) => {
    if (meshes.length !== vertices.length) { problems.push(`${label}: ${meshes.length} primitives, expected ${vertices.length}`); return; }
    meshes.forEach((mesh, i) => {
      const count = mesh.geometry.getAttribute('position').count;
      if (count !== vertices[i]) problems.push(`${label} primitive ${i}: ${count} vertices, expected ${vertices[i]}`);
      const index = materials[i];
      if (index == null) return;
      mesh.material = paint ? library.painted(index, mesh.material as Material, mesh.geometry) : library.direct(index, mesh.geometry);
    });
  };
  const shadows = (object: Object3D, spec: {castShadow: boolean; receiveShadow: boolean}) =>
    object.traverse(o => { if ((o as Mesh).isMesh) { o.castShadow = spec.castShadow; o.receiveShadow = spec.receiveShadow; } });

  const objects: Object3D[] = [];
  let hiddenNodes = 0;
  const build = async (node: WorldNode, index: number) => {
    let object: Object3D;
    if (node.shape) {
      const geometry = primitive(node.shape.type);
      object = new Mesh(geometry, library.direct(node.shape.material, geometry));
      shadows(object, node.shape);
      if (node.shape.enabled === false) object.visible = false;
    } else if (node.mesh) {
      const gltf = gltfs[node.mesh.model];
      object = meshOnly(gltf, await gltf.parser.getDependency('mesh', node.mesh.mesh) as Object3D, node.mesh.mesh);
      assign(primitiveMeshes(object), node.mesh.materials, node.mesh.vertices, `${data.models[node.mesh.model].src} mesh ${node.mesh.mesh}`, false);
      shadows(object, node.mesh);
      if (node.mesh.enabled === false) object.visible = false;
    } else if (node.model) {
      const holder = new Group(), instance = gltfs[node.model.model].scene.clone(true);
      holder.add(instance);
      assign(primitiveMeshes(instance), node.model.materials, node.model.vertices, `${data.models[node.model.model].src} (${node.name})`, true);
      shadows(instance, node.model);
      object = holder;
    } else object = new Object3D();
    object.name = node.name;
    object.position.fromArray(node.p); object.quaternion.fromArray(node.q); object.scale.fromArray(node.s);
    if (node.enabled === false || node.codeEnabled === false) { object.visible = false; hiddenNodes++; }
    object.userData.world = {index, key: node.key, tags: node.tags};
    objects[index] = object;
  };
  await Promise.all(data.nodes.map(build));
  data.nodes.forEach((node, i) => { if (node.parent >= 0) objects[node.parent].add(objects[i]); });

  // The authored world is static: compute transforms once and stop per-frame matrix work.
  const root = new Group(); root.name = `region:${region}`; root.add(objects[0]);
  objects[0].visible = true; // environment roots are toggled by the scene, not by their saved flag
  root.updateMatrixWorld(true);
  // Walkable surfaces for visual foot contact (PlayCanvas CharacterGrounding), before batching merges them.
  const surfaces: GroundSurface[] = [];
  const visible = (o: Object3D) => { for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
  data.nodes.forEach((node, i) => {
    if (!node.shape || !/(?:floor|rug|runner|mat)$/i.test(node.name) || !visible(objects[i])) return;
    const box = new Box3().setFromObject(objects[i]);
    surfaces.push({minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y, oval: node.shape.type === 'cylinder'});
  });
  // Props the player picks up, uses or that change state stay individual meshes.
  const keyOf = (o: Object3D) => { for (let p: Object3D | null = o; p; p = p.parent) { const key = p.userData.world?.key as string | undefined; if (key) return key; } return undefined; };
  const batching = batch ? batchStatic(root, mesh => /^(Cleanup props|Daily routines)\//.test(keyOf(mesh) ?? '')) : {batches: [], merged: 0, kept: 0};
  let meshes = 0, triangles = 0;
  root.traverse(o => {
    o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.layers.mask !== 0) { meshes++; const g = mesh.geometry; triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3; }
  });
  for (const p of problems) console.error('World problem:', p);
  return {region, root, data, problems, surfaces, stats: {nodes: data.nodes.length, meshes, triangles, hiddenNodes, batches: batching.batches.length, batchedMeshes: batching.merged},
    dispose() { root.removeFromParent(); for (const b of batching.batches) b.geometry.dispose(); library.dispose(); urls.forEach(release); }};
}
