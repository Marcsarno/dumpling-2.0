import assert from 'node:assert/strict';
import {PopBoard,POP_STARTERS,boardPool} from '../src/data/squishyPop.ts';
import {ProgressStore} from '../src/systems/ProgressStore.ts';
import {boxPrice,storeById} from '../src/data/hunt.ts';
function fixture(){return new PopBoard(POP_STARTERS,{},()=>0);}
const path=[0,1,2,3,4,5,11,10,9,8,7,6];
for(const [n,power] of [[5,'bomb'],[7,'rainbow'],[10,'mega']]){const b=fixture();path.slice(0,n).forEach((i,j)=>j?b.extend(i):b.begin(i));const r=b.release(1);assert.equal(r.created,power);assert.equal(b.pieces.filter(p=>p.power===power).length,1);assert.equal(new Set(b.pieces.map(p=>p.id)).size,36);}
for(const [power,count] of [['bomb',9],['mega',25]]){const b=fixture();b.pieces[14].power=power;b.begin(14);const r=b.release(1);assert.equal(r.cleared.length,count);assert.equal(r.created,undefined);assert.deepEqual(r.activated,[power]);}
{const b=fixture();b.pieces[0].kind='rosie';b.pieces[1].power='rainbow';b.pieces[2].kind='minty';b.begin(0);assert.ok(b.extend(1));assert.equal(b.extend(2),false,'Rainbow connects within a matching type, not arbitrary mixed chains');b.begin(1);assert.ok(b.extend(2));assert.ok(b.extend(1));assert.equal(b.chain.length,1);assert.ok(b.extend(0),'Backtracking resets wildcard base');}
{const b=fixture();b.pieces[14].power='bomb';b.pieces[15].power='mega';b.begin(14);const r=b.release();assert.equal(new Set(r.cleared.map(c=>c.index)).size,r.cleared.length);assert.equal(r.activated.length,2);}
{const b=fixture();for(let r=0;r<3;r++){b.pieces.forEach(p=>{p.kind='mochi';delete p.power;});path.slice(0,7).forEach((i,j)=>j?b.extend(i):b.begin(i));b.release(r+1);}assert.ok(b.frenzyUntil>3);}
{const b=fixture();b.pieces.forEach((p,i)=>p.kind=POP_STARTERS[(i%6+Math.floor(i/6)*2)%6]);assert.deepEqual(b.findChain(),[]);assert.equal(b.ensurePlayable(),true);assert.ok(b.findChain().length>=3);}
assert.ok(boardPool({fox:3,panda:1}).includes('fox'));assert.equal(boardPool({}).length,5);
let raw=null,fail=false;const repo={read:()=>raw,write:value=>{if(fail)throw Error('disk');raw=value;}};const save=new ProgressStore(repo,()=>.1,()=>crypto.randomUUID());save.creditRound('allowance',20);save.ensureHuntDay(1);save.visitStore('corner',1,900);
const preserved=structuredClone(save.data);assert.equal(save.completePopRound('round1',1000),3);assert.equal(save.completePopRound('round1',1000),3);assert.deepEqual(Object.fromEntries(Object.entries(save.data).filter(([k])=>k!=='pop')),preserved);
fail=true;assert.throws(()=>save.completePopRound('round2',1000));assert.equal(save.data.pop.tickets,3);fail=false;assert.equal(save.completePopRound('round2',1000),6);
for(let i=0;i<10;i++)save.completePopRound('big'+i,9999);assert.equal(save.popDiscount(),0);const slot=save.data.hunt.stores.corner.slots.find(s=>s.remaining);save.discover(slot.site);const before=save.data.balance,tickets=save.data.pop.tickets;save.purchaseStock(slot.site);assert.equal(before-save.data.balance,boxPrice(storeById('corner'),slot.series));assert.equal(save.data.pop.tickets,tickets);save.ensureHuntDay(2);assert.equal(save.popDiscount(),0);assert.equal(new ProgressStore(repo).data.pop.tickets,86);
console.log('PASS power thresholds/radii/cascades, wildcard/backtrack, Frenzy, deadlock, collection pool, old saves, state preservation, idempotent rewards, failed writes and tickets reserved for explicit prize purchases');
