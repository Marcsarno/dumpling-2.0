import {Box3, Group, Vector3, type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SPILL_LOCATIONS} from '../systems/DailyClock';
import type {RegionSemantics} from '../world/format';
import {propSpace} from '../world/propSpace';
import {shapes, type Triple} from '../world/primitives';
import type {DayLoop} from './DayLoop';
import type {CarrySystem} from './CarrySystem';
import type {CleanupItem, CleanupProps, Interaction} from './cleanupProps';

/** House palette used by the routine props (PlayCanvas bedroom.ts materials). */
const M = {trim: '#fff1df', pink: '#e99db9', yellow: '#f3d68f', blue: '#9cbed5', dark: '#76647e', sky: '#c4e4ea'};

/**
 * Everyday routines (the chore half of PlayCanvas DailyLife): brushing teeth, choosing and
 * putting away clothes, the breakfast chain (take an egg, crack it — half the time it drops
 * and needs a paper towel — cook, carry, serve, sit and eat), the bedtime book, going to bed,
 * and leaving for school. Each routine is a 'daily' interaction whose availability follows
 * the saved day, so a reload puts every prop back where the day left it.
 *
 * Static fixtures (pan, toothbrush cup, drawers, dog bowl) are already part of the converted
 * house; only the props that move are built here.
 *
 * Stand-in until outdoors lands (P4): PlayCanvas walks out of the front door and along the
 * garden path to the school gate. Here the front door offers "Go to school" once school is due.
 */
export class DailyRoutines {
  readonly root = new Group();
  readonly outfit: CleanupItem; readonly towel: CleanupItem; readonly egg: CleanupItem; readonly plate: CleanupItem;
  readonly cooked = new Group(); readonly spill: Object3D; readonly eggSpill: Object3D;
  readonly bubbles = new Group(); readonly wipingPaper: Object3D; readonly book = new Group();
  private eggFall = 0;
  active = false;
  onSchool: () => void = () => {};
  private readonly stove; private readonly dining; private readonly bed;

