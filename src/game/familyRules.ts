import type {DayState} from '../systems/DailyClock';

/**
 * Family-life rules as pure functions over the saved day (PlayCanvas FamilyDinner, Lilah and
 * DailyLife), so they are unit-tested in Node and shared by the browser code.
 */

/** 6:15 PM: Lilah gets sleepy and walks to her crib (PlayCanvas minutes >= 1095). */
export const LILAH_BEDTIME = 1095;
export const LILAH_BED_RECEIPT = (day: number) => `day-${day}-lilah-bed`;

/** Dad's menu rotates by day: pizza, taco, turkey (PlayCanvas FamilyDinner). */
export const DINNER_MENU = ['pizza', 'taco', 'turkey'] as const;
export type DinnerFood = typeof DINNER_MENU[number];
export const dinnerFood = (day: number): DinnerFood => DINNER_MENU[((day - 1) % 3 + 3) % 3];
export const DINNER_LINES: Record<DinnerFood, string> = {
  pizza: 'I’ll put some pizza out for us.', taco: 'Taco night! I’ll set the table.', turkey: 'Something warm for dinner today.',
};
/** The minute Dad starts dinner: 3:30 PM plus a per-day offset (3:35-4:59 PM). */
export const dinnerStart = (day: number) => 930 + (day * 37) % 90;
/**
 * Upgrade: PlayCanvas served only in the afternoon, so a day whose afternoon ended early
 * (chores done before the due minute) had no dinner at all. Dad still serves early in the
 * evening, until 8 PM.
 */
export const DINNER_LATEST = 1200;
export function dinnerDue(s: Pick<DayState, 'phase' | 'minutes' | 'day' | 'dinnerServed'>) {
  if (s.dinnerServed) return false;
  if (s.phase === 'afternoon') return s.minutes >= dinnerStart(s.day);
  return s.phase === 'night' && s.minutes < DINNER_LATEST;
}

/** Is there kibble in the bowl? (PlayCanvas DailyLife.refresh visibility rule, read from the save.) */
export function bowlHasFood(s: Pick<DayState, 'dogFoodEmpty' | 'done' | 'phase' | 'petTask'>) {
  return !s.dogFoodEmpty && (s.done.includes('feed-dog') || s.phase !== 'afternoon' || s.petTask !== 'feed-dog');
}

/** Lilah's tuck-in is offered from 6:15 PM in the afternoon or at night, once a day. */
export function tuckInTime(s: Pick<DayState, 'phase' | 'minutes' | 'lilahAsleep'>) {
  return !s.lilahAsleep && (s.phase === 'afternoon' || s.phase === 'night') && s.minutes >= LILAH_BEDTIME;
}

export interface CribKey {t: number; x: number; z: number; h: number; yaw: number}
/** Seconds for Lilah to climb into her crib (PlayCanvas BED_ENTRY_SECONDS, now actually used). */
export const CRIB_ENTRY_SECONDS = 3.2;
/** The crib-front spot she waits at, and where she stands up in the morning. */
export const CRIB_FRONT = {x: 8.55, z: -1.3};
/**
 * Lilah's path into the crib in crib space (PlayCanvas BedEntry crib keys: reach, tuck, sit,
 * recline), from wherever she starts. Positions are floor x/z; h is her height above the floor.
 */
export function cribKeys(start: {x: number; z: number; yaw: number}): CribKey[] {
  const deg = Math.PI / 180;
  return [
    {t: 0, x: start.x, z: start.z, h: .027, yaw: start.yaw},
    {t: .2, x: 8.55, z: -1.3, h: .12, yaw: 90 * deg},
    {t: .43, x: 8.76, z: -1.5, h: 1.22, yaw: 90 * deg},
    {t: .65, x: 9.45, z: -1.7, h: 1.22, yaw: 90 * deg},
    {t: 1, x: 9.8, z: -1.7, h: .65, yaw: 90 * deg},
  ];
}
/** Sample the path at progress 0-1 with smoothstep between keys (yaw takes the short way). */
export function samplePath(keys: CribKey[], progress: number) {
  const c = Math.max(0, Math.min(1, progress)), b = Math.max(1, keys.findIndex(k => k.t >= c)), a = keys[b - 1], z = keys[b];
  const raw = (c - a.t) / Math.max(1e-6, z.t - a.t), u = raw * raw * (3 - 2 * raw);
  let dy = (z.yaw - a.yaw) % (2 * Math.PI); if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
  return {x: a.x + (z.x - a.x) * u, z: a.z + (z.z - a.z) * u, h: a.h + (z.h - a.h) * u, yaw: a.yaw + dy * u};
}
