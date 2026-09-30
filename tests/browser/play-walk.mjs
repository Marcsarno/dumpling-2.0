// Plays the rebuild with real input in a disposable headless Edge context (390x844 @3x,
// touch): keyboard and touch-joystick movement, gait changes, collision with walls,
// and Arianna's runtime quality. Screenshots go to artifacts/play/.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const out=resolve(ROOT,'artifacts','play');await mkdir(out,{recursive:true});
let url=process.env.THREE_URL,server;
if(!url){const {createServer}=await import('vite');server=await createServer({root:ROOT,logLevel:'warn',server:{host:'127.0.0.1',port:5213,strictPort:false}});await server.listen();url=server.resolvedUrls.local[0];}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);
 await page.waitForFunction(()=>document.body.dataset.ready==='true'&&window.__player.snapshot(),undefined,{timeout:120000});
 const snap=()=>page.evaluate(()=>window.__player.snapshot());
 const start=await snap();
 assert.deepEqual(start.quality.colorMap,[2048,2048]);assert.deepEqual(start.quality.normalMap,[2048,2048]);
 assert.equal(start.quality.triangles,14694);assert.equal(start.quality.joints,28);assert.equal(start.quality.pixelRatio,3);
 assert.equal(start.animation.state,'Idle');
 await page.screenshot({path:resolve(out,'00-idle.png')});

 // Keyboard: run toward screen-right.
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);
 const running=await snap();await page.screenshot({path:resolve(out,'01-running.png')});
 await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');
 const moved=await snap();
 assert.equal(running.animation.state,'Run',`full stick runs (state ${running.animation.state})`);
 assert.ok(Math.hypot(moved.position[0]-start.position[0],moved.position[2]-start.position[2])>.8,'keyboard moved her');
 await page.waitForTimeout(400);assert.equal((await snap()).animation.state,'Idle','she settles when released');

 // Touch joystick: a partial push walks.
 const pad=await page.locator('#joystick').boundingBox(),cx=pad.x+pad.width/2,cy=pad.y+pad.height/2,cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx,y:cy-pad.width*.29*.45*i/6,id:1}]});await page.waitForTimeout(16);}
 await page.waitForTimeout(500);const walking=await snap();await page.screenshot({path:resolve(out,'02-walking.png')});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(walking.animation.state,'Walk',`a gentle push walks (state ${walking.animation.state}, input ${walking.input})`);

 // Collision: hold up-left for 4 s; she must stay inside the house walkables.
 await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(4000);
 await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowLeft');
 const wall=await snap();await page.screenshot({path:resolve(out,'03-wall.png')});
 const inside=await page.evaluate(p=>!window.__player.session().movement.blocked(p[0],p[2]),wall.position);
 assert.ok(inside,`she ends in a free spot ${wall.position}`);
 // Actions: events fire on the clip clock at the gameplay times, then locomotion resumes.
 const action=await page.evaluate(()=>new Promise(resolve=>{const t0=performance.now(),events=[];
  window.__player.session().animator.playAction('MealBite',{onEvent:e=>events.push([e,Math.round(performance.now()-t0)]),done:()=>resolve({events,ms:Math.round(performance.now()-t0)})});}));
 assert.deepEqual(action.events.map(e=>e[0]),['mouth-contact']);
 assert.ok(Math.abs(action.events[0][1]-650)<120,`contact at ${action.events[0][1]} ms`);
 assert.ok(Math.abs(action.ms-1250)<150,`finished at ${action.ms} ms`);
 await page.waitForTimeout(300);assert.equal((await snap()).animation.state,'Idle');
 assert.deepEqual(errors,[]);
 console.log('PASS play:',JSON.stringify({start:start.position.map(v=>+v.toFixed(2)),afterRun:moved.position.map(v=>+v.toFixed(2)),walk:walking.animation,wall:wall.position.map(v=>+v.toFixed(2))}));
}finally{await browser.close();await server?.close();}
