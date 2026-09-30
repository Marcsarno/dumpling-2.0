import {Quaternion, Vector3, type AnimationClip, type Object3D} from 'three';
import {Poser, recorder} from './pose';
import {aim, armIK, roll, softWrist} from './ik';

/**
 * Keyed action motions, baked at load onto Arianna's existing bones.
 *
 * Why this replaces the PlayCanvas poses: those were 2–3 whole-body keyframes blended
 * linearly, with arms aimed by IK but hands left at whatever angle they had, so meals and
 * pick-ups read as stiff snaps. Here each key sets goals (hand points in metres, torso
 * lean, head look, seat/crouch), goals move on smooth Catmull-Rom arcs with eased timing,
 * forearms roll so fists face the right way, wrists use the soft-wrist rule, and a small
 * breath keeps her alive during holds. Elbows stay close to the body (coat guard: the
 * jacket stretches into a "bat wing" when the upper arms lift sideways).
 *
 * Coordinates are her own: metres from the floor between her feet, +X to her left,
 * +Y up, +Z forward.
 */
type V3 = [number, number, number];
export interface ArmKey {
  /** Hand target, or 'rest' (hanging) / 'carry' (the authored two-hand carry hold). */
  at: V3 | 'rest' | 'carry' | {mouth: V3};
  /** Elbow bend direction; defaults to down, slightly back and out. */
  pole?: V3;
  /** Forearm roll in degrees (+ turns the thumb outward on either side). */
  roll?: number;
}
export interface PoseKey {
  t: number;
  /** Easing of the segment arriving at this key. */
  ease?: 'inOut' | 'out' | 'in' | 'linear';
  hips?: V3;
  /** 0 standing, 1 seated on a chair (thighs level, shins down). */
  seat?: number;
  /** 0 standing, 1 knees bent with feet planted. */
  crouch?: number;
  /** Forward lean in degrees, spread over the spine. */
  lean?: number;
  /** 0 upright, 1 lying on her back (head toward -Z, face up). */
  recline?: number;
  /** 0 legs down, 1 legs straight out in front (sitting up in bed). */
  legsForward?: number;
  /** Knee bend in degrees, used with recline / legsForward. */
  knees?: number;
  /** Head look [down, turn-left] in degrees. */
  head?: [number, number];
  left?: ArmKey;
  right?: ArmKey;
}
export interface ActionSpec { name: string; duration: number; loop?: boolean; keys: PoseKey[]; events?: {time: number; event: string}[]; breathe?: number }

const FPS = 30;
const EASE = {linear: (t: number) => t, in: (t: number) => t * t * t, out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2};
const DEG = Math.PI / 180;
const SIDES = ['Left', 'Right'] as const;
const ARM_BONES = (side: string) => ['Shoulder', 'Arm', 'ForeArm', 'Hand'].map(p => side + p);

function catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return new Vector3(
    .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    .5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
}

export class ActionBaker {
  private readonly carry = new Map<string, Quaternion>();
  private readonly carryHands: Record<string, Vector3> = {};
  private readonly restHands: Record<string, Vector3> = {};
  private readonly restElbowX: Record<string, number> = {};
  /** Mouth point in the Head bone's own space (measured at rest: 2.5 cm below the joint, 16 cm forward). */
  private readonly mouthInHead: Vector3;
  constructor(private readonly poser: Poser, private readonly root: Object3D, carryClip: AnimationClip, private readonly reference: AnimationClip) {
    poser.restore();
    for (const side of SIDES) {
      this.restHands[side] = this.local(poser.bone(side + 'Hand').getWorldPosition(new Vector3()));
      this.restElbowX[side] = Math.abs(this.local(poser.bone(side + 'ForeArm').getWorldPosition(new Vector3())).x);
    }
    const head = poser.bone('Head'); head.updateMatrixWorld(true);
    this.mouthInHead = this.world(this.local(head.getWorldPosition(new Vector3())).add(new Vector3(0, -.025, .16))).applyMatrix4(head.matrixWorld.clone().invert());
    poser.sample(carryClip, 0);
    for (const side of SIDES) {
      for (const n of ARM_BONES(side)) this.carry.set(n, poser.bone(n).quaternion.clone());
      this.carryHands[side] = this.local(poser.bone(side + 'Hand').getWorldPosition(new Vector3()));
    }
    poser.restore();
  }
  private local(world: Vector3) { this.root.updateMatrixWorld(true); return world.clone().applyMatrix4(this.root.matrixWorld.clone().invert()); }
  private world(local: Vector3) { this.root.updateMatrixWorld(true); return local.clone().applyMatrix4(this.root.matrixWorld); }
  private tilt(bone: string, axis: Vector3, radians: number) {
    if (!radians) return;
    const b = this.poser.bone(bone);
    const worldAxis = axis.clone().transformDirection(this.root.matrixWorld);
    this.poser.setWorld(bone, new Quaternion().setFromAxisAngle(worldAxis, radians).multiply(this.poser.world(bone)));
    void b;
  }

