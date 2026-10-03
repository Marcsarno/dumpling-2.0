import {AnimationMixer, Group, LoopRepeat, Vector3, type AnimationAction, type Object3D, type WebGLRenderer} from 'three';
import {SUNNY_PUP, loadCharacter, characterQuality, type LoadedCharacter} from '../characters/Arianna';
import {groundHeight, type GroundSurface} from '../characters/CharacterAnimator';
import {HousePath, type FloorPoint, type PathArea} from './HousePath';

const HOME = {x: 4.8, z: 5.85};
const SPOTS: FloorPoint[] = [{x: 4.7, z: 6}, {x: 3.3, z: 5.8}, {x: 1.2, z: 7.8}, {x: .6, z: 10.8}, {x: 1.6, z: 11.8}, {x: 4.7, z: 11.6}, {x: 1.1, z: 4.6}];
const ROAM_SPEED = .3;
/** He steps around people rather than through them (PlayCanvas: 0.48 m). */
const PERSONAL_SPACE = .48;
const FETCH_SPEED = .8;
const FETCH_TIMEOUT = 15;
const BOWL_SIDES: FloorPoint[] = [{x: 0, z: .5}, {x: -.5, z: 0}, {x: 0, z: -.5}, {x: .5, z: 0}];
/** Where a toy rides in his mouth: ahead of his chest, at muzzle height. */
const MOUTH = {ahead: .22, height: .22};

/** His bowl, as the household day sees it (DailyRoutines): is there food, where, and eat it. */
export interface Bowl { position: FloorPoint; hasFood(): boolean; eat(): boolean }
type State = 'roaming' | 'to-bowl' | 'eating' | 'fetch';
interface FetchJob { toy: Object3D; player: () => FloorPoint; drop: (at: Vector3) => void; carrying: boolean; time: number }

/**
 * Baxter, the family's puppy (in the PlayCanvas code and assets he is "Sunny pup"): the
 * owner's Meshy dog on its CC0 Mesh2Motion rig, with its two authored clips. Animation
 * follows actual ground speed (PlayCanvas DogAnimator): Walk above 0.015 m/s, blended in
 * 0.16 s and played at speed / 0.20 (clamped 0.35-2.5x); teleports are not strides.
 *
 * Daily life (PlayCanvas DogRoaming):
 * - Roaming: a new spot every 4-10 s, at 0.3 m/s, pausing for people, replanning after 2 s
 *   blocked.
 * - His bowl: 20-40 s after waking up (then 40-70 s after each meal), if there is kibble he
 *   trots to the bowl, eats for 3-5 s facing it and empties it. The empty bowl is saved; the
 *   afternoon "Fill puppy's bowl" chore refills it.
 * - Fetch (his half; tossing the toy arrives with home toys in slice 7): he chases a toy at
 *   0.8 m/s, carries it in his mouth back to Arianna and drops it beside her; he gives up and
 *   drops it after 15 s, or as soon as he leaves the house.
 *
 * Upgrades over PlayCanvas: he turns smoothly and follows rug heights; "is there food" comes
 * from the saved day, not from whether the kibble mesh happens to be shown; he approaches the
 * bowl from the side furthest from people instead of stalling against Arianna; fetch works
 * while there is food in the bowl (PlayCanvas silently refused), returns to where Arianna is
 * now (not where she stood), steps around people instead of freezing, and the toy lands on the
 * floor (PlayCanvas left it hovering at mouth height).
 */
export class Baxter {
  readonly root = new Group();
  character!: LoadedCharacter;
  bowl: Bowl | null = null;
  private mixer!: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current = 'Idle';
  private planner: HousePath;
  private route: FloorPoint[] = [];
  private wait = 4;
  private blocked = 0;
  private last = -1;
  private yaw = 30 * Math.PI / 180;
  private previous = {x: HOME.x, z: HOME.z};
  private bowlWait: number;
  private job: FetchJob | null = null;
  speed = 0;
  state: State = 'roaming';
  meals = 0;
  fetches = 0;

  private constructor(area: PathArea, private readonly random: () => number) {
    this.planner = new HousePath(area, .19); this.root.name = 'Baxter';
    this.bowlWait = 20 + random() * 20;
  }

