import {saveKey} from '../systems/SaveNamespace';
const KEYS=[saveKey('progress.v1'),saveKey('daily.v1'),saveKey('lilah.v1')] as const;
const CHECKPOINT=saveKey('developer.checkpoint.v1');
type Checkpoint={version:1;created:string;values:Record<string,string|null>};
/** Capture before the first cheat. Restoring only ever touches the three game keys. */
export class DeveloperSaves {
  capture(){const checkpoint:Checkpoint={version:1,created:new Date().toISOString(),values:Object.fromEntries(KEYS.map(key=>[key,localStorage.getItem(key)]))};localStorage.setItem(CHECKPOINT,JSON.stringify(checkpoint));return checkpoint;}
  ensure(){return this.read()??this.capture();}
  read():Checkpoint|null{const raw=localStorage.getItem(CHECKPOINT);if(!raw)return null;const c=JSON.parse(raw);if(c.version!==1||typeof c.created!=='string'||!c.values||KEYS.some(k=>c.values[k]!==null&&typeof c.values[k]!=='string'))throw Error('Developer checkpoint is unreadable; it has not been overwritten.');return c;}
  restore(){const c=this.read();if(!c)throw Error('No checkpoint yet.');this.write(c.values);}
  reset(){this.ensure();this.write(Object.fromEntries(KEYS.map(k=>[k,null])));}
  current(){return{version:1,created:new Date().toISOString(),values:Object.fromEntries(KEYS.map(k=>[k,localStorage.getItem(k)]))};}
  private write(values:Record<string,string|null>){const old=this.current().values;try{for(const k of KEYS)values[k]===null?localStorage.removeItem(k):localStorage.setItem(k,values[k]!);}catch(error){for(const k of KEYS){try{old[k]===null?localStorage.removeItem(k):localStorage.setItem(k,old[k]!);}catch{/* Surface the original failure. */}}throw error;}}
}
