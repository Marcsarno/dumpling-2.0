// Captures the three.js world viewer at the PlayCanvas baseline viewpoints, in a
// disposable headless Edge context, 390x844 CSS at devicePixelRatio 3.
//   node tests/browser/capture-three.mjs                 (dev server from source)
//   THREE_URL=http://127.0.0.1:5201/ node tests/browser/capture-three.mjs   (a served build)
//   CAPTURE_ONLY=house-bedroom,store-toys-entry node tests/browser/capture-three.mjs
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';
import {VIEWPORT,VIEWPOINTS} from '../viewpoints.mjs';

const only=process.env.CAPTURE_ONLY?.split(',');
const views=VIEWPOINTS.filter(v=>!only||only.includes(v.id));
const shots=resolve(ROOT,'artifacts','three','authored');await mkdir(shots,{recursive:true});

let url=process.env.THREE_URL,server;
if(!url){const {createServer}=await import('vite');server=await createServer({root:ROOT,logLevel:'warn',server:{host:'127.0.0.1',port:5210,strictPort:false}});await server.listen();url=server.resolvedUrls.local[0];}

const browser=await chromium.launch({channel:'msedge',headless:true});
const result={captured:new Date().toISOString(),url,viewport:VIEWPORT,note:'Headless desktop Edge in a disposable context. Not phone evidence.',views:{},errors:[]};
try{
 const context=await browser.newContext({viewport:{width:VIEWPORT.width,height:VIEWPORT.height},deviceScaleFactor:VIEWPORT.deviceScaleFactor,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 await page.goto(url+'?capture=1&view='+views[0].id);
 await page.waitForFunction(()=>document.body.dataset.ready==='true',undefined,{timeout:120000});
 result.environment=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),i=gl?.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,gpu:i?gl.getParameter(i.UNMASKED_RENDERER_WEBGL):'unknown'};});
 const frames=n=>page.evaluate(n=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
 for(const view of views){
  const region=view.scene==='store'?'store-'+view.store:'house';
  const t0=Date.now();await page.evaluate(r=>window.__roomTest.show(r),region);const loadMs=Date.now()-t0;
  await page.evaluate(v=>window.__roomTest.frame(v.focus,v.height),view);await frames(4);
  const snapshot=await page.evaluate(()=>window.__roomTest.snapshot());
  await page.screenshot({path:resolve(shots,view.id+'.png')});
  result.views[view.id]={...snapshot,regionLoadMs:loadMs};
  console.log(view.id,'draws',snapshot.drawCalls,'tris',snapshot.triangles,'textures',snapshot.memory.textures,'pixelRatio',snapshot.pixelRatio,snapshot.resolution.join('x'),snapshot.world?.problems.length?'PROBLEMS '+snapshot.world.problems.length:'');
 }
 await writeFile(resolve(ROOT,'artifacts','three','metrics.json'),JSON.stringify(result,null,1)+'\n');
 console.log('Errors:',result.errors.length?result.errors:'none');
}finally{await browser.close();await server?.close();}
