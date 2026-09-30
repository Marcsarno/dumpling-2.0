// The rebuild must never resolve to the PlayCanvas production keys (audit §8.3 R1, R8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {ROOT} from '../../tools/paths.mjs';

const module=resolve(ROOT,'src/systems/SaveNamespace.ts');
async function prefixFor(search,production){
 globalThis.location={search};
 if(production)globalThis.__productionRelease=true;else delete globalThis.__productionRelease;
 // A fresh module instance per case: the prefix is resolved once at load, like the game.
 const {SAVE_PREFIX,saveKey}=await import(`${new URL('file:///'+module.split('\\').join('/')).href}?case=${encodeURIComponent(search)}-${production}`);
 return {SAVE_PREFIX,key:saveKey('progress.v1')};
}

test('every preview and production mode stays inside dumpling.three',async()=>{
 const cases=[['',false,'dumpling.three'],['',true,'dumpling.three'],['?preview=home-play',true,'dumpling.three.homePlayReview'],
  ['?preview=outdoors',false,'dumpling.three.outdoorReview'],['?preview=opening',false,'dumpling.three.openingReview'],
  ['?preview=school&room=cafeteria',true,'dumpling.three.schoolReview'],['?preview=unknown',true,'dumpling.three']];
 for(const [search,production,expected] of cases){
  const {SAVE_PREFIX,key}=await prefixFor(search,production);
  assert.equal(SAVE_PREFIX,expected,search);assert.equal(key,expected+'.progress.v1');
  assert.ok(!key.startsWith('arianna'),`${search} resolved to a production key`);
 }
});

test('no rebuild source hard-codes an arianna.* save key',()=>{
 const walk=dir=>readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?walk(p):[p];});
 const offenders=walk(resolve(ROOT,'src')).filter(p=>/\.(ts|js|mjs)$/.test(p)).filter(p=>/['"`]arianna\./.test(readFileSync(p,'utf8')));
 assert.deepEqual(offenders,[]);
});
