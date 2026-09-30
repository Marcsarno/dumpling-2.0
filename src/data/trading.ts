import { DUMPLINGS } from './collection.ts';
import { SERIES } from './hunt.ts';

export const TRADERS = [
  { id: 'rarity', name: 'Jules', title: 'Rarity Hunter', icon: '✦', color: '#bca4e4', hint: 'Rare finds make my day. A legendary? Even better!' },
  { id: 'series', name: 'Remy', title: 'Series Collector', icon: '✿', color: '#a9cfb5', hint: 'I’m filling the gaps in my series!' },
  { id: 'cute', name: 'Poppy', title: 'Cute Collector', icon: '♡', color: '#edb3cc', hint: 'Pink, purple, and little bows. Those are my favorites!' },
] as const;
export type TraderId = typeof TRADERS[number]['id'];
export interface TraderState { stock: string[]; offer: string[]; asks: number; revision: number; done: boolean; message: string }
export interface TradingDay { day: number; series: string; traders: Record<TraderId, TraderState> }
export interface Protection { favorite: boolean; locked: boolean }
export const cuteIds = ['rosie', 'shortcake', 'lavendream', 'sorbet', 'nebula'];
export const definition = (id: string) => DUMPLINGS.find(d => d.id === id)!;
export function valueFor(id: string, trader: TraderId, series: string): number {
  const d = definition(id);
  if (!d) throw Error('Unknown squishy.');
  if (trader === 'rarity') return { Common: 1, Rare: 4, Epic: 10, Legendary: 24 }[d.rarity];
  if (trader === 'series') return { Common: 1, Rare: 2, Epic: 4, Legendary: 7 }[d.rarity]
    * ((SERIES.find(s => s.id === series)?.items as readonly string[] | undefined)?.includes(id) ? 4 : 1);
  return { Common: 1, Rare: 2, Epic: 3, Legendary: 5 }[d.rarity]
    * (cuteIds.includes(id) || d.accessory === 'bow' ? 4 : 1);
}
export const offerValue = (ids: string[], trader: TraderId, series: string) => ids.reduce((sum, id) => sum + valueFor(id, trader, series), 0);
export function willing(day: TradingDay, trader: TraderId, give: string[]): boolean {
  const npc = day.traders[trader];
  return !npc.done && give.length > 0 && give.length <= 3 && !give.some(id => npc.offer.includes(id))
    && offerValue(give, trader, day.series) >= offerValue(npc.offer, trader, day.series);
}
/** Stable daily pockets: reopening a table or reloading never rerolls the offer. */
export function createTradingDay(day: number): TradingDay {
  let seed = (day * 2654435761) >>> 0;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const traders = {} as TradingDay['traders'];
  for (const [i, trader] of TRADERS.entries()) {
    const pool = DUMPLINGS.map(d => d.id);
    for (let j = pool.length - 1; j > 0; j--) { const k = Math.floor(random() * (j + 1)); [pool[j], pool[k]] = [pool[k], pool[j]]; }
    const stock = pool.slice(0, 6);
    // Keep opening deals reachable; there is still room to negotiate for a better find.
    stock.sort((a, b) => valueFor(a, trader.id, SERIES[(day - 1) % SERIES.length].id) - valueFor(b, trader.id, SERIES[(day - 1) % SERIES.length].id));
    traders[trader.id] = { stock, offer: stock.slice(0, i + 1), asks: 0, revision: 0, done: false, message: 'Here’s what I brought. What would you trade?' };
  }
  return { day, series: SERIES[(day - 1) % SERIES.length].id, traders };
}
/** An ask changes only the NPC side. A swapped offer still needs a fresh player acceptance. */
export function negotiate(day: TradingDay, trader: TraderId, give: string[]): void {
  const npc = day.traders[trader];
  if (npc.done || npc.asks >= 4) throw Error('That’s my final offer for today. Take your time deciding.');
  if (!give.length) throw Error('Put a squishy on your side first.');
  npc.asks++; npc.revision++;
  const offered = offerValue(give, trader, day.series);
  const extras = npc.stock.filter(id => !npc.offer.includes(id) && !give.includes(id));
  const add = extras.find(id => npc.offer.length < 3 && offered >= offerValue([...npc.offer, id], trader, day.series));
  if (add) { npc.offer.push(add); npc.message = 'Okay! I’ll add ' + definition(add).name + '.'; return; }
  if (npc.asks % 2 === 0) {
    const swap = extras[0];
    if (swap) { const old = npc.offer.pop()!; npc.offer.push(swap); npc.message = `What about ${definition(swap).name} instead of ${definition(old).name}? Look again before you agree.`; return; }
  }
  npc.message = 'I’ll keep these on my side. Try something I love, or we can walk away.';
}
