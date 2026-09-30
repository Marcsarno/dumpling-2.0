import {BufferAttribute, Float32BufferAttribute, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Object3D} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {setExterior} from '../engine/interiorLights';

/**
 * Static scenery batching. Every visible, opaque, non-interactive mesh is baked into
 * world space and merged with others that share a *surface* — the material with its
 * colour factored out — plus shadow flags and an 8 m floor cell. The flat paint colour
 * moves into a vertex colour, so the dozens of pastel materials that differ only in
 * colour become a handful of draws. Cells keep view and shadow culling useful.
 * Interactive props stay individual so gameplay can move or hide them.
 */
const CELL = 8;

export interface BatchResult { batches: Mesh[]; merged: number; kept: number; surfaces: number }

/** Everything that changes shading except the base colour. */
function surfaceKey(m: MeshStandardMaterial) {
  const map = m.map ? `${m.map.source.uuid}:${m.map.repeat.x},${m.map.repeat.y}:${m.map.offset.x},${m.map.offset.y}` : '-';
  return [m.type, m.roughness.toFixed(3), m.metalness.toFixed(3), map, m.side, m.emissive.getHexString(), m.emissiveIntensity, m.alphaTest, m.depthWrite].join('|');
}

export function batchStatic(root: Object3D, isDynamic: (mesh: Mesh) => boolean): BatchResult {
  root.updateMatrixWorld(true);
  type Group = {material: MeshStandardMaterial; cast: boolean; receive: boolean; geometries: BufferGeometry[]; sources: Mesh[]};
  const groups = new Map<string, Group>();
  const surfaces = new Map<string, MeshStandardMaterial>();
  let kept = 0;
  const visibleInHierarchy = (o: Object3D) => { for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
  root.traverse(o => {
    const mesh = o as Mesh, material = mesh.material as Material;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material) || !(material as MeshStandardMaterial).isMeshStandardMaterial || material.transparent || !visibleInHierarchy(mesh) || isDynamic(mesh)) { kept++; return; }
    const m = material as MeshStandardMaterial, g = mesh.geometry;
    const hasUv = !!g.getAttribute('uv');
    if (m.map && !hasUv) { kept++; return; }
    const surface = surfaceKey(m);
    let shared = surfaces.get(surface);
    if (!shared) { shared = m.clone(); shared.name = `surface:${m.name}`; shared.color.set(1, 1, 1); shared.vertexColors = true; surfaces.set(surface, shared); }
    const centre = (g.boundingSphere ?? (g.computeBoundingSphere(), g.boundingSphere!)).center.clone().applyMatrix4(mesh.matrixWorld);
    const key = `${surface}|${mesh.castShadow}|${mesh.receiveShadow}|${hasUv}|${Math.floor(centre.x / CELL)},${Math.floor(centre.z / CELL)}`;
    let group = groups.get(key);
    if (!group) { group = {material: shared, cast: mesh.castShadow, receive: mesh.receiveShadow, geometries: [], sources: []}; groups.set(key, group); }
    group.geometries.push(bake(mesh, m, hasUv)); group.sources.push(mesh);
  });
  const batches: Mesh[] = [];
  let merged = 0;
  for (const group of groups.values()) {
    // Garden and house share batches; garden vertices carry the outdoor flag (interiorLights.ts).
    if (group.sources.some(s => s.userData.exterior)) group.geometries.forEach((g, i) => setExterior(g, !!group.sources[i].userData.exterior));
    const geometry = mergeGeometries(group.geometries, false);
    for (const g of group.geometries) g.dispose();
    if (!geometry) { kept += group.sources.length; continue; }
    const batch = new Mesh(geometry, group.material);
    batch.name = `batch:${group.material.name}`;
    batch.castShadow = group.cast; batch.receiveShadow = group.receive;
    batch.matrixAutoUpdate = false; batch.matrixWorldAutoUpdate = false;
    batch.userData.batchedFrom = group.sources.length;
    // Layers are per object: a merged source stops drawing (and casting) while any child
    // nodes it carries keep rendering; childless sources leave the graph entirely.
    for (const source of group.sources) { if (source.children.length) source.layers.disableAll(); else source.removeFromParent(); }
    root.add(batch); batch.updateMatrixWorld(true);
    batches.push(batch); merged += group.sources.length;
  }
  return {batches, merged, kept, surfaces: surfaces.size};
}

/** World-space copy with a uniform attribute layout: position, normal, optional uv, colour. */
function bake(mesh: Mesh, material: MeshStandardMaterial, withUv: boolean) {
  const source = mesh.geometry, count = source.getAttribute('position').count;
  const g = source.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  if (!withUv) g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.morphAttributes = {};
  g.applyMatrix4(mesh.matrixWorld);
  // Paint colour (linear) × any existing vertex colour.
  const colour = new Float32Array(count * 3), existing = material.vertexColors ? source.getAttribute('color') : undefined, c = material.color;
  for (let i = 0; i < count; i++) {
    colour[i * 3] = c.r * (existing ? existing.getX(i) : 1);
    colour[i * 3 + 1] = c.g * (existing ? existing.getY(i) : 1);
    colour[i * 3 + 2] = c.b * (existing ? existing.getZ(i) : 1);
  }
  g.setAttribute('color', new Float32BufferAttribute(colour, 3));
  if (!g.index) g.setIndex(Array.from({length: count}, (_, i) => i));
  // A mirroring transform flips triangle winding; restore it so front faces stay front.
  if (mesh.matrixWorld.determinant() < 0) {
    const idx = g.index!.array, flipped = new Uint32Array(idx.length);
    for (let i = 0; i < idx.length; i += 3) { flipped[i] = idx[i]; flipped[i + 1] = idx[i + 2]; flipped[i + 2] = idx[i + 1]; }
    g.setIndex(new BufferAttribute(flipped, 1));
  }
  return g;
}
