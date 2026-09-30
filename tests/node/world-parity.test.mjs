// Gameplay-facing world data must match what the PlayCanvas runtime actually uses, so
// movement, prompts and shopping feel the same. Visual parity is deliberately not
// tested here: the rebuild is free to look better.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,REFERENCE} from '../../tools/paths.mjs';

const read=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'));
const baseline=read(`baseline/playcanvas-${REFERENCE.playcanvasCommit.slice(0,7)}/metrics.json`).collision;
const world=Object.fromEntries(['house','store-corner','store-toys','store-collector'].map(r=>[r,read(`public/world/${r}.json`).semantics]));
const index=read('public/world/index.json');
const close=(a,b,eps=1e-4)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=eps);
const boxKey=b=>[...b.center,...b.half].map(v=>v.toFixed(3)).join(',');

test('world was converted from the pinned PlayCanvas commit',()=>{
 assert.equal(index.source.commit,REFERENCE.playcanvasCommit);
 assert.deepEqual(index.census,{entities:4430,records:1019,colliders:128,walkables:12,anchors:34,markers:34,placements:13,siteTags:36,stock:36,exits:3,lights:13,storeArt:756,previews:295,renders:2570});
});

// PlayCanvas room.obstacles also include runtime-added outdoor and garden blockers (Outdoors,
// Neighborhood) that belong to later phases; every converted collider must appear there.
test('house colliders are exactly the authored blockers PlayCanvas moves against',()=>{
 const pc=new Map(baseline.house.obstacles.map(b=>[boxKey({center:b.center,half:b.half}),b]));
 const ours=world.house.colliders.filter(c=>c.active!==false);
 const missing=ours.filter(c=>![...pc.values()].some(b=>close(b.center,c.center)&&close(b.half,c.half)));
 assert.deepEqual(missing.map(boxKey),[],'converted colliders PlayCanvas does not use');
});

for(const [id,region] of [['corner','store-corner'],['toys','store-toys'],['collector','store-collector']])
 test(`${region} colliders, walkable area, sites and exit match PlayCanvas`,()=>{
  const pc=baseline[id],ours=world[region];
  const active=ours.colliders.filter(c=>c.active!==false);
  assert.equal(active.length,pc.obstacles.length);
  const sort=list=>[...list].map(boxKey).sort();
  assert.deepEqual(sort(active),sort(pc.obstacles.map(b=>({center:b.center,half:b.half}))));
  for(const w of ours.walkable){const p=pc.walkable[w.index];assert.ok(close([w.minX,w.maxX,w.minZ,w.maxZ],[p.minX,p.maxX,p.minZ,p.maxZ]),`walkable ${w.index}`);}
  for(const site of pc.sites){const s=ours.sites.find(x=>x.id===String(site.id));assert.ok(s,`site ${site.id}`);assert.ok(close(s.anchor,site.anchor),`site ${site.id} anchor`);assert.ok(close(s.marker,site.marker),`site ${site.id} marker`);}
  assert.ok(close(ours.exit,pc.exit),'exit');
 });

test('house walkable rooms match PlayCanvas',()=>{
 for(const w of world.house.walkable){const p=baseline.house.walkable[w.index];assert.ok(close([w.minX,w.maxX,w.minZ,w.maxZ],[p.minX,p.maxX,p.minZ,p.maxZ]),`walkable ${w.index} ${p.id}`);}
});

test('interaction anchors, markers and placements match PlayCanvas',()=>{
 let compared=0;
 for(const i of world.house.interactions){
  const p=baseline.house.interactions.find(x=>x.id===i.id);if(!p)continue;compared++;
  assert.ok(close(i.anchor,p.anchor),`${i.id} anchor`);assert.ok(close(i.marker,p.marker),`${i.id} marker`);
  if(i.placement&&p.placement)assert.ok(close(i.placement,p.placement),`${i.id} placement`);
 }
 assert.equal(compared,34,'every authored interaction is live in PlayCanvas');
});
