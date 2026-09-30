import { DUMPLINGS, randomUnit, type Rarity } from './collection.ts';

export const HUNT_RULES = { closingMinute: 1140, minimumSearchMinutes: 18, bagLimit: 3, inspectMilliseconds: 650 } as const;
export const SERIES = [
  { id: 'garden', name: 'Garden Friends', price: 4, color: '#bbd8b8', items: ['mochi','rosie','minty','blueberry','sunny','lavendream','peachy','stardrop','dewdrop-unicorn','sunbeam-unicorn'] },
  { id: 'treats', name: 'Sweet Treats', price: 5, color: '#f1baca', items: ['shortcake','custard','cocoa','macaron','sorbet','sugarstar','sugarplum-bunny','opal-bunny'] },
  { id: 'animals', name: 'Pocket Pals', price: 5, color: '#efd7a0', items: ['bunny','kitten','panda','fox','sleepykoala','goldenbear','starlight-panda','moonwish-panda'] },
  { id: 'galaxy', name: 'Galaxy Dreams', price: 7, color: '#bab4e9', items: ['moonbean','comet','nebula','orbit','aurora','supernova','nebula-dragon','solstice-dragon'] },
] as const;
export type SeriesId = typeof SERIES[number]['id'];
export interface StoreDefinition {
  id: string; name: string; subtitle: string; icon: string; travelMinutes: number; markup: number;
  stock: [number, number]; lowStockChance: number; series: {id: SeriesId; weight: number}[];
  odds: Record<Rarity, number>; palette: [string,string,string]; layout: number;
}
export const STORES: readonly StoreDefinition[] = [
  { id:'corner', name:'Clover Corner', subtitle:'A tiny neighborhood treasure stop', icon:'☘', travelMinutes:55, markup:0,
    stock:[3,5],lowStockChance:.22,series:[{id:'garden',weight:6},{id:'treats',weight:4}],
    odds:{Common:65,Rare:25,Epic:8,Legendary:2},palette:['#b6d1ba','#f4dfab','#f7eedc'],layout:0 },
  { id:'toys', name:'Peachy Playroom', subtitle:'Colorful aisles, more places to peek', icon:'✿', travelMinutes:90, markup:1,
    stock:[5,8],lowStockChance:.12,series:[{id:'garden',weight:2},{id:'treats',weight:3},{id:'animals',weight:5},{id:'galaxy',weight:1}],
    odds:{Common:65,Rare:25,Epic:8,Legendary:2},palette:['#ecb7cb','#c4bbe3','#fff0dc'],layout:1 },
  { id:'collector', name:'Moonbeam Finds', subtitle:'Small batches of unusual little friends', icon:'☾', travelMinutes:165, markup:2,
    stock:[2,4],lowStockChance:.2,series:[{id:'galaxy',weight:7},{id:'animals',weight:2},{id:'treats',weight:1}],
    odds:{Common:65,Rare:25,Epic:8,Legendary:2},palette:['#b7b5db','#a7cfcd','#eee4f3'],layout:2 },
];
export const STOCK_SITES = ['Main shelf','Endcap','Checkout display','Basket','Lower shelf','Special display'] as const;
export interface StockSlot { site: number; series: SeriesId; remaining: number; discovered: boolean }
export interface StoreStock { slots: StockSlot[]; rumor: string; visited: boolean }
export interface HuntDay { day: number; stores: Record<string, StoreStock>; activeStore: string | null; clockFloor: number }
export const seriesById = (id: SeriesId) => SERIES.find(s=>s.id===id)!;
export const storeById = (id: string) => { const s=STORES.find(s=>s.id===id); if(!s)throw Error('That store is unavailable.');return s; };
export const boxPrice = (store: StoreDefinition, series: SeriesId) => seriesById(series).price + store.markup;
export const shoppingMinutes = (minutes: number) => Math.max(0, Math.floor(HUNT_RULES.closingMinute-minutes));
export const canVisit = (_store: StoreDefinition, minutes: number) => minutes>=900;
function unit(random:()=>number) { const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Invalid random source.');return n; }
function weighted<T>(entries: {value:T;weight:number}[],random:()=>number):T {
  let n=unit(random)*entries.reduce((sum,e)=>sum+e.weight,0);
  for(const e of entries){n-=e.weight;if(n<0)return e.value;}return entries[entries.length-1].value;
}
export function createHuntDay(day:number, random:()=>number=randomUnit):HuntDay {
  const stores:Record<string,StoreStock>={};
  for(const store of STORES){
    const quantity=unit(random)<store.lowStockChance?1:store.stock[0]+Math.floor(unit(random)*(store.stock[1]-store.stock[0]+1));
    const sites=STOCK_SITES.map((_,i)=>i),slots:StockSlot[]=[];
    for(let i=sites.length-1;i>0;i--){const j=Math.floor(unit(random)*(i+1));[sites[i],sites[j]]=[sites[j],sites[i]];}
    // A day's assortment changes as well as its hiding places. Bigger shops carry more series.
    const assortment:SeriesId[]=[];
    const pool=store.series.map(e=>({value:e.id,weight:e.weight}));
    const assortmentSize=store.id==='toys'?3:2;
    while(assortment.length<Math.min(assortmentSize,store.series.length)){
      const id=weighted(pool,random);assortment.push(id);pool.splice(pool.findIndex(p=>p.value===id),1);
    }
    for(let i=0;i<quantity;i++){
      if(i<6)slots.push({site:sites[i],series:assortment[i%assortment.length],remaining:1,discovered:false});
      else slots[i%6].remaining++;
    }
    const clue=unit(random);
    const rumor=quantity===1?'Low stock — a quiet shelf kind of day.':clue<.3?'Recently restocked. Worth a little look?':clue<.6?`${seriesById(assortment[0]).name} spotted today.`:clue<.8?'A friend heard an unusual box might be here.':'Unknown inventory. A little mystery awaits.';
    stores[store.id]={slots,rumor,visited:false};
  }
  return {day,stores,activeStore:null,clockFloor:0};
}
export function rollSeries(series:SeriesId,store:StoreDefinition,random:()=>number=randomUnit){
  const pool=DUMPLINGS.filter(d=>(seriesById(series).items as readonly string[]).includes(d.id));
  const rarity=weighted((Object.keys(store.odds) as Rarity[]).filter(r=>pool.some(d=>d.rarity===r)).map(r=>({value:r,weight:store.odds[r]})),random);
  const options=pool.filter(d=>d.rarity===rarity);return options[Math.floor(unit(random)*options.length)];
}
