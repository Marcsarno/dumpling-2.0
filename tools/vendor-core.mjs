// Vendors the engine-free core from the pinned PlayCanvas commit and records core.sync.json.
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {ROOT,REFERENCE,requirePlaycanvas,playcanvasBlob,assertWritable,warnIfReferenceMoved} from './paths.mjs';
import {sha256} from './protected.mjs';
import {CORE_FILES,produce} from './core-files.mjs';

requirePlaycanvas();warnIfReferenceMoved();
const ledger=[];
for(const entry of CORE_FILES){
 const source=playcanvasBlob(entry.path),bytes=produce(entry,source);
 const target=assertWritable(resolve(ROOT,entry.path));
 mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
 ledger.push({path:entry.path,mode:entry.mode,sourceSha256:sha256(source),localSha256:sha256(bytes),...(entry.reason?{reason:entry.reason}:{})});
}
writeFileSync(assertWritable(resolve(ROOT,'core.sync.json')),JSON.stringify({
 note:'Vendored from the PlayCanvas game. Check with `node tools/check-core-sync.mjs`; refresh with `node tools/vendor-core.mjs` after reviewing upstream changes.',
 source:{repo:REFERENCE.playcanvasRepo,commit:REFERENCE.playcanvasCommit},files:ledger},null,1)+'\n');
console.log(`Vendored ${ledger.length} files (${ledger.filter(f=>f.mode==='verbatim').length} verbatim, ${ledger.filter(f=>f.mode!=='verbatim').length} patched/replaced) from ${REFERENCE.playcanvasCommit.slice(0,7)}.`);
