import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgressStore} from '../src/systems/ProgressStore.ts';
import {STORES,SERIES,HUNT_RULES,createHuntDay,canVisit,boxPrice,rollSeries} from '../src/data/hunt.ts';
import {DUMPLINGS} from '../src/data/collection.ts';
function random(seed=3){return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)}
function fixture(){let raw=null,fail=false,serial=0;const repo={read:()=>raw,write:v=>{if(fail)throw Error('quota');raw=v}};return{store:new ProgressStore(repo,random(),()=>String(++serial)),reload:()=>new ProgressStore(repo,random(54)),fail:()=>fail=true,raw:()=>raw}}
test('Daily stock uses configured sites, quantities, series and fresh assortments',()=>{
 const a=createHuntDay(1,random()),b=createHuntDay(2,random(54));assert.notDeepEqual(a.stores,b.stores);
 for(let day=1;day<300;day++)for(const store of STORES){const s=createHuntDay(day,random(day)).stores[store.id];assert.equal(new Set(s.slots.map(x=>x.site)).size,s.slots.length);assert.ok(s.slots.length>=1&&s.slots.length<=6);assert.ok(s.slots.reduce((n,x)=>n+x.remaining,0)<=store.stock[1]);for(const slot of s.slots)assert.ok(store.series.some(x=>x.id===slot.series));}
 for(const series of SERIES)for(const rarity of ['Common','Rare','Epic','Legendary'])assert.ok(DUMPLINGS.some(d=>series.items.includes(d.id)&&d.rarity===rarity));
});
test('All stores allow untimed afternoon and night trips',()=>{for(const store of STORES){assert.equal(canVisit(store,899),false);assert.equal(canVisit(store,900),true);assert.equal(canVisit(store,1260),true);}});
test('Buy, reload, open, revisit, and next-day restock preserve economy and receipts',()=>{
 const f=fixture(),s=f.store;s.creditRound('test',100);s.ensureHuntDay(1);const day=structuredClone(s.data.hunt);s.ensureHuntDay(1);assert.deepEqual(day,s.data.hunt);
 const minute=s.visitStore('corner',1,925),slot=s.data.hunt.stores.corner.slots[0];assert.equal(minute,925);assert.throws(()=>s.purchaseStock(slot.site),/look/);s.discover(slot.site);
 const price=boxPrice(STORES[0],slot.series),qty=slot.remaining;s.purchaseStock(slot.site);assert.equal(s.data.balance,100-price);assert.equal(s.data.hunt.stores.corner.slots[0].remaining,qty-1);
 let reload=f.reload();assert.equal(reload.data.hunt.clockFloor,0);assert.equal(reload.data.boxes.length,1);assert.throws(()=>reload.purchaseStock(slot.site),/sold out/);
 reload.goHome();const receipt=reload.openNext();assert.ok(SERIES.find(x=>x.id===slot.series).items.includes(receipt.dumplingId));assert.deepEqual(f.reload().openNext(),receipt);
 reload.showCollection();reload.startCleanup();reload.visitStore('toys',1,920);assert.equal(reload.data.hunt.clockFloor,0,'untimed travel does not advance the daily clock');assert.throws(()=>reload.visitStore('collector',1,1070),/Two/);
 reload.goHome();reload.ensureHuntDay(2);assert.equal(reload.data.balance,100-price);assert.equal(reload.data.collection[receipt.dumplingId],1);assert.equal(reload.data.hunt.day,2);assert.notDeepEqual(reload.data.hunt.stores,day.stores);
});
test('Storage failure, insufficient money and bag limit cannot consume stock',()=>{
 const f=fixture(),s=f.store;s.ensureHuntDay(1);s.visitStore('toys',1,920);const slot=s.data.hunt.stores.toys.slots[0],quantity=slot.remaining;s.discover(slot.site);assert.throws(()=>s.purchaseStock(slot.site),/costs/);assert.equal(s.data.hunt.stores.toys.slots[0].remaining,quantity);
 s.creditRound('funds',100);const before=f.raw();f.fail();assert.throws(()=>s.purchaseStock(slot.site),/Unable to save/);assert.equal(f.raw(),before);assert.equal(s.data.boxes.length,0);
 const g=fixture();g.store.creditRound('funds',100);g.store.ensureHuntDay(1);g.store.visitStore('toys',1,920);
 for(const slot of g.store.data.hunt.stores.toys.slots.slice(0,3)){g.store.discover(slot.site);g.store.purchaseStock(slot.site);}const last=g.store.data.hunt.stores.toys.slots[3];if(last){g.store.discover(last.site);assert.throws(()=>g.store.purchaseStock(last.site),/bag is full/);}
});
test('Rare-stock differences are real and outcomes stay in the purchased series',()=>{
 for(const store of STORES){const counts={Common:0,Rare:0,Epic:0,Legendary:0};for(let i=0;i<10000;i++){let n=0;const d=rollSeries('galaxy',store,()=>n++?0:(i+.5)/10000);counts[d.rarity]++;assert.ok(SERIES.find(s=>s.id==='galaxy').items.includes(d.id));}for(const [rarity,count] of Object.entries(counts))assert.equal(count,store.odds[rarity]*100);}
});
test('Existing version-one saves migrate without losing their old collection',()=>{const f=fixture();f.store.creditRound('old',8);f.store.startTrip();f.store.purchase();f.store.goHome();const r=f.store.openNext();const s=f.reload();s.ensureHuntDay(1);assert.equal(s.data.balance,4);assert.equal(s.data.collection[r.dumplingId],1);assert.equal(s.data.reveal.id,r.id)});
