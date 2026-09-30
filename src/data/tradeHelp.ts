import {DUMPLINGS} from './collection.ts';
import {SERIES} from './hunt.ts';
import {cuteIds,willing,type Protection,type TraderId,type TradingDay} from './trading.ts';

export function loves(id:string,trader:TraderId,day:TradingDay){const d=DUMPLINGS.find(d=>d.id===id)!;return trader==='rarity'?d.rarity!=='Common':trader==='series'?(SERIES.find(s=>s.id===day.series)!.items as readonly string[]).includes(id):cuteIds.includes(id)||d.accessory==='bow';}
export function dailyWish(day:TradingDay,trader:TraderId){const pool=DUMPLINGS.filter(d=>loves(d.id,trader,day)&&!day.traders[trader].offer.includes(d.id));return pool[(day.day+['rarity','series','cute'].indexOf(trader))%pool.length]??DUMPLINGS[0];}
/** Only suggests owned extras. The existing atomic trade still requires explicit acceptance. */
export function suggestTrade(day:TradingDay,trader:TraderId,collection:Record<string,number>,protections:Record<string,Protection>={}){
 const ids=DUMPLINGS.filter(d=>(collection[d.id]??0)>1&&!protections[d.id]?.favorite&&!protections[d.id]?.locked&&!day.traders[trader].offer.includes(d.id)).map(d=>d.id);
 let best:string[]|null=null,cost=Infinity;
 const search=(offer:string[],start:number)=>{
  if(willing(day,trader,offer)){const score=offer.reduce((s,id)=>s+({Common:1,Rare:4,Epic:12,Legendary:30}[DUMPLINGS.find(d=>d.id===id)!.rarity]),0)*10+offer.length;
   if(score<cost){best=[...offer];cost=score;}return;}
  if(offer.length===3)return;
  for(let i=start;i<ids.length;i++){const id=ids[i];if(offer.filter(x=>x===id).length<(collection[id]??0)-1)search([...offer,id],i);}
 };
 search([],0);return best;
}
