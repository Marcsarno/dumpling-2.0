import {HOME_TOYS,type Point,type ToyKind} from '../data/homePlay';
export type ToyState={position:Point;yaw:number;owner:'world'|'held'|string;kind:ToyKind;value:number;marks:number[];tilt:number};
export type Plate={id:string;food:'pizza'|'taco'|'turkey'|'sandwich';bites:number;drink:number;fruit:'apple'|'orange';fruitBites:number;owner:'held'|'world'|string;position:Point};
export type HomeState={version:1;day:number;toys:Record<string,ToyState>;dinner:{served:boolean;portions:boolean[];plate:Plate|null};lunch:Plate|null;serial:number;water:number;puddle:number;leafPile:number};
export interface PlayStorage{getItem(key:string):string|null;setItem(key:string,value:string):void}
const fresh=(day:number):HomeState=>({version:1,day,toys:Object.fromEntries(HOME_TOYS.map(t=>[t.id,{position:[...t.home],yaw:0,owner:'world',kind:t.kind,value:0,marks:[],tilt:0}])),dinner:{served:false,portions:Array(8).fill(true),plate:null},lunch:null,serial:0,water:0,puddle:0,leafPile:1});
const position=(p:unknown):p is Point=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<40&&p[1]>=0&&p[1]<3&&p[2]>-24&&p[2]<22;
/** One durable transaction owns every toy, container and food identity. Failed writes never publish state. */
export class HomePlayStore{
 data:HomeState;
 constructor(private storage:PlayStorage,private key:string,day:number){
  this.data=fresh(day);let saved:HomeState|undefined;try{saved=JSON.parse(storage.getItem(key)||'null')??undefined;}catch{}
  if(saved?.version!==1)return;
  for(const def of HOME_TOYS){const t=saved.toys?.[def.id];if(t&&position(t.position)&&Number.isFinite(t.value)&&Number.isFinite(t.yaw))this.data.toys[def.id]={...this.data.toys[def.id],...t,marks:Array.isArray(t.marks)?t.marks.filter(Number.isFinite).slice(0,16):[],kind:def.id==='paper'&&t.kind==='plane'?'plane':def.kind};}
  // Recover corrupt/cyclic containers without trusting arbitrary saved identifiers.
  for(const [id,t]of Object.entries(this.data.toys)){const seen=new Set([id]);let owner=t.owner;while(owner!=='world'&&owner!=='held'){if(!this.data.toys[owner]||seen.has(owner)){t.owner='world';t.position=[...HOME_TOYS.find(d=>d.id===id)!.home];break;}seen.add(owner);owner=this.data.toys[owner].owner;}}
  let held=false;for(const t of Object.values(this.data.toys))if(t.owner==='held'){if(held)t.owner='world';held=true;}
  if(saved.day===day){
   const validPlate=(p:Plate|null)=>p&&typeof p.id==='string'&&position(p.position)&&['pizza','taco','turkey','sandwich'].includes(p.food)&&Number.isInteger(p.bites)&&p.bites>=0&&p.bites<=3?{...p,owner:['world','held','counter','home-north','lunch-left','lunch-right'].includes(p.owner)?p.owner:'world',fruit:p.fruit==='orange'?'orange' as const:'apple' as const,drink:Math.max(0,Math.min(3,p.drink||0)),fruitBites:Math.max(0,Math.min(2,p.fruitBites||0))}:null;
   this.data.dinner={served:!!saved.dinner?.served,portions:Array.isArray(saved.dinner?.portions)&&saved.dinner.portions.length===8?saved.dinner.portions.map(Boolean):Array(8).fill(true),plate:validPlate(saved.dinner?.plate)};
   this.data.lunch=validPlate(saved.lunch);this.data.water=Math.max(0,Math.min(1,saved.water||0));this.data.puddle=Math.max(0,Math.min(1,saved.puddle||0));this.data.serial=Number.isSafeInteger(saved.serial)?Math.max(0,saved.serial):0;this.data.leafPile=saved.leafPile?1:0;
   for(const plate of [this.data.dinner.plate,this.data.lunch])if(plate?.owner==='held'){if(held)plate.owner='world';held=true;}
  }
 }
 transact(change:(s:HomeState)=>boolean|void){const next=structuredClone(this.data);if(change(next)===false)return false;this.storage.setItem(this.key,JSON.stringify(next));this.data=next;return true;}
 day(day:number){if(day===this.data.day)return false;return this.transact(s=>{s.day=day;s.dinner={served:false,portions:Array(8).fill(true),plate:null};s.lunch=null;s.puddle=0;});}
 get held(){return Object.keys(this.data.toys).find(id=>this.data.toys[id].owner==='held')??(this.data.dinner.plate?.owner==='held'?'dinner-plate':this.data.lunch?.owner==='held'?'lunch-tray':null);}
 take(id:string){return this.transact(s=>{if(this.held||!s.toys[id]||s.toys[id].owner==='sunny'||s.toys[id].owner==='lilah'||HOME_TOYS.find(t=>t.id===id)?.fixed)return false;s.toys[id].owner='held';});}
 place(id:string,p:Point,owner='world'){return this.transact(s=>{const t=s.toys[id];if(!t||!position(p)||id===owner)return false;if(owner!=='world'){
   const parent=s.toys[owner];if(!parent||parent.owner==='held')return false;const seen=new Set([id]);let cursor=owner;while(s.toys[cursor]){if(seen.has(cursor))return false;seen.add(cursor);cursor=s.toys[cursor].owner;}
   if(owner==='wagon'&&Object.values(s.toys).filter(t=>t.owner==='wagon').length>=4)return false;
  }t.owner=owner;t.position=[...p];t.tilt=0;});}
 claimDinner(){return this.transact(s=>{if(this.held||s.dinner.plate||!s.dinner.served)return false;const index=s.dinner.portions.indexOf(true);if(index<0)return false;s.dinner.portions[index]=false;s.dinner.plate={id:`dinner-${s.day}-${index}`,food:(['pizza','taco','turkey'] as const)[(s.day-1)%3],bites:0,drink:0,fruit:'apple',fruitBites:2,owner:'held',position:[.55,1,13.28]};});}
 refillDinner(){return this.transact(s=>{const plate=s.dinner.plate,index=s.dinner.portions.indexOf(true);if(!plate||plate.bites<3||index<0)return false;s.dinner.portions[index]=false;plate.id=`dinner-${s.day}-${index}`;plate.bites=0;});}
 lunch(food:'pizza'|'sandwich',fruit:'apple'|'orange',counter=false){return this.transact(s=>{if(this.held||s.lunch)return false;s.lunch={id:`lunch-${s.day}-${++s.serial}`,food,fruit,bites:0,drink:0,fruitBites:0,owner:counter?'counter':'held',position:[4.6,1.34,-20.8]};});}
 bite(context:'dinner'|'lunch',identity:string,expected:number,fruit=false){return this.transact(s=>{const p=context==='dinner'?s.dinner.plate:s.lunch;if(!p||p.id!==identity||p[fruit?'fruitBites':'bites']!==expected||p[fruit?'fruitBites':'bites']>=(fruit?2:3))return false;p[fruit?'fruitBites':'bites']++;});}
 plate(context:'dinner'|'lunch'){return context==='dinner'?this.data.dinner.plate:this.data.lunch;}
 returnPlate(context:'dinner'|'lunch'){return this.transact(s=>{if(context==='dinner')s.dinner.plate=null;else s.lunch=null;});}
}
