// Registries and seeded rules must match the PlayCanvas game exactly (audit §8.3 R3, R5).
// Compares with the committed golden file, and live with the PlayCanvas checkout when present.
//   Regenerate the golden (only after reviewing an upstream change): node tests/node/core-contract.test.mjs --write
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {fingerprint} from './core-contract.mjs';
import {ROOT,PLAYCANVAS_ROOT,playcanvasAvailable} from '../../tools/paths.mjs';

const golden=resolve(ROOT,'tests/node/golden/core-contract.json');
const local=await fingerprint(pathToFileURL(ROOT+'/'));

if(process.argv.includes('--write')){writeFileSync(golden,JSON.stringify(local,null,1)+'\n');console.log('Wrote',golden);}
else{
 test('registries and seeded outputs match the committed golden',()=>{
  const expected=JSON.parse(readFileSync(golden,'utf8'));
  assert.deepEqual(local.registries,expected.registries,'An id registry changed. Registries are append-only and order-stable.');
  assert.deepEqual(local.outputs,expected.outputs);
 });
 test('registries and seeded outputs match the live PlayCanvas checkout',{skip:!playcanvasAvailable()&&'PlayCanvas checkout not present'},async()=>{
  const upstream=await fingerprint(pathToFileURL(PLAYCANVAS_ROOT+'/'));
  assert.deepEqual(local,upstream);
 });
 test('golden file exists',()=>assert.ok(existsSync(golden)));
}
