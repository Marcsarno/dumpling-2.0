// Records a review video of Arianna's motions from the motion lab, played in real time with
// captions, in a disposable headless Edge context. Output: artifacts/motion/review.webm
//   node tests/browser/record-motion-video.mjs
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const SHOTS=[
 ['RunAuthored','right','Original run (her right side): watch the wrist flick down',2],
 ['Run','right','Rebuilt run: same body and rhythm, relaxed wrists',2],
 ['Run','front','Rebuilt run from the front',2],
 ['MealBite','front','Meal bite: arc to the mouth, head meets the food, small chew',2],
 ['MealBite','right','Meal bite from the side',2],
 ['MealDrink','right','Drink: head tips back to the cup',2],
 ['EatSit','front','Breakfast: sit, two bites, stand',1],
 ['PickUp','right','Pick up: a real squat, feet planted',2],
 ['PutDown','three-quarter','Put down',2],
 ['Celebrate','front','Celebrate: dip, hop, fist pump',3],
];
const out=resolve(ROOT,'artifacts','motion');await mkdir(out,{recursive:true});
const {createServer}=await import('vite');
const server=await createServer({root:ROOT,logLevel:'warn',server:{host:'127.0.0.1',port:5214,strictPort:false}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 // Recorded in the page itself (canvas + MediaRecorder), so no video tools are downloaded.
 const page=await browser.newPage({viewport:{width:540,height:760},deviceScaleFactor:2});
 await page.goto(server.resolvedUrls.local[0]+'lab.html?capture=1');
 await page.waitForFunction(()=>document.body.dataset.ready==='true',undefined,{timeout:120000});
 const webm=await page.evaluate(async shots=>{
  const gl=document.querySelector('#game-canvas'),out=document.createElement('canvas');out.width=gl.width;out.height=gl.height;
  const x=out.getContext('2d'),stream=out.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:8e6}),chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);rec.start(250);
  const frame=caption=>{x.drawImage(gl,0,0);x.fillStyle='#fffaf2e6';x.fillRect(0,0,out.width,90);x.fillStyle='#3d3350';x.font='600 34px system-ui';x.textAlign='center';x.fillText(caption,out.width/2,58);};
  for(const [clip,view,caption,loops] of shots){
   const d=window.__lab.clips().find(c=>c.name===clip).duration,total=d*loops*1000+400,t0=performance.now();
   await new Promise(r=>{const f=now=>{const e=now-t0;window.__lab.pose(clip,Math.min(e/1000,d*loops)%d,view);frame(caption);if(e<total)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});
  }
  rec.stop();await new Promise(r=>rec.onstop=r);
  const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=65536)str+=String.fromCharCode(...bytes.subarray(i,i+65536));return btoa(str);
 },SHOTS);
 await writeFile(resolve(out,'review.webm'),Buffer.from(webm,'base64'));
 console.log('Video:',resolve(out,'review.webm'));
}finally{await browser.close();await server.close();}
