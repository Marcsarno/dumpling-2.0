import {selectDailyPlay,PLAY_ACTIVITIES,type PlayId} from '../data/dailyPlay';
import {saveKey} from './SaveNamespace';
export type PlayProgress={step:number;done:boolean};
type Data={version:1;seed:number;day:number;ids:PlayId[];progress:Partial<Record<PlayId,PlayProgress>>};
const valid=(id:unknown):id is PlayId=>PLAY_ACTIVITIES.some(a=>a.id===id);
/** Separate additive save. Never edits allowance, collectibles, or daily chores. */
export class DailyPlayStore {
 data:Data;problem='';
 constructor(private storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
  let seed=(Math.random()*4294967296)>>>0;
  this.data={version:1,seed,day:0,ids:[],progress:{}};
  try{const raw=storage.getItem(saveKey('daily-play.v1'));if(raw){const v=JSON.parse(raw);if(v.version===1&&Number.isInteger(v.seed)&&Number.isInteger(v.day)&&Array.isArray(v.ids)&&v.ids.length===5&&new Set(v.ids).size===5&&v.ids.every(valid)){
   this.data={version:1,seed:v.seed>>>0,day:v.day,ids:v.ids,progress:{}};
   for(const id of v.ids as PlayId[]){const p=v.progress?.[id];this.data.progress[id]={step:Number.isInteger(p?.step)?Math.max(0,Math.min(31,p.step)):0,done:p?.done===true};}
  }}}catch{this.problem='Today’s play could not be read. Your other saves are safe.';}
 }
 ensure(day:number){if(this.data.day===day)return false;this.data={version:1,seed:this.data.seed,day,ids:selectDailyPlay(this.data.seed,day),progress:{}};this.flush();return true;}
 progress(id:PlayId){return this.data.progress[id]??{step:0,done:false};}
 update(id:PlayId,step:number,done=false){if(!this.data.ids.includes(id))return;this.data.progress[id]={step,done:done||this.progress(id).done};this.flush();}
 flush(){try{this.storage.setItem(saveKey('daily-play.v1'),JSON.stringify(this.data));this.problem='';return true;}catch{this.problem='Play is still available, but today’s progress could not be saved.';return false;}}
}

