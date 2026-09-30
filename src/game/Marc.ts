import {Group, type Camera, type WebGLRenderer} from 'three';
import {MARC, loadCharacter, characterQuality, type LoadedCharacter} from '../characters/Arianna';
import {buildMarcClips, MARC_CARRY_SPEED, MARC_WALK_SPEED} from '../characters/clips';
import {CarrySocket, CharacterAnimator, groundHeight, type GroundSurface} from '../characters/CharacterAnimator';
import type {RegionSemantics} from '../world/format';
import {propSpace} from '../world/propSpace';
import {HousePath, type FloorPoint, type PathArea} from './HousePath';
import {SpeechLabel} from './SpeechLabel';

/** His reading chair in the living room, authored against the chair prop (PlayCanvas Marc.ts). */
const SEAT = {x: 4.5, z: 7.35}, SEAT_YAW = -35;
const FORWARD = {x: Math.sin(SEAT_YAW * Math.PI / 180), z: Math.cos(SEAT_YAW * Math.PI / 180)};
const ENTRY = {x: SEAT.x + FORWARD.x * 1.02, z: SEAT.z + FORWARD.z * 1.02};
const SEATED = {x: SEAT.x + FORWARD.x * .28, z: SEAT.z + FORWARD.z * .28};
const PATROL: FloorPoint[] = [{x: 8.4, z: .5}, {x: 8.1, z: 9.6}, {x: .4, z: 11.2}, {x: 3.8, z: 2}, {x: 1.25, z: 5.6}];
const REMARKS = ['Need a hand, sweetie?', 'I came. I saw. I stepped on a block.', 'Sweetie, is this a house or a tiny toy museum?',
  'My coffee has been reheated three times. A new record.', 'The laundry and I are in a long-term relationship.', 'Nice collecting, sweetie. I collect missing socks.'];
/** He gives Arianna and Lilah room (PlayCanvas: 0.6 m and 0.48 m). */
const ROOM_ARIANNA = .6, ROOM_LILAH = .48;
type State = 'idle' | 'walking' | 'sitting-down' | 'seated' | 'standing-up';

/**
 * Marc (Dad), 1.3 x Arianna's height: household presence only, never Arianna's chores or
 * money. He alternates between his reading chair (18 s seated) and a patrol of the house,
 * and chats when Arianna is near. Dinner and tidying Lilah's messes arrive with the daily
 * loop (P2) on top of this.
 *
 * Upgrade: his turns are smoothed by the shared animator instead of snapping each frame.
 */
export class Marc {
  readonly root = new Group();
  animator!: CharacterAnimator;
  character!: LoadedCharacter;
  socket!: CarrySocket;
  private planner: HousePath;
  private seat!: ReturnType<typeof propSpace>;
  private route: FloorPoint[] = [];
  state: State = 'idle';
  private purpose = 'seat';
  private time = 0;
  private until = 1;
  private transitionStart = 0;
  private patrolIndex = 0;
  private blockedFor = 0;
  private nextSpeech = 6;
  private lineIndex = 0;
  sits = 0;
  private readonly velocity = {x: 0, z: 0};
  private readonly label = new SpeechLabel('marc', 3.8, {top: 135, bottom: 145, side: 0});

  private constructor(area: PathArea) { this.planner = new HousePath(area, .25); this.root.name = 'Marc'; }

  static async load(renderer: WebGLRenderer, area: PathArea, semantics: RegionSemantics, base?: string) {
    const marc = new Marc(area);
    marc.seat = propSpace(semantics, 'marc-seat');
    marc.character = await loadCharacter(MARC, renderer, base);
    const library = buildMarcClips(marc.character);
    marc.root.add(marc.character.root);
    marc.animator = new CharacterAnimator(marc.character.root, marc.character.model, library.clips,
      {initialYaw: 0, travel: {Walk: MARC_WALK_SPEED, CarryWalk: MARC_CARRY_SPEED}, canRun: false});
    const hand = (n: string) => marc.character.bones.get(n)!;
    marc.socket = new CarrySocket(marc.character.root, [hand('LeftHand'), hand('RightHand')]);
    marc.root.position.set(3.5, 0, 6.2);
    return marc;
  }

  setArea(area: PathArea, semantics: RegionSemantics) { this.planner = new HousePath(area, .25); this.seat = propSpace(semantics, 'marc-seat'); this.route = []; }
  get position(): FloorPoint { return {x: this.root.position.x, z: this.root.position.z}; }
  get speech() { return this.label.text; }

  private say(text: string) { this.label.say(text); this.nextSpeech = this.time + 24; }

