import assert from 'node:assert/strict';
import {HomePlayStore} from '../src/systems/HomePlayStore.ts';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(storage.fail)throw Error('full');values.set(k,v);},fail:false};
let store=new HomePlayStore(storage,'test',1);
assert(store.take('teddy'));assert(!store.take('cup0'));assert(!store.lunch('pizza','apple'));
assert(store.place('teddy',[1,.1,7],'wagon'));assert(store.take('cup0'));assert(store.place('cup0',[1,.2,7],'wagon'));assert(store.take('cup1'));assert(store.place('cup1',[1,.2,7],'wagon'));assert(store.take('duck'));assert(store.place('duck',[1,.2,7],'wagon'));assert(store.take('block0'));assert(!store.place('block0',[1,.2,7],'wagon'));assert(store.place('block0',[1,.1,7]));
assert(!store.place('wagon',[1,.1,7],'teddy'),'Reject container cycles');
store.transact(s=>{s.dinner.served=true;});assert(store.claimDinner());assert(!store.claimDinner());const p=store.data.dinner.plate;
assert.equal(store.data.dinner.portions.filter(Boolean).length,7);assert(store.bite('dinner',p.id,0));assert(!store.bite('dinner',p.id,0),'Duplicate mouth contact cannot consume twice');
const before=JSON.stringify(store.data);storage.fail=true;assert.throws(()=>store.bite('dinner',p.id,1));assert.equal(JSON.stringify(store.data),before,'Failed save leaves current meal unchanged');storage.fail=false;
store=new HomePlayStore(storage,'test',1);assert.equal(store.data.dinner.plate.bites,1);assert.equal(store.data.dinner.portions.filter(Boolean).length,7);assert.equal(store.held,'dinner-plate');
store.returnPlate('dinner');assert(store.lunch('sandwich','orange'));assert(!store.lunch('pizza','apple'));store=new HomePlayStore(storage,'test',1);assert.equal(store.data.lunch.food,'sandwich');assert.equal(store.data.lunch.fruit,'orange');
const teddy=structuredClone(store.data.toys.teddy);store.day(2);assert.equal(store.data.lunch,null);assert.equal(store.data.dinner.plate,null);assert.deepEqual(store.data.toys.teddy,teddy);assert.equal(store.held,null);
console.log('PASS ownership, cargo capacity/cycles, portion claims, duplicate contact, save failure rollback, reload, lunch choice, day boundary');

for(const [index,food]of ['pizza','taco','turkey'].entries()){
 const key='menu-'+food,day=index+1;let meal=new HomePlayStore(storage,key,day);
 meal.transact(s=>{s.dinner.served=true;});assert(meal.claimDinner());
 for(let portion=0;portion<8;portion++){
  const plate=meal.data.dinner.plate;assert.equal(plate.food,food);
  assert(!meal.refillDinner(),'A partial serving cannot consume another portion');
  for(let bite=0;bite<3;bite++)assert(meal.bite('dinner',plate.id,bite));
  const previous=plate.id;
  if(portion<7){assert(meal.refillDinner());assert.notEqual(meal.data.dinner.plate.id,previous);assert(!meal.bite('dinner',previous,0),'Old action callbacks cannot bite a new portion');}
  else assert(!meal.refillDinner(),'The platter is finite');
  meal=new HomePlayStore(storage,key,day);
  assert.equal(meal.data.dinner.portions.filter(Boolean).length,Math.max(0,6-portion));
 }
}
let counter=new HomePlayStore(storage,'counter',1);assert(counter.lunch('pizza','apple',true));
counter=new HomePlayStore(storage,'counter',1);assert.equal(counter.data.lunch.owner,'counter');assert(!counter.lunch('sandwich','orange',true));
const fruitId=counter.data.lunch.id;assert(counter.bite('lunch',fruitId,0,true));assert(!counter.bite('lunch',fruitId,0,true));assert(counter.bite('lunch',fruitId,1,true));assert(!counter.bite('lunch',fruitId,2,true));
const deep=new HomePlayStore(storage,'deep',1);assert(deep.place('cup0',[1,.1,7],'block0'));assert(deep.place('block0',[1,.1,7],'wagon'));assert(!deep.place('wagon',[1,.1,7],'cup0'),'Reject a three-level container cycle');
for(const operation of [()=>deep.day(2),()=>deep.take('teddy')]){const prior=JSON.stringify(deep.data);storage.fail=true;assert.throws(operation);assert.equal(JSON.stringify(deep.data),prior);storage.fail=false;}
console.log('PASS all three dinner menus, finite refills, stale contact rejection, counter reload, fruit contacts, deep cycles and failed day/pickup writes');
