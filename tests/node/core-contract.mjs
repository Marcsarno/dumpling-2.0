// Shared by the golden test and its generator: a deterministic fingerprint of the
// append-only registries and seeded rule outputs that saves and daily content depend on.
import {createHash} from 'node:crypto';

/** Seeded stream (mulberry32) so roll functions are compared on identical inputs. */
export function stream(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function fingerprint(root){
 const load=path=>import(new URL(path,root).href);
 const [collection,hunt,trading,prizes,popLevels,homePlay,dailyPlay,clock,house]=await Promise.all([
  load('src/data/collection.ts'),load('src/data/hunt.ts'),load('src/data/trading.ts'),load('src/data/ticketPrizes.ts'),
  load('src/data/popLevels.ts'),load('src/data/homePlay.ts'),load('src/data/dailyPlay.ts'),load('src/systems/DailyClock.ts'),load('src/data/house.ts')]);
 const days=Array.from({length:365},(_,i)=>i+1);
 // Ids in order (append-only contract) plus a digest of the full definitions.
 const tables={dumplings:collection.DUMPLINGS,series:hunt.SERIES,stores:hunt.STORES,traders:trading.TRADERS,popLevels:popLevels.POP_LEVELS,
  homeToys:homePlay.HOME_TOYS,playActivities:dailyPlay.PLAY_ACTIVITIES,afternoonExtras:clock.AFTERNOON_EXTRAS,rooms:house.HOUSE_ROOMS};
 const registries=JSON.parse(JSON.stringify({
  ...Object.fromEntries(Object.entries(tables).map(([k,rows])=>[k,rows.map(r=>r.id??r)])),
  stockSites:[...hunt.STOCK_SITES],dust:clock.DUST_LOCATIONS,spill:clock.SPILL_LOCATIONS,
  definitions:Object.fromEntries(Object.entries(tables).map(([k,rows])=>[k,digest(rows)])),
 }));
 const rolls=(fn)=>{const r=stream(20260929);return Array.from({length:2000},()=>fn(r));};
 const outputs={
  tradingDays:digest(days.map(d=>trading.createTradingDay(d))),
  ticketPrizes:digest(days.map(d=>prizes.ticketPrizes(d))),
  huntDays:digest(days.map(d=>hunt.createHuntDay(d,stream(d)))),
  dailyPlay:digest(days.map(d=>dailyPlay.selectDailyPlay(1234567,d))),
  rollDumpling:digest(rolls(r=>collection.rollDumpling(r).id)),
  rollSeries:digest(hunt.SERIES.flatMap(s=>hunt.STORES.map(store=>rolls(r=>hunt.rollSeries(s.id,store,r).id)))),
 };
 return {registries,registriesDigest:digest(registries),outputs};
}
