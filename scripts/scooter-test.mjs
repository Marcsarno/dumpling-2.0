import assert from 'node:assert/strict';
import {ScooterDynamics} from '../src/systems/ScooterDynamics.ts';
const run=hz=>{const s=new ScooterDynamics();let x=0,z=0,maxLean=0;for(let i=0;i<hz*5;i++){const t=i/hz;s.step(1/hz,t>2?.8:0,t>2?.6:1);x+=s.vx/hz;z+=s.vz/hz;maxLean=Math.max(maxLean,Math.abs(s.lean));}return{x,z,maxLean,s};};
const low=run(30),high=run(120);assert.ok(Math.hypot(low.x-high.x,low.z-high.z)<.3,'Consistent route at 30 and 120 Hz');assert.ok(low.maxLean<.18,'Gentle lean limit');
const s=high.s;let distance=0;for(let i=0;i<120;i++){s.step(1/120,0,0);distance+=Math.hypot(s.vx,s.vz)/120;}assert.ok(distance<.8,'Release stops within a child-friendly distance');assert.ok(Math.hypot(s.vx,s.vz)<.04,'Release reaches rest');
s.reset();for(let i=0;i<60;i++)s.step(1/60,0,1);const old=s.heading;s.step(1/60,0,-1);assert.ok(Math.abs(s.heading-old)<.06,'Reversal does not snap');
console.log('PASS: rate independence, bounded lean, release stopping distance, smooth reversal');