  constructor(private readonly props: CleanupProps, semantics: RegionSemantics, private readonly day: DayLoop, private readonly carry: CarrySystem, base: string) {
    this.root.name = 'Daily routines'; props.root.add(this.root);
    this.stove = propSpace(semantics, 'stove'); this.dining = propSpace(semantics, 'dining'); this.bed = propSpace(semantics, 'bed');
    const item = (id: string, name: string, icon: string, home: Triple): CleanupItem => {
      const object = new Group(); object.name = name; object.position.set(...home); this.root.add(object);
      const it = {id, name, icon, object, home}; props.items.push(it); return it;
    };
    this.outfit = item('daily-outfit', 'Clothes', '👕', [-.7, .7, 3.05]);
    const clothes = shapes(this.outfit.object);
    clothes('Shirt', 'box', [0, .03, 0], [.38, .06, .32], M.pink);
    for (const x of [-.23, .23]) clothes('Sleeve', 'box', [x, .03, -.1], [.18, .06, .15], M.pink);
    this.towel = item('paper-towel', 'Paper towel', '🧻', [-2.65, 1.02, 10.5]);
    void this.importProp(this.towel.object, base + 'assets/pets/paper.glb', .23);
    this.egg = item('breakfast-egg', 'Egg', '🥚', [-2.68, 1.15, 14.55]);
    shapes(this.egg.object)('Egg', 'sphere', [0, .1, 0], [.14, .2, .14], M.trim);
    const stoveTop = this.at(this.stove, [-2.63, 1.12, 12.65]);
    this.cooked.name = 'Cooked breakfast'; this.cooked.position.set(...stoveTop); this.root.add(this.cooked);
    const food = shapes(this.cooked);
    food('Egg white', 'sphere', [0, 0, 0], [.37, .025, .3], M.trim); food('Egg yolk', 'sphere', [0, .025, 0], [.15, .05, .15], M.yellow);
    this.plate = item('breakfast-plate', 'Egg on a plate', '🍳', [-2.63, 1.13, 12.65]); this.plate.carryPace = 'walk';
    const plate = shapes(this.plate.object);
    plate('Breakfast plate rim', 'cylinder', [0, 0, 0], [.53, .035, .53], M.blue); plate('Breakfast plate', 'cylinder', [0, .021, 0], [.46, .012, .46], M.trim);
    plate('Plated egg white', 'sphere', [0, .039, 0], [.35, .025, .3], M.trim); plate('Plated egg yolk', 'sphere', [0, .06, 0], [.15, .055, .15], M.yellow);
    const makeSpill = (name: string, position: Triple) => {
      const g = new Group(); g.name = name; g.position.set(...position); this.root.add(g); const s = shapes(g);
      for (let i = 0; i < 7; i++) s('Puddle', 'sphere', [Math.sin(i * 2) * .22, .01, Math.cos(i * 2) * .16], [.35, .022, .3], i === 0 ? M.yellow : M.trim, false);
      return g;
    };
    this.spill = makeSpill('Kitchen spill', [.1, .04, 11.1]); this.eggSpill = makeSpill('Dropped egg', [-1.5, .04, 12.55]);
    this.bubbles.name = 'Toothpaste foam'; this.root.add(this.bubbles);
    const foam = shapes(this.bubbles); for (let i = 0; i < 6; i++) foam('Foam', 'sphere', [Math.sin(i) * .05, i * .012, Math.cos(i) * .04], [.03, .03, .03], M.sky, false);
    this.wipingPaper = shapes(this.root)('Paper wiping the floor', 'box', [0, .09, 0], [.28, .012, .23], M.trim, false); this.wipingPaper.visible = false;
    // Upgrade: an open storybook in her hands while she reads (PlayCanvas showed empty hands).
    this.book.name = 'Bedtime book'; const pages = shapes(this.book);
    pages('Open book cover', 'box', [0, 0, 0], [.34, .015, .24], '#739fcf'); pages('Open book pages', 'box', [0, .012, 0], [.32, .012, .22], M.trim);
    this.root.add(this.book); this.book.visible = false;

    const target = (id: string, name: string, icon: string, anchor: Triple, marker: Triple, available: (held: string | null) => boolean,
      duration = 650, task?: string, hold = false, mess?: Object3D) => {
      props.interactions.push({id, name, icon, kind: 'daily', actionLabel: name, anchor: new Vector3(...anchor), marker: new Vector3(...marker), range: 1, task, duration, hold, mess,
        available: carried => this.active && available(carried)});
    };
    const s = () => this.day.state, phase = () => s().phase, notDone = (id: string) => !s().done.includes(id);
    target('daily-teeth', 'Brush teeth', '🪥', [4.12, 0, -2.35], [4.12, 1.15, -3.03], h => !h && (phase() === 'morning' || phase() === 'night') && notDone('teeth'), 1800, 'teeth');
    target('choose-clothes', 'Choose clothes', '👕', [-.7, 0, 2.4], [-.7, .8, 3.05], h => !h && phase() === 'morning' && notDone('outfit'), 0);
    target('get-dressed', 'Get dressed', '👕', [-.85, 0, -.65], [-1.35, .9, -.65], h => h === 'daily-outfit' && phase() === 'morning', 850, 'outfit');
    target('night-clothes', 'Pick up clothes', '👕', [-.85, 0, -.65], [-1.35, .9, -.65], h => !h && phase() === 'night' && notDone('outfit'), 0);
    target('clothes-drawer', 'Put clothes inside', '👕', [-.7, 0, 2.4], [-.7, .8, 3.05], h => h === 'daily-outfit' && phase() === 'night', 0, 'outfit');
    target('take-egg', 'Take an egg', '🥚', [-1.8, 0, 14.55], [-2.6, 1.1, 14.55], h => !h && phase() === 'morning' && s().breakfast === 'eggs', 0);
    target('crack-egg', 'Crack egg', '🥚', [-1.8, 0, 12.65], [-2.63, 1.15, 12.65], h => h === 'breakfast-egg', 0);
    target('cook-egg', 'Cook breakfast', '🍳', [-1.8, 0, 12.65], [-2.63, 1.15, 12.65], h => !h && phase() === 'morning' && s().breakfast === 'cook', 2200);
    target('take-breakfast', 'Carry breakfast', '🍳', [-1.8, 0, 12.65], [-2.63, 1.15, 12.65], h => !h && phase() === 'morning' && s().breakfast === 'serve' && s().breakfastAtTable === false, 0);
    target('serve-breakfast', 'Put breakfast on table', '🍽', [.55, 0, 11.9], [.55, .9, 13.15], h => h === 'breakfast-plate', 0);
    target('eat-breakfast', 'Eat breakfast', '🍽', [.55, 0, 11.9], [.55, .9, 13.15], h => !h && phase() === 'morning' && s().breakfast === 'serve' && s().breakfastAtTable !== false, 4200, 'breakfast');
    target('take-towel', 'Take paper towel', '🧻', [-1.8, 0, 10.5], [-2.65, 1.15, 10.5], h => !h && (s().breakfast === 'spill' && phase() === 'morning' || phase() === 'afternoon' && this.needs('spill')), 0);
    target('wipe-egg', 'Wipe dropped egg', '🧻', [-1.5, 0, 12.55], [-1.5, .12, 12.55], h => h === 'paper-towel' && s().breakfast === 'spill', 1200, undefined, true, this.eggSpill);
    target('wipe-spill', 'Wipe spill', '🧻', [.1, 0, 11.1], [.1, .12, 11.1], h => h === 'paper-towel' && phase() === 'afternoon' && notDone('spill'), 1200, 'spill', true, this.spill);
    target('put-tool-away', 'Put tool away', '↩', [0, 0, 0], [0, .8, 0], h => h === 'vacuum' || h === 'paper-towel', 0);
    target('bedtime-book', 'Read a bedtime book', '📘', [-.85, 0, -.8], [-1.4, .9, -.8], h => !h && phase() === 'night' && notDone('read'), 1600, 'read');
    target('school-door', 'Go to school', '🎒', [-2.35, 0, 8.2], [-3.1, 1.1, 8.2], h => !h && this.day.clock.schoolDue, 0);
    target('sleep', 'Go to bed', '🌙', [-.85, 0, -1.6], [-1.4, .8, -1.6], h => !h && this.canSleep, 6500);
    // Editor overrides (anchor:/marker:/placement: tags) for routine targets.
    for (const edit of semantics.interactions ?? []) {
      const t = props.interactions.find(i => i.id === edit.id && i.kind === 'daily');
      if (!t) continue;
      if (edit.anchor) t.anchor.set(edit.anchor[0], 0, edit.anchor[2]);
      if (edit.marker) t.marker.set(...edit.marker);
      if (edit.placement) t.placement = [...edit.placement];
    }
    this.refresh();
  }