  private go(point: FloorPoint, purpose: string) {
    this.route = this.planner.route(this.position, point); this.purpose = purpose; this.blockedFor = 0;
    if (this.route.length) { this.state = 'walking'; this.animator.idleClip = 'Idle'; return true; }
    return false;
  }

  private stand() {
    this.state = 'standing-up'; this.transitionStart = this.time; this.until = this.time + 1;
    this.animator.idleClip = 'Idle'; this.animator.playAction('StandUp');
  }

  update(dt: number, arianna: FloorPoint, lilah: FloorPoint | null, surfaces: GroundSurface[], active: boolean) {
    this.root.visible = active;
    this.velocity.x = this.velocity.z = 0;
    if (!active) { this.label.hide(); return; }
    this.time += dt;
    const entry = this.seat.point(ENTRY.x, ENTRY.z), seated = this.seat.point(SEATED.x, SEATED.z), yaw = this.seat.yaw(SEAT_YAW);
    if (this.state === 'walking') this.walk(dt, arianna, lilah, yaw);
    else if (this.state === 'sitting-down' || this.state === 'standing-up') {
      const down = this.state === 'sitting-down', t = Math.min(1, (this.time - this.transitionStart) / (down ? 1.3 : 1)), k = t * t * (3 - 2 * t);
      const [a, b] = down ? [entry, seated] : [seated, entry];
      this.root.position.x = a.x + (b.x - a.x) * k; this.root.position.z = a.z + (b.z - a.z) * k; this.animator.setYaw(yaw);
      if (this.time >= this.until && !this.animator.busy) {
        if (down) { this.state = 'seated'; this.until = this.time + 18; } else { this.state = 'idle'; this.until = this.time + 1; }
      }
    } else if (this.state === 'seated') { if (this.time >= this.until) this.stand(); }
    else if (this.time >= this.until) {
      // Chair, then the next patrol point, then back to the chair.
      if (this.purpose === 'seat') { if (!this.go(PATROL[this.patrolIndex++ % PATROL.length], 'wander')) this.until = this.time + 3; }
      else if (!this.go(entry, 'seat')) this.until = this.time + 3;
    }
    // His first destination is the chair.
    if (this.time < 2 && this.state === 'idle' && this.purpose === 'seat') this.go(entry, 'seat');
    if (this.time >= this.nextSpeech && Math.hypot(arianna.x - this.root.position.x, arianna.z - this.root.position.z) < 5) this.say(REMARKS[this.lineIndex++ % REMARKS.length]);
    this.root.position.y = groundHeight(surfaces, this.root.position.x, this.root.position.z);
    this.animator.update(dt, this.velocity);
    this.socket.update();
  }

  private walk(dt: number, arianna: FloorPoint, lilah: FloorPoint | null, seatYaw: number) {
    const p = this.root.position, next = this.route[0];
    if (!next) { this.state = 'idle'; this.until = this.time; return; }
    const dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz), step = Math.min(distance, MARC_WALK_SPEED * dt);
    const x = p.x + dx / Math.max(distance, 1e-3) * step, z = p.z + dz / Math.max(distance, 1e-3) * step;
    const clear = Math.hypot(x - arianna.x, z - arianna.z) > ROOM_ARIANNA && (!lilah || Math.hypot(x - lilah.x, z - lilah.z) > ROOM_LILAH) && this.planner.free(x, z);
    if (!clear) {
      this.blockedFor += dt;
      if (this.blockedFor > 2) { this.route = []; this.state = 'idle'; this.until = this.time + 3; this.blockedFor = 0; }
      return;
    }
    this.blockedFor = 0;
    if (dt > 0) { this.velocity.x = (x - p.x) / dt; this.velocity.z = (z - p.z) / dt; }
    p.x = x; p.z = z;
    if (distance > step + 1e-5) return;
    this.route.shift();
    if (this.route.length) return;
    if (this.purpose === 'seat') {
      this.state = 'sitting-down'; this.transitionStart = this.time; this.until = this.time + 1.3; this.sits++;
      this.animator.setYaw(seatYaw); this.animator.idleClip = 'SitIdle'; this.animator.playAction('SitDown');
    } else { this.state = 'idle'; this.until = this.time + 6; }
  }

  updateLabel(camera: Camera, canvas: HTMLElement) { this.label.place(this.root, MARC.displayHeight + .1, camera, canvas); }

  snapshot(renderer: WebGLRenderer) {
    return {position: [this.root.position.x, this.root.position.y, this.root.position.z], state: this.state, purpose: this.purpose, sits: this.sits,
      speech: this.speech, routeLength: this.route.length, visible: this.root.visible, animation: this.animator.snapshot(), quality: characterQuality(this.character, renderer)};
  }
  dispose() { this.label.dispose(); this.root.removeFromParent(); }
}
