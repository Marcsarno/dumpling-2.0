// PlayCanvas baseline capture in a disposable browser context.
//
// Serves the PlayCanvas production build (its local dist/, byte-identical to the live
// release at the pinned commit) from 127.0.0.1, instruments the gameplay bundle in
// memory only, and records fixed-view screenshots, render metrics, a mesh/material
// dump of the authored world, and collision data. Nothing in either repository or
// the user's browser profile is touched; the context is in-memory and discarded.
//
//   node tests/baseline/capture-playcanvas.mjs          (all viewpoints)
//   BASELINE_ONLY=house-bedroom,store-toys-entry node tests/baseline/capture-playcanvas.mjs
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,REFERENCE,requirePlaycanvas,fromPlaycanvas} from '../../tools/paths.mjs';
import {serveStatic} from '../../tools/serve-static.mjs';
import {VIEWPORT,VIEWPOINTS} from '../viewpoints.mjs';

requirePlaycanvas();
const dist=fromPlaycanvas('dist');
const release=JSON.parse(await readFile(resolve(dist,'release.json'),'utf8'));
assert.equal(release.commit,REFERENCE.playcanvasCommit,'PlayCanvas dist/ is not the pinned release; rebuild it there first.');
assert.equal(release.runtimeHash,REFERENCE.playcanvasRuntimeHash);
const tag=`playcanvas-${release.commit.slice(0,7)}`;
const metricsDir=resolve(ROOT,'baseline',tag),shotsDir=resolve(ROOT,'artifacts','baseline',tag);
await mkdir(metricsDir,{recursive:true});for(const v of ['as-played','authored'])await mkdir(resolve(shotsDir,v),{recursive:true});
const only=process.env.BASELINE_ONLY?.split(',');
const views=VIEWPOINTS.filter(v=>!only||only.includes(v.id));

// In-memory instrumentation: expose the game objects the capture drives.
const config=JSON.parse(await readFile(resolve(dist,'config.json'),'utf8'));
const bundlePath=config.assets['307711680'].file.url.replace(/^\.\//,'').split('?')[0];
const source=await readFile(resolve(dist,bundlePath),'utf8');
const hook='  const dogRoaming = new DogRoaming(room, props.pet.dog, props.daily);';
assert.equal(source.split(hook).length,2,'Injection point not found; the bundle changed.');
const instrumented=source.replace(hook,hook+'\n  window.__deep={app,loop,cleanup,navigation,camera,character,props,room,lilah,marc,tornado,controller};');

const server=await serveStatic(dist);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:VIEWPORT.width,height:VIEWPORT.height},deviceScaleFactor:VIEWPORT.deviceScaleFactor,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[],httpErrors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))httpErrors.push(`${r.status()} ${r.url()}`);});
await page.route('**/'+bundlePath.split('/').pop(),route=>route.fulfill({status:200,contentType:'text/javascript',body:instrumented}));

const result={captured:new Date().toISOString(),source:{commit:release.commit,runtimeHash:release.runtimeHash,scene:release.scene,served:'PlayCanvas dist/ from 127.0.0.1 (same bytes as the live release)'},
 viewport:VIEWPORT,note:'Headless desktop Edge in a disposable context. Not phone evidence.',environment:{},views:{},perf:{},collision:{},errors,httpErrors};
const save=()=>writeFile(resolve(metricsDir,'metrics.json'),JSON.stringify(result,null,1)+'\n');

