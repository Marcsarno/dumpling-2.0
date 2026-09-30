import {Vector3, type Camera, type Object3D} from 'three';
import {MissionSystem, TASKS, type TaskDefinition} from '../systems/MissionSystem';
import {HOUSE_TASKS, EXTRA_HOUSE_TASKS} from '../data/house';
import {InteractionSystem} from '../systems/InteractionSystem';
import {saveId} from '../systems/saveId';
import type {RegionSemantics} from '../world/format';
import type {CharacterAnimator} from '../characters/CharacterAnimator';
import type {PlayerMovement} from './movement';
import {RUN_SPEED, WALK_SPEED} from './movement';
import type {DayLoop} from './DayLoop';
import {createCleanupProps, type CleanupItem, type CleanupProps, type Interaction} from './cleanupProps';
import {CarrySystem} from './CarrySystem';
import {CleanupFeedback} from '../ui/CleanupFeedback';
import {RoundMesses} from './RoundMesses';
import {DailyRoutines} from './DailyRoutines';
import {addHouseProps} from './houseProps';
import {PetCare, PET_TASKS} from './PetCare';
import {ChoreAudio} from '../ui/ChoreAudio';
import type {PathArea} from './HousePath';

export type ChoreMode = 'day' | 'house' | 'bedroom' | 'pet' | 'practice';
const WORK_MS: Partial<Record<Interaction['kind'], number>> = {crayons: 450, vacuum: 1150, pet: 1600};
const DEG = Math.PI / 180;
/** Routine pickups that play PickUp (the rest of the instant routines play PutDown). */
const ROUTINE_PICKUPS = ['choose-clothes', 'night-clothes', 'take-egg', 'take-towel', 'daily-vacuum', 'take-breakfast'];
/** Getting into bed: 3.2 s path from where she stands onto the mattress (PlayCanvas BedEntry). */
export const BED_ENTRY_SECONDS = 3.2;

/**
 * Doing things around the house (the gameplay half of PlayCanvas CleanupGame): press the
 * action button near something, walk up to it, then pick up, put away, tap or hold to work.
 * Targets come from the vendored InteractionSystem (nearest available within range, with a
 * little hysteresis); carrying uses the socket between Arianna's hands; rounds are scored by
 * the vendored MissionSystem ($1 per task, $2 all-clean bonus in a timed 60 s round) and paid
 * through a one-time receipt. Everyday routines (DailyRoutines) pay $1 each through the day.
 *
 * Modes (the PlayCanvas mission picker): 'day' (everyday life), the timed one-minute rounds
 * 'house' (six of the eleven house chores, $8 when all done), 'bedroom' (five, $7) and 'pet'
 * (scoop · flush · wash, $3), and 'practice' (Explore: every chore, no timer or allowance).
 * In everyday life the afternoon's house chores and pet care pay $1 each through the day.
 */
export class Chores {
  readonly mission = new MissionSystem();
  readonly props: CleanupProps;
  readonly routines: DailyRoutines;
  readonly interactions: InteractionSystem;
  readonly carry: CarrySystem;
  readonly feedback: CleanupFeedback;
  readonly roundMesses: RoundMesses;
  readonly pet: PetCare;
  readonly audio = new ChoreAudio();
  /** Items that belong to rounds and house chores (not the everyday routine props). */
  private readonly roundItems: CleanupItem[];
  private readonly extras: CleanupItem[];
  mode: ChoreMode = 'day';
  roundId = saveId();
  aligning: Interaction | null = null;
  progress = 0;
  /** Floor height override while she sits at the table or lies in bed (else the rug/floor). */
  heightOverride: number | null = null;
  private activity: {target: Interaction; start: number; duration: number} | null = null;
  /** Where she stood before sitting down or getting into bed, and her facing then. */
  private seatReturn: {x: number; z: number; yaw: number} | null = null;
  private finishedHandled = false;
  private celebrated = false;
  private readonly announcement = document.createElement('p');
  readonly results = document.createElement('dialog');
  private readonly hands = new Vector3();
  private readonly rightHand = new Vector3();
  onFinished: (receipt: string, amount: number) => void = () => {};

