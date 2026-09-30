import {Box3, Matrix4, Vector3, type Object3D} from 'three';
import type {CleanupItem, Triple} from './cleanupProps';

/**
 * Held items (PlayCanvas CarrySystem): an item is re-parented to the carry socket between
 * Arianna's hands, gripped at its `carryGrip` (or the centre of its bounds), and set back
 * down at an exact position when placed.
 */
export class CarrySystem {
  item: CleanupItem | null = null;
  constructor(readonly socket: Object3D) {}

  pickUp(item: CleanupItem) {
    if (this.item) return false;
    this.item = item;
    const o = item.object;
    let grip: Vector3;
    if (item.carryGrip) grip = new Vector3(...item.carryGrip);
    else {
      o.updateMatrixWorld(true);
      const box = new Box3().setFromObject(o);
      grip = box.isEmpty() ? new Vector3() : box.getCenter(new Vector3()).applyMatrix4(new Matrix4().copy(o.matrixWorld).invert());
    }
    const scale = item.carriedScale ?? 1;
    this.socket.add(o); o.scale.setScalar(scale); o.position.copy(grip.multiplyScalar(-scale)); o.rotation.set(0, 0, 0);
    return true;
  }

  release(parent: Object3D, position: Triple) {
    const item = this.item;
    if (!item) return null;
    parent.add(item.object); item.object.scale.setScalar(1); item.object.position.set(...position); item.object.rotation.set(0, 0, 0);
    this.item = null;
    return item;
  }
}