  static async load(renderer: WebGLRenderer, area: PathArea, options: {random?: () => number; base?: string} = {}) {
    const pup = new Baxter(area, options.random ?? Math.random);
    pup.character = await loadCharacter(SUNNY_PUP, renderer, options.base);
    pup.root.add(pup.character.root);
    pup.mixer = new AnimationMixer(pup.character.model);
    for (const name of ['Idle', 'Walk']) {
      const clip = pup.character.clips.find(c => c.name === name);
      if (!clip) throw Error(`Baxter is missing clip ${name}`);
      const a = pup.mixer.clipAction(clip); a.setLoop(LoopRepeat, Infinity); pup.actions.set(name, a);
    }
    pup.actions.get('Idle')!.play();
    pup.root.position.set(HOME.x, 0, HOME.z); pup.character.root.rotation.y = pup.yaw;
    return pup;
  }

  setArea(area: PathArea) { this.planner = new HousePath(area, .19); this.route = []; }
  get position(): FloorPoint { return {x: this.root.position.x, z: this.root.position.z}; }

  /**
   * Fetch a toy lying on the floor and bring it back to Arianna. Refused while he is eating
   * or on his way to the bowl, already fetching, more than 7 m away, or if he can't reach it.
   */
  fetchToy(toy: Object3D, player: () => FloorPoint, drop: (at: Vector3) => void) {
    if (this.job || this.state === 'eating' || this.state === 'to-bowl') return false;
    const t = toy.getWorldPosition(new Vector3());
    if (Math.hypot(t.x - this.root.position.x, t.z - this.root.position.z) > 7) return false;
    const route = this.planner.route(this.position, {x: t.x, z: t.z});
    if (!route.length) return false;
    this.job = {toy, player, drop, carrying: false, time: 0}; this.route = route; this.wait = 0; this.state = 'fetch'; this.blocked = 0;
    return true;
  }

  update(dt: number, people: FloorPoint[], surfaces: GroundSurface[], active: boolean) {
    this.root.visible = active;
    if (!active) {
      if (this.job) this.endFetch();
      // Away from home: whatever he was about to do waits (a meal in progress is not eaten).
      this.route = []; this.wait = 3; this.state = 'roaming';
      return;
    }
    if (this.job) this.fetch(dt, people);
    else this.live(dt, people);
    this.root.position.y = groundHeight(surfaces, this.root.position.x, this.root.position.z);
    if (this.job?.carrying) {
      const f = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.job.toy.position.set(this.root.position.x + f.x * MOUTH.ahead, this.root.position.y + MOUTH.height, this.root.position.z + f.z * MOUTH.ahead);
    }
    this.animate(dt);
  }

