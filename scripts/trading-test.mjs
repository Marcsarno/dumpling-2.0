import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore } from '../src/systems/ProgressStore.ts';
import { DUMPLINGS } from '../src/data/collection.ts';
import { createTradingDay, valueFor, willing } from '../src/data/trading.ts';

function fixture() {
  const trading=createTradingDay(1);
  trading.traders.cute={stock:['comet','blueberry','custard','orbit','aurora','supernova'],offer:['blueberry'],asks:0,revision:0,done:false,message:'Hello'};
  let raw=JSON.stringify({version:1,balance:17,collection:Object.fromEntries(DUMPLINGS.map(d=>[d.id,d.id==='blueberry'?0:4])),boxes:[{id:'sealed',dumplingId:'mochi'}],creditedRounds:[],trip:{active:false,purchases:0},location:'collection',reveal:null,trading});
  let fail=false;
  const repo={read:()=>raw,write:v=>{if(fail)throw Error('blocked');raw=v;}};
  return {s:new ProgressStore(repo),reload:()=>new ProgressStore(repo),fail:()=>fail=true,raw:()=>raw,edit:fn=>{const d=JSON.parse(raw);fn(d);raw=JSON.stringify(d);}};
}
test('Same-day offers are stable; each trader opens with 1–3 and tomorrow changes pockets',()=>{
  assert.deepEqual(createTradingDay(1),createTradingDay(1));assert.notDeepEqual(createTradingDay(1),createTradingDay(2));
  assert.deepEqual(Object.values(createTradingDay(1).traders).map(n=>n.offer.length),[1,2,3]);
});
test('Preferences create a real duplicate-for-discovery deal, not a universal rarity ladder',()=>{
  assert.ok(valueFor('rosie','cute','garden')>valueFor('blueberry','cute','garden'));
  assert.ok(valueFor('rosie','rarity','garden')<valueFor('blueberry','rarity','garden'));
  const f=fixture(),day=f.s.data.trading;
  assert.equal(willing(day,'cute',['rosie']),true);
  const got=f.s.executeTrade(1,'cute',0,['rosie']);assert.deepEqual(got,['blueberry']);
  assert.equal(f.s.data.collection.rosie,3);assert.equal(f.s.data.collection.blueberry,1);
  assert.equal(f.s.data.balance,17);assert.equal(f.s.data.boxes.length,1);
});
test('Series collector values their current series over equal rarity elsewhere',()=>{
  const day=createTradingDay(1);assert.ok(valueFor('mochi','series',day.series)>valueFor('custard','series',day.series));
});
test('Ask can add, refuse and swap; every revision persists and attempts are bounded',()=>{
  const f=fixture(),s=f.s;
  s.askTrade(1,'cute',0,['rosie']);assert.equal(s.data.trading.traders.cute.offer.length,2);
  const g=fixture();g.s.askTrade(1,'cute',0,['mochi']);assert.match(g.s.data.trading.traders.cute.message,/keep/);
  g.s.askTrade(1,'cute',1,['mochi']);assert.match(g.s.data.trading.traders.cute.message,/instead/);
  assert.deepEqual(g.reload().data.trading,g.s.data.trading);
  g.s.askTrade(1,'cute',2,['mochi']);g.s.askTrade(1,'cute',3,['mochi']);assert.throws(()=>g.s.askTrade(1,'cute',4,['mochi']),/final offer/);
});
test('Double acceptance and stale negotiations cannot award twice',()=>{
  const f=fixture(),stale=f.reload();f.s.executeTrade(1,'cute',0,['rosie']);
  assert.throws(()=>stale.executeTrade(1,'cute',0,['rosie']),/changed/);
  assert.throws(()=>f.s.executeTrade(1,'cute',0,['rosie']),/changed/);
  const before=f.raw();f.s.ensureTradingDay(1);assert.equal(f.raw(),before);
});
test('Favorite and lock protect ALL copies, even if another tab added the protection',()=>{
  for(const kind of ['favorite','locked']){
    const f=fixture(),stale=f.reload();f.s.protect('rosie',kind,true);
    assert.throws(()=>stale.executeTrade(1,'cute',0,['rosie'],true),/stay safe/);
    assert.equal(f.reload().data.collection.rosie,4);
  }
});
test('Last copies stay by default; explicit inclusion supports giving one away',()=>{
  const f=fixture();f.edit(d=>d.collection.rosie=1);
  assert.throws(()=>f.s.executeTrade(1,'cute',0,['rosie']),/last copy/);
  f.s.executeTrade(1,'cute',0,['rosie'],true);assert.equal(f.s.data.collection.rosie,0);
});
test('Repeated IDs count individually; insufficient inventory and invalid offers are rejected',()=>{
  const f=fixture();assert.throws(()=>f.s.executeTrade(1,'cute',0,['rosie','rosie','rosie','rosie']),/one to three/);
  f.edit(d=>d.collection.rosie=2);assert.throws(()=>f.s.executeTrade(1,'cute',0,['rosie','rosie']),/last copy/);
  assert.throws(()=>f.s.executeTrade(1,'cute',0,[]),/one to three/);
  assert.throws(()=>f.s.executeTrade(1,'cute',0,['unknown']),/one to three/);
  assert.throws(()=>f.s.executeTrade(1,'cute',0,['mochi']),/aren’t ready/);
});
test('Failed storage cannot remove or add squishies or consume the trade',()=>{
  const f=fixture(),before=f.raw();f.fail();assert.throws(()=>f.s.executeTrade(1,'cute',0,['rosie']),/Unable to save/);
  assert.equal(f.raw(),before);assert.equal(f.s.data.trading.traders.cute.done,false);
});
test('Older saves migrate additively and malformed trade/protection saves are preserved',()=>{
  const f=fixture();f.edit(d=>{delete d.trading;delete d.protections;});const s=f.reload();s.ensureTradingDay(2);assert.equal(s.data.collection.rosie,4);
  f.edit(d=>d.protections={rosie:{favorite:'yes',locked:false}});const bad=f.reload();assert.ok(bad.problem);assert.throws(()=>bad.ensureTradingDay(2));
});
