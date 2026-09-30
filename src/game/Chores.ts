import {Vector3, type Camera, type Object3D} from 'three';
import {MissionSystem, TASKS, type TaskDefinition} from '../systems/MissionSystem';
import {InteractionSystem} from '../systems/InteractionSystem';
import {saveId} from '../systems/saveId';
import type {RegionSemantics} from '../world/format';
import type {CharacterAnimator} from '../characters/CharacterAnimator';
import type {PlayerMovement} from './movement';
import {RUN_SPEED, WALK_SPEED} from './movement';
import type {DayLoop} from './DayLoop';
import {createCleanupProps, type CleanupProps, type Interaction} from './cleanupProps';
import {CarrySystem} from './CarrySystem';
import {CleanupFeedback} from '../ui/CleanupFeedback';
import {RoundMesses} from './RoundMesses';
import type {PathArea} from './HousePath';

export type ChoreMode = 'day' | 'bedroom';
const WORK_MS: Partial<Record<Interaction['kind'], number>> = {crayons: 450, vacuum: 1150, pet: 1600};

/**
 * Doing things around the house (the gameplay half of PlayCanvas CleanupGame): press the
 * action button near something, walk up to it, then pick up, put away, tap or hold to work.
 * Targets come from the vendored InteractionSystem (nearest available within range, with a
 * little hysteresis); carrying uses the socket between Arianna's hands; rounds are scored by
 * the vendored MissionSystem ($1 per task, $2 all-clean bonus in a timed 60 s round) and paid
 * through a one-time receipt.
 *
 * Modes so far: 'day' (everyday life, chores arrive with slice 3) and 'bedroom' (the timed
 * five-task tidy round). The other rounds and the mission picker's full list land in slice 4.
 */
export class Chores {
  readonly mission = new MissionSystem();
  readonly props: CleanupProps;
  readonly interactions: InteractionSystem;
  readonly carry: CarrySystem;
  readonly feedback: CleanupFeedback;
  readonly roundMesses: RoundMesses;
  mode: ChoreMode = 'day';
  roundId = saveId();
  aligning: Interaction | null = null;
  progress = 0;
  private activity: {target: Interaction; start: number; duration: number} | null = null;
  private finishedHandled = false;
  private celebrated = false;
  private readonly announcement = document.createElement('p');
  readonly results = document.createElement('dialog');
  private readonly hands = new Vector3();
  onFinished: (receipt: string, amount: number) => void = () => {};

  constructor(scene: Object3D, camera: Camera, semantics: RegionSemantics, private readonly movement: PlayerMovement,
    private readonly animator: CharacterAnimator, socket: Object3D, private readonly day: DayLoop, area: PathArea) {
    this.props = createCleanupProps(semantics);
    this.roundMesses = new RoundMesses(this.props, area);
    scene.add(this.props.root);
    this.carry = new CarrySystem(socket);
    this.interactions = new InteractionSystem(this.props.interactions);
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
    const tasks: readonly TaskDefinition[] = mode === 'day' ? this.day.clock.tasks : TASKS;
    this.mission.configure(tasks, mode !== 'day');
    this.replay();
  }

  replay() {
    this.roundId = saveId();
    this.cancelActivity(); this.aligning = null; this.movement.cancelApproach();
    this.carry.item = null; this.animator.carrying = false; this.animator.carryPace = 'run'; this.movement.speed = RUN_SPEED;
    this.props.reset(); this.mission.reset(); this.feedback.reset(); this.results.close(); this.announcement.textContent = '';
    for (const it of this.props.items) it.object.visible = this.mode !== 'day';
    this.props.crayonMess.visible = this.props.dirt.visible = this.mode !== 'day';
    this.roundMesses.apply(this.mode);
    this.syncDay();
    this.finishedHandled = this.celebrated = false; this.interactions.focus = null;
    if (this.mode !== 'day') { this.animator.cancelAction(); this.movement.place(0, .9); this.animator.setYaw(30 * Math.PI / 180); }
  }