  constructor(scene: Object3D, camera: Camera, semantics: RegionSemantics, private readonly movement: PlayerMovement,
    private readonly animator: CharacterAnimator, socket: Object3D, private readonly day: DayLoop, area: PathArea,
    private readonly rightHandBone: Object3D, base = import.meta.env.BASE_URL) {
    this.props = createCleanupProps(semantics);
    this.extras = addHouseProps(this.props, semantics);
    this.pet = new PetCare(this.props, base);
    this.roundItems = [...this.props.items];
    this.roundMesses = new RoundMesses(this.props, area);
    scene.add(this.props.root);
    this.carry = new CarrySystem(socket);
    this.routines = new DailyRoutines(this.props, semantics, day, this.carry, base);
    this.interactions = new InteractionSystem(this.props.interactions, target => this.pet.allows(target));
    this.feedback = new CleanupFeedback(scene, camera, this.props.interactions);
    this.announcement.id = 'cleanup-announcement'; this.announcement.className = 'sr-only';
    this.announcement.setAttribute('role', 'status'); this.announcement.setAttribute('aria-live', 'polite');
    this.results.id = 'results'; this.results.setAttribute('aria-labelledby', 'results-title');
    this.results.innerHTML = `<div class="results-flower" aria-hidden="true">✿</div><span class="eyebrow">A LITTLE HELP GOES A LONG WAY</span>
      <h2 id="results-title">Nice helping!</h2><p id="results-summary"></p>
      <div class="results-totals"><div><strong id="results-tasks">0 / 5</strong><span>tasks completed</span></div><div><strong id="results-money">$0</strong><span>allowance earned</span></div></div>
      <p id="results-bonus" hidden></p><ul id="results-list" aria-label="Completed tasks"></ul><p id="results-wallet"></p>
      <button id="replay" type="button" autofocus>Play again <span aria-hidden="true">↻</span></button>
      <button id="results-day" class="results-back" type="button">Back to everyday life</button>`;
    this.results.addEventListener('cancel', e => e.preventDefault());
    this.results.querySelector('#replay')!.addEventListener('click', () => this.replay());
    this.results.querySelector('#results-day')!.addEventListener('click', () => this.configure('day'));
    document.querySelector('#game')!.append(this.announcement, this.results);
    this.configure('day');
  }

  get carried() { return this.carry.item?.id ?? null; }
  /** Movement is locked while an action plays or work is under way (walk-ups still move). */
  get movementLocked() { return this.animator.busy || !!this.activity; }
  get working() { return !!this.activity; }
  get timed() { return this.mission.timed; }

  configure(mode: ChoreMode) {
    if (this.mission.state === 'running' && this.mission.timed) return;
    this.mode = mode;
    this.mission.continuous = mode === 'day';
    const tasks: readonly TaskDefinition[] = mode === 'day' ? this.day.clock.tasks : mode === 'pet' ? PET_TASKS : mode === 'bedroom' ? TASKS
      : mode === 'house' ? HOUSE_TASKS : [...TASKS, ...HOUSE_TASKS.filter(t => t.id !== 'book'), ...EXTRA_HOUSE_TASKS, ...PET_TASKS];
    this.mission.configure(tasks, mode !== 'practice' && mode !== 'day');
    this.replay();
  }

  replay() {
    this.roundId = saveId();
    this.cancelActivity(); this.aligning = null; this.movement.cancelApproach();
    this.dropHeld();
    // The house round draws six of its eleven chores each time (never the same six twice running).
    if (this.mode === 'house') this.mission.configure(this.roundMesses.houseTasks(), true);
    this.mission.reset(); this.feedback.reset(); this.results.close(); this.announcement.textContent = '';
    this.routines.active = this.mode === 'day'; this.routines.root.visible = this.mode === 'day';
    this.arrange();
    this.roundMesses.apply(this.mode);
    this.finishedHandled = this.celebrated = false; this.interactions.focus = null;
    if (this.mode !== 'day') { this.animator.cancelAction(); this.movement.place(0, .9); this.animator.setYaw(30 * DEG); }
  }

  /** The day moved on (new phase or a new day): props follow the saved state. */
  dayChanged() {
    if (this.mode !== 'day') return;
    this.cancelActivity(); this.aligning = null; this.movement.cancelApproach();
    this.dropHeld(); this.arrange();
  }

