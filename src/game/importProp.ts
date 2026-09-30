import {Box3, type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const DEG = Math.PI / 180;

/**
 * A small imported prop (PlayCanvas ImportedProp): the model is turned by `rotation`
 * (degrees), scaled to `height` and set on the floor, centred under `parent`'s origin.
 * The props stay individual meshes so they can be carried, hidden or animated.
 */
export async function importProp(parent: Object3D, url: string, height: number, rotation: [number, number, number] = [0, 0, 0]) {
  const model = (await loader.loadAsync(url)).scene;
  model.traverse(o => { if ((o as {isMesh?: boolean}).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  model.rotation.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG);
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model), k = height / Math.max(1e-6, box.max.y - box.min.y);
  model.scale.setScalar(k);
  model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
  parent.add(model);
  return model;
}
