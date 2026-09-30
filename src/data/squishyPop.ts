import { DUMPLINGS } from './collection.ts';
import { visuallyDistinct } from './popIdentity.ts';

export const POP_RULES = { columns:6, rows:6, seconds:60, minimum:3, activeTypes:5,
  scorePerPiece:10, pointsPerTicket:500, minimumTickets:1, maximumTickets:8,
  couponTickets:40, couponValue:1, frenzySeconds:7 } as const;
export const POP_STARTERS = ['rosie','lavendream','macaron','stardrop','panda','fox','comet','sunny','minty','mochi'];
export type PopPower = 'bomb'|'rainbow'|'mega';
export type PopPiece = {id:number;kind:string;power?:PopPower};
export type PopMove = {piece:PopPiece;from:number;to:number};
export type PopEffect={power:PopPower;index:number;targets:number[]};
export type PopResult = {chain:number;cleared:{piece:PopPiece;index:number}[];moves:PopMove[];score:number;label:string;shuffled:boolean;created?:PopPower;activated:PopPower[];effects:PopEffect[];frenzy:boolean};
export const powerForChain=(n:number):PopPower|undefined=>n>=10?'mega':n>=7?'rainbow':n>=5?'bomb':undefined;
export const starLevel=(copies:number)=>copies>=5?3:copies>=2?2:copies>=1?1:0;
export const roundTickets=(score:number)=>Math.min(POP_RULES.maximumTickets,POP_RULES.minimumTickets+Math.floor(Math.max(0,score)/POP_RULES.pointsPerTicket));
export function boardPool(collection:Record<string,number>,random= Math.random){
  const eligible=[...new Set([...DUMPLINGS.filter(d=>collection[d.id]>0).map(d=>d.id),...POP_STARTERS])];
  for(let i=eligible.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  // A complete small search maximizes owned friends without ever sacrificing readability.
  let best:string[]=[],ownedBest=-1;
  const choose=(pool:string[],start:number,owned:number)=>{
    if(pool.length===POP_RULES.activeTypes){if(owned>ownedBest){best=[...pool];ownedBest=owned;}return;}
    for(let i=start;i<eligible.length;i++)if(pool.every(id=>visuallyDistinct(id,eligible[i])))choose([...pool,eligible[i]],i+1,owned+(collection[eligible[i]]>0?1:0));
  };
  choose([],0,0);return best;
}

/** Pure board rules. Rendering, timers, saving and audio have no authority here. */
export class PopBoard {
  pieces:PopPiece[]=[];
  chain:number[]=[];
  score=0;bestChain=0;pops=0;shuffles=0;
  frenzyMeter=0;frenzyUntil=0;private lastStrong=-100;
  protected serial=0;
  constructor(readonly pool:string[],readonly collection:Record<string,number>={},protected random= Math.random){
    if(pool.length<3||pool.some(id=>!DUMPLINGS.some(d=>d.id===id)))throw Error('Squishy Pop needs a valid starter pool.');
    this.pieces=Array.from({length:POP_RULES.columns*POP_RULES.rows},()=>this.newPiece());
    this.ensurePlayable();
  }
  protected newPiece():PopPiece{return {id:++this.serial,kind:this.pool[Math.floor(this.random()*this.pool.length)]};}
  adjacent(a:number,b:number){return a!==b&&Math.abs(a%6-b%6)<=1&&Math.abs(Math.floor(a/6)-Math.floor(b/6))<=1;}
  begin(index:number){this.chain=[];return this.extend(index);}
  extend(index:number){
    if(!Number.isInteger(index)||index<0||index>=this.pieces.length)return false;
    if(this.chain.length>1&&index===this.chain.at(-2)){this.chain.pop();return true;}
    if(this.chain.includes(index))return false;
    const base=this.chain.find(i=>this.pieces[i].power!=='rainbow');
    if(this.chain.length&&(!this.adjacent(this.chain.at(-1)!,index)||(base!==undefined&&this.pieces[index].power!=='rainbow'&&this.pieces[index].kind!==this.pieces[base].kind)))return false;
    this.chain.push(index);return true;
  }
  cancel(){this.chain=[];}
  private affected(chain:number[],finale=false){
    const removed=new Set(chain),effects:PopEffect[]=[];
    for(const index of removed){const piece=this.pieces[index],power=piece.power;if(!power)continue;
      const targets=power==='rainbow'?(finale?this.pieces.flatMap((p,i)=>p.kind===piece.kind?[i]:[]):chain):this.pieces.flatMap((_,i)=>Math.abs(i%6-index%6)<=(power==='mega'?2:1)&&Math.abs(Math.floor(i/6)-Math.floor(index/6))<=(power==='mega'?2:1)?[i]:[]);
      targets.forEach(i=>removed.add(i));effects.push({power,index,targets});
    }return{removed,effects};
  }
  preview(){const valid=this.chain.length>=3||(this.chain.length===1&&['bomb','mega'].includes(this.pieces[this.chain[0]].power??''));return{valid,created:powerForChain(this.chain.length),...this.affected(valid?this.chain:[])};}
  finale(now=0){const powers=this.pieces.flatMap((p,i)=>p.power?[i]:[]);this.cancel();return powers.length?this.resolve(powers,now,true):null;}
  findChain(minimum=3):number[]{
    const walk=(path:number[]):number[]=>{
      if(path.length>=minimum)return path;
      const at=path.at(-1)!;
      const base=path.find(i=>this.pieces[i].power!=='rainbow');
      for(let i=0;i<this.pieces.length;i++)if(!path.includes(i)&&this.adjacent(at,i)&&(base===undefined||this.pieces[i].power==='rainbow'||this.pieces[i].kind===this.pieces[base].kind)){const found=walk([...path,i]);if(found.length)return found;}
      return [];
    };
    for(let i=0;i<this.pieces.length;i++){const found=walk([i]);if(found.length)return found;}return [];
  }
  ensurePlayable(){
    if(this.findChain().length)return false;
    for(let attempt=0;attempt<8;attempt++){
      for(let i=this.pieces.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.pieces[i],this.pieces[j]]=[this.pieces[j],this.pieces[i]];}
      if(this.findChain().length){this.shuffles++;return true;}
    }
    // Bounded guarantee, including adversarial RNG. A shuffle never costs points.
    const row=Math.floor(this.random()*6)*6,kind=this.pool[0];
    for(let i=0;i<3;i++)this.pieces[row+i].kind=kind;
    this.shuffles++;return true;
  }
  release(now=0):PopResult|null {
    const chain=[...this.chain];this.cancel();
    const tapPower=chain.length===1&&['bomb','mega'].includes(this.pieces[chain[0]].power??'');
    if(chain.length<3&&!tapPower)return null;
    return this.resolve(chain,now);
  }
  private resolve(chain:number[],now:number,finale=false):PopResult {
    const {removed,effects}=this.affected(chain,finale),activated=effects.map(e=>e.power),moves:PopMove[]=[];
    const cleared=[...removed].map(index=>({index,piece:this.pieces[index]}));
    const created=finale?undefined:powerForChain(chain.length);
    if(created){const at=chain.at(-1)!;this.pieces[at]={...this.newPiece(),kind:this.pieces[at].kind,power:created};removed.delete(at);}
    for(let column=0;column<6;column++){
      const kept=this.pieces.map((piece,index)=>({piece,index})).filter(x=>x.index%6===column&&!removed.has(x.index));
      for(let row=5;row>=0;row--){const old=kept.pop(),to=row*6+column,piece=old?.piece??this.newPiece();this.pieces[to]=piece;moves.push({piece,from:old?.index??(row-6)*6+column,to});}
    }
    const bonus=finale?1:chain.length>=10?3:chain.length>=7?2:chain.length>=5?1.5:1;
    if(!finale&&chain.length>=5&&now>=this.frenzyUntil){this.frenzyMeter=Math.min(100,Math.max(0,this.frenzyMeter-Math.max(0,now-this.lastStrong-4)*4)+chain.length*5+(now-this.lastStrong<4?10:0));this.lastStrong=now;if(this.frenzyMeter>=100){this.frenzyUntil=now+POP_RULES.frenzySeconds;this.frenzyMeter=0;}}
    const frenzy=!finale&&now<this.frenzyUntil;
    const score=Math.round(cleared.reduce((sum,c)=>sum+POP_RULES.scorePerPiece*(1+Math.max(0,starLevel(this.collection[c.piece.kind]||0)-1)*.02),0)*bonus*(frenzy?2:1));
    this.score+=score;if(!finale){this.bestChain=Math.max(this.bestChain,chain.length);this.pops++;}
    const before=this.pieces.map(p=>p.id),shuffled=this.ensurePlayable();
    if(shuffled){moves.length=0;this.pieces.forEach((piece,to)=>moves.push({piece,from:before.indexOf(piece.id),to}));}
    return {chain:finale?0:chain.length,cleared,moves,score,label:finale?'LAST LITTLE POPS!':chain.length>=10?'SUPER SQUISH!':chain.length>=7?'GREAT!':chain.length>=5?'NICE!':'POP!',shuffled,created,activated,effects,frenzy};
  }
}
