// Copies the shipped PlayCanvas public/ assets into this repository, byte-identical
// to their committed bytes at the pinned reference commit, then writes the manifest.
// Reads the PlayCanvas checkout only; writes only inside Dumpling Three.
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,statSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,REFERENCE,requirePlaycanvas,fromPlaycanvas,playcanvasGit,playcanvasBlob,assertWritable,warnIfReferenceMoved} from './paths.mjs';
import {checkFile,isProtectedPath,sha256} from './protected.mjs';
import {excluded,licenceFor,EXTRA_PUBLIC} from './asset-rules.mjs';

requirePlaycanvas();warnIfReferenceMoved();
const prune=process.argv.includes('--prune');
const gitBlobId=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// Tracked files at the pinned commit: mode, type, blob id, path.
const tree=playcanvasGit(['ls-tree','-r','--full-tree',REFERENCE.playcanvasCommit,'--','public/']).trim().split('\n').map(line=>{
 const [meta,path]=line.split('\t');const [,type,blob]=meta.split(' ');return {type,blob,path};
}).filter(entry=>entry.type==='blob');

const files=[],skipped=[],problems=[];let fromWorkingTree=0,fromGit=0,unchanged=0;
for(const {blob,path:repoPath} of tree){
 const rel=repoPath.slice('public/'.length);
 if(!rel.startsWith('assets/')&&!EXTRA_PUBLIC.includes(rel)){skipped.push({path:rel,why:'not an asset (PlayCanvas-only file)'});continue;}
 const rule=excluded(rel);if(rule){skipped.push({path:rel,why:rule.why});continue;}
 // Prefer the working file when it is exactly the committed blob; otherwise take the blob itself.
 let bytes;const working=fromPlaycanvas(repoPath);
 if(existsSync(working)){const candidate=readFileSync(working);if(gitBlobId(candidate)===blob){bytes=candidate;fromWorkingTree++;}}
 if(!bytes){bytes=playcanvasBlob(repoPath);fromGit++;}
 if(gitBlobId(bytes)!==blob)throw Error(`Blob mismatch for ${repoPath}`);
 problems.push(...checkFile(rel,bytes));
 const target=assertWritable(resolve(ROOT,'public',rel));
 if(existsSync(target)&&sha256(readFileSync(target))===sha256(bytes))unchanged++;
 else{mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
 files.push({path:rel,bytes:bytes.length,sha256:sha256(bytes),gitBlob:blob,protected:isProtectedPath(rel),licence:rel.startsWith('assets/')?licenceFor(rel):'project page'});
}
if(problems.length)throw Error('Protected-asset check failed:\n'+problems.join('\n'));

// Files in public/ that no longer come from the reference.
const walk=dir=>readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?walk(p):[p];});
const wanted=new Set(files.map(f=>f.path));
const stale=walk(resolve(ROOT,'public')).map(p=>p.slice(resolve(ROOT,'public').length+1).split('\\').join('/'))
 .filter(p=>(p.startsWith('assets/')||EXTRA_PUBLIC.includes(p))&&!wanted.has(p));
if(stale.length&&prune)for(const p of stale)rmSync(assertWritable(resolve(ROOT,'public',p)));

files.sort((a,b)=>a.path<b.path?-1:1);skipped.sort((a,b)=>a.path<b.path?-1:1);
const manifest={
 note:'Byte-identical copies of PlayCanvas public/ files at the pinned commit. Verify with `node tools/asset-manifest.mjs --verify`. Do not edit by hand; rerun `pnpm assets:sync`.',
 source:{repo:REFERENCE.playcanvasRepo,commit:REFERENCE.playcanvasCommit,folder:'public/'},
 totals:{files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),protected:files.filter(f=>f.protected).length},
 files,excluded:skipped,
};
writeFileSync(assertWritable(resolve(ROOT,'assets.manifest.json')),JSON.stringify(manifest,null,1)+'\n');
console.log(`Copied ${files.length} files (${(manifest.totals.bytes/1048576).toFixed(2)} MiB): ${fromWorkingTree} from the working tree, ${fromGit} from git blobs, ${unchanged} already current.`);
console.log(`Excluded ${skipped.length}. Protected verified: ${files.filter(f=>f.protected).map(f=>f.path).join(', ')}.`);
if(stale.length)console.log(`${prune?'Removed':'Stale (rerun with --prune to remove)'}: ${stale.join(', ')}`);
