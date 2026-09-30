import {AnimationMixer, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D} from 'three';
import {RUN_SPEED, WALK_SPEED} from '../game/movement';

const GAITS = new Set(['Walk', 'Run', 'CarryWalk', 'CarryRun']);
const TRAVEL: Record<string, number> = {Walk: WALK_SPEED, Run: RUN_SPEED, CarryWalk: WALK_SPEED, CarryRun: RUN_SPEED};

/**
 * Locomotion for a character on its existing rig: one mixer action per clip, short
 * crossfades (0.14 s, 0.08 s into actions) that keep the stride phase between gaits, and
 * the owner-approved relaxed cadence (playback = min(1, speed / clip travel speed)).
 * Run engages above 1.3 m/s and holds down to 1.05 m/s.
 *
 * Upgrade: facing turns quickly but smoothly instead of snapping every frame, which
 * removed analog-stick jitter; the idle turn toward a target keeps PlayCanvas's rate.
 */
export class CharacterAnimator {
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  state = '';
  yaw: number;
  carrying = false;
  turnRate = 22;

  constructor(private readonly pivot: Object3D, model: Object3D, clips: AnimationClip[], initialYaw = 30 * Math.PI / 180) {
    this.mixer = new AnimationMixer(model);
    for (const clip of clips) { const a = this.mixer.clipAction(clip); a.setLoop(LoopRepeat, Infinity); this.actions.set(clip.name, a); }
    this.yaw = initialYaw; pivot.rotation.y = initialYaw;
    this.transition('Idle', 0);
  }

  private transition(name: string, fade: number) {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;
    const previous = this.current;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    if (previous && GAITS.has(this.state) && GAITS.has(name)) next.time = (previous.time / previous.getClip().duration % 1) * next.getClip().duration;
    next.play();
    if (previous && fade > 0) next.crossFadeFrom(previous, fade, false); else previous?.stop();
    this.current = next; this.state = name;
  }

  update(dt: number, velocity: {x: number; z: number}) {
    const speed = Math.hypot(velocity.x, velocity.z), moving = speed > .03;
    if (moving) {
      const target = Math.atan2(velocity.x, velocity.z);
      let delta = (target - this.yaw + Math.PI) % (2 * Math.PI); if (delta < 0) delta += 2 * Math.PI; delta -= Math.PI;
      this.yaw += delta * (1 - Math.exp(-this.turnRate * dt));
      this.pivot.rotation.y = this.yaw;
    }
    const run = speed > (this.state.includes('Run') ? 1.05 : 1.3);
    const gait = this.carrying ? (run ? 'CarryRun' : 'CarryWalk') : run ? 'Run' : 'Walk';
    const desired = moving ? gait : 'Idle';
    if (desired !== this.state) this.transition(desired, .14);
    const travel = TRAVEL[desired];
    if (this.current) this.current.timeScale = travel ? Math.min(1, speed / travel) : 1;
    this.mixer.update(dt);
  }

  snapshot() {
    return {state: this.state, yaw: this.yaw * 180 / Math.PI, clipTime: this.current?.time ?? 0, playbackRate: this.current?.timeScale ?? 1};
  }
}

/** Visual-only ground contact on flat floors and thin rugs (PlayCanvas CharacterGrounding). */
export interface GroundSurface { minX: number; maxX: number; minZ: number; maxZ: number; top: number; oval: boolean }
export function groundHeight(surfaces: GroundSurface[], x: number, z: number) {
  let ground = 0;
  for (const s of surfaces) {
    const cx = (s.minX + s.maxX) / 2, cz = (s.minZ + s.maxZ) / 2, u = (x - cx) / ((s.maxX - s.minX) / 2), v = (z - cz) / ((s.maxZ - s.minZ) / 2);
    if (s.oval ? u * u + v * v <= 1 : Math.abs(u) <= 1 && Math.abs(v) <= 1) ground = Math.max(ground, s.top);
  }
  return ground + .002;
}
