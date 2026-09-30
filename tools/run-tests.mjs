// Node test suite: the vendored PlayCanvas core tests (unchanged) plus rebuild tests.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from './paths.mjs';
import {CORE_FILES} from './core-files.mjs';

const core=CORE_FILES.map(f=>f.path).filter(p=>/^scripts\/.+-test\.mjs$/.test(p));
const own=readdirSync(resolve(ROOT,'tests/node')).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/node/'+f);
let failed=0;
for(const file of [...core,...own]){
 // Each file runs alone: several core tests assign globalThis.localStorage at import.
 const run=spawnSync(process.execPath,['--experimental-transform-types','--no-warnings','--import','./scripts/test-register.mjs','--test','--test-reporter=dot',file],{cwd:ROOT,encoding:'utf8'});
 const ok=run.status===0;if(!ok)failed++;
 console.log(`${ok?'PASS':'FAIL'} ${file}`);
 if(!ok)console.log((run.stdout+run.stderr).split('\n').slice(-40).join('\n'));
}
console.log(`\n${core.length+own.length-failed}/${core.length+own.length} test files passed.`);
if(failed)process.exit(1);
