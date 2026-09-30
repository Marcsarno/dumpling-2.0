import assert from 'node:assert/strict';
import {POP_LEVELS,PopLevelRun,createLevelBoard,levelUnlocked,levelStars} from '../src/data/popLevels.ts';
import {ProgressStore} from '../src/systems/ProgressStore.ts';
import {visuallyDistinct} from '../src/data/popIdentity.ts';
for(const level of POP_LEVELS)for(let n=0;n<100;n++){
  const b=createLevelBoard(level,{});assert.equal(b.pool.length,level.board.types);assert.ok(b.findChain(level.board.openingChain).length);
  assert.ok(b.pool.every((a,i)=>b.pool.slice(i+1).every(c=>visuallyDistinct(a,c))));
}
const level=POP_LEVELS[2],b=createLevelBoard(level,{}),run=new PopLevelRun(level,b.pool);
b.begin(28);const r=b.release(1);run.observe(r,b.score);assert.equal(run.values[1],1);
const finale=b.finale(2);if(finale)run.observe(finale,b.score,true);assert.equal(run.values[1],1,'Automatic finale cannot satisfy use-power goal');
const custom={...level,objectives:[{kind:'chains',length:5,target:2},{kind:'create',power:'bomb',target:1},{kind:'use',power:'rainbow',target:1},{kind:'frenzy',target:1}]};
const tracker=new PopLevelRun(custom,b.pool),event={...r,chain:5,created:'bomb',activated:['rainbow'],frenzy:true};tracker.observe(event,100,false,8);tracker.observe(event,200,false,8);assert.deepEqual(tracker.values,[2,2,2,1]);assert.ok(tracker.completed);tracker.observe(event,300,false,20);assert.equal(tracker.values[3],2,'A second Frenzy after idle time is a new activation');
let raw=null,fail=false;const repo={read:()=>raw,write:v=>{if(fail)throw Error('disk');raw=v;}};let store=new ProgressStore(repo);store.creditRound('old',25);const before=structuredClone(store.data);
assert.throws(()=>store.completePopRound('locked',100,{levelId:POP_LEVELS[1].id,values:[2],bestChain:5}));assert.deepEqual(store.data,before);
for(const [i,l] of POP_LEVELS.entries()){
  assert.ok(levelUnlocked(l,store.data.pop?.levels));const attempt={levelId:l.id,values:l.objectives.map(o=>o.target),bestChain:8};
  fail=true;const prior=raw;assert.throws(()=>store.completePopRound('level'+i,1800,attempt));assert.equal(raw,prior);fail=false;
  store.completePopRound('level'+i,1800,attempt);const saved=raw;store.completePopRound('level'+i,1800,attempt);assert.equal(raw,saved);
  store.completePopRound('retry'+i,0,{...attempt,values:l.objectives.map(()=>0),bestChain:0});
  store=new ProgressStore(repo);const rec=store.data.pop.levels[l.id];assert.equal(rec.stars,3);assert.equal(rec.bestScore,1800);assert.equal(rec.bestChain,8);assert.equal(rec.attempts,2);assert.ok(rec.completed);
  assert.equal(levelStars(l,l.objectives.map(()=>0),9999),0);
}
assert.deepEqual(Object.fromEntries(Object.entries(store.data).filter(([k])=>k!=='pop')),before);
console.log('PASS boards/readability, objective event accounting, finale exclusion, locked-level rejection, old-save preservation, atomic failure/retry, idempotency, sequential unlocks, replay and best retention');