  private live(dt: number, people: FloorPoint[]) {
    this.bowlWait -= dt;
    if (this.state === 'eating') {
      this.wait -= dt;
      if (this.wait <= 0) { if (this.bowl?.eat()) this.meals++; this.state = 'roaming'; this.wait = 5; this.bowlWait = 40 + this.random() * 30; }
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const here = this.position, bowl = this.bowl;
    if (this.state === 'roaming' && this.bowlWait <= 0 && bowl?.hasFood()) {
      // The side of the bowl furthest from people, that he can reach.
      const away = (g: FloorPoint) => Math.min(...people.map(p => Math.hypot(p.x - g.x, p.z - g.z)), 99);
      const sides = BOWL_SIDES.map(s => ({x: bowl.position.x + s.x, z: bowl.position.z + s.z})).filter(g => this.planner.free(g.x, g.z)).sort((a, b) => away(b) - away(a));
      for (const goal of sides) { const r = this.planner.route(here, goal); if (r.length) { this.route = r; this.state = 'to-bowl'; break; } }
      this.bowlWait = 20;
    }
    if (!this.route.length && this.state === 'to-bowl') {
      if (bowl && Math.hypot(here.x - bowl.position.x, here.z - bowl.position.z) < .75 && bowl.hasFood()) {
        this.state = 'eating'; this.wait = 3 + this.random() * 2; this.face(bowl.position, 1);
        return;
      }
      this.state = 'roaming';
    }
    if (!this.route.length) {
      const options = SPOTS.map((s, i) => ({i, s})).filter(o => o.i !== this.last && this.planner.free(o.s.x, o.s.z) && Math.hypot(o.s.x - here.x, o.s.z - here.z) > 1);
      const choice = options[Math.floor(this.random() * options.length)];
      if (choice) { this.route = this.planner.route(here, choice.s); this.last = choice.i; }
      if (!this.route.length) this.wait = 3;
      return;
    }
    if (!this.step(dt, ROAM_SPEED, people, .015)) return;
    if (!this.route.length && this.state === 'roaming') this.wait = 4 + this.random() * 6;
  }

  /** Move along the route; false while blocked. Replans after 2 s blocked (fetch: around people). */
  private step(dt: number, speed: number, people: FloorPoint[], reach: number) {
    const p = this.root.position, next = this.route[0], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    if (distance < reach) { this.route.shift(); return true; }
    const s = Math.min(distance, dt * speed), x = p.x + dx / distance * s, z = p.z + dz / distance * s;
    if (people.some(o => Math.hypot(o.x - x, o.z - z) < PERSONAL_SPACE) || !this.planner.free(x, z)) {
      this.blocked += dt;
      if (this.blocked > 2) {
        this.blocked = 0;
        if (this.job) { const goal = this.route[this.route.length - 1], r = this.planner.withObstacles(people.map(o => ({...o, half: .3}))).route(this.position, goal); if (r.length) this.route = r; }
        else { this.route = []; this.state = 'roaming'; this.wait = 2; }
      }
      return false;
    }
    this.blocked = 0; p.x = x; p.z = z;
    this.face({x: p.x + dx, z: p.z + dz}, 1 - Math.exp(-10 * dt));
    return true;
  }

  private face(point: FloorPoint, amount: number) {
    let delta = (Math.atan2(point.x - this.root.position.x, point.z - this.root.position.z) - this.yaw + Math.PI) % (2 * Math.PI); if (delta < 0) delta += 2 * Math.PI; delta -= Math.PI;
    this.yaw += delta * amount; this.character.root.rotation.y = this.yaw;
  }

  private fetch(dt: number, people: FloorPoint[]) {
    const job = this.job!;
    job.time += dt;
    if (job.time > FETCH_TIMEOUT) { this.endFetch(); return; }
    if (this.route.length) { this.step(dt, FETCH_SPEED, people, .08); return; }
    if (!job.carrying) {
      // At the toy: pick it up and head back to wherever Arianna is now, beside her.
      const a = job.player(), here = this.position;
      const sides = [{x: .7, z: 0}, {x: -.7, z: 0}, {x: 0, z: .7}, {x: 0, z: -.7}].map(o => ({x: a.x + o.x, z: a.z + o.z}))
        .sort((p, q) => Math.hypot(p.x - here.x, p.z - here.z) - Math.hypot(q.x - here.x, q.z - here.z));
      for (const goal of sides) { const r = this.planner.route(here, goal); if (r.length) { this.route = r; break; } }
      job.carrying = true;
      if (!this.route.length) this.endFetch();
      return;
    }
    this.fetches++; this.endFetch(); this.wait = 4;
  }

  /** Let go of the toy: it drops to the floor where he is. */
  private endFetch() {
    const job = this.job; if (!job) return;
    this.job = null; this.route = []; this.state = 'roaming';
    const at = job.toy.getWorldPosition(new Vector3()); at.y = this.root.position.y;
    job.drop(at);
  }

  private animate(dt: number) {
    const p = this.root.position, distance = Math.hypot(p.x - this.previous.x, p.z - this.previous.z);
    this.previous = {x: p.x, z: p.z};
    if (dt <= 0) return;
    this.speed = distance < .1 ? distance / dt : 0;
    const next = this.speed > .015 ? 'Walk' : 'Idle';
    if (next !== this.current) {
      const from = this.actions.get(this.current)!, to = this.actions.get(next)!;
      to.reset().play(); to.crossFadeFrom(from, .16, false); this.current = next;
    }
    this.actions.get('Walk')!.timeScale = Math.max(.35, Math.min(2.5, this.speed / .2));
    this.mixer.update(dt);
  }

  snapshot(renderer: WebGLRenderer) {
    return {position: [this.root.position.x, this.root.position.y, this.root.position.z], state: this.state, clip: this.current, speed: this.speed,
      routeLength: this.route.length, visible: this.root.visible, meals: this.meals, fetches: this.fetches, food: this.bowl?.hasFood() ?? null,
      fetching: !!this.job, carrying: !!this.job?.carrying, quality: characterQuality(this.character, renderer)};
  }
  dispose() { this.root.removeFromParent(); }
}
