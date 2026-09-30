import {Group, type AnimationClip, type Bone, type Material, type Mesh, type Object3D, type SkinnedMesh, type Texture, type WebGLRenderer} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/**
 * Family characters, loaded exactly as shipped. Arianna and Lilah are PROTECTED
 * (CLAUDE.md): their GLBs are byte-identical to the originals (hash-gated at build) and
 * their mesh, materials, rig and textures are used as GLTFLoader produces them. Nothing
 * here rebuilds a material, resizes or compresses a texture, or edits geometry or skin
 * weights. Motion is applied only by animating each character's existing bones.
 */
export interface CharacterProfile {
  id: string;
  url: string;
  displayHeight: number;
  restHeight: number;
  protected: boolean;
  expect: {triangles: number; joints: number; maps: Partial<Record<'map' | 'normalMap' | 'roughnessMap', number>>};
}
const ARIANNA_HEIGHT = 1.38345; // characters/arianna/character.json
export const ARIANNA: CharacterProfile = {id: 'arianna', url: 'assets/characters/arianna/arianna.glb', displayHeight: ARIANNA_HEIGHT, restHeight: 1.20309758, protected: true,
  expect: {triangles: 15822, joints: 28, maps: {map: 2048, normalMap: 2048}}}; // 14,694 original + armpit panels
/** Lilah is 0.625 of Arianna's height (PlayCanvas Lilah.ts); owner-approved 1024 metallic/roughness map. */
export const LILAH: CharacterProfile = {id: 'lilah', url: 'assets/characters/lilah/lilah.glb', displayHeight: ARIANNA_HEIGHT * .625, restHeight: 1.03, protected: true,
  expect: {triangles: 11271, joints: 25, maps: {map: 2048, roughnessMap: 1024}}};

export interface LoadedCharacter {
  profile: CharacterProfile;
  /** Placement root: position/yaw in the world. */
  root: Group;
  /** The untouched GLB scene, scaled to display height under the root. */
  model: Object3D;
  mesh: SkinnedMesh;
  bones: Map<string, Bone>;
  clips: AnimationClip[];
}

export async function loadCharacter(profile: CharacterProfile, renderer: WebGLRenderer, base = import.meta.env.BASE_URL): Promise<LoadedCharacter> {
  const gltf = await new GLTFLoader().loadAsync(base + profile.url);
  const model = gltf.scene;
  model.scale.setScalar(profile.displayHeight / profile.restHeight);
  let mesh: SkinnedMesh | undefined;
  const bones = new Map<string, Bone>();
  model.traverse(o => {
    if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh;
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = true;
      // Skinned bounds come from the bind pose; action poses (sleep, crouch) would be culled.
      m.frustumCulled = false;
      // Sharper maps at the isometric grazing angle: sampling only, texture data unchanged.
      for (const material of ([] as Material[]).concat(m.material))
        for (const value of Object.values(material)) if ((value as Texture)?.isTexture) (value as Texture).anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  });
  if (!mesh) throw Error(`${profile.id} GLB has no skinned mesh.`);
  const root = new Group(); root.name = profile.id; root.add(model);
  return {profile, root, model, mesh, bones, clips: gltf.animations};
}
export const loadArianna = (renderer: WebGLRenderer, base?: string) => loadCharacter(ARIANNA, renderer, base);

/** Runtime evidence for the protected-quality rule (three.js equivalent of arianna-quality-browser). */
export function characterQuality(character: LoadedCharacter, renderer: WebGLRenderer) {
  const {mesh} = character, material = mesh.material as Material & Record<string, Texture | undefined>;
  const size = (t?: Texture) => t ? [(t.image as {width: number}).width, (t.image as {height: number}).height] : null;
  const index = mesh.geometry.index;
  const result = {
    id: character.profile.id, protected: character.profile.protected,
    pixelRatio: renderer.getPixelRatio(), devicePixelRatio: window.devicePixelRatio,
    colorMap: size(material.map), normalMap: size(material.normalMap), roughnessMap: size(material.roughnessMap),
    triangles: index ? index.count / 3 : mesh.geometry.getAttribute('position').count / 3,
    joints: mesh.skeleton.bones.length, tangents: !!mesh.geometry.getAttribute('tangent'),
    clips: character.clips.map(c => ({name: c.name, duration: +c.duration.toFixed(4), tracks: c.tracks.length})),
    problems: [] as string[],
  };
  const e = character.profile.expect;
  if (result.triangles !== e.triangles) result.problems.push(`triangles ${result.triangles} ≠ ${e.triangles}`);
  if (result.joints !== e.joints) result.problems.push(`joints ${result.joints} ≠ ${e.joints}`);
  for (const [key, px] of Object.entries(e.maps)) { const s = size(material[key]); if (!s || s[0] !== px || s[1] !== px) result.problems.push(`${key} ${s} ≠ ${px}²`); }
  if (result.pixelRatio !== result.devicePixelRatio) result.problems.push('pixel ratio below native');
  return result;
}
export const ariannaQuality = characterQuality;
