import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Bone, type Camera, type WebGLRenderer} from 'three';
import {SpeechLabel} from './SpeechLabel';
import {LILAH, loadCharacter, characterQuality, type LoadedCharacter} from '../characters/Arianna';
import {buildLilahClips, LILAH_ACTION_RATE, LILAH_WALK_SPEED} from '../characters/clips';
import {CarrySocket, CharacterAnimator, groundHeight, type GroundSurface} from '../characters/CharacterAnimator';
import {HousePath, type FloorPoint, type PathArea} from './HousePath';
import {CRIB_ENTRY_SECONDS, CRIB_FRONT, LILAH_BEDTIME, cribKeys, samplePath, type CribKey} from './familyRules';

/** Where she wanders when she isn't following (PlayCanvas Lilah.ts explore spots). */
const EXPLORE_SPOTS: FloorPoint[] = [{x: 1.1, z: 1.3}, {x: 3.8, z: 2}, {x: 1.4, z: 5.6}, {x: .5, z: 10.8}, {x: 4.3, z: 11.4}, {x: 8.4, z: .5}];
const FOLLOW_OFFSETS: FloorPoint[] = [{x: .9, z: .7}, {x: -.9, z: .7}, {x: .9, z: -.7}, {x: -.9, z: -.7}];
const FOLLOW_LINES = ['Ari! Wait for me!', 'I do it too!', 'Whatcha doing?'];
/** She stops rather than walk into Arianna (0.4 m, PlayCanvas) or the rest of the family. */
const PERSONAL_SPACE = .4;
export interface Neighbour { x: number; z: number; space: number }
/** What Lilah knows about the day each frame (from the saved day, in everyday life only). */
export interface LilahDay { minutes: number; phase: string; asleep: boolean; everyday: boolean; /** Arianna is walking over to play with her: wait. */ beckoned?: boolean }
const PLAY_LINES = ['Again! Again!', 'Hehe! More, Ari!', 'You’re silly, Ari!', 'Spin me! Spin me!'];
/** Sleepy toddling is a little slower than her usual 0.7 m/s. */
const SLEEPY_SPEED = .5;
/** Seconds before she may play again (upgrade: PlayCanvas let the button be spammed). */
const PLAY_COOLDOWN = 6;
/** If her way to the crib stays blocked this long, she can be tucked in from where she is. */
const SLEEPY_FALLBACK = 40;
/** Her lying height on the crib mattress (PlayCanvas BedEntry crib end key). */
const CRIB_HEIGHT = .65;

const findBone = (character: LoadedCharacter, ...names: string[]) => {
  // three.js strips "." from node names (hand.L becomes handL).
  for (const n of names) { const b = character.bones.get(n) ?? character.bones.get(n.replace(/\./g, '')); if (b) return b; }
  throw Error(`${character.profile.id} has no bone ${names.join('/')}`);
};

/**
 * Lilah, age 2: her own protected model and clips, a toddler's walk (0.7 m/s), and the
 * PlayCanvas personality loop: every 12 s she either follows Arianna (55%) or toddles off
 * to explore, stopping short of her big sister instead of walking through her.
 *
 * Family life (PlayCanvas Lilah + DailyLife): from 6:15 PM she gets sleepy and toddles to
 * her crib to wait for Arianna ("Tuck me in, Ari?"); the tuck-in has her climb in and fall
 * asleep, and the saved day keeps her asleep through a reload until the next morning, when
 * she wakes at the crib. Arianna can play with her ("Play with Lilah").
 *
 * Upgrades over PlayCanvas: she follows to whichever spot beside Arianna is nearest to her
 * (not always the same corner), waits a moment when Arianna is in the way before giving up,
 * and turns to watch Arianna while she stands still. At bedtime she visibly climbs into the
 * crib (PlayCanvas snapped her in under a black fade), asks once rather than every 30 s, does
 * not repeat "Night night" on every reload, and play has a short cooldown and varied lines.
 */
