import {Box3, Group, type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {DayState} from '../systems/DailyClock';
import type {CharacterAnimator, CarrySocket} from '../characters/CharacterAnimator';
import {shapes} from '../world/primitives';
import type {propSpace} from '../world/propSpace';
import {DINNER_LINES, DINNER_MENU, dinnerDue, dinnerFood, type DinnerFood} from './familyRules';
import type {FloorPoint, HousePath} from './HousePath';

type Space = ReturnType<typeof propSpace>;
export type DinnerStage = 'idle' | 'fetch' | 'pickup' | 'carry' | 'place' | 'sitting' | 'seated' | 'standing';
/** Everything dinner needs from Dad (Marc owns the service). */
export interface DinnerHost {
  root: Object3D; animator: CharacterAnimator; socket: CarrySocket;
  planner: () => HousePath; say: (text: string) => void;
  dining: Space; fridge: Space;
}
/** The household side: the saved day, whether it is everyday life, saving, and a HUD note. */
export interface DinnerDay { state: DayState; everyday: boolean; save: () => void; toast: (text: string) => void }

const WALK = 1.05;
/** Children keep 0.6 m from Dad while he walks with dinner (PlayCanvas). */
const ROOM = .6;
const SEATED_Z = 15.1, CHAIR_Z = 15.65;

/**
 * Dad's dinner (PlayCanvas FamilyDinner): once a day in the afternoon (3:30 PM plus a per-day
 * offset) he fetches dinner from the fridge, carries the platter to the dining table and sets
 * it down, saving `dinnerServed` in daily.v1 at once ("Dinner is ready whenever you are,
 * sweetie."). He sits at the south end for a little while, then goes back to his routine. The
 * menu rotates pizza, taco, turkey. A reload restores the platter on the table and he never
 * serves twice. Eating the portions arrives with home meals (slice 7).
 *
 * Upgrades over PlayCanvas: he steps around a child in his way instead of waiting forever;
 * "dinner is ready" also shows as a HUD note, since his bubble is hidden when he is off
 * screen; a dinner missed in the afternoon is served early in the evening; and his sit and
 * stand glides match his clips and ease like his reading chair's.
 */
export class FamilyDinner {
  readonly tray = new Group();
  private readonly models = new Map<DinnerFood, Object3D>();
  ready = false;
  stage: DinnerStage = 'idle';
  private route: FloorPoint[] = [];
  private goal: FloorPoint = {x: 0, z: 0};
  private timer = 0;
  private blocked = 0;
  private retry = 0;
  private excused = false;
  private day = 0;
  serving: DinnerFood = 'pizza';
  readonly stages: DinnerStage[] = [];

  constructor(private readonly host: DinnerHost, base = import.meta.env.BASE_URL) {
    this.tray.name = 'Family dinner'; this.tray.visible = false;
    shapes(this.tray)('Dinner platter', 'cylinder', [0, 0, 0], [.72, .025, .58], '#fff2d9', false);
    const loader = new GLTFLoader();
    void Promise.all(DINNER_MENU.map(async name => {
      const model = (await loader.loadAsync(`${base}assets/food/${name}.glb`)).scene;
      model.traverse(o => { if ((o as {isMesh?: boolean}).isMesh) o.castShadow = true; });
      model.updateMatrixWorld(true);
      // 0.57 m wide, centred, resting 2 cm above the platter (PlayCanvas FamilyDinner).
      const box = new Box3().setFromObject(model), k = .57 / Math.max(1e-6, box.max.x - box.min.x);
      model.scale.setScalar(k);
      model.position.set(-(box.min.x + box.max.x) / 2 * k, .02 - box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
      const holder = new Group(); holder.name = name; holder.add(model); holder.visible = false; this.tray.add(holder);
      this.models.set(name, holder);
    })).then(() => { this.ready = true; this.showServing(); }).catch(e => console.error('Dinner models failed to load', e));
  }

  get active() { return this.stage !== 'idle'; }
  due(d: DinnerDay) { return this.ready && d.everyday && this.retry <= 0 && dinnerDue(d.state); }

  private showServing() { for (const [name, m] of this.models) m.visible = name === this.serving; }
  private table() {
    const p = this.host.dining.point(.55, 14.35);
    this.host.root.parent?.add(this.tray);
    this.tray.position.set(p.x, this.host.dining.height(.99), p.z); this.tray.rotation.set(0, this.host.dining.yaw(0), 0); this.tray.visible = true;
  }
  private setStage(stage: DinnerStage) { this.stage = stage; this.stages.push(stage); if (this.stages.length > 40) this.stages.shift(); }
  private go(point: FloorPoint, stage: DinnerStage) {
    const p = this.host.root.position;
    this.goal = point; this.route = this.host.planner().route({x: p.x, z: p.z}, point); this.blocked = 0; this.setStage(stage);
    return this.route.length > 0;
  }
  private finish() {
    const a = this.host.animator;
    this.setStage('idle'); this.route = []; a.carrying = false; a.idleClip = 'Idle'; a.cancelAction(); a.faceTarget = null; a.workClip = null;
    this.retry = 15;
  }

  /** Per frame. Returns true while dinner owns Dad (his own routine then waits). */
  update(dt: number, d: DinnerDay, canStart: boolean, people: FloorPoint[], velocity: {x: number; z: number}) {
    const s = d.state, a = this.host.animator, root = this.host.root;
    this.retry = Math.max(0, this.retry - dt);
    if (this.day !== s.day) {
      // A new day (or the first frame): a fresh service, the platter restored if already served.
      this.day = s.day; if (this.active) this.finish(); this.retry = 0; this.tray.visible = false;
      this.serving = dinnerFood(s.day); this.showServing();
      if (s.dinnerServed) this.table();
    }
    if (!this.ready) return false;
    if (this.stage === 'idle') {
      if (s.dinnerServed && !this.tray.visible) this.table();
      if (!canStart || !this.due(d)) return false;
      const f = this.host.fridge.point(-1.65, 14.55);
      if (!this.go(f, 'fetch')) { this.finish(); return false; }
      this.excused = false;
      this.host.say(DINNER_LINES[this.serving]);
    }
    if (this.stage === 'fetch' || this.stage === 'carry') return this.walk(dt, d, people, velocity);
    this.timer -= dt;
    if (this.stage === 'sitting' || this.stage === 'standing') {
      const down = this.stage === 'sitting', t = Math.max(0, Math.min(1, 1 - this.timer / (down ? 1.3 : 1))), k = t * t * (3 - 2 * t);
      const p = this.host.dining.point(.55, down ? CHAIR_Z - (CHAIR_Z - SEATED_Z) * k : SEATED_Z + (CHAIR_Z - SEATED_Z) * k);
      root.position.x = p.x; root.position.z = p.z;
    }
    if (this.timer > 0) return true;
    if (this.stage === 'pickup') {
      a.faceTarget = null; a.idleClip = 'Idle'; a.carrying = true;
      this.host.socket.add(this.tray); this.tray.position.set(0, .035, .06); this.tray.rotation.set(0, 0, 0); this.tray.visible = true;
      if (!this.go(this.host.dining.point(.55, CHAIR_Z), 'carry')) { this.tray.visible = false; this.finish(); }
    } else if (this.stage === 'place') {
      a.carrying = false; a.faceTarget = null; this.table();
      s.dinnerServed = true; d.save();
      this.host.say('Dinner is ready whenever you are, sweetie.'); d.toast('🍽 Dad’s dinner is on the table.');
      this.sit();
    } else if (this.stage === 'sitting') {
      this.setStage('seated'); this.timer = 12 + (s.day % 4) * 2;
      const p = this.host.dining.point(.55, SEATED_Z); root.position.x = p.x; root.position.z = p.z;
    } else if (this.stage === 'seated') {
      this.setStage('standing'); this.timer = 1; a.idleClip = 'Idle'; a.playAction('StandUp');
    } else if (this.stage === 'standing') {
      const p = this.host.dining.point(.55, CHAIR_Z); root.position.x = p.x; root.position.z = p.z;
      this.finish(); return false;
    }
    return true;
  }

  private sit() {
    const a = this.host.animator;
    this.setStage('sitting'); this.timer = 1.3; a.setYaw(this.host.dining.yaw(180)); a.idleClip = 'SitIdle'; a.playAction('SitDown');
  }

  private walk(dt: number, d: DinnerDay, people: FloorPoint[], velocity: {x: number; z: number}) {
    const p = this.host.root.position, next = this.route[0], a = this.host.animator;
    if (next) {
      const dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz), step = Math.min(distance, dt * WALK);
      const x = p.x + dx / Math.max(distance, 1e-4) * step, z = p.z + dz / Math.max(distance, 1e-4) * step;
      if (people.some(v => Math.hypot(v.x - x, v.z - z) < ROOM) || !this.host.planner().free(x, z)) {
        // Upgrade: after a moment he steps around whoever is in the way; if there is no way
        // around he asks nicely and waits (PlayCanvas waited and re-asked the same path forever).
        this.blocked += dt;
        if (this.blocked > 1.2) {
          const around = this.host.planner().withObstacles(people.map(v => ({x: v.x, z: v.z, half: .35}))).route({x: p.x, z: p.z}, this.goal);
          if (around.length) this.route = around;
          else if (!this.excused) { this.host.say('’Scuse me, sweetie!'); this.excused = true; }
          this.blocked = 0;
        }
        return true;
      }
      this.blocked = 0;
      if (dt > 0) { velocity.x = (x - p.x) / dt; velocity.z = (z - p.z) / dt; }
      p.x = x; p.z = z;
      if (distance <= step + .01) this.route.shift();
      return true;
    }
    if (Math.hypot(p.x - this.goal.x, p.z - this.goal.z) > .5) { this.tray.visible = !!d.state.dinnerServed; this.finish(); return false; }
    if (this.stage === 'fetch') {
      this.setStage('pickup'); this.timer = 1.4; a.idleClip = 'Reach'; a.faceTarget = this.host.fridge.point(-2.65, 14.55);
    } else {
      this.setStage('place'); this.timer = 1.1; a.faceTarget = this.host.dining.point(.55, 13.85);
    }
    return true;
  }

  snapshot() {
    const p = this.tray.getWorldPosition(this.tray.position.clone());
    return {ready: this.ready, stage: this.stage, stages: [...this.stages], food: this.serving, position: p.toArray(), visible: this.tray.visible, route: this.route.map(r => [r.x, r.z])};
  }
  dispose() { this.tray.removeFromParent(); }
}