  /** Put down whatever she holds, back where it lives. */
  private dropHeld() {
    const held = this.carry.item;
    if (!held) return;
    const routine = [this.routines.outfit, this.routines.towel, this.routines.egg, this.routines.plate].includes(held);
    this.carry.release(routine ? this.routines.root : this.props.root, held.home);
  }

  /**
   * Show the props the current chores need (PlayCanvas houseProps.configure): round items for
   * the round's tasks, the crayons or their tidy cup, the dust pile, and the pet-care set.
   * In everyday life the routine props follow the saved day, and chores already done today
   * stay done after a reload (an upgrade: PlayCanvas put their items back out untidied).
   */
  private arrange() {
    this.syncDay();
    this.props.reset();
    for (const it of this.extras) { this.props.root.add(it.object); it.object.position.set(...it.home); it.object.rotation.set(0, 0, 0); it.object.scale.setScalar(1); }
    const active = new Set(this.mission.tasks.map(t => t.id));
    for (const it of this.roundItems) it.object.visible = active.has(it.id === 'vacuum' ? 'dirt' : it.id);
    this.props.crayonMess.visible = active.has('crayons'); this.props.tidyCrayons.visible = !active.has('crayons'); this.props.dirt.visible = active.has('dirt');
    this.pet.reset(active.has('pet-care'));
    this.routines.refresh();
    if (this.mode !== 'day') return;
    const done = this.day.state.done;
    for (const target of this.props.interactions) {
      if (target.kind !== 'place' || !target.task || !done.includes(target.task) || !active.has(target.task)) continue;
      const item = this.props.items.find(i => i.id === target.item);
      if (!item || !target.placement) continue;
      item.object.position.set(...target.placement);
      if (target.placedStyle === 'hide') item.object.visible = false;
      if (target.placedStyle === 'hang') item.object.rotation.set(Math.PI / 2, 0, 0);
    }
    if (done.includes('pet-care')) this.pet.finish();
  }

  private syncDay() {
    if (this.mode !== 'day') return;
    this.mission.tasks = this.day.clock.tasks;
    this.mission.completed.clear(); for (const id of this.day.state.done) this.mission.completed.add(id);
  }

  private refreshFocus() { this.interactions.update(this.movement.position as Vector3, this.carried, this.mission); }

  /** Action pressed (button, Space or E). */
  press = (now = performance.now()) => {
    this.mission.tick(now); this.refreshFocus();
    const target = this.interactions.focus;
    if (!target || this.activity || this.aligning || this.movementLocked || this.mission.state === 'finished') return;
    this.mission.start(now);
    this.aligning = target;
    const item = target.kind === 'pickup' ? this.props.items.find(i => i.id === target.item) : undefined;
    const point = target.placement ? {x: target.placement[0], z: target.placement[2]} : item ? item.object.getWorldPosition(new Vector3()) : target.marker;
    this.movement.approachProp(point, () => { this.aligning = null; this.mission.tick(performance.now()); if (this.mission.state !== 'finished') this.perform(target, performance.now()); },
      () => { this.aligning = null; });
  };

  /** Action released: hold work stops (tap work carries on). */
  cancelHold = () => {
    if (this.aligning && (this.aligning.kind === 'vacuum' || this.aligning.hold)) { this.movement.cancelApproach(); this.aligning = null; }
    if (this.activity && (this.activity.target.kind === 'vacuum' || this.activity.target.hold)) this.cancelActivity();
  };

