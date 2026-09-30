// Guards the owner's real saves: loading the rebuild (built output) must never read or
// write any PlayCanvas production key (arianna.*), and must render at native resolution.
// Runs in a disposable browser context seeded with a sentinel arianna.* save.
//   node tests/browser/no-arianna-writes.mjs        (builds dist/ must exist: pnpm run build)
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';
import {serveStatic} from '../../tools/serve-static.mjs';

assert.ok(existsSync(resolve(ROOT,'dist/index.html')),'Run pnpm run build first.');
const server=await serveStatic(resolve(ROOT,'dist'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const search of ['','?preview=home-play','?region=store-toys']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   const sentinel='{"version":1,"sentinel":true}';
   if(!sessionStorage.getItem('seeded')){localStorage.setItem('arianna.progress.v1',sentinel);sessionStorage.setItem('seeded','1');}
   const log=window.__storageLog=[];const proto=Storage.prototype;
   for(const name of ['getItem','setItem','removeItem']){const original=proto[name];proto[name]=function(key,...rest){if(this===localStorage)log.push([name,String(key)]);return original.call(this,key,...rest);};}
   const clear=proto.clear;proto.clear=function(){if(this===localStorage)log.push(['clear','*']);return clear.call(this);};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.url+search);
  await page.waitForFunction(()=>document.body.dataset.ready==='true',undefined,{timeout:60000});
  await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>({log:[...window.__storageLog],keys:Object.keys(localStorage),sentinel:localStorage.getItem('arianna.progress.v1'),snapshot:window.__roomTest.snapshot()}));
  assert.deepEqual(errors,[],search);
  assert.deepEqual(state.log.filter(([,key])=>key==='*'||key.startsWith('arianna')),[],`${search||'default'}: touched arianna.* keys`);
  assert.equal(state.sentinel,'{"version":1,"sentinel":true}','the seeded production save is untouched');
  assert.ok(state.keys.every(k=>k==='arianna.progress.v1'||k.startsWith('dumpling.three')),`unexpected keys ${state.keys}`);
  assert.ok(state.snapshot.savePrefix.startsWith('dumpling.three'));
  assert.equal(state.snapshot.pixelRatio,3,'native devicePixelRatio, uncapped');
  assert.deepEqual(state.snapshot.resolution,[1170,2532]);
  assert.deepEqual(state.snapshot.world.problems,[]);
  console.log(`PASS ${search||'(default)'}: no arianna.* access, prefix ${state.snapshot.savePrefix}, ${state.snapshot.resolution.join('x')} at ratio ${state.snapshot.pixelRatio}`);
  await context.close();
 }
}finally{await browser.close();await server.close();}