try{
 await page.goto(server.url);
 await page.locator('[data-ready=true]').waitFor({timeout:120000});
 await page.waitForFunction(()=>window.__roomTest?.snapshot().characterLoaded&&window.__migration?.ready,undefined,{timeout:120000});
 result.environment=await page.evaluate(()=>{
  const gl=document.createElement('canvas').getContext('webgl2'),info=gl?.getExtension('WEBGL_debug_renderer_info');
  const {app}=window.__deep;
  return {userAgent:navigator.userAgent,gpu:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown',devicePixelRatio,
   canvas:[app.graphicsDevice.width,app.graphicsDevice.height],maxPixelRatio:app.graphicsDevice.maxPixelRatio};
 });
 console.log('PlayCanvas ready',JSON.stringify(result.environment));

 const closeDialogs=()=>page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 const frames=n=>page.evaluate(n=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
 const command=(cmd,value='')=>page.evaluate(({cmd,value})=>window.__deep.loop.developerCommand(cmd,value),{cmd,value});

 async function perf(name){
  await page.evaluate(()=>{window.__deep.app.timeScale=1;});await frames(30);
  result.perf[name]=await page.evaluate(async()=>{
   const {app}=window.__deep,rows=[];let start=0,renders=0,draws=0;
   const begin=()=>start=performance.now(),end=()=>rows.push(performance.now()-start),render=()=>{renders++;draws+=app.graphicsDevice._drawCallsPerFrame;};
   app.on('frameupdate',begin);app.on('framerender',end);app.on('postrender',render);
   const t=performance.now();await new Promise(r=>setTimeout(r,2500));const duration=performance.now()-t;
   app.off('frameupdate',begin);app.off('framerender',end);app.off('postrender',render);rows.sort((a,b)=>a-b);
   return {durationMs:duration,fps:renders*1000/duration,meanUpdateMs:rows.reduce((a,b)=>a+b,0)/rows.length,p95UpdateMs:rows[Math.floor(rows.length*.95)],drawsPerFrame:renders?draws/renders:0};
  });
  console.log('perf',name,JSON.stringify(result.perf[name]));
 }

 // Freezes the world (dt = 0) and frames the follow camera exactly like play does.
 async function frame(view){
  await page.evaluate(({focus,height})=>{
   const {app,camera}=window.__deep;app.timeScale=0;
   Object.assign(camera,{target:null,returnZoom:null,returning:false,interactionLift:0,state:'EXPLORE'});
   camera.offset.set(focus[0],0,focus[1]-.9);camera.entity.camera.orthoHeight=height;camera.follow({x:focus[0],y:0,z:focus[1]},0);
  },view);
  await frames(6);
  return page.evaluate(()=>{
   const {app,camera}=window.__deep,d=app.graphicsDevice,s=app.stats;
   const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]]));
   return {camera:{position:camera.entity.getPosition().toArray(),euler:camera.entity.getEulerAngles().toArray(),orthoHeight:camera.entity.camera.orthoHeight},
    drawCallsPerFrame:d._drawCallsPerFrame,drawCalls:{...s.drawCalls},frame:pick(s.frame,['triangles','otherPrimitives','shaders','materials','shadowMapUpdates','lightClusters']),
    vramMiB:Object.fromEntries(Object.entries(d._vram).map(([k,v])=>[k,+(v/1048576).toFixed(3)])),textures:d.textures.length,
    lighting:{ambient:[app.scene.ambientLight.r,app.scene.ambientLight.g,app.scene.ambientLight.b]}};
  });
 }

 async function shoot(view,variant){
  const metrics=await frame(view);
  await page.screenshot({path:resolve(shotsDir,variant,view.id+'.png')});
  (result.views[view.id]??={})[variant]=metrics;await save();
  console.log(variant,view.id,'draws',metrics.drawCallsPerFrame,'tex MiB',metrics.vramMiB.tex);
 }

 // Hides everything that is not the authored Editor world: characters, toys, markers,
 // dynamic shop stock. Only this disposable page is affected.
 const authoredOnly=()=>page.evaluate(()=>{
  const {app,loop}=window.__deep,roots=new Set(app.root.findByTag('migration.environment'));
  const under=n=>{for(let p=n;p;p=p.parent)if(roots.has(p))return true;return false;};
  const stock=new Set(loop.stores.flatMap(s=>[...s.boxes.flat(),...s.glows]));
  const inStock=n=>{for(let p=n;p;p=p.parent)if(stock.has(p))return true;return false;};
  let hidden=0;for(const r of app.root.findComponents('render'))if(r.entity.enabled&&(!under(r.entity)||inStock(r.entity))){r.entity.enabled=false;hidden++;}
  const style=document.createElement('style');style.id='authored-only';
  style.textContent='body *:not(#game):not(#game-canvas){visibility:hidden!important}#game>*:not(#game-canvas){visibility:hidden!important}';document.head.append(style);
  return hidden;
 });

 // Mesh instances and materials of the authored world as PlayCanvas renders it.
 const dump=scene=>page.evaluate(scene=>{
  const {app,loop}=window.__deep,roots=new Set(app.root.findByTag('migration.environment')),r5=v=>Math.round(v*1e5)/1e5;
  const stock=new Set(loop.stores.flatMap(s=>[...s.boxes.flat(),...s.glows]));
  const inStock=n=>{for(let p=n;p;p=p.parent)if(stock.has(p))return true;return false;};
  const color=c=>c?[r5(c.r),r5(c.g),r5(c.b)]:undefined;
  const pathOf=n=>{const names=[];let key;for(let p=n;p&&!roots.has(p);p=p.parent){names.unshift(p.name);key??=p.tags.list().find(t=>t.startsWith('key:'))?.slice(4);}return {path:names.join('/'),key};};
  const envOf=n=>{for(let p=n;p;p=p.parent)if(roots.has(p))return p.tags.list().find(t=>t.startsWith('scope:'))?.slice(6);};
  const rows=[];
  for(const r of app.root.findComponents('render')){
   if(!r.enabled||!r.entity.enabled)continue;let visible=true;for(let p=r.entity;p;p=p.parent)if(!p.enabled){visible=false;break;}if(!visible)continue;
   const env=envOf(r.entity);if(!env)continue;const {path,key}=pathOf(r.entity);
   r.meshInstances.forEach((mi,index)=>{if(!mi.visible)return;const m=mi.material,w=r.entity.getWorldTransform().data;
    rows.push({env,path,key,index,type:r.type,stock:inStock(r.entity)||undefined,vertices:mi.mesh.vertexBuffer?.numVertices,indices:mi.mesh.primitive[0]?.count,
     world:[...w].map(r5),aabb:{c:mi.aabb.center.toArray().map(r5),h:mi.aabb.halfExtents.toArray().map(r5)},castShadow:mi.castShadow,receiveShadow:mi.receiveShadow,mask:mi.mask,
     material:{name:m.name,diffuse:color(m.diffuse),emissive:color(m.emissive),emissiveIntensity:m.emissiveIntensity,specular:color(m.specular),gloss:m.gloss,glossInvert:m.glossInvert,
      metalness:m.metalness,useMetalness:m.useMetalness,useLighting:m.useLighting,opacity:m.opacity,blendType:m.blendType,cull:m.cull,alphaTest:m.alphaTest,depthWrite:m.depthWrite,
      twoSidedLighting:m.twoSidedLighting,diffuseVertexColor:m.diffuseVertexColor,diffuseMap:m.diffuseMap?.name,diffuseMapTiling:m.diffuseMap?m.diffuseMapTiling.toArray():undefined,
      normalMap:m.normalMap?.name,opacityMap:m.opacityMap?.name,emissiveMap:m.emissiveMap?.name}});});
  }
  return {scene,count:rows.length,rows};
 },scene);

 await closeDialogs();
 await perf('house-start');
 const house=views.filter(v=>v.scene==='house');
 await command('home');await frames(30);await perf('house-home');
 for(const view of house)await shoot(view,'as-played');
 result.collision.house=await page.evaluate(()=>{const {room,props}=window.__deep,a=v=>v.toArray();
  return {obstacles:room.obstacles.map(b=>({center:a(b.center),half:a(b.halfExtents)})),walkable:room.walkable,
   interactions:props.interactions.map(i=>({id:i.id,kind:i.kind,anchor:a(i.anchor),marker:a(i.marker),range:i.range,placement:i.placement}))};});
 const dumps={house:await dump('house')};
 console.log('hid',await authoredOnly(),'non-authored renders in the house');
 for(const view of house)await shoot(view,'authored');
 await page.evaluate(()=>document.getElementById('authored-only')?.remove());

 for(const store of ['corner','toys','collector']){
  const storeViews=views.filter(v=>v.store===store);
  // Reload per store so the previous authored-only hiding never leaks into the next scene.
  await page.reload();await page.locator('[data-ready=true]').waitFor({timeout:120000});
  await page.waitForFunction(()=>window.__roomTest?.snapshot().characterLoaded&&window.__migration?.ready,undefined,{timeout:120000});
  await closeDialogs();await command('store',store);await frames(30);await closeDialogs();
  await perf('store-'+store);
  for(const view of storeViews)await shoot(view,'as-played');
  result.collision[store]=await page.evaluate(id=>{const {loop}=window.__deep,s=loop.stores.find(s=>s.definition.id===id),a=v=>v.toArray();
   return {name:s.root.name,obstacles:s.obstacles.map(b=>({center:a(b.center),half:a(b.halfExtents)})),walkable:s.walkable,
    sites:s.sites.map(t=>({id:t.id,anchor:a(t.anchor),marker:a(t.marker)})),exit:a(s.exitAnchor)};},store);
  dumps[store]=await dump(store);
  await authoredOnly();
  for(const view of storeViews)await shoot(view,'authored');
 }
 await writeFile(resolve(metricsDir,'world-dump.json'),JSON.stringify(dumps)+'\n');
 await save();
 console.log(`Baseline written: ${metricsDir} (metrics, world dump) and ${shotsDir} (screenshots). Page errors: ${errors.length}, HTTP errors: ${httpErrors.length}.`);
}finally{await browser.close();await server.close();}