  private perform(target: Interaction, now: number) {
    const face = target.placement ? {x: target.placement[0], z: target.placement[2]} : {x: target.marker.x, z: target.marker.z};
    if (target.id !== 'school-door') this.audio.start(target.id);
    if (target.kind === 'daily') return this.performRoutine(target, now, face);
    if (target.kind === 'pickup') {
      const item = this.props.items.find(i => i.id === target.item);
      if (!item) return;
      this.animator.playAction('PickUp', {face, onEvent: e => {
        if (e !== 'attach') return;
        this.mission.tick(performance.now());
        if (this.mission.state === 'finished' || !this.carry.pickUp(item)) return;
        if (item.id === 'scooper') this.pet.pickedUp();
        this.announce(`Picked up ${item.name}. Follow the glowing destination.`);
      }});
      return;
    }
    if (target.kind === 'pet' && target.id !== 'wash-hands') {
      // Scoop (bend down with the scooper) and flush (tip it into the toilet).
      const scoop = target.id === 'scoop-poop';
      this.animator.playAction(scoop ? 'PickUp' : 'PutDown', {face, onEvent: e => {
        if (e !== (scoop ? 'attach' : 'release')) return;
        this.mission.tick(performance.now());
        if (this.mission.state === 'finished') return;
        if (scoop) this.pet.scoop();
        else { this.carry.release(this.props.root, this.pet.tool.home); this.pet.flush(performance.now()); }
        this.announce(this.pet.hint ?? '');
      }});
      return;
    }
    if (target.kind === 'place') {
      if (this.carried !== target.item) return;
      this.animator.playAction('PutDown', {face, onEvent: e => {
        if (e !== 'release' || this.carried !== target.item) return;
        if (!this.mission.complete(target.task!, performance.now())) return;
        if (this.mode === 'day') this.day.complete(target.task!);
        const item = this.carry.release(this.props.root, target.placement!);
        if (item && target.placedStyle === 'hide') item.object.visible = false;
        if (item && target.placedStyle === 'hang') item.object.rotation.set(Math.PI / 2, 0, 0);
        this.reward(target, performance.now());
      }});
      return;
    }
    this.activity = {target, start: now, duration: WORK_MS[target.kind] ?? target.duration ?? 1000};
    if (target.kind === 'vacuum') { this.animator.workClip = 'Vacuum'; this.animator.faceTarget = {x: target.anchor.x, z: target.anchor.z}; }
    if (target.kind === 'pet') { this.animator.workClip = 'WashHands'; this.animator.faceTarget = {x: target.marker.x, z: target.marker.z}; }
  }

  /** Everyday routines (PlayCanvas CleanupGame.perform 'daily' branch). */
  private performRoutine(target: Interaction, now: number, face: {x: number; z: number}) {
    if (target.duration === 0) {
      this.animator.playAction(ROUTINE_PICKUPS.includes(target.id) ? 'PickUp' : 'PutDown', {face, onEvent: e => {
        if (e !== 'attach' && e !== 'release') return;
        this.routines.perform(target);
        if (target.task) this.feedback.reward(target.marker, '+$1', performance.now());
      }});
      return;
    }
    this.activity = {target, start: now, duration: target.duration ?? 1000};
    const p = this.movement.position;
    if (target.id === 'sleep') {
      this.seatReturn = {x: p.x, z: p.z, yaw: this.animator.yaw}; this.movement.cancelApproach(); this.animator.workClip = 'SleepEnter'; this.animator.faceTarget = null;
      return;
    }
    if (target.id === 'eat-breakfast') {
      const seat = this.routines.seat;
      this.seatReturn = {x: p.x, z: p.z, yaw: this.animator.yaw}; this.movement.place(seat.x, seat.z); this.animator.setYaw(seat.yaw);
      this.heightOverride = .07; this.animator.workClip = 'EatSit'; this.animator.faceTarget = seat.face;
      return;
    }
    this.animator.faceTarget = face;
    if (target.id.startsWith('wipe-')) this.animator.workClip = 'Wipe';
    else if (target.id.includes('vacuum')) this.animator.workClip = 'Vacuum';
    // Upgrades: real brushing and reading motions (PlayCanvas held the carry pose for both).
    else if (target.id === 'daily-teeth') this.animator.workClip = 'BrushTeeth';
    else if (target.id === 'bedtime-book') this.animator.workClip = 'Read';
    else if (target.id === 'feed-dog') this.animator.workClip = 'FeedBowl';
    else if (!target.hold) this.animator.workClip = 'CarryIdle';
  }

  /** Back to where she was standing after eating or waking (PlayCanvas leaveSeat). */
  private leaveSeat() {
    if (!this.seatReturn) return;
    this.movement.place(this.seatReturn.x, this.seatReturn.z); this.animator.setYaw(this.seatReturn.yaw);
    this.seatReturn = null; this.heightOverride = null;
  }

