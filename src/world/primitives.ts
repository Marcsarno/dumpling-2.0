import {
  BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry,
  type BufferGeometry, type Object3D,
} from 'three';
import {roughnessFromGloss} from './materials';

/** PlayCanvas primitive shapes at their unit sizes (capsule: radius 0.5, total height 2). */
const PRIMITIVES: Record<string, () => BufferGeometry> = {
  box: () => new BoxGeometry(1, 1, 1),
  sphere: () => new SphereGeometry(.5, 16, 16),
  cylinder: () => new CylinderGeometry(.5, .5, 1, 20, 5),
  cone: () => new ConeGeometry(.5, 1, 18, 5),
  plane: () => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  capsule: () => new CapsuleGeometry(.5, 1, 8, 20),
};
const shared = new Map<string, BufferGeometry>();
export function primitive(type: string) {
  let g = shared.get(type);
  if (!g) { g = PRIMITIVES[type](); shared.set(type, g); }
  return g;
}

const paints = new Map<string, MeshStandardMaterial>();
/** A PlayCanvas `material(name, hex)` (gloss 0.15) as a shared three.js material. */
export function paint(hex: string) {
  let m = paints.get(hex);
  if (!m) { m = new MeshStandardMaterial({color: new Color(hex), roughness: roughnessFromGloss(.15, false), metalness: 0}); paints.set(hex, m); }
  return m;
}

export type Triple = [number, number, number];
/** PlayCanvas `primitives(app, parent)` helper: returns a shape builder under `parent`. */
export function shapes(parent: Object3D) {
  return (name: string, type: keyof typeof PRIMITIVES, position: Triple, scale: Triple, hex: string, shadows = true) => {
    const mesh = new Mesh(primitive(type), paint(hex));
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = shadows; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
}
