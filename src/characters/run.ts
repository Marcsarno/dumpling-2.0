import {Quaternion, type AnimationClip} from 'three';
import {Poser, mirror, recorder, swingTwist} from './pose';

/**
 * Arianna's run. The owner likes the PlayCanvas balanced run (src/components/RunningPose.ts),
 * so its body is kept: the torso lean is averaged with the mirrored half stride, the hips are
 * centred, and the clean right arm is reflected onto the left half a stride later.
 *
 * Upgrade: the wrists. PlayCanvas left the right hand as authored (clamped at 12°) and pinned
 * the left hand to one calibrated pose, so the fists flick and differ side to side. Here both
 * hands share one rule: roll comes from each hand's own rest pose, and only a small share of
 * the authored bend is kept, trailing the arm slightly for a relaxed, follow-through wrist.
 */
export const RUN_WRIST = {keepBend: .3, maxBendDegrees: 10, lagFrames: 2};
const COUNT = 40;
const TORSO = ['Hips', 'Spine02', 'Spine01', 'Spine'];
const ARM = ['Shoulder', 'Arm', 'ForeArm', 'Hand'];

export function balancedRun(poser: Poser, authored: AnimationClip): AnimationClip {
  const duration = authored.duration, rec = recorder(authored, poser.bones);
  const restHipsX = poser.restPosition('Hips').x;
  const armNames = ['Left', 'Right'].flatMap(side => ARM.map(p => side + p));
  const bendAngles: number[] = [];
  const bends: Record<'Left' | 'Right', Quaternion[]> = {Left: [], Right: []};
  for (let f = 0; f <= COUNT; f++) {
    const phase = f === COUNT ? 0 : f / COUNT;
    poser.sample(authored, ((phase + .5) % 1) * duration);
    const opposite = Object.fromEntries([...TORSO, ...armNames].map(n => [n, poser.delta(n)]));
    const oppositeX = poser.bone('Hips').position.x;
    poser.sample(authored, phase * duration);
    const central = TORSO.map(n => new Quaternion().slerpQuaternions(poser.delta(n), mirror(opposite[n]), .5));
    const hips = poser.bone('Hips'); hips.position.x = (hips.position.x - oppositeX) * .5 + restHipsX; hips.updateMatrixWorld(true);
    TORSO.forEach((n, i) => poser.setWorld(n, central[i].clone().multiply(poser.bind.get(n)!)));
    for (const part of ARM) poser.setWorld('Left' + part, mirror(opposite['Right' + part].clone().multiply(poser.bind.get('Right' + part)!)));
    // Keep each hand's bend for the wrist pass below.
    for (const side of ['Left', 'Right'] as const) bends[side].push(swingTwist(poser.bone(side + 'Hand').quaternion).swing);
    rec.capture();
  }
  // Wrist pass: rest roll, softened and slightly lagging bend.
  for (const side of ['Left', 'Right'] as const) {
    const channel = rec.channels.findIndex(c => c.bone.name === side + 'Hand' && c.property === 'quaternion');
    const {twist: restTwist} = swingTwist(poser.restLocal(side + 'Hand'));
    rec.frames.forEach((frame, f) => {
      const lagged = bends[side][(f - RUN_WRIST.lagFrames + COUNT) % COUNT];
      let angle = 2 * Math.acos(Math.min(1, Math.abs(lagged.w))) * 180 / Math.PI;
      const keep = Math.min(RUN_WRIST.keepBend, RUN_WRIST.maxBendDegrees / Math.max(angle, 1e-3));
      const bend = new Quaternion().slerp(lagged, keep);
      angle *= keep; bendAngles.push(angle);
      frame[channel] = bend.multiply(restTwist).toArray();
    });
  }
  poser.restore();
  const clip = rec.clip('Run', rec.frames.map((_, i) => i * duration / COUNT));
  clip.userData = {maxWristBendDegrees: Math.max(...bendAngles)};
  return clip;
}

