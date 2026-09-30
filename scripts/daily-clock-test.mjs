import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const source=await readFile('src/systems/DailyClock.ts','utf8');const code=ts.transpile(source,{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});const {DailyClock}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const c=new DailyClock(()=>.25);assert.equal(c.label,'7:00 AM');c.advance(120);assert.equal(c.label,'8:00 AM');assert.equal(c.canShop,false);c.advance(60);assert.equal(c.schoolDue,true);assert.equal(c.goSchool(),true);c.advance(3);assert.equal(c.state.phase,'afternoon');assert.equal(c.canShop,true);c.advance(480);assert.equal(c.state.phase,'afternoon');c.tasks.forEach(t=>c.complete(t.id));c.advance(1);assert.equal(c.state.phase,'night');assert.equal(c.canShop,false);c.advance(240);assert.equal(c.sleep(),true);assert.equal(c.state.day,2);assert.equal(c.state.phase,'morning');
for(const chance of [.499,.5]){const d=new DailyClock(()=>chance);d.crackEgg();assert.equal(d.state.eggDrop,chance<.5);const restored=new DailyClock(()=>1,d.state);restored.crackEgg();assert.equal(restored.state.eggDrop,chance<.5);assert.equal(new Set(d.state.dust).size,3)}
console.log('PASS running clock, school requirement, shopping hours, night, next day, 50% egg boundary and persisted egg outcome');

for(const minutes of [1139,1140,1150]){const d=new DailyClock(()=>.25,{...c.state,phase:'afternoon',minutes});assert.equal(d.canShop,minutes<1140);}
