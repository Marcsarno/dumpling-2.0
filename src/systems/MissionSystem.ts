export const TASKS = [
  { id: 'teddy', name: 'Teddy', icon: '🧸' },
  { id: 'shirt', name: 'Shirt', icon: '👕' },
  { id: 'book', name: 'Book', icon: '📘' },
  { id: 'crayons', name: 'Crayons', icon: '🖍' },
  { id: 'dirt', name: 'Dirt', icon: '✦' },
] as const;
export type TaskId = string;
export interface TaskDefinition { id: TaskId; name: string; icon: string; room?: string }

/** A round owns its money. No save data or permanent progression. Times are monotonic ms. */
export class MissionSystem {
  readonly duration = 60_000;
  readonly reward = 1;
  readonly allCleanBonus = 2;
  readonly completed = new Set<TaskId>();
  state: 'ready' | 'running' | 'finished' = 'ready';
  reason: 'complete' | 'time' | null = null;
  allowance = 0;
  bonus = 0;
  remaining = this.duration;
  finishedAt = 0;
  private deadline = 0;
  tasks: readonly TaskDefinition[] = TASKS;
  timed = true;
  continuous = false;
  configure(tasks: readonly TaskDefinition[], timed = true) { this.tasks = tasks; this.timed = timed; this.reset(); }
  start(now: number) {
    if (this.state !== 'ready') return;
    this.state = 'running';
    this.deadline = now + this.duration;
  }
  tick(now: number) {
    if (this.state !== 'running' || !this.timed) return;
    this.remaining = Math.max(0, this.deadline - now);
    if (this.remaining === 0) this.finish('time', now);
  }
  pauseFor(milliseconds:number){if(this.state==='running'&&this.timed)this.deadline+=Math.max(0,milliseconds);}
  complete(task: TaskId, now: number): boolean {
    this.tick(now); // A late input/hold can never score after the deadline.
    if (this.state !== 'running' || this.completed.has(task) || !this.tasks.some(entry => entry.id === task)) return false;
    this.completed.add(task);
    this.allowance += this.timed ? this.reward : 0;
    if (!this.continuous && this.completed.size === this.tasks.length) {
      this.bonus = this.timed ? this.allCleanBonus : 0;
      this.allowance += this.bonus;
      this.finish('complete', now);
    }
    return true;
  }
  private finish(reason: 'complete' | 'time', now: number) {
    this.state = 'finished'; this.reason = reason; this.finishedAt = now;
  }
  reset() {
    this.state = 'ready'; this.reason = null; this.allowance = 0; this.bonus = 0;
    this.remaining = this.duration; this.deadline = 0; this.finishedAt = 0;
    this.completed.clear();
  }
}
