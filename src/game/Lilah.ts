import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Bone, type Camera, type WebGLRenderer} from 'three';
import {LILAH, loadCharacter, characterQuality, type LoadedCharacter} from '../characters/Arianna';
import {buildLilahClips, LILAH_ACTION_RATE, LILAH_WALK_SPEED} from '../characters/clips';
import {CarrySocket, CharacterAnimator, groundHeight, type GroundSurface} from '../characters/CharacterAnimator';
import {HousePath, type FloorPoint, type PathArea} from './HousePath';

/** Where she wanders when she isn't following (PlayCanvas Lilah.ts explore spots). */
const EXPLORE_SPOTS: FloorPoint[] = [{x: 1.1, z: 1.3}, {x: 3.8, z: 2}, {x: 1.4, z: 5.6}, {x: .5, z: 10.8}, {x: 4.3, z: 11.4}, {x: 8.4, z: .5}];
const FOLLOW_OFFSETS: FloorPoint[] = [{x: .9, z: .7}, {x: -.9, z: .7}, {x: .9, z: -.7}, {x: -.9, z: -.7}];
const FOLLOW_LINES = ['Ari! Wait for me!', 'I do it too!', 'Whatcha doing?'];
/** She stops rather than walk into Arianna, and gives her this much room. */
const PERSONAL_SPACE = .4;

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
 * Upgrades over PlayCanvas: she follows to whichever spot beside Arianna is nearest to her
 * (not always the same corner), waits a moment when Arianna is in the way before giving up,
 * and turns to watch Arianna while she stands still.
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
  state = 'watching';
  speech = 'Hi, Ari!';
  private speechUntil = 0;
  carrying = false;
  private readonly label = document.createElement('div');
  private readonly velocity = {x: 0, z: 0};

  private constructor(area: PathArea, private readonly random: () => number) {
    this.planner = new HousePath(area);
    this.root.name = 'Lilah · age 2';
    this.label.className = 'speech-label'; this.label.hidden = true;
    document.querySelector('#game')?.append(this.label);
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
  place(x: number, z: number) { this.root.position.set(x, .09, z); this.route = []; }
  get position(): FloorPoint { return {x: this.root.position.x, z: this.root.position.z}; }

  /** Show or hide her favourite block in her hands (carry pose). */
  carry(on: boolean) { this.carrying = on; this.animator.carrying = on; this.toy.visible = on; }

  private say(text: string) { this.speech = text; this.label.textContent = text; this.speechUntil = performance.now() + 2600; }

  private go(point: FloorPoint, purpose: string) {
    this.route = this.planner.route(this.position, point); this.destination = purpose; this.blockedFor = 0;
    return this.route.length > 0;
  }

  private decide(arianna: FloorPoint) {
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
    this.nextDecision = this.time + 7; this.state = 'watching';
    this.say(this.destination === 'follow' ? 'You’re my favorite, Ari!' : 'Ooh…');
  }

  /** active: she is in the current region and free to wander (her clock only runs then). */
  update(dt: number, arianna: FloorPoint, surfaces: GroundSurface[], active: boolean) {
    this.root.visible = active;
    this.velocity.x = this.velocity.z = 0;
    if (!active) { this.label.hidden = true; return; }
    this.time += dt;
    if (!this.animator.busy) {
      if (this.route.length) this.walk(dt, arianna);
      else {
        if (this.time >= this.nextDecision) this.decide(arianna);
        // Standing still, she watches her big sister.
        if (!this.route.length && Math.hypot(arianna.x - this.root.position.x, arianna.z - this.root.position.z) < 3.5) this.animator.turnToward(arianna.x, arianna.z, dt);
      }
    }
    this.root.position.y = groundHeight(surfaces, this.root.position.x, this.root.position.z);
    this.animator.update(dt, this.velocity);
    this.socket.update();
  }

  private walk(dt: number, arianna: FloorPoint) {
    const p = this.root.position, next = this.route[0], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    // She reaches each waypoint exactly before turning, so she never cuts furniture corners.
    if (distance < 1e-4) { this.route.shift(); if (!this.route.length) this.arrive(); return; }
    const step = Math.min(distance, LILAH_WALK_SPEED * dt), x = p.x + dx / distance * step, z = p.z + dz / distance * step;
    if (Math.hypot(x - arianna.x, z - arianna.z) <= PERSONAL_SPACE) {
      // Wait for Arianna to move; after a second, give up and think again shortly.
      this.blockedFor += dt;
      if (this.blockedFor > 1) { this.route = []; this.state = 'watching'; this.nextDecision = this.time + 1; }
      return;
    }
    if (!this.planner.free(x, z)) { const goal = this.route[this.route.length - 1]; if (!this.go(goal, this.destination)) this.nextDecision = this.time + 2; return; }
    this.blockedFor = 0;
    p.x = x; p.z = z; this.velocity.x = dx / distance * LILAH_WALK_SPEED; this.velocity.z = dz / distance * LILAH_WALK_SPEED;
  }

  /** Place her speech bubble above her head (hidden near the screen edges, like PlayCanvas). */
  updateLabel(camera: Camera, canvas: HTMLElement) {
    if (!this.root.visible || performance.now() > this.speechUntil) { this.label.hidden = true; return; }
    const head = new Vector3(this.root.position.x, this.root.position.y + LILAH.displayHeight + .12, this.root.position.z).project(camera);
    const rect = canvas.getBoundingClientRect(), x = (head.x + 1) / 2 * rect.width, y = (1 - head.y) / 2 * rect.height;
    this.label.hidden = x < 10 || x > rect.width - 10 || y < 130 || y > rect.height - 130;
    if (this.label.hidden) return;
    const w = this.label.offsetWidth, h = this.label.offsetHeight;
    this.label.style.transform = `translate(${Math.max(4, Math.min(rect.width - w - 4, x - w / 2))}px,${y - h}px)`;
  }

  snapshot(renderer: WebGLRenderer) {
    return {position: [this.root.position.x, this.root.position.y, this.root.position.z], state: this.state, speech: this.speech, destination: this.destination,
      routeLength: this.route.length, time: this.time, nextDecision: this.nextDecision, carrying: this.carrying, visible: this.root.visible,
      socket: this.socket.getWorldPosition(new Vector3()).toArray(), animation: this.animator.snapshot(), quality: characterQuality(this.character, renderer)};
  }

  dispose() { this.label.remove(); this.root.removeFromParent(); }
}