export class Lilah {
  readonly root = new Group();
  animator!: CharacterAnimator;
  character!: LoadedCharacter;
  socket!: CarrySocket;
  readonly toy = new Mesh(new BoxGeometry(.13, .13, .13), new MeshStandardMaterial({color: '#edb867', roughness: .7}));
  private planner: HousePath;
  private route: FloorPoint[] = [];
  private destination = '';
  private time = 0;
  private nextDecision = 3;
  private blockedFor = 0;
  /** watching · following · exploring · playing · sleepy · climbing · sleeping */
  state = 'watching';
  private sleepySince = 0;
  private nextAsk = 0;
  private playUntil = 0;
  private climb: {start: number; keys: CribKey[]} | null = null;
  /** Height above the floor while climbing or asleep (else the floor or rug). */
  private height: number | null = null;
  private crib = (x: number, z: number) => ({x, z});
  private dayState: LilahDay = {minutes: 420, phase: 'morning', asleep: false, everyday: true};
  private visible = false;
  carrying = false;
  private readonly label = new SpeechLabel('lilah', 2.6, {top: 130, bottom: 130, side: 10});
  private readonly velocity = {x: 0, z: 0};

  private constructor(area: PathArea, private readonly random: () => number) {
    this.planner = new HousePath(area);
    this.root.name = 'Lilah · age 2';
  }

  static async load(renderer: WebGLRenderer, area: PathArea, options: {random?: () => number; base?: string} = {}) {
    const lilah = new Lilah(area, options.random ?? Math.random);
    lilah.character = await loadCharacter(LILAH, renderer, options.base);
    const library = buildLilahClips(lilah.character);
    lilah.root.add(lilah.character.root);
    lilah.animator = new CharacterAnimator(lilah.character.root, lilah.character.model, library.clips,
      {initialYaw: 0, travel: {Walk: LILAH_WALK_SPEED, CarryWalk: LILAH_WALK_SPEED}, canRun: false, actionRate: LILAH_ACTION_RATE});
    lilah.socket = new CarrySocket(lilah.character.root, [findBone(lilah.character, 'hand.L'), findBone(lilah.character, 'hand.R')] as [Bone, Bone]);
    lilah.toy.castShadow = true; lilah.toy.visible = false; lilah.socket.add(lilah.toy);
    lilah.place(1, .7);
    lilah.say('Hi, Ari!');
    return lilah;
  }

  setArea(area: PathArea) { this.planner = new HousePath(area); this.route = []; }
  /** Crib-space points (they follow the crib if it is moved in the Editor). */
  setCrib(point: (x: number, z: number) => FloorPoint) { this.crib = point; }
  place(x: number, z: number) { this.root.position.set(x, .09, z); this.route = []; }
  get front() { return this.crib(CRIB_FRONT.x, CRIB_FRONT.z); }
  get atCrib() { const f = this.front; return !this.route.length && Math.hypot(this.root.position.x - f.x, this.root.position.z - f.z) < .4; }
  get asleep() { return this.state === 'sleeping'; }

  /** Free to play: at home, in everyday life, not busy, not winding down for bed, not just played. */
  get canPlay() {
    return this.visible && this.dayState.everyday && !this.animator.busy && this.time >= this.playUntil && !['sleepy', 'climbing', 'sleeping'].includes(this.state);
  }
  /** Ready to be tucked in: sleepy and waiting at her crib (or stuck on the way for a while). */
  get tuckable() {
    return this.visible && this.state === 'sleepy' && !this.animator.busy && (this.atCrib || this.time - this.sleepySince > SLEEPY_FALLBACK);
  }

  /** "Play with Lilah": she stops, faces her sister and cheers. */
  playTogether(arianna: FloorPoint) {
    if (!this.canPlay) return false;
    this.route = []; this.carry(false); this.animator.cancelAction();
    this.state = 'playing'; this.say(PLAY_LINES[Math.floor(this.random() * PLAY_LINES.length)]);
    this.nextDecision = this.time + 10; this.playUntil = this.time + PLAY_COOLDOWN;
    this.animator.playAction('Celebrate', {face: arianna});
    return true;
  }