  /** Interpolated goals at time t. */
  /** Current mouth position in her own coordinates (follows lean and head tilt). */
  private mouth() { const head = this.poser.bone('Head'); head.updateMatrixWorld(true); return this.local(this.mouthInHead.clone().applyMatrix4(head.matrixWorld)); }
  private state(spec: ActionSpec, t: number, mouth = new Vector3(0, 1, .16)) {
    const keys = spec.keys;
    let i = keys.findIndex(k => k.t >= t); if (i <= 0) i = i === 0 ? 1 : keys.length - 1;
    const a = keys[i - 1], b = keys[i], raw = Math.min(1, Math.max(0, (t - a.t) / Math.max(1e-6, b.t - a.t)));
    const u = EASE[b.ease ?? 'inOut'](raw), mix = (x = 0, y = 0) => x + (y - x) * u;
    const num = (f: (k: PoseKey) => number | undefined) => mix(f(a), f(b));
    const arm = (side: typeof SIDES[number]) => {
      const pick = (k: PoseKey) => k[side === 'Left' ? 'left' : 'right'] ?? {at: 'rest' as const};
      const point = (k: PoseKey) => { const at = pick(k).at; return at === 'rest' ? this.restHands[side] : at === 'carry' ? this.carryHands[side] : Array.isArray(at) ? new Vector3(...at) : mouth.clone().add(new Vector3(...at.mouth)); };
      const weight = (k: PoseKey, kind: 'ik' | 'carry') => { const at = pick(k).at; return kind === 'carry' ? +(at === 'carry') : +(typeof at === 'object'); };
      const k0 = keys[Math.max(0, i - 2)], k3 = keys[Math.min(keys.length - 1, i + 1)];
      const pa = pick(a), pb = pick(b);
      const pole = new Vector3(...(pa.pole ?? defaultPole(side))).lerp(new Vector3(...(pb.pole ?? defaultPole(side))), u);
      return {target: catmull(point(k0), point(a), point(b), point(k3), u), pole, roll: mix(pa.roll, pb.roll),
        ik: mix(weight(a, 'ik'), weight(b, 'ik')), carry: mix(weight(a, 'carry'), weight(b, 'carry'))};
    };
    return {hips: new Vector3(num(k => k.hips?.[0]), num(k => k.hips?.[1]), num(k => k.hips?.[2])), seat: num(k => k.seat), crouch: num(k => k.crouch),
      recline: num(k => k.recline), legsForward: num(k => k.legsForward), knees: num(k => k.knees),
      lean: num(k => k.lean), headDown: num(k => k.head?.[0]), headTurn: num(k => k.head?.[1]), Left: arm('Left'), Right: arm('Right')};
  }

