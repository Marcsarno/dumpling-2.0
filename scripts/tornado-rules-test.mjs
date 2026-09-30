import assert from 'node:assert/strict';
import {TornadoScore,chooseInterruption,TORNADO_SECONDS} from '../src/systems/TornadoRules.ts';
assert.equal(TORNADO_SECONDS,55);
const score=new TornadoScore();assert.equal(score.reward,1);
assert.equal(score.clean(2),10);assert.equal(score.clean(5),12);assert.equal(score.clean(10),14);assert.equal(score.streak,3);
assert.equal(score.clean(19,'dog'),20);assert.equal(score.streak,1);assert.equal(score.bestStreak,3);
assert.equal(score.clean(23,'basket'),22);assert.equal(score.stars,3);assert.equal(score.reward,3);
assert.deepEqual([0,.199,.2,.399,.4,.99].map(chooseInterruption),['dog','dog','basket','basket','none','none']);
console.log('PASS streak timing, streak cap, bonus points, positive minimum reward, star thresholds and rare event selection');
