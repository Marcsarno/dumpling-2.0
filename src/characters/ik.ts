import {Quaternion, Vector3} from 'three';
import type {Poser} from './pose';
import {swingTwist} from './pose';

const up = new Vector3(0, 1, 0);

/** Rotate `bone` (world) so the direction to `child` points at `target`: the minimal, twist-preserving aim. */
export function aim(poser: Poser, bone: string, child: string, target: Vector3) {
  const b = poser.bone(bone), c = poser.bone(child);
  const from = c.getWorldPosition(new Vector3()).sub(b.getWorldPosition(new Vector3())).normalize();
  const to = target.clone().sub(b.getWorldPosition(new Vector3())).normalize();
  poser.setWorld(bone, new Quaternion().setFromUnitVectors(from, to).multiply(poser.world(bone)));
}

/**
 * Two-bone arm IK (law of cosines) to a world hand target, the elbow bending toward
 * `pole`. Unreachable targets stop 2 mm short of full extension. Returns the elbow point.
 */
export function armIK(poser: Poser, side: 'Left' | 'Right', target: Vector3, pole: Vector3, elbowLimit?: (elbow: Vector3) => Vector3) {
  const arm = side + 'Arm', fore = side + 'ForeArm', hand = side + 'Hand';
  const shoulder = poser.bone(arm).getWorldPosition(new Vector3());
  const upper = shoulder.distanceTo(poser.bone(fore).getWorldPosition(new Vector3()));
  const lower = poser.bone(fore).getWorldPosition(new Vector3()).distanceTo(poser.bone(hand).getWorldPosition(new Vector3()));
  const direction = target.clone().sub(shoulder), distance = Math.min(direction.length(), upper + lower - .002);
  direction.normalize();
  const bend = pole.clone().sub(direction.clone().multiplyScalar(pole.dot(direction))).normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  let elbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
  if (elbowLimit) {
    // Keep the elbow on its circle around the shoulder→hand line, just moved toward the limit.
    const wanted = elbowLimit(elbow.clone()), centre = shoulder.clone().addScaledVector(direction, along), radius = elbow.distanceTo(centre);
    const offset = wanted.sub(centre); offset.sub(direction.clone().multiplyScalar(offset.dot(direction)));
    if (offset.lengthSq() > 1e-10) elbow = centre.addScaledVector(offset.normalize(), radius);
  }
  aim(poser, arm, fore, elbow);
  aim(poser, fore, hand, shoulder.clone().addScaledVector(direction, distance));
  return elbow;
}

/** Roll a bone about its own axis (+Y toward its child), degrees. Used for forearm pronation. */
export function roll(poser: Poser, bone: string, degrees: number) {
  if (!degrees) return;
  const b = poser.bone(bone);
  b.quaternion.multiply(new Quaternion().setFromAxisAngle(up, degrees * Math.PI / 180));
  b.updateMatrixWorld(true);
}

/**
 * The soft wrist: the hand keeps its rest roll and only a fraction of its current bend,
 * plus an optional extra bend (degrees about the hand's local X/Z) for gestures.
 */
export function softWrist(poser: Poser, side: 'Left' | 'Right', keep = .3, extra?: {x?: number; z?: number}) {
  const hand = poser.bone(side + 'Hand');
  const {swing} = swingTwist(hand.quaternion), {twist: restTwist} = swingTwist(poser.restLocal(side + 'Hand'));
  const bend = new Quaternion().slerp(swing, keep);
  if (extra) bend.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (extra.x ?? 0) * Math.PI / 180))
    .premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (extra.z ?? 0) * Math.PI / 180));
  hand.quaternion.copy(bend.multiply(restTwist));
  hand.updateMatrixWorld(true);
}
