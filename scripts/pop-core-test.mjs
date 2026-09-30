import assert from 'node:assert/strict';
import {PopBoard,boardPool,starLevel,roundTickets} from '../src/data/squishyPop.ts';
let seed=3245;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
for(let n=0;n<1000;n++){
 const b=new PopBoard(boardPool({}),{},random);
 for(let round=0;round<15;round++){
  const path=b.findChain();assert.ok(path.length>=3);path.forEach((i,n)=>assert.ok(n?b.extend(i):b.begin(i)));
  assert.equal(b.extend(path.at(-2)),true);assert.equal(b.chain.length,path.length-1);assert.equal(b.extend(path.at(-1)),true);
  const result=b.release();assert.ok(result);assert.equal(b.pieces.length,36);assert.equal(new Set(b.pieces.map(p=>p.id)).size,36);assert.ok(b.findChain().length);assert.ok(result.score>=30);
 }
}
const b=new PopBoard(boardPool({}),{},()=>0);b.begin(0);assert.equal(b.extend(35),false);assert.equal(b.extend(0),false);assert.equal(b.release(),null);assert.equal(b.score,0);
assert.deepEqual([0,1,2,4,5].map(starLevel),[0,1,2,2,3]);assert.deepEqual([0,499,500,999999].map(roundTickets),[1,1,2,8]);
console.log('PASS 15,000 generated/refilled boards; unique pieces, playable chains, backtracking, invalid chains, stars and ticket bounds');