  /** The tuck-in begins: she climbs into the crib over CRIB_ENTRY_SECONDS. */
  startTuck() {
    if (this.state !== 'sleepy') return false;
    this.route = []; this.carry(false); this.animator.cancelAction();
    const p = this.root.position;
    const keys = cribKeys({x: p.x, z: p.z, yaw: this.animator.yaw}).map((k, i) => i === 0 ? k : {...k, ...this.crib(k.x, k.z)});
    this.climb = {start: this.time, keys}; this.state = 'climbing';
    this.animator.workClip = 'SleepEnter'; this.animator.faceTarget = null;
    return true;
  }
  /** The tuck-in was interrupted: she climbs back out to wait at the crib front. */
  cancelTuck() {
    if (this.state !== 'climbing') return;
    this.climb = null; this.height = null; this.animator.workClip = null;
    const f = this.front; this.place(f.x, f.z); this.state = 'sleepy';
  }
  /** The tuck-in finished: asleep in the crib (PlayCanvas restInCrib). */
  fallAsleep(announce = true) {
    this.climb = null; this.route = []; this.carry(false); this.animator.cancelAction();
    const end = this.crib(9.8, -1.7);
    this.root.position.set(end.x, CRIB_HEIGHT, end.z); this.height = CRIB_HEIGHT;
    this.animator.setYaw(Math.PI / 2); this.animator.workClip = null; this.animator.idleClip = 'Sleep'; this.animator.faceTarget = null;
    this.state = 'sleeping';
    if (announce) this.say('Night night, Ari…'); else this.label.hide();
  }
  /** A new morning: she wakes and stands at the crib front. */
  private wake() {
    this.climb = null; this.height = null; this.animator.workClip = null; this.animator.idleClip = 'Idle';
    const f = this.front; this.place(f.x, f.z); this.animator.setYaw(-Math.PI / 2);
    this.state = 'watching'; this.nextDecision = this.time + 3; this.say('Morning, Ari!');
  }

  /** 6:15 PM: drop everything and toddle to the crib. */
  private goToBed() {
    this.route = []; this.carry(false); this.animator.cancelAction();
    this.state = 'sleepy'; this.sleepySince = this.time; this.nextAsk = 0;
    this.say('Sleepy…');
    this.go(this.front, 'bedtime');
  }

  /** Follow the saved day: bedtime, asleep after a reload, or a new morning. */
  private followDay() {
    const d = this.dayState;
    if (d.asleep) { if (this.state !== 'sleeping' && this.state !== 'climbing') this.fallAsleep(false); return; }
    // Timed rounds leave her as she is: no bedtime, no waking.
    if (!d.everyday) return;
    const bedtime = d.minutes >= LILAH_BEDTIME && (d.phase === 'afternoon' || d.phase === 'night'), winding = ['sleepy', 'climbing', 'sleeping'].includes(this.state);
    if (!bedtime) { if (winding) this.wake(); return; }
    if (!winding) this.goToBed();
  }
  get position(): FloorPoint { return {x: this.root.position.x, z: this.root.position.z}; }

  /** Show or hide her favourite block in her hands (carry pose). */
  carry(on: boolean) { this.carrying = on; this.animator.carrying = on; this.toy.visible = on; }

  private say(text: string) { this.label.say(text); }
  get speech() { return this.label.text; }

  private go(point: FloorPoint, purpose: string) {
    this.route = this.planner.route(this.position, point); this.destination = purpose; this.blockedFor = 0;
    return this.route.length > 0;
  }

  private decide(arianna: FloorPoint) {
    if (this.state === 'sleepy') {
      // Keep heading for the crib; once there, ask (again only if Arianna is close by).
      if (!this.atCrib) { if (!this.go(this.front, 'bedtime')) this.nextDecision = this.time + 2; else this.nextDecision = this.time + 12; return; }
      if (this.time >= this.nextAsk && Math.hypot(arianna.x - this.root.position.x, arianna.z - this.root.position.z) < 6) { this.say('Tuck me in, Ari?'); this.nextAsk = this.time + 45; }
      this.nextDecision = this.time + 2;
      return;
    }
    if (this.random() < .55) {
      const here = this.position, d = (o: FloorPoint) => Math.hypot(arianna.x + o.x - here.x, arianna.z + o.z - here.z);
      for (const o of [...FOLLOW_OFFSETS].sort((a, b) => d(a) - d(b))) if (this.go({x: arianna.x + o.x, z: arianna.z + o.z}, 'follow')) break;
      this.state = 'following'; this.say(FOLLOW_LINES[Math.floor(this.random() * FOLLOW_LINES.length)]);
    } else {
      this.go(EXPLORE_SPOTS[Math.floor(this.random() * EXPLORE_SPOTS.length)], 'explore');
      this.state = 'exploring'; this.say('Ooh! What’s that?');
    }
    this.nextDecision = this.time + 12;
  }

