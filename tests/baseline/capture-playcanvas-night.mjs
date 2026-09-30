// PlayCanvas at night, for lighting parity: serves the pinned PlayCanvas dist/ in a disposable
// context, switches the day to night and captures three rooms once the lamps are fully on.
// Output: artifacts/baseline/night/pc-night-*.png
import {chromium} from 'playwright-core';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const T=new URL('../../', import.meta.url).href;
const {ROOT,fromPlaycanvas}=await import(T+'tools/paths.mjs');
const {serveStatic}=await import(T+'tools/serve-static.mjs');
const dist=fromPlaycanvas('dist'),out=resolve(ROOT,'artifacts','baseline','night');await mkdir(out,{recursive:true});
const config=JSON.parse(await readFile(resolve(dist,'config.json'),'utf8'));
const bundlePath=config.assets['307711680'].file.url.replace(/^\.\//,'').split('?')[0];
const source=await readFile(resolve(dist,bundlePath),'utf8');
const hook='  const dogRoaming = new DogRoaming(room, props.pet.dog, props.daily);';
const body=source.replace(hook,hook+'\n  window.__deep={app,loop,cleanup,camera,character,props,room};');
const server=await serveStatic(dist);
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
const page=await ctx.newPage();
await page.route('**/'+bundlePath.split('/').pop(),r=>r.fulfill({status:200,contentType:'text/javascript',body}));
await page.goto(server.url);
await page.locator('[data-ready=true]').waitFor({timeout:120000});
await page.waitForFunction(()=>window.__roomTest?.snapshot().characterLoaded&&window.__migration?.ready,undefined,{timeout:120000});
await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
await page.evaluate(()=>{const {props,cleanup}=window.__deep;props.daily.developerPhase('night');cleanup.configure('day');});
for(const [room,x,z] of [['bedroom',0,.9],['living',1.5,6.5],['kitchen',-.5,12.5]]){
  await page.evaluate(([x,z])=>{window.__deep.character.player.setPosition(x,.09,z);},[x,z]);
  await page.waitForTimeout(2200);
  const amt=await page.evaluate(()=>window.__deep.room.lighting.nightAmount);
  await page.screenshot({path:resolve(out,`pc-night-${room}.png`)});console.log(room,amt);
}
await browser.close();await server.close?.();
