/** Short catch-and-release battles. Rewards still belong to ProgressStore. */
export const FISHING_TEMPO=4/3;
export type FishingPhase='idle'|'prepare'|'cast'|'wait'|'bite'|'reel'|'catch'|'release'|'miss';
export type PullDirection=-1|0|1;
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
export const FISH_PERSONALITIES=[
 {name:'Gentle',strength:.80,pace:4.6,run:1.8},
 {name:'Stubborn',strength:1.02,pace:5.2,run:2.2},
 {name:'Darting',strength:.90,pace:3.9,run:1.8},
 {name:'Steady',strength:1.08,pace:5.5,run:2.4},
] as const;
export class FishingRound{
 phase:FishingPhase='idle';elapsed=0;total=0;nextBite=0;catchKind='fish';fishIndex=0;id='';
 distance=.88;tension=.16;energy=1;strain=0;reeling=false;direction:PullDirection=0;pullSide:PullDirection=0;fightTime=0;missReason='';
 private seed=0;
 constructor(private random=()=>Math.random()){}
 get tired(){return this.energy<.34;}
 get desiredDirection():PullDirection{return this.pullSide===0?0:this.pullSide===1?-1:1;}
 get matching(){return this.pullSide!==0&&this.direction===this.desiredDirection;}
 get progress(){return clamp(1-this.distance);}
 get warning(){return this.tension>=.76;}
 start(id:string){
  this.phase='prepare';this.elapsed=0;this.total=0;this.id=id;this.seed=clamp(this.random());
  this.nextBite=1.6+this.seed*2.2;this.catchKind=this.random()<.12?'squishy':'fish';this.fishIndex=Math.min(3,Math.floor(this.random()*4));
  this.distance=.88;this.tension=.16;this.energy=1;this.strain=0;this.fightTime=0;this.pullSide=0;this.missReason='';this.releaseControls();
 }
 step(phase:FishingPhase){this.phase=phase;this.elapsed=0;if(phase!=='reel')this.releaseControls();}
 releaseControls(){this.reeling=false;this.direction=0;}
 holdReel(held:boolean){this.reeling=this.phase==='reel'&&held;}
 steer(side:PullDirection){this.direction=this.phase==='reel'?side:0;}
 tap(){if(this.phase==='prepare')this.step('cast');else if(this.phase==='bite'){this.step('reel');this.fightTime=0;}else if(this.phase==='miss')this.start(this.id);}
 update(dt:number){
  if(this.phase==='idle')return;dt=clamp(dt,0,.05);const pace=this.phase==='bite'?1:FISHING_TEMPO;dt*=pace;this.elapsed+=dt;this.total+=dt;
  if(this.phase==='cast'&&this.elapsed>1.93)this.step('wait');
  else if(this.phase==='wait'&&this.elapsed>this.nextBite)this.step('bite');
  else if(this.phase==='bite'&&this.elapsed>3.6){this.missReason='That nibble got away. Cast again!';this.step('miss');}
  else if(this.phase==='release'&&this.elapsed>1)this.step('idle');
  else if(this.phase==='reel')this.battle(dt);
 }
 private battle(dt:number){
  this.fightTime+=dt;const p=FISH_PERSONALITIES[this.fishIndex],cycle=Math.floor(this.fightTime/p.pace),beat=this.fightTime%p.pace;
  const pulling=this.fightTime>1.4&&beat>p.pace-p.run&&!this.tired;
  this.pullSide=pulling?((cycle+Math.floor(this.seed*9))%2?1:-1):0;
  this.energy=clamp(this.energy-dt*(.027+(this.matching?.06:0)+(this.reeling?.014:0)));
  const wrong=this.pullSide!==0&&this.direction!==0&&!this.matching;
  const heat=this.tired?.055:pulling?(this.matching?.105:.27)*p.strength:.115;
  this.tension=clamp(this.tension+dt*(this.reeling?heat+(wrong?.09:0):-.37));
  this.strain=this.tension>.97?this.strain+dt:Math.max(0,this.strain-dt*2);
  if(this.strain>1.8){this.missReason='The fish slipped free. Let go when the line turns coral.';this.step('miss');return;}
  const gain=this.tired?.145:pulling?(this.matching?.07:.012):.10;
  this.distance=clamp(this.distance+dt*(this.reeling?-gain:(pulling?.038:.012)));
  if(this.matching&&!this.reeling)this.distance=clamp(this.distance-dt*.022);
  if(this.distance<=.015&&this.fightTime>4)this.step('catch');
  else if(this.fightTime>90){this.missReason='This friend wants to stay in the pond. Try another cast!';this.step('miss');}
 }
}