  private syncDay() {
    if (this.mode !== 'day') return;
    this.mission.tasks = this.day.clock.tasks;
    for (const id of this.day.state.done) this.mission.completed.add(id);
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
    if (target.kind === 'pickup') {
      const item = this.props.items.find(i => i.id === target.item);
      if (!item) return;
      this.animator.playAction('PickUp', {face, onEvent: e => {
        if (e !== 'attach' || !this.carry.pickUp(item)) return;
        this.animator.carrying = true;
        const bulky = item.carryPace === 'walk';
        this.animator.carryPace = bulky ? 'walk' : 'run';
        this.movement.speed = bulky ? WALK_SPEED * (item.id === 'vacuum' ? 1.5 : 1) : RUN_SPEED;
        this.announce(`Picked up ${item.name}. Follow the glowing destination.`);
      }});
      return;
    }
    if (target.kind === 'place') {
      if (this.carried !== target.item) return;
      this.animator.playAction('PutDown', {face, onEvent: e => {
        if (e !== 'release' || this.carried !== target.item) return;
        if (!this.mission.complete(target.task!, performance.now())) return;
        const item = this.carry.release(this.props.root, target.placement!);
        if (item && target.placedStyle === 'hide') item.object.visible = false;
        if (item && target.placedStyle === 'hang') item.object.rotation.set(Math.PI / 2, 0, 0);
        this.dropped();
        this.reward(target, performance.now());
      }});
      return;
    }
    this.activity = {target, start: now, duration: WORK_MS[target.kind] ?? target.duration ?? 1000};
  }

  private dropped() { this.animator.carrying = false; this.animator.carryPace = 'run'; this.movement.speed = RUN_SPEED; }

  private cancelActivity() {
    this.activity?.target.mess?.scale.setScalar(1);
    this.activity = null; this.progress = 0;
    this.props.dirt.scale.setScalar(1); this.props.crayonMess.scale.setScalar(1);
  }

  private reward(target: Interaction, now: number) {
    this.feedback.reward(target.marker, this.mission.timed || this.mode === 'day' ? '+$1' : '✓', now);
    this.announce(`${target.name} cleaned up. ${this.mission.timed ? 'Earned $1. ' : ''}${this.mission.completed.size} of ${this.mission.tasks.length} tasks complete.`);
  }
  private announce(text: string) { this.announcement.textContent = text; }

  /** Per frame. `held`: is the action still held; `moving`: any movement input (starts the round timer). */
  update(now: number, held: boolean, moving: boolean) {
    this.syncDay();
    if (moving && this.mode !== 'day') this.mission.start(now);
    this.mission.tick(now); this.refreshFocus();
    const a = this.activity;
    if (a) {
      const inRange = this.interactions.distance(a.target, this.movement.position as Vector3) <= a.target.range + .1;
      if (!inRange || document.hidden || ((a.target.kind === 'vacuum' || a.target.hold) && !held)) this.cancelActivity();
      else {
        this.progress = Math.min(1, (now - a.start) / a.duration);
        const mess = a.target.kind === 'vacuum' ? this.props.dirt : a.target.kind === 'crayons' ? this.props.crayonMess : a.target.mess;
        mess?.scale.setScalar(1 - this.progress * .92);
        if (this.progress >= 1) {
          const target = a.target; this.cancelActivity();
          if (this.mission.complete(target.task!, now)) {
            if (target.kind === 'crayons') { this.props.crayonMess.visible = false; this.props.tidyCrayons.visible = true; }
            if (target.kind === 'vacuum') {
              this.props.dirt.visible = false;
              const vacuum = this.props.items.find(i => i.id === 'vacuum')!;
              this.animator.playAction('PutDown', {face: {x: target.anchor.x, z: target.anchor.z}, onEvent: e => {
                if (e === 'release' && this.carried === 'vacuum') { this.carry.release(this.props.root, vacuum.home); this.dropped(); }
              }});
            }
            if (target.mess) target.mess.visible = false;
            this.reward(target, now);
          }
        }
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
    this.carry.socket.getWorldPosition(this.hands);
    this.feedback.update(now, this.interactions, this.carried, this.hands, this.mission, !this.activity && !this.animator.busy);
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
    const m = this.mission, item = this.carry.item;
    if (m.state === 'finished') return 'Every little bit helps. Nice work, Arianna!';
    if (item) return item.id === 'vacuum' ? '✦ Go to the dirt, then hold Action to vacuum.' : `${item.icon} Take ${item.name.toLowerCase()} to ${this.feedback.destinationIcon || 'the glowing destination'}.`;
    if (m.state === 'ready') return 'Move to start · 60 seconds · $1 per task';
    if (this.interactions.focus?.kind === 'crayons') return '🖍 Tap Action to put the crayons in their cup.';
    return 'Find an item. Walk close, then tap Action.';
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
      items: this.props.items.map(i => ({id: i.id, visible: i.object.visible, position: i.object.getWorldPosition(new Vector3()).toArray(), home: i.home})),
      targets: this.props.interactions.map(t => ({id: t.id, position: [t.anchor.x, 0, t.anchor.z], range: t.range}))};
  }

  dispose() { this.feedback.dispose(); this.props.root.removeFromParent(); this.announcement.remove(); this.results.remove(); }
}
