import {AnimationMixer, LoopOnce, LoopRepeat, Matrix4, Object3D, Vector3, type AnimationAction, type AnimationClip, type Bone} from 'three';
import {RUN_SPEED, WALK_SPEED} from '../game/movement';

const GAITS = new Set(['Walk', 'Run', 'CarryWalk', 'CarryRun']);

/** Per-character gait tuning. Arianna's defaults are the game's full-stick speeds. */
export interface AnimatorOptions {
  initialYaw?: number;
  /** Travel speed (m/s) each gait clip is played at full rate for. */
  travel?: Record<string, number>;
  /** Characters without a Run clip (Lilah) always walk. */
  canRun?: boolean;
  /** Playback rate for one-shot actions, e.g. Lilah's 2.4 s PickUp plays in 0.8 s (3x). */
  actionRate?: Record<string, number>;
}
const ARIANNA_TRAVEL: Record<string, number> = {Walk: WALK_SPEED, Run: RUN_SPEED, CarryWalk: WALK_SPEED, CarryRun: RUN_SPEED};

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
  private readonly travel: Record<string, number>;
  private readonly canRun: boolean;
  private readonly actionRate: Record<string, number>;

  constructor(private readonly pivot: Object3D, model: Object3D, clips: AnimationClip[], options: AnimatorOptions = {}) {
    const initialYaw = options.initialYaw ?? 30 * Math.PI / 180;
    this.travel = options.travel ?? ARIANNA_TRAVEL; this.canRun = options.canRun ?? true; this.actionRate = options.actionRate ?? {};
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

  private action: {name: string; events: {time: number; event: string; fired?: boolean}[]; onEvent?: (event: string) => void; done?: () => void} | null = null;
  get busy() { return this.action !== null; }

  /**
   * Play a one-shot action (0.08 s blend in). Events fire on the clip's own clock, the way
   * gameplay expects (e.g. 'mouth-contact' at 0.65 s of MealBite), then locomotion resumes.
   */
  playAction(name: string, handlers: {onEvent?: (event: string) => void; done?: () => void} = {}, rate = this.actionRate[name] ?? 1) {
    const clip = this.actions.get(name)?.getClip();
    if (!clip) throw Error(`Unknown action ${name}`);
    const events = ((clip.userData?.events ?? []) as {time: number; event: string}[]).map(e => ({...e}));
    this.action = {name, events, ...handlers};
    const a = this.actions.get(name)!;
    a.setLoop(clip.userData?.loop ? LoopRepeat : LoopOnce, Infinity); a.clampWhenFinished = true;
    this.transition(name, .08);
    a.timeScale = rate;
  }
  cancelAction() { this.action = null; }

  update(dt: number, velocity: {x: number; z: number}) {
    if (this.action) {
      const a = this.actions.get(this.action.name)!, clip = a.getClip();
      this.mixer.update(dt);
      for (const e of this.action.events) if (!e.fired && a.time >= e.time) { e.fired = true; this.action.onEvent?.(e.event); }
      if (!clip.userData?.loop && a.time >= clip.duration - 1e-4) { const done = this.action.done; this.action = null; done?.(); }
      return;
    }
    const speed = Math.hypot(velocity.x, velocity.z), moving = speed > .03;
    if (moving) {
      const target = Math.atan2(velocity.x, velocity.z);
      let delta = (target - this.yaw + Math.PI) % (2 * Math.PI); if (delta < 0) delta += 2 * Math.PI; delta -= Math.PI;
      this.yaw += delta * (1 - Math.exp(-this.turnRate * dt));
      this.pivot.rotation.y = this.yaw;
    }
    const run = this.canRun && speed > (this.state.includes('Run') ? 1.05 : 1.3);
    const gait = this.carrying ? (run ? 'CarryRun' : 'CarryWalk') : run ? 'Run' : 'Walk';
    const desired = moving ? gait : this.carrying ? 'CarryIdle' : 'Idle';
    if (desired !== this.state) this.transition(desired, .14);
    const travel = this.travel[desired];
    if (this.current) this.current.timeScale = travel ? Math.min(1, speed / travel) : 1;
    this.mixer.update(dt);
  }

  /** Turn gently toward a floor point while standing (rate: 1/s time constant). */
  turnToward(x: number, z: number, dt: number, rate = 4) {
    const p = this.pivot.getWorldPosition(new Vector3());
    let delta = (Math.atan2(x - p.x, z - p.z) - this.yaw + Math.PI) % (2 * Math.PI); if (delta < 0) delta += 2 * Math.PI; delta -= Math.PI;
    this.yaw += delta * (1 - Math.exp(-rate * dt)); this.pivot.rotation.y = this.yaw;
  }

  /** Face a floor point (used when an action should look at its target). */
  face(x: number, z: number) {
    const p = this.pivot.getWorldPosition(new Vector3());
    this.yaw = Math.atan2(x - p.x, z - p.z); this.pivot.rotation.y = this.yaw;
  }

  snapshot() {
    return {state: this.state, action: this.action?.name ?? null, yaw: this.yaw * 180 / Math.PI, clipTime: this.current?.time ?? 0, playbackRate: this.current?.timeScale ?? 1};
  }
}

/**
 * Held-item attachment point: the midpoint of the two hands in the character's yaw-pivot
 * space, nudged 2.5 cm forward, updated after the pose each frame (PlayCanvas
 * CharacterAnimator carry socket). Props parented here follow the hands exactly.
 */
export class CarrySocket extends Object3D {
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly inverse = new Matrix4();
  constructor(private readonly frame: Object3D, private readonly hands: [Bone, Bone], private readonly forward = .025) {
    super(); this.name = 'Carry socket'; frame.add(this);
  }
  update() {
    this.hands[0].getWorldPosition(this.a); this.hands[1].getWorldPosition(this.b);
    this.a.add(this.b).multiplyScalar(.5);
    this.frame.updateWorldMatrix(true, false);
    this.a.applyMatrix4(this.inverse.copy(this.frame.matrixWorld).invert());
    this.a.z += this.forward;
    this.position.copy(this.a);
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