  private cancelActivity() {
    this.audio.stop();
    this.leaveSeat();
    this.animator.workClip = null; this.animator.faceTarget = null;
    this.activity?.target.mess?.scale.setScalar(1);
    this.activity = null; this.progress = 0;
    this.props.dirt.scale.setScalar(1); this.props.crayonMess.scale.setScalar(1);
  }

  private reward(target: Interaction, now: number) {
    this.feedback.reward(target.marker, this.mission.timed || this.mode === 'day' ? '+$1' : '✓', now);
    this.announce(`${target.name} cleaned up. ${this.mission.timed ? 'Earned $1. ' : ''}${this.mission.completed.size} of ${this.mission.tasks.length} tasks complete.`);
  }
  private announce(text: string) { this.announcement.textContent = text; }

  /** Bed entry pose at progress t (PlayCanvas bedEntry: reach, tuck, sit, recline). */
  private bedPose(t: number) {
    const start = this.seatReturn!, bed = this.routines.bedSpace;
    const key = (tt: number, x: number, z: number, h: number, y: number) => { const q = bed.point(x, z); return {t: tt, x: q.x, z: q.z, h: bed.height(h), y: bed.yaw(y)}; };
    const keys = [{t: 0, x: start.x, z: start.z, h: .027, y: start.yaw}, key(.2, -1, -1.75, .08, 90), key(.43, -1.35, -1.85, .91, 90), key(.65, -1.8, -1.85, .91, 35), key(1, -2.05, -1.85, .91, 0)];
    const c = Math.max(0, Math.min(1, t)), b = Math.max(1, keys.findIndex(k => k.t >= c)), a = keys[b - 1], z = keys[b];
    const raw = (c - a.t) / (z.t - a.t), u = raw * raw * (3 - 2 * raw);
    let dy = (z.y - a.y) % (2 * Math.PI); if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
    return {x: a.x + (z.x - a.x) * u, z: a.z + (z.z - a.z) * u, h: a.h + (z.h - a.h) * u, yaw: a.y + dy * u};
  }

  /** Per frame. `held`: is the action still held; `moving`: any movement input (starts the round timer). */
  update(now: number, held: boolean, moving: boolean) {
    if (!this.activity && !this.animator.busy) this.audio.stop();
    this.syncDay();
    if (moving && this.mode !== 'day') this.mission.start(now);
    this.mission.tick(now); this.refreshFocus();
    // Carrying pace follows the item: bulky things (vacuum, a full plate) are a steady walk.
    const item = this.carry.item, bulky = item?.carryPace === 'walk';
    this.animator.carrying = !!item; this.animator.carryPace = bulky ? 'walk' : 'run';
    this.movement.speed = bulky ? WALK_SPEED * (item!.id === 'vacuum' ? 1.5 : 1) : RUN_SPEED;
    const a = this.activity;
    if (a) {
      if (a.target.id === 'sleep' && this.seatReturn) {
        const t = (now - a.start) / (BED_ENTRY_SECONDS * 1000), pose = this.bedPose(t);
        this.movement.position.x = pose.x; this.movement.position.z = pose.z; this.animator.setYaw(pose.yaw); this.heightOverride = pose.h;
        if (t >= 1) this.animator.workClip = 'Sleep';
      }
      const inRange = !!this.seatReturn || this.interactions.distance(a.target, this.movement.position as Vector3) <= a.target.range + .1;
      if (!inRange || document.hidden || ((a.target.kind === 'vacuum' || a.target.hold) && !held)) this.cancelActivity();
      else {
        this.progress = Math.min(1, (now - a.start) / a.duration);
        const mess = a.target.kind === 'vacuum' ? this.props.dirt : a.target.kind === 'crayons' ? this.props.crayonMess : a.target.mess;
        mess?.scale.setScalar(1 - this.progress * .92);
        if (this.progress >= 1) this.finishWork(a.target, now);
      }
    }
    if (this.mission.state === 'finished') {
      if (!this.finishedHandled) {
        this.finishedHandled = true; this.cancelActivity(); this.aligning = null; this.movement.cancelApproach();
        this.onFinished(this.roundId, this.mission.allowance);
        if (this.mission.reason !== 'complete') this.animator.cancelAction();
      }
      if (this.mission.reason === 'complete' && !this.animator.busy && !this.celebrated) { this.celebrated = true; this.animator.playAction('Celebrate'); }
      else if (!this.animator.busy) this.showResults();
    }
    this.carry.socket.getWorldPosition(this.hands); this.rightHandBone.getWorldPosition(this.rightHand);
    this.routines.update(now, this.activity?.target ?? null, this.progress, this.hands, this.rightHand, this.animator.yaw);
    this.pet.update(now, this.activity?.target.kind === 'pet' ? this.progress : 0, this.hands);
    this.feedback.update(now, this.interactions, this.carried, this.hands, this.mission, !this.activity && !this.animator.busy);
  }