  private arrive() {
    if (this.destination === 'bedtime') { this.nextDecision = this.time; this.say('Tuck me in, Ari?'); this.nextAsk = this.time + 45; return; }
    this.nextDecision = this.time + 7; this.state = 'watching';
    this.say(this.destination === 'follow' ? 'You’re my favorite, Ari!' : 'Ooh…');
  }

  /** active: she is in the current region and free to wander (her clock only runs then). */
  update(dt: number, arianna: FloorPoint, surfaces: GroundSurface[], active: boolean, others: Neighbour[] = [], day?: LilahDay) {
    this.root.visible = this.visible = active;
    this.velocity.x = this.velocity.z = 0;
    if (day) this.dayState = day;
    if (!active) { this.label.hide(); return; }
    this.time += dt;
    this.followDay();
    if (this.state === 'climbing' && this.climb) {
      const t = (this.time - this.climb.start) / CRIB_ENTRY_SECONDS, p = samplePath(this.climb.keys, t);
      this.root.position.x = p.x; this.root.position.z = p.z; this.height = p.h; this.animator.setYaw(p.yaw);
      if (t >= 1) this.fallAsleep();
    } else if (this.state === 'sleeping') { /* asleep: nothing to decide */ }
    else if (this.dayState.beckoned && !this.animator.busy) {
      // Upgrade: she waits for her sister to come and play (PlayCanvas let her wander off,
      // which silently cancelled the play).
      this.route = []; this.animator.turnToward(arianna.x, arianna.z, dt);
    } else if (!this.animator.busy) {
      if (this.route.length) this.walk(dt, arianna, others);
      else {
        if (this.time >= this.nextDecision) this.decide(arianna);
        // Standing still, she watches her big sister.
        if (!this.route.length && Math.hypot(arianna.x - this.root.position.x, arianna.z - this.root.position.z) < 3.5) this.animator.turnToward(arianna.x, arianna.z, dt);
      }
    }
    if (this.state === 'playing' && !this.animator.busy) this.state = 'watching';
    this.root.position.y = this.height ?? groundHeight(surfaces, this.root.position.x, this.root.position.z);
    this.animator.update(dt, this.velocity);
    this.socket.update();
  }

  private walk(dt: number, arianna: FloorPoint, others: Neighbour[]) {
    const p = this.root.position, next = this.route[0], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    // She reaches each waypoint exactly before turning, so she never cuts furniture corners.
    if (distance < 1e-4) { this.route.shift(); if (!this.route.length) this.arrive(); return; }
    const speed = this.state === 'sleepy' ? SLEEPY_SPEED : LILAH_WALK_SPEED;
    const step = Math.min(distance, speed * dt), x = p.x + dx / distance * step, z = p.z + dz / distance * step;
    if (Math.hypot(x - arianna.x, z - arianna.z) <= PERSONAL_SPACE || others.some(o => Math.hypot(x - o.x, z - o.z) <= o.space)) {
      // Wait for Arianna to move; after a second, give up and think again shortly
      // (on her way to bed she stays sleepy and tries again).
      this.blockedFor += dt;
      if (this.blockedFor > 1) { this.route = []; if (this.state !== 'sleepy') this.state = 'watching'; this.nextDecision = this.time + 1; }
      return;
    }
    if (!this.planner.free(x, z)) { const goal = this.route[this.route.length - 1]; if (!this.go(goal, this.destination)) this.nextDecision = this.time + 2; return; }
    this.blockedFor = 0;
    p.x = x; p.z = z; this.velocity.x = dx / distance * speed; this.velocity.z = dz / distance * speed;
  }

  /** Place her speech bubble above her head. */
  updateLabel(camera: Camera, canvas: HTMLElement) { this.label.place(this.root, LILAH.displayHeight + .12, camera, canvas); }

  snapshot(renderer: WebGLRenderer) {
    return {position: [this.root.position.x, this.root.position.y, this.root.position.z], state: this.state, speech: this.speech, destination: this.destination,
      routeLength: this.route.length, time: this.time, nextDecision: this.nextDecision, carrying: this.carrying, visible: this.root.visible,
      atCrib: this.atCrib, canPlay: this.canPlay, tuckable: this.tuckable, height: this.height,
      socket: this.socket.getWorldPosition(new Vector3()).toArray(), animation: this.animator.snapshot(), quality: characterQuality(this.character, renderer)};
  }

  dispose() { this.label.dispose(); this.root.removeFromParent(); }
}
