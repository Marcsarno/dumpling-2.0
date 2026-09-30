import {AnimationMixer, Group, LoopRepeat, type AnimationAction, type WebGLRenderer} from 'three';
import {SUNNY_PUP, loadCharacter, characterQuality, type LoadedCharacter} from '../characters/Arianna';
import {groundHeight, type GroundSurface} from '../characters/CharacterAnimator';
import {HousePath, type FloorPoint, type PathArea} from './HousePath';

const HOME = {x: 4.8, z: 5.85};
const SPOTS: FloorPoint[] = [{x: 4.7, z: 6}, {x: 3.3, z: 5.8}, {x: 1.2, z: 7.8}, {x: .6, z: 10.8}, {x: 1.6, z: 11.8}, {x: 4.7, z: 11.6}, {x: 1.1, z: 4.6}];
const ROAM_SPEED = .3;
/** He steps around people rather than through them (PlayCanvas: 0.48 m). */
const PERSONAL_SPACE = .48;

/**
 * Sunny Pup: the owner's Meshy dog on its CC0 Mesh2Motion rig, with its two authored clips.
 * Animation follows actual ground speed (PlayCanvas DogAnimator): Walk above 0.015 m/s,
 * blended in 0.16 s and played at speed / 0.20 (clamped 0.35-2.5x); teleports are not strides.
 * Roaming (PlayCanvas DogRoaming): a new spot every 4-10 s, at 0.3 m/s, pausing for people
 * and replanning after 2 s blocked. The bowl, fetch and pet care arrive with P2.
 *
 * Upgrades: he turns smoothly toward where he is heading instead of snapping, and he sits on
 * rugs instead of a fixed floor height.
 */
export class SunnyPup {
  readonly root = new Group();
  character!: LoadedCharacter;
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
  speed = 0;
  state = 'roaming';

  private constructor(area: PathArea, private readonly random: () => number) { this.planner = new HousePath(area, .19); this.root.name = 'Sunny Pup'; }

  static async load(renderer: WebGLRenderer, area: PathArea, options: {random?: () => number; base?: string} = {}) {
    const pup = new SunnyPup(area, options.random ?? Math.random);
    pup.character = await loadCharacter(SUNNY_PUP, renderer, options.base);
    pup.root.add(pup.character.root);
    pup.mixer = new AnimationMixer(pup.character.model);
    for (const name of ['Idle', 'Walk']) {
      const clip = pup.character.clips.find(c => c.name === name);
      if (!clip) throw Error(`Sunny Pup is missing clip ${name}`);
      const a = pup.mixer.clipAction(clip); a.setLoop(LoopRepeat, Infinity); pup.actions.set(name, a);
    }
    pup.actions.get('Idle')!.play();
    pup.root.position.set(HOME.x, 0, HOME.z); pup.character.root.rotation.y = pup.yaw;
    return pup;
  }

  setArea(area: PathArea) { this.planner = new HousePath(area, .19); this.route = []; }
  get position(): FloorPoint { return {x: this.root.position.x, z: this.root.position.z}; }

  update(dt: number, people: FloorPoint[], surfaces: GroundSurface[], active: boolean) {
    this.root.visible = active;
    if (!active) { this.route = []; this.wait = 3; return; }
    this.roam(dt, people);
    this.root.position.y = groundHeight(surfaces, this.root.position.x, this.root.position.z);
    this.animate(dt);
  }

  private roam(dt: number, people: FloorPoint[]) {
    if (this.wait > 0) { this.wait -= dt; return; }
    const p = this.root.position;
    if (!this.route.length) {
      const here = this.position, options = SPOTS.map((s, i) => ({i, s})).filter(o => o.i !== this.last && this.planner.free(o.s.x, o.s.z) && Math.hypot(o.s.x - here.x, o.s.z - here.z) > 1);
      const choice = options[Math.floor(this.random() * options.length)];
      if (choice) { this.route = this.planner.route(here, choice.s); this.last = choice.i; }
      if (!this.route.length) this.wait = 3;
      return;
    }
    const next = this.route[0], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    if (distance < .015) { this.route.shift(); if (!this.route.length) this.wait = 4 + this.random() * 6; return; }
    const step = Math.min(distance, dt * ROAM_SPEED), x = p.x + dx / distance * step, z = p.z + dz / distance * step;
    if (people.some(o => Math.hypot(o.x - x, o.z - z) < PERSONAL_SPACE) || !this.planner.free(x, z)) {
      this.blocked += dt;
      if (this.blocked > 2) { this.route = []; this.wait = 2; this.blocked = 0; }
      return;
    }
    this.blocked = 0; p.x = x; p.z = z;
    let delta = (Math.atan2(dx, dz) - this.yaw + Math.PI) % (2 * Math.PI); if (delta < 0) delta += 2 * Math.PI; delta -= Math.PI;
    this.yaw += delta * (1 - Math.exp(-10 * dt)); this.character.root.rotation.y = this.yaw;
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
      routeLength: this.route.length, visible: this.root.visible, quality: characterQuality(this.character, renderer)};
  }
  dispose() { this.root.removeFromParent(); }
}
