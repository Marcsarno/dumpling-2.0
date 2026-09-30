import { PopBoard, boardPool, type PopPower, type PopResult } from './squishyPop.ts';

export type PopObjective =
  | { kind:'score'; target:number }
  | { kind:'chains'; length:number; target:number }
  | { kind:'friend'; slot:number; target:number }
  | { kind:'create'|'use'; power?:PopPower; target:number }
  | { kind:'frenzy'; target:number };
export interface PopLevel {
  id:string; name:string; hint:string; seconds:number;
  board:{types:number; openingChain:number; powers:{index:number;power:PopPower}[]};
  objectives:PopObjective[];
  /** Completion earns one star; optional score thresholds earn two/three. Tickets stay unchanged. */
  stars:[number,number];
}
export const POP_LEVELS:readonly PopLevel[] = [
  {id:'little-chains',name:'Little chains',hint:'Connect 3 or more matching friends.',seconds:60,
    board:{types:4,openingChain:3,powers:[]},objectives:[{kind:'score',target:300}],stars:[600,1000]},
  {id:'big-squishes',name:'Big squishes',hint:'Connect 5 or more in one drag. Do it twice!',seconds:60,
    board:{types:4,openingChain:5,powers:[]},objectives:[{kind:'chains',length:5,target:2}],stars:[800,1400]},
  {id:'friend-party',name:'Friend party',hint:'Pop your pictured friend. Tap Bombs or chain through Rainbows!',seconds:60,
    board:{types:5,openingChain:5,powers:[{index:28,power:'bomb'},{index:14,power:'rainbow'}]},
    objectives:[{kind:'friend',slot:0,target:12},{kind:'use',target:2}],stars:[900,1600]},
];
export interface PopLevelRecord {completed:boolean;stars:number;bestScore:number;bestChain:number;attempts:number}
export type PopLevelRecords=Record<string,PopLevelRecord>;
export interface PopLevelAttempt {levelId:string;values:number[];bestChain:number}
export function levelUnlocked(level:PopLevel,records:PopLevelRecords={}) {
  const index=POP_LEVELS.findIndex(l=>l.id===level.id);
  return index===0 || index>0 && !!records[POP_LEVELS[index-1].id]?.completed;
}
export function createLevelBoard(level:PopLevel,collection:Record<string,number>,random=Math.random) {
  const board=new PopBoard(boardPool(collection,random).slice(0,level.board.types),collection,random);
  // A welcoming first chain, never a forced gesture. Refill and power rules remain the normal game.
  [12,13,14,15,16,17].slice(0,level.board.openingChain).forEach(i=>board.pieces[i].kind=board.pool[0]);
  for(const p of level.board.powers)board.pieces[p.index].power=p.power;
  return board;
}
/** Consumes resolved board events, independently of animation/input. Tutorial events never enter here. */
export class PopLevelRun {
  values:number[];private frenzyUntil=0;
  constructor(readonly level:PopLevel,readonly pool:readonly string[]){this.values=level.objectives.map(()=>0);}
  observe(result:PopResult,score:number,finale=false,frenzyUntil=0) {
    this.level.objectives.forEach((o,i)=>{
      if(o.kind==='score')this.values[i]=score;
      else if(o.kind==='friend')this.values[i]+=result.cleared.filter(c=>c.piece.kind===this.pool[o.slot]).length;
      else if(!finale){
        if(o.kind==='chains'&&result.chain>=o.length)this.values[i]++;
        if(o.kind==='create'&&result.created&&(!o.power||result.created===o.power))this.values[i]++;
        if(o.kind==='use')this.values[i]+=result.activated.filter(p=>!o.power||p===o.power).length;
        if(o.kind==='frenzy'&&result.frenzy&&frenzyUntil>this.frenzyUntil)this.values[i]++;
      }
    });
    this.frenzyUntil=Math.max(this.frenzyUntil,frenzyUntil);
  }
  get completed(){return this.level.objectives.every((o,i)=>this.values[i]>=o.target);}
  attempt(bestChain:number):PopLevelAttempt{return{levelId:this.level.id,values:[...this.values],bestChain};}
}
export function levelStars(level:PopLevel,values:readonly number[],score:number){
  return level.objectives.every((o,i)=>values[i]>=o.target)?1+Number(score>=level.stars[0])+Number(score>=level.stars[1]):0;
}
