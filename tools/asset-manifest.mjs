// Verifies shipped assets against assets.manifest.json and the protected deny-list.
//   node tools/asset-manifest.mjs --verify            checks public/
//   node tools/asset-manifest.mjs --verify --dist     also checks dist/ (after a build)
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {ROOT} from './paths.mjs';
import {checkFile,sha256,PROTECTED} from './protected.mjs';

export function verifyTree(folder,{requireAll=true}={}){
 const manifest=JSON.parse(readFileSync(resolve(ROOT,'assets.manifest.json'),'utf8'));
 const base=resolve(ROOT,folder),problems=[];
 for(const file of manifest.files){
  const path=resolve(base,file.path);
  if(!existsSync(path)){if(requireAll)problems.push(`${folder}/${file.path}: missing`);continue;}
  const bytes=readFileSync(path);
  if(bytes.length!==file.bytes||sha256(bytes)!==file.sha256)problems.push(`${folder}/${file.path}: differs from the manifest`);
 }
 for(const entry of PROTECTED)if(!manifest.files.some(f=>f.path===entry.path&&f.sha256===entry.sha256))problems.push(`manifest lacks protected ${entry.path} at ${entry.sha256.slice(0,12)}`);
 // Every file in the folder, manifest-listed or not, is screened for forbidden copies.
 const walk=dir=>readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?walk(p):[p];});
 let scanned=0;
 if(existsSync(base))for(const path of walk(base)){scanned++;problems.push(...checkFile(path.slice(base.length+1),readFileSync(path)));}
 return {problems,checked:manifest.files.length,scanned};
}

if(process.argv.includes('--verify')){
 const folders=['public',...(process.argv.includes('--dist')?['dist']:[])];
 let failed=false;
 for(const folder of folders){
  const {problems,checked,scanned}=verifyTree(folder);
  if(problems.length){failed=true;console.error(`Asset verification failed in ${folder}/:\n  `+problems.join('\n  '));}
  else console.log(`Assets verified in ${folder}/: ${checked} manifest files match, ${scanned} files screened, protected characters intact.`);
 }
 if(failed)process.exit(1);
}
