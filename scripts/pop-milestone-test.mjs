import assert from 'node:assert/strict';
import {DUMPLINGS} from '../src/data/collection.ts';
import {PopBoard,boardPool,POP_STARTERS} from '../src/data/squishyPop.ts';
import {visuallyDistinct,POP_IDENTITY} from '../src/data/popIdentity.ts';
let seed=571;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(const d of DUMPLINGS){assert.ok(POP_IDENTITY[d.id]);assert.ok(boardPool({[d.id]:1},random).includes(d.id),`${d.id} can appear when discovered`);}
const began=performance.now();for(let i=0;i<1500;i++){const collection=Object.fromEntries(DUMPLINGS.filter(()=>random()>.3).map(d=>[d.id,5]));const pool=boardPool(collection,random);assert.equal(pool.length,5);assert.equal(new Set(pool).size,5);pool.forEach((a,n)=>pool.slice(n+1).forEach(b=>assert.ok(visuallyDistinct(a,b),`${a}/${b}`)));assert.ok(pool.every(id=>collection[id]||POP_STARTERS.includes(id)));}
console.log('PASS 1,500 lineups, five distinct silhouettes/colors each; all 26 discovered friends remain eligible. Milliseconds:',Math.round(performance.now()-began));
const b=new PopBoard(boardPool({}),{},random);b.pieces.forEach((p,i)=>{p.kind=b.pool[(i%6+Math.floor(i/6)*2)%5];delete p.power;});b.pieces[14].power='bomb';b.pieces[15].power='mega';b.begin(14);const preview=b.preview(),score=b.score;assert.equal(preview.valid,true);assert.equal(score,0);assert.equal(preview.effects.length,2);const result=b.release();assert.deepEqual([...preview.removed].sort(),result.cleared.map(c=>c.index).sort());assert.equal(result.effects.length,2);
for(const [n,power] of [[5,'bomb'],[7,'rainbow'],[10,'mega']]){b.pieces.forEach(p=>{p.kind=b.pool[0];delete p.power;});const chain=[0,1,2,3,4,5,11,10,9,8].slice(0,n);chain.forEach((i,j)=>j?b.extend(i):b.begin(i));assert.equal(b.preview().created,power);b.extend(chain.at(-2));assert.equal(b.chain.length,n-1);b.cancel();}
const final=new PopBoard(boardPool({}),{},random);final.pieces[0].power='rainbow';final.pieces[14].power='bomb';final.pieces[15].power='mega';final.frenzyUntil=99;final.bestChain=7;
const f=final.finale(1);assert.equal(f.created,undefined);assert.equal(f.frenzy,false);assert.equal(f.chain,0);assert.equal(f.score,f.cleared.length*10);assert.equal(final.bestChain,7);assert.ok(f.cleared.length<=36);assert.equal(new Set(f.cleared.map(c=>c.index)).size,f.cleared.length);assert.ok(final.pieces.every(p=>!p.power));assert.equal(final.finale(),null);assert.equal(final.score,f.score);
console.log('PASS previews match cascade resolution; backtracking, bounded one-shot finale, no new specials, no false best chain or Frenzy multiplier');