  private at(space: ReturnType<typeof propSpace>, [x, y, z]: Triple): Triple { const p = space.point(x, z); return [p.x, y, p.z]; }
  private needs(id: string) { return this.day.clock.tasks.some(t => t.id === id) && !this.day.state.done.includes(id); }
  /** All of today's chores done, at night (PlayCanvas also allows the afternoon once shopping is done — P3). */
  get canSleep() { return this.day.clock.ready && this.day.state.phase === 'night'; }
  /** Where she eats: the dining chair spot and the table point she faces. */
  get seat() { const p = this.dining.point(.55, 12.49), f = this.dining.point(.55, 13.85); return {x: p.x, z: p.z, yaw: this.dining.yaw(0), face: f}; }
  get bedSpace() { return this.bed; }

  private async importProp(parent: Object3D, url: string, height: number) {
    const gltf = await new GLTFLoader().loadAsync(url), model = gltf.scene;
    model.traverse(o => { if ((o as {isMesh?: boolean}).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model), k = height / Math.max(1e-6, box.max.y - box.min.y);
    model.scale.setScalar(k); model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    parent.add(model);
  }

  /** Put every routine prop where the saved day says it is (PlayCanvas DailyLife.refresh). */
  refresh() {
    const st = this.day.state;
    const spill = SPILL_LOCATIONS[st.spillSite ?? 0] ?? SPILL_LOCATIONS[0];
    this.spill.position.set(spill[0], .04, spill[1]);
    const wipe = this.props.interactions.find(t => t.id === 'wipe-spill')!; wipe.anchor.set(spill[0], 0, spill[1]); wipe.marker.set(spill[0], .12, spill[1]);
    for (const m of [this.spill, this.eggSpill]) m.scale.setScalar(1);
    this.spill.visible = st.phase === 'afternoon' && this.needs('spill');
    this.eggSpill.visible = st.breakfast === 'spill' && st.phase === 'morning';
    this.cooked.visible = st.phase === 'morning' && st.breakfast === 'cook';
    for (const it of [this.outfit, this.towel, this.egg, this.plate]) {
      if (this.carry.item === it) continue;
      this.root.add(it.object); it.object.position.set(...it.home); it.object.rotation.set(0, 0, 0); it.object.scale.setScalar(1);
    }
    this.plate.object.visible = st.phase === 'morning' && st.breakfast === 'serve';
    if (this.plate.object.parent === this.root) this.plate.object.position.set(...(st.breakfastAtTable === false ? this.plate.home : this.at(this.dining, [.55, .975, 13.28])));
    this.outfit.object.visible = (st.phase === 'morning' || st.phase === 'night') && !st.done.includes('outfit');
    if (st.phase === 'night' && this.outfit.object.parent === this.root) this.outfit.object.position.set(...this.at(this.bed, [-1.4, .91, -.65]));
    this.egg.object.visible = st.phase === 'morning' && st.breakfast === 'eggs';
    this.towel.object.visible = true;
    this.bubbles.visible = this.wipingPaper.visible = this.book.visible = false; this.eggFall = 0;
  }

  /** Apply a finished routine (PlayCanvas DailyLife.perform). Pays the task's $1 through the day. */
  perform(target: Interaction) {
    const take = (it: CleanupItem) => { it.object.visible = true; this.carry.pickUp(it); };
    const release = () => { const it = this.carry.item; if (it) { this.carry.release(this.root, it.home); it.object.visible = false; } };
    const st = this.day.state;
    switch (target.id) {
      case 'choose-clothes': case 'night-clothes': take(this.outfit); break;
      case 'take-egg': take(this.egg); break;
      case 'take-towel': take(this.towel); break;
      case 'put-tool-away': { const it = this.carry.item; if (it) { this.carry.release(it.object === this.towel.object ? this.root : this.props.root, it.home); it.object.visible = true; } break; }
      case 'crack-egg':
        release(); this.day.clock.crackEgg(); this.eggSpill.visible = false; this.cooked.visible = st.breakfast === 'cook';
        if (!this.cooked.visible) { this.egg.object.visible = true; this.eggFall = performance.now(); }
        break;
      case 'wipe-egg': this.eggSpill.visible = false; release(); st.breakfast = 'cook'; this.cooked.visible = true; break;
      case 'wipe-spill': this.spill.visible = false; release(); break;
      case 'cook-egg': st.breakfast = 'serve'; st.breakfastAtTable = false; this.cooked.visible = false; take(this.plate); break;
      case 'take-breakfast': take(this.plate); break;
      case 'serve-breakfast': this.carry.release(this.root, this.at(this.dining, [.55, .975, 13.28])); st.breakfastAtTable = true; break;
      case 'eat-breakfast': this.plate.object.visible = false; st.breakfast = 'done'; break;
      case 'get-dressed': case 'clothes-drawer': release(); break;
      case 'school-door': if (this.day.clock.goSchool()) this.onSchool(); break;
      case 'sleep': if (this.canSleep) this.day.sleep(true); break;
    }
    if (target.task) this.day.complete(target.task);
    if (target.mess) target.mess.visible = false;
    this.day.save();
  }

  /** Per frame: the dropping egg, the tool return spot, and work effects at her hands. */
  update(now: number, working: Interaction | null, progress: number, hands: Vector3, rightHand: Vector3, yaw: number) {
    if (this.eggFall) {
      const t = Math.min(1, (now - this.eggFall) / 420), a = this.at(this.stove, [-2.63 + 1.13 * t, 1.12 * (1 - t * t), 12.65 - .1 * t]);
      this.egg.object.position.set(...a); this.egg.object.rotation.set(0, 0, t * 140 * Math.PI / 180);
      if (t === 1) { this.eggFall = 0; this.egg.object.visible = false; this.eggSpill.visible = true; }
    }
    const tool = this.props.interactions.find(t => t.id === 'put-tool-away')!, held = this.carry.item;
    const home = held?.id === 'vacuum' ? held.home : this.towel.home;
    tool.anchor.set(home[0], 0, home[2]); tool.marker.set(home[0], home[1] + .8, home[2]);
    this.bubbles.visible = working?.id === 'daily-teeth' && progress > 0;
    if (this.bubbles.visible) this.bubbles.position.copy(rightHand).add(new Vector3(0, .04, 0));
    const wiping = !!working && working.id.startsWith('wipe-') && progress > 0;
    this.wipingPaper.visible = wiping;
    if (wiping) { this.wipingPaper.position.set(rightHand.x, Math.max(.06, rightHand.y - .05), rightHand.z); }
    this.book.visible = working?.id === 'bedtime-book' && progress > 0;
    if (this.book.visible) { this.book.position.copy(hands); this.book.rotation.set(-60 * Math.PI / 180, yaw, 0, 'YXZ'); }
  }
}
