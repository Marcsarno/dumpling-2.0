import {DUMPLINGS} from './collection.ts';
export interface PrizeShelf {day:number; sold:string[]}
/** Rotating, visible prizes: no paid random roll and no cash/ticket conversion. */
export function ticketPrizes(day:number){
 return (['Common','Common','Rare','Epic'] as const).map((rarity,i)=>{
  const pool=DUMPLINGS.filter(d=>d.rarity===rarity);
  return {item:pool[(day*3+i)%pool.length],cost:[1,3,5,8][i],slot:String(i)};
 });
}