  private finishWork(target: Interaction, now: number) {
    if (target.kind === 'daily') {
      this.animator.workClip = null; this.animator.faceTarget = null;
      this.activity = null; this.progress = 0;
      this.routines.perform(target);
      this.leaveSeat();
      this.feedback.reward(target.marker, target.task ? '+$1' : '✓', now);
      return;
    }
    this.cancelActivity();
    if (!this.mission.complete(target.task!, now)) return;
    if (target.kind === 'pet') { this.pet.finish(); if (this.mode === 'day') this.day.complete(target.task!); }
    if (target.kind === 'crayons') { this.props.crayonMess.visible = false; this.props.tidyCrayons.visible = true; }
    if (target.kind === 'vacuum') {
      this.props.dirt.visible = false;
      const vacuum = this.props.items.find(i => i.id === 'vacuum')!;
      this.animator.playAction('PutDown', {face: {x: target.anchor.x, z: target.anchor.z}, onEvent: e => {
        if (e === 'release' && this.carried === 'vacuum') this.carry.release(this.props.root, vacuum.home);
      }});
    }
    if (target.mess) target.mess.visible = false;
    this.reward(target, now);
  }

  /** What the big button says (PlayCanvas CleanupHUD titles). */
  get action() {
    const focus = this.activity?.target ?? this.interactions.focus, clip = this.animator.actionName;
    const busy = !!this.activity && (this.activity.target.kind === 'crayons' || this.activity.target.kind === 'pet' || (this.activity.target.kind === 'daily' && !this.activity.target.hold));
    let title = 'Action', detail = 'Come closer';
    if (focus) { title = focus.actionLabel ?? {pickup: 'Pick up', place: 'Put away', crayons: 'Tidy up', vacuum: 'Hold to clean', pet: 'Action', daily: 'Action'}[focus.kind]; detail = focus.name; }
    if (busy) { title = focus?.kind === 'pet' ? 'Washing…' : focus?.kind === 'daily' ? `${focus.name}…` : 'Tidying…'; detail = 'One moment'; }
    if (clip) { title = clip === 'PickUp' ? 'Picking up…' : clip === 'PutDown' ? 'Putting away…' : 'Lovely!'; detail = 'One moment'; }
    if (this.mission.state === 'finished') { title = 'Well done'; detail = 'Round complete'; }
    if (this.aligning) { title = 'Moving closer…'; detail = this.aligning.name; }
    const ready = !!focus && !busy && !clip && !this.aligning && this.mission.state !== 'finished';
    return {ready, title, detail, target: ready ? focus!.id : '', progress: this.progress};
  }

  /** The journal nudge during rounds (PlayCanvas CleanupHUD hint). */
  get hint() {
    const m = this.mission, item = this.carry.item, pet = this.pet.hint;
    let hint = 'Find an item. Walk close, then tap Action.';
    if (m.state === 'ready') hint = 'Move to start · 60 seconds · $1 per task';
    else if (item) hint = item.id === 'vacuum' ? '✦ Go to the dirt, then hold Action to vacuum.' : `${item.icon} Take ${item.name.toLowerCase()} to ${this.feedback.destinationIcon || 'the glowing destination'}.`;
    else if (this.interactions.focus?.kind === 'crayons') hint = '🖍 Tap Action to put the crayons in their cup.';
    if (m.state === 'finished') hint = 'Every little bit helps. Nice work, Arianna!';
    if (!m.timed && !item && m.state !== 'finished') hint = 'Explore freely · Practice tasks · No timer or allowance';
    if (pet && m.state !== 'finished' && (m.tasks.length === 1 || item?.id === 'scooper' || pet.startsWith('🫧'))) hint = pet;
    return hint;
  }

