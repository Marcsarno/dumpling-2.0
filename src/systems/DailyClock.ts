export type DayPhase = 'morning' | 'school' | 'afternoon' | 'night';
export interface DayState {
  version: 1; day: number; minutes: number; phase: DayPhase; done: string[];
  eggDrop: boolean | null; breakfast: 'eggs' | 'spill' | 'cook' | 'serve' | 'done';
  dust: number[]; schoolSeconds: number;
  afternoonTasks?: string[];
  lilahAsleep?: boolean;
  dinnerServed?: boolean;
  dogFoodEmpty?: boolean;
  petTask?: 'feed-dog'|'pet-care';
  spillSite?: number;
  breakfastAtTable?: boolean;
  sideTask?: 'laundry-clothes'|'living-toy'|'kitchen-dish';
}
// Keep the indices stable for older saves; every site is now in living/kitchen.
export const DUST_LOCATIONS = [[1.2,5.2],[3.3,6.1],[1.1,7.2],[1,8.3],[.2,10.6],[2.2,11.6]] as const;
export const SPILL_LOCATIONS=[[.1,11.1],[1.7,10.7],[-.8,11.5]] as const;
export const DAILY_TASKS = {
  morning: [{id:'teeth',name:'Brush teeth',icon:'🪥'}, {id:'outfit',name:'Choose clothes',icon:'👕'}, {id:'breakfast',name:'Make breakfast',icon:'🍳'}],
  school: [],
  afternoon: [{id:'dust-0',name:'Vacuum',icon:'✦'},{id:'dust-1',name:'Vacuum',icon:'✦'},{id:'dust-2',name:'Vacuum',icon:'✦'}, {id:'spill',name:'Wipe kitchen spill',icon:'🧻'}, {id:'laundry-clothes',name:'Put laundry in washer',icon:'👕'}],
  night: [{id:'teeth',name:'Brush teeth',icon:'🪥'},{id:'outfit',name:'Put clothes away',icon:'👕'},{id:'read',name:'Bedtime book',icon:'📘'}],
};

