// Flags drift between the vendored core and the PlayCanvas game, in either direction.
// Local integrity always runs; upstream comparison runs when the PlayCanvas checkout exists.
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,playcanvasAvailable,playcanvasGit,warnIfReferenceMoved} from './paths.mjs';
import {sha256} from './protected.mjs';
import {CORE_FILES,produce} from './core-files.mjs';

const ledger=JSON.parse(readFileSync(resolve(ROOT,'core.sync.json'),'utf8'));
const errors=[],notes=[];
for(const file of ledger.files){
 const path=resolve(ROOT,file.path);
 if(!existsSync(path)){errors.push(`${file.path}: missing locally`);continue;}
 const bytes=readFileSync(path);
 if(sha256(bytes)!==file.localSha256)errors.push(`${file.path}: edited locally (${file.mode}). Vendored files change only through tools/vendor-core.mjs.`);
 if(file.mode==='verbatim'&&file.localSha256!==file.sourceSha256)errors.push(`${file.path}: ledger says verbatim but hashes differ`);
}
const listed=new Set(ledger.files.map(f=>f.path));
for(const entry of CORE_FILES)if(!listed.has(entry.path))errors.push(`${entry.path}: in tools/core-files.mjs but not vendored yet`);

if(playcanvasAvailable()){
 const head=warnIfReferenceMoved();
 for(const file of ledger.files){
  let upstream;try{upstream=playcanvasGit(['show',`${head}:${file.path}`],{encoding:'buffer'});}catch{errors.push(`${file.path}: no longer exists in PlayCanvas HEAD`);continue;}
  if(sha256(upstream)!==file.sourceSha256)errors.push(`${file.path}: PlayCanvas changed it since vendoring. Review the change, then rerun tools/vendor-core.mjs.`);
  else if(file.mode!=='verbatim'){const entry=CORE_FILES.find(e=>e.path===file.path);if(entry&&sha256(produce(entry,upstream))!==file.localSha256)errors.push(`${file.path}: regenerating the ${file.mode} copy gives different bytes`);}
 }
 // New upstream rules/data files that are not vendored yet.
 for(const dir of ['src/data','src/systems']){
  const upstream=playcanvasGit(['ls-tree','--name-only',`${head}`,`${dir}/`]).trim().split('\n').filter(p=>p.endsWith('.ts'));
  for(const path of upstream)if(!listed.has(path))notes.push(`${path}: exists upstream but is not vendored`);
 }
}else notes.push('PlayCanvas checkout not found; checked local integrity only.');

for(const n of notes)console.log('Note:',n);
if(errors.length){console.error('Core sync check failed:\n  '+errors.join('\n  '));process.exit(1);}
console.log(`Core in sync: ${ledger.files.length} files match their ledger${playcanvasAvailable()?' and PlayCanvas':''}.`);