  /**
   * Everyday life's nudge while a chore is under way (upgrade: PlayCanvas always showed the
   * day's general line, even halfway through pet care). Null means the day's own hint.
   */
  get dayHint(): string | null {
    if (this.mode !== 'day') return null;
    const item = this.carry.item, pet = this.pet.hint;
    if (pet && (item?.id === 'scooper' || pet.startsWith('🫧'))) return pet;
    if (item?.id === 'vacuum') return this.routines.dustLeft ? '✦ Go to the dust, then hold Action to vacuum.' : '↩ All vacuumed! Put the vacuum back in the utility room.';
    if (item?.id === 'paper-towel' && this.day.state.phase === 'afternoon') return '🧻 Hold Action over the kitchen spill to wipe it.';
    const chore = item && this.props.interactions.find(t => t.kind === 'place' && t.item === item.id);
    if (chore) return `${item.icon} Take ${item.name.toLowerCase()} to the ${chore.name.toLowerCase()}.`;
    return null;
  }

  private showResults() {
    if (this.results.open) return;
    const m = this.mission, q = (s: string) => this.results.querySelector<HTMLElement>(s)!;
    q('#results-title').textContent = m.reason === 'complete' ? (m.tasks.length === 6 ? 'House ready!' : m.tasks.length === 5 ? 'Room ready!' : 'All tidied up!') : 'Nice helping!';
    q('#results-summary').textContent = m.reason === 'complete' ? `All ${m.tasks.length} tasks done. A little helping makes a happy home!`
      : m.completed.size ? 'Look at what you did in one little minute.' : 'A little practice goes a long way. Let’s try again!';
    q('#results-tasks').textContent = `${m.completed.size} / ${m.tasks.length}`;
    q('#results-money').textContent = `$${m.allowance}`;
    const bonus = q('#results-bonus'); bonus.hidden = !m.bonus; bonus.textContent = `Includes a $${m.bonus} all-clean bonus ✦`;
    q('#results-wallet').textContent = this.day.message || `Saved to your wallet · $${this.day.balance}`;
    const list = q('#results-list'); list.replaceChildren();
    for (const task of m.tasks) { const row = document.createElement('li'); row.textContent = `${m.completed.has(task.id) ? '✓' : '○'} ${task.name}`; row.classList.toggle('done', m.completed.has(task.id)); list.append(row); }
    this.results.showModal(); q('#replay').focus();
  }

  snapshot() {
    const item = this.carry.item;
    return {mode: this.mode, state: this.mission.state, timed: this.mission.timed, remaining: this.mission.remaining, allowance: this.mission.allowance, bonus: this.mission.bonus,
      tasks: this.mission.tasks.map(t => t.id), completed: [...this.mission.completed], focus: this.interactions.focus?.id ?? null,
      carrying: item?.id ?? null, carriedParent: item?.object.parent?.name ?? null, carriedPosition: item ? item.object.getWorldPosition(new Vector3()).toArray() : null,
      aligning: this.aligning?.id ?? null, working: this.activity?.target.id ?? null, progress: this.progress, roundId: this.roundId,
      workClip: this.animator.workClip, seated: !!this.seatReturn, heightOverride: this.heightOverride, pet: this.pet.snapshot(), audio: this.audio.snapshot(),
      dust: this.routines.dust.map(d => ({visible: d.visible, position: d.position.toArray(), scale: d.scale.x})), dogFood: this.routines.dogFood.visible,
      items: this.props.items.map(i => ({id: i.id, visible: i.object.visible, position: i.object.getWorldPosition(new Vector3()).toArray(), home: i.home})),
      targets: this.props.interactions.map(t => ({id: t.id, position: [t.anchor.x, 0, t.anchor.z], range: t.range}))};
  }

  dispose() { this.audio.destroy(); this.feedback.dispose(); this.props.root.removeFromParent(); this.announcement.remove(); this.results.remove(); }
}
