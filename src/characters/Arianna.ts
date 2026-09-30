import {Group, type AnimationClip, type Bone, type Material, type Mesh, type Object3D, type SkinnedMesh, type Texture, type WebGLRenderer} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/**
 * Arianna, loaded exactly as shipped. PROTECTED (CLAUDE.md): her GLB is byte-identical
 * to the original (hash-gated at build), her mesh, materials, rig and 2048×2048 colour
 * and normal maps are used as GLTFLoader produces them. Nothing here rebuilds her
 * material, resizes or compresses a texture, or edits geometry or skin weights.
 * Motion is applied only by animating her existing bones.
 */
export const ARIANNA = {
  url: 'assets/characters/arianna/arianna.glb',
  /** character.json display height ÷ the rig's rest height (MeshyGameplayAdapter). */
  displayHeight: 1.38345, restHeight: 1.20309758,
  triangles: 14694, joints: 28, textureSize: 2048,
} as const;

export interface LoadedCharacter {
  /** Placement root: position/yaw in the world. */
  root: Group;
  /** The untouched GLB scene, scaled to display height under the root. */
  model: Object3D;
  mesh: SkinnedMesh;
  bones: Map<string, Bone>;
  clips: AnimationClip[];
}

export async function loadArianna(renderer: WebGLRenderer, base = import.meta.env.BASE_URL): Promise<LoadedCharacter> {
  const gltf = await new GLTFLoader().loadAsync(base + ARIANNA.url);
  const model = gltf.scene, scale = ARIANNA.displayHeight / ARIANNA.restHeight;
  model.scale.setScalar(scale);
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
      // Sharper maps at the isometric grazing angle; sampling only, the texture data is unchanged.
      for (const material of ([] as Material[]).concat(m.material))
        for (const value of Object.values(material)) if ((value as Texture)?.isTexture) (value as Texture).anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  });
  if (!mesh) throw Error('Arianna GLB has no skinned mesh.');
  const root = new Group(); root.name = 'Arianna'; root.add(model);
  return {root, model, mesh, bones, clips: gltf.animations};
}

/** Runtime evidence for the protected-quality rule (the three.js equivalent of arianna-quality-browser). */
export function ariannaQuality(character: LoadedCharacter, renderer: WebGLRenderer) {
  const {mesh} = character, material = mesh.material as Material & {map?: Texture; normalMap?: Texture};
  const size = (t?: Texture) => t ? [(t.image as {width: number}).width, (t.image as {height: number}).height] : null;
  const index = mesh.geometry.index;
  return {
    pixelRatio: renderer.getPixelRatio(), devicePixelRatio: window.devicePixelRatio,
    colorMap: size(material.map), normalMap: size(material.normalMap),
    triangles: index ? index.count / 3 : mesh.geometry.getAttribute('position').count / 3,
    joints: mesh.skeleton.bones.length,
    tangents: !!mesh.geometry.getAttribute('tangent'),
    clips: character.clips.map(c => ({name: c.name, duration: +c.duration.toFixed(4), tracks: c.tracks.length})),
  };
}