  bake(spec: ActionSpec): AnimationClip {
    const poser = this.poser, rec = recorder(this.reference, poser.bones), frames = Math.max(2, Math.round(spec.duration * FPS));
    const right = new Vector3(1, 0, 0), vertical = new Vector3(0, 1, 0);
    const breathPeriod = spec.loop ? spec.duration / Math.max(1, Math.round(spec.duration / 3.4)) : 3.4;
    const times: number[] = [];
    for (let f = 0; f <= frames; f++) {
      const t = f === frames && spec.loop ? 0 : spec.duration * f / frames, s = this.state(spec, t);
      poser.restore();
      const hips = poser.bone('Hips'), feet = SIDES.map(side => ({side, p: poser.bone(side + 'Foot').getWorldPosition(new Vector3()), q: poser.world(side + 'Foot')}));
      hips.position.add(s.hips.clone().divide(hips.parent!.getWorldScale(new Vector3()))); hips.updateMatrixWorld(true);
      // Lying back rotates the whole body about the hips; legs can fold out in front and bend at the knee.
      const lying = s.recline > 0 || s.legsForward > 0;
      if (s.recline) this.tilt('Hips', right, -90 * s.recline * DEG);
      if (lying) for (const side of SIDES) {
        this.tilt(side + 'UpLeg', right, (-90 * s.legsForward - s.knees / 2) * DEG);
        this.tilt(side + 'Leg', right, s.knees * DEG);
      }
      // Legs: seated (thighs forward, shins down) and/or crouched (feet stay planted).
      for (const {side, p, q} of lying ? [] : feet) {
        const thigh = side + 'UpLeg', shin = side + 'Leg', foot = side + 'Foot';
        const base = [thigh, shin, foot].map(n => poser.bone(n).quaternion.clone());
        if (s.seat > 0) {
          const hip = poser.bone(thigh).getWorldPosition(new Vector3()), upper = hip.distanceTo(poser.bone(shin).getWorldPosition(new Vector3()));
          const lower = poser.bone(shin).getWorldPosition(new Vector3()).distanceTo(poser.bone(foot).getWorldPosition(new Vector3()));
          aim(poser, thigh, shin, hip.clone().add(this.world(new Vector3(0, -.04, upper)).sub(this.world(new Vector3()))));
          const knee = poser.bone(shin).getWorldPosition(new Vector3());
          aim(poser, shin, foot, knee.clone().add(this.world(new Vector3(0, -lower, .035)).sub(this.world(new Vector3()))));
          const seated = [thigh, shin, foot].map(n => poser.bone(n).quaternion.clone());
          [thigh, shin, foot].forEach((n, k) => { poser.bone(n).quaternion.copy(base[k]).slerp(seated[k], s.seat); poser.bone(n).updateMatrixWorld(true); });
        } else if (s.hips.y < 0 || s.crouch > 0) {
          // Keep the foot where it stood; knee bends forward.
          const hip = poser.bone(thigh).getWorldPosition(new Vector3()), knee0 = poser.bone(shin).getWorldPosition(new Vector3());
          const upper = hip.distanceTo(knee0), lower = knee0.distanceTo(p), delta = p.clone().sub(hip), length = Math.min(delta.length(), upper + lower - .001); delta.normalize();
          const forward = new Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
          const bend = forward.sub(delta.clone().multiplyScalar(forward.dot(delta))).normalize(), along = (upper * upper - lower * lower + length * length) / (2 * length);
          aim(poser, thigh, shin, hip.clone().addScaledVector(delta, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along))));
          aim(poser, shin, foot, p); poser.setWorld(foot, q);
        }
      }
      // Torso: forward lean spread over the spine, plus a gentle breath.
      const breath = (spec.breathe ?? 1) * .9 * Math.sin(2 * Math.PI * t / breathPeriod);
      [['Spine02', .4], ['Spine01', .35], ['Spine', .25]].forEach(([n, share]) => this.tilt(n as string, right, ((s.lean * (share as number)) + breath * (share as number)) * DEG));
      this.tilt('neck', right, s.headDown * .4 * DEG); this.tilt('Head', right, s.headDown * .6 * DEG);
      this.tilt('neck', vertical, s.headTurn * .4 * DEG); this.tilt('Head', vertical, s.headTurn * .6 * DEG);
      // Arms: base → carry hold → IK goal, each blended by its eased weight. Goals are resolved
      // now that the torso and head are placed, so mouth-relative targets follow the head.
      const arms = this.state(spec, t, this.mouth());
      for (const side of SIDES) {
        const a = arms[side], names = ARM_BONES(side), base = names.map(n => poser.bone(n).quaternion.clone());
        const carried = names.map(n => this.carry.get(n)!.clone());
        let solved = base;
        if (a.ik > 0) {
          names.forEach((n, k) => { poser.bone(n).quaternion.copy(base[k]).slerp(carried[k], a.carry / Math.max(1e-6, 1 - a.ik + a.carry)); });
          poser.bone(side + 'Shoulder').updateMatrixWorld(true);
          const limitX = this.restElbowX[side] + .03, sign = side === 'Left' ? 1 : -1;
          armIK(poser, side, this.world(a.target), this.world(new Vector3(...a.pole.toArray())).sub(this.world(new Vector3())), elbow => {
            const l = this.local(elbow); if (l.x * sign > limitX) l.x = sign * limitX; return this.world(l);
          });
          roll(poser, side + 'ForeArm', a.roll * (side === 'Left' ? -1 : 1));
          softWrist(poser, side, .3);
          solved = names.map(n => poser.bone(n).quaternion.clone());
        }
        names.forEach((n, k) => {
          const q = base[k].clone().slerp(carried[k], Math.min(1, a.carry));
          poser.bone(n).quaternion.copy(q.slerp(solved[k], Math.min(1, a.ik)));
        });
        poser.bone(side + 'Shoulder').updateMatrixWorld(true);
      }
      rec.capture(); times.push(spec.duration * f / frames);
    }
    poser.restore();
    const clip = rec.clip(spec.name, times);
    clip.userData = {events: spec.events ?? [], loop: !!spec.loop, generated: 'actions.ts'};
    return clip;
  }
}

const defaultPole = (side: 'Left' | 'Right'): V3 => [side === 'Left' ? .35 : -.35, -1, -.35];