export const AFTERNOON_EXTRAS = [
 {id:'laundry-clothes',name:'Put laundry in washer',icon:'👕'}, {id:'living-toy',name:'Put toys away',icon:'🧸'},
 {id:'kitchen-dish',name:'Take dish to sink',icon:'🍽'}, {id:'kitchen-trash',name:'Recycle trash',icon:'♻'},
 {id:'bath-towel',name:'Hang a towel',icon:'▤'}, {id:'hall-shoes',name:'Put shoes away',icon:'👟'},
 {id:'hall-mail',name:'Sort the mail',icon:'✉'}, {id:'living-cushion',name:'Straighten a cushion',icon:'♡'},
 {id:'laundry-clean',name:'Put folded clothes away',icon:'▤'}, {id:'bath-bottle',name:'Put toiletries away',icon:'♧'},
 {id:'book',name:'Put a book away',icon:'📘'},
];
const afternoonCatalog=[...DAILY_TASKS.afternoon,...AFTERNOON_EXTRAS,{id:'feed-dog',name:'Fill puppy’s bowl',icon:'🐾'},{id:'pet-care',name:'Scoop · flush · wash',icon:'🐾'}];
/** Accelerated household time: two real seconds per game minute; school is a transition. */
export class DailyClock {
  state: DayState;
  constructor(private readonly random = Math.random, saved?: unknown) {
    this.state = this.newDay(1);
    const s = saved as DayState | undefined;
    if (s?.version === 1 && Number.isInteger(s.day) && s.day > 0 && ['morning','school','afternoon','night'].includes(s.phase) && Number.isFinite(s.minutes) && s.minutes >= 420 && s.minutes <= 1260 && Array.isArray(s.done) && s.done.every(x=>typeof x==='string') && Array.isArray(s.dust) && s.dust.length===3 && new Set(s.dust).size===3 && s.dust.every(x=>Number.isInteger(x)&&x>=0&&x<DUST_LOCATIONS.length) && ['eggs','spill','cook','serve','done'].includes(s.breakfast) && [true,false,null].includes(s.eggDrop) && Number.isFinite(s.schoolSeconds)) this.state = structuredClone(s);
  }
  private newDay(day: number): DayState {
    const random=()=>Math.max(0,Math.min(1-Number.EPSILON,this.random()));
    const pool = DUST_LOCATIONS.map((_,i)=>i), dust: number[]=[];
    while(dust.length<3) dust.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
    const chores=[...AFTERNOON_EXTRAS];for(let i=chores.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[chores[i],chores[j]]=[chores[j],chores[i]];}
    const petTask=random()<.5?'feed-dog':'pet-care';
    const afternoonTasks=['dust-0',random()<.5?'dust-1':'spill',chores[0].id,chores[1].id,petTask];
    return {afternoonTasks,version:1,day,minutes:420,phase:'morning',done:[],eggDrop:null,breakfast:'eggs',dust,schoolSeconds:0,petTask,spillSite:Math.floor(random()*SPILL_LOCATIONS.length),sideTask:(['laundry-clothes','living-toy','kitchen-dish'] as const)[Math.floor(random()*3)]};
  }
  get tasks() { if(this.state.phase==='afternoon'&&Array.isArray(this.state.afternoonTasks)&&this.state.afternoonTasks.length===5&&new Set(this.state.afternoonTasks).size===5&&this.state.afternoonTasks.every(id=>afternoonCatalog.some(t=>t.id===id)))return this.state.afternoonTasks.map(id=>afternoonCatalog.find(t=>t.id===id)!);const tasks=DAILY_TASKS[this.state.phase];if(this.state.phase!=='afternoon'||!this.state.petTask)return tasks;return [...tasks.filter(t=>t.id!=='dust-2'&&t.id!=='laundry-clothes'),this.state.sideTask==='living-toy'?{id:'living-toy',name:'Put toys away',icon:'🧸'}:this.state.sideTask==='kitchen-dish'?{id:'kitchen-dish',name:'Take dish to sink',icon:'🍽'}:{id:'laundry-clothes',name:'Put laundry in washer',icon:'👕'},this.state.petTask==='feed-dog'?{id:'feed-dog',name:'Fill puppy’s bowl',icon:'🐾'}:{id:'pet-care',name:'Scoop · flush · wash',icon:'🐾'}]; }
  get ready() { return this.tasks.every(t=>this.state.done.includes(t.id)); }
  get canShop() { return this.state.phase === 'afternoon'&&this.state.minutes<1140; }
  get schoolDue() { return this.state.phase==='morning' && (this.ready || this.state.minutes>=510); }
  get canSleep() { return this.state.phase==='night' && (this.ready || this.state.minutes>=1260); }
  complete(id: string) { if(!this.tasks.some(t=>t.id===id)||this.state.done.includes(id)) return false; this.state.done.push(id); return true; }
  crackEgg() { if(this.state.eggDrop===null) this.state.eggDrop=this.random()<.5; this.state.breakfast=this.state.eggDrop?'spill':'cook'; }
  goSchool() { if(!this.schoolDue)return false;this.state.phase='school';this.state.minutes=510;this.state.schoolSeconds=3;return true; }
  sleep(early=false) { if(!this.canSleep&&!(early&&this.state.phase==='afternoon'&&this.ready))return false;const old=this.state,next=this.newDay(old.day+1);if(next.sideTask===old.sideTask)next.sideTask=old.sideTask==='laundry-clothes'?'living-toy':old.sideTask==='living-toy'?'kitchen-dish':'laundry-clothes';if(next.dust.slice(0,2).every(i=>old.dust.slice(0,2).includes(i)))next.dust=next.dust.map(i=>(i+2)%DUST_LOCATIONS.length);if(next.afternoonTasks?.slice().sort().join()===old.afternoonTasks?.slice().sort().join()){const choices=AFTERNOON_EXTRAS.filter(t=>!next.afternoonTasks!.includes(t.id));next.afternoonTasks![2]=choices[Math.floor(this.random()*choices.length)].id;}this.state=next;return true; }
  advance(seconds: number) {
    if(!Number.isFinite(seconds)||seconds<=0)return;
    if(this.state.phase==='school') { this.state.schoolSeconds=Math.max(0,this.state.schoolSeconds-seconds);if(!this.state.schoolSeconds){this.state.phase='afternoon';this.state.minutes=900;this.state.done=[];}return; }
    this.state.minutes+=seconds*.5;
    if(this.state.phase==='morning')this.state.minutes=Math.min(510,this.state.minutes);
    if(this.state.phase==='afternoon'&&this.state.minutes>=1140&&this.ready){this.state.phase='night';this.state.minutes=1140;this.state.done=[];}
    if(this.state.phase==='afternoon')this.state.minutes=Math.min(1140,this.state.minutes);
    if(this.state.phase==='night')this.state.minutes=Math.min(1260,this.state.minutes);
  }
  get label() { const m=Math.floor(this.state.minutes),h=Math.floor(m/60);return `${h>12?h-12:h}:${String(m%60).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
}
