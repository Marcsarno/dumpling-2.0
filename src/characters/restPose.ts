import {AnimationClip, Euler, Quaternion, Vector3} from 'three';
import type {LoadedCharacter} from './Arianna';
import {Poser, recorder} from './pose';

/** CMU 140_08 resting flex (public/assets/animations/rest/sleep.json), degrees. */
export interface RestMotion {leftKnee: number; rightKnee: number; leftElbow: number; rightElbow: number}
export const LILAH_REST: RestMotion = {leftKnee: 29.15495333333334, rightKnee: 21.213143333333335, leftElbow: 20.247608333333332, rightElbow: 17.978191666666664};

type Part = 'thigh' | 'shin' | 'foot' | 'arm' | 'fore' | 'hand';
/** Bone names on both rig styles: Meshy (LeftUpLeg…) and Rigify (thigh.L, which three.js names thighL). */
function boneNames(character: LoadedCharacter) {
  const meshy = character.bones.has('Hips');
  const meshyPart: Record<Part, string> = {thigh: 'UpLeg', shin: 'Leg', foot: 'Foot', arm: 'Arm', fore: 'ForeArm', hand: 'Hand'};
  const rigifyPart: Record<Part, string> = {thigh: 'thigh', shin: 'shin', foot: 'foot', arm: 'upper_arm', fore: 'forearm', hand: 'hand'};
  return {
    bone: (side: 'Left' | 'Right', part: Part) => meshy ? side + meshyPart[part] : rigifyPart[part] + side[0],
    hips: meshy ? 'Hips' : 'pelvis', chest: meshy ? 'Spine02' : 'chest',
  };
}

/** Rotate a bone (world) so the direction to its child points along `direction`. */
function aimAlong(poser: Poser, bone: string, child: string, direction: Vector3) {
  const b = poser.bone(bone), c = poser.bone(child);
  const from = c.getWorldPosition(new Vector3()).sub(b.getWorldPosition(new Vector3())).normalize();
  poser.setWorld(bone, new Quaternion().setFromUnitVectors(from, direction.clone().normalize()).multiply(poser.world(bone)));
}

/**
 * Sleeping and getting into bed on a character's own rig (PlayCanvas RestingPose.ts
 * sleepingTrack and bedEntryTrack), generated at load. The GLB, mesh and weights are not
 * touched; only bone rotations and the hips' height are keyed.
 *
 * - `Sleep` (4 s loop, 25 frames): lying face-up (+Z forward turns to the sky, head toward
 *   -Z), knees and elbows in the CMU resting flex, a slow breath in the chest and hips.
 * - `SleepEnter` (3.2 s, keys at 0/.5/1.2/1.9/3.2 s): reach for the rail, tuck a knee,
 *   sit, recline into Sleep's first frame. Matched to the crib path in familyRules.ts.
 */
export function restClips(character: LoadedCharacter, reference: AnimationClip, motion: RestMotion) {
  const poser = new Poser(character.model, character.bones);
  const names = boneNames(character), hips = poser.bone(names.hips), initial = poser.restPosition(names.hips);
  const sides = [['Left', 1], ['Right', -1]] as const;

  // Sleep: 25 frames over 4 s, the last equal to the first so the loop closes.
  const sleep = recorder(reference, character.bones);
  for (let f = 0; f <= 24; f++) {
    poser.restore();
    const breath = Math.sin(f / 24 * Math.PI * 2) * .003;
    for (const [side, sign] of sides) {
      const knee = (side === 'Left' ? motion.leftKnee : motion.rightKnee) * Math.PI / 180;
      const elbow = (side === 'Left' ? motion.leftElbow : motion.rightElbow) * Math.PI / 180;
      aimAlong(poser, names.bone(side, 'thigh'), names.bone(side, 'shin'), new Vector3(sign * .05, -Math.cos(knee / 2), Math.sin(knee / 2)));
      aimAlong(poser, names.bone(side, 'shin'), names.bone(side, 'foot'), new Vector3(0, -Math.cos(knee / 2), -Math.sin(knee / 2)));
      aimAlong(poser, names.bone(side, 'arm'), names.bone(side, 'fore'), new Vector3(sign * .15, -1, .05));
      aimAlong(poser, names.bone(side, 'fore'), names.bone(side, 'hand'), new Vector3(-sign * .12, -1, Math.sin(elbow) * .4));
    }
    const chest = poser.bone(names.chest);
    chest.quaternion.multiply(new Quaternion().setFromEuler(new Euler(breath * 50 * Math.PI / 180, 0, 0))); chest.updateMatrixWorld(true);
    // Lie back: +Z forward becomes face-up, head toward -Z.
    poser.setWorld(names.hips, new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0)).multiply(poser.world(names.hips)));
    hips.position.set(initial.x, .12 + breath, 0); hips.updateMatrixWorld(true);
    sleep.capture();
  }
  sleep.frames[24] = sleep.frames[0];
  const sleepClip = sleep.clip('Sleep', sleep.frames.map((_, i) => i / 6));
  sleepClip.userData = {loop: true, events: []};

  // SleepEnter: four authored stages, then Sleep's first frame.
  const enter = recorder(reference, character.bones);
  for (let stage = 0; stage < 4; stage++) {
    poser.restore();
    hips.position.set(initial.x, [initial.y, initial.y - .12, .17, .12][stage], initial.z); hips.updateMatrixWorld(true);
    for (const [side, sign] of sides) {
      aimAlong(poser, names.bone(side, 'arm'), names.bone(side, 'fore'),
        stage === 1 ? new Vector3(sign * .2, .25, .8) : stage === 2 ? new Vector3(sign * .25, -.3, .7) : new Vector3(sign * .12, -1, .06));
      aimAlong(poser, names.bone(side, 'fore'), names.bone(side, 'hand'), stage === 1 ? new Vector3(0, .2, .8) : new Vector3(0, -.7, .35));
      const tuck = stage >= 2 ? 1 : stage === 1 && side === 'Left' ? .6 : 0;
      aimAlong(poser, names.bone(side, 'thigh'), names.bone(side, 'shin'), new Vector3(sign * .04, -1 + tuck, tuck));
      aimAlong(poser, names.bone(side, 'shin'), names.bone(side, 'foot'), new Vector3(0, -1, stage >= 2 ? -.15 : 0));
    }
    enter.capture();
  }
  enter.frames.push(sleep.frames[0]);
  const enterClip = enter.clip('SleepEnter', [0, .5, 1.2, 1.9, 3.2]);
  enterClip.userData = {loop: false, events: []};
  poser.dispose();
  return [sleepClip, enterClip];
}
