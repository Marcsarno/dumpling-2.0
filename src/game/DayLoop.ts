import {DailyClock, type DayState} from '../systems/DailyClock';
import {ProgressStore, type SaveRepository} from '../systems/ProgressStore';
import {DailyPlayStore} from '../systems/DailyPlayStore';
import {saveKey} from '../systems/SaveNamespace';

/** Where a save is kept; localStorage in the browser, a Map in Node tests. */
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

export const DAILY_KEY = saveKey('daily.v1');
export const PROGRESS_KEY = saveKey('progress.v1');

/**
 * The household day (PlayCanvas DailyLife + the clock half of GameLoop), without any
 * rendering. It runs the vendored DailyClock (0.5 game-minutes per real second), writes
 * daily.v1 about once a second and after every change, pays chores through the vendored
 * ProgressStore receipts, and keeps the daily-play record current each new day.
 *
 * The clock only runs while Arianna is at home and free: never in shops, while a dialog is
 * open, while the tab is hidden, or while an action or approach is under way. Each step is
 * capped at 2 s so a stalled tab never skips time.
 *
 * Upgrade: PlayCanvas silently replaced an unreadable daily save with a fresh day 1. The
 * rebuild keeps the unreadable text under `daily.v1.unreadable` first and reports it.
 */
export class DayLoop {
  readonly clock: DailyClock;
  readonly progress: ProgressStore;
  readonly play: DailyPlayStore;
  /** Set when a stored daily save could not be read (kept aside, never silently lost). */
  readonly problem: string;
  private sinceSave = 0;
  /** Rewards that could not be written yet (storage full or blocked); retried each second. */
  private pending: {receipt: string; amount: number}[] = [];
  message = '';
  private phase: DayState['phase'];
  private day: number;
  onPhaseChange: (phase: DayState['phase']) => void = () => {};
  onNewDay: (day: number) => void = () => {};

  constructor(private readonly storage: KeyValueStore, random: () => number = Math.random) {
    let saved: unknown = null, problem = '';
    const raw = storage.getItem(DAILY_KEY);
    try { saved = JSON.parse(raw ?? 'null'); } catch { problem = 'Daily progress could not be read.'; }
    this.clock = new DailyClock(random, saved);
    if (raw !== null && !problem && JSON.stringify(this.clock.state) !== JSON.stringify(saved)) problem = 'Daily progress could not be read.';
    if (problem && raw !== null) storage.setItem(DAILY_KEY + '.unreadable', raw);
    this.problem = problem;
    const repository: SaveRepository = {read: () => storage.getItem(PROGRESS_KEY), write: value => storage.setItem(PROGRESS_KEY, value)};
    this.progress = new ProgressStore(repository);
    this.play = new DailyPlayStore(storage);
    this.play.ensure(this.clock.state.day);
    this.phase = this.clock.state.phase; this.day = this.clock.state.day;
    this.save();
  }

  get state() { return this.clock.state; }
  get balance() { return this.progress.data.balance; }

  /** Advance the day. `running` is false whenever the PlayCanvas pause rules would hold it. */
  update(dt: number, running: boolean) {
    if (running) this.clock.advance(Math.min(2, dt));
    this.sinceSave += dt;
    if (this.sinceSave >= 1) { this.sinceSave = 0; this.save(); this.retry(); }
    if (this.clock.state.day !== this.day) {
      this.day = this.clock.state.day; this.play.ensure(this.day); this.save(); this.onNewDay(this.day);
    }
    if (this.clock.state.phase !== this.phase) { this.phase = this.clock.state.phase; this.save(); this.onPhaseChange(this.phase); }
  }

  /**
   * Finish a routine chore: marks it done and pays $1 once, by receipt
   * `day-{d}-{phase}-{task}` (PlayCanvas DailyLife.perform). Returns false if it was not due.
   */
  complete(id: string) {
    const s = this.clock.state, phase = s.phase;
    if (!this.clock.complete(id)) return false;
    this.save();
    this.credit(`day-${s.day}-${phase}-${id}`, 1);
    return true;
  }

  /**
   * Pay a reward once; a repeated receipt id never pays twice. If the save cannot be written
   * the reward waits and is retried (PlayCanvas GameLoop.creditPending), never lost.
   */
  credit(receipt: string, amount: number) {
    try { const paid = this.progress.creditRound(receipt, amount); this.message = ''; return paid; }
    catch (error) {
      if (!this.pending.some(p => p.receipt === receipt)) this.pending.push({receipt, amount});
      this.message = 'Allowance not saved yet. It will be added as soon as saving works.';
      return false;
    }
  }
  private retry() {
    for (const p of [...this.pending]) {
      try { this.progress.creditRound(p.receipt, p.amount); this.pending.splice(this.pending.indexOf(p), 1); } catch { return; }
    }
    if (!this.pending.length && this.message.startsWith('Allowance')) this.message = '';
  }

  save() {
    try { this.storage.setItem(DAILY_KEY, JSON.stringify(this.clock.state)); return true; } catch { return false; }
  }

  /** Sleep ends the day (PlayCanvas DailyClock.sleep; early sleep after shopping in the afternoon). */
  sleep(early = false) { const ok = this.clock.sleep(early); if (ok) this.update(0, false); return ok; }

  /** The journal's gentle nudge (PlayCanvas DailyLife.hint, before shopping and tasks land). */
  get hint() {
    const s = this.clock.state;
    if (s.phase === 'school') return 'At school · See you after class!';
    if (this.clock.schoolDue) return '🎒 Time for school. Walk outside and follow the garden path to the school gate.';
    if (s.phase === 'morning' && s.breakfast === 'spill') return 'Oops! Get a paper towel and hold Action over the dropped egg.';
    if (this.clock.canSleep) return '🌙 All done! Walk to your bed whenever you’re ready.';
    if (s.phase === 'afternoon') return 'After school · Help a little, then visit two stores. Take your time!';
    return s.phase === 'morning' ? 'A fresh morning · Brush, choose clothes, and make breakfast.' : 'Wind down · Brush teeth, put clothes away, and read.';
  }

  snapshot() {
    return {...structuredClone(this.clock.state), clock: this.clock.label, tasks: this.clock.tasks.map(t => t.id), ready: this.clock.ready,
      balance: this.balance, problem: this.problem, hint: this.hint, pending: this.pending.length, message: this.message};
  }
}
