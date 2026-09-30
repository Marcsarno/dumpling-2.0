// Production build: type-check, bundle, then verify the output before it can ship.
// Fails if a protected character, a manifest asset or a world file differs in dist/.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'vite';
import {ROOT,REFERENCE,assertWritable} from './paths.mjs';
import {sha256} from './protected.mjs';
import {verifyTree} from './asset-manifest.mjs';
import {verifyAriannaQuality} from '../scripts/verify-arianna-quality.mjs';
import {verifyLilahQuality} from '../scripts/verify-lilah-quality.mjs';

const run=(label,args)=>{const r=spawnSync(process.execPath,args,{cwd:ROOT,stdio:'inherit'});if(r.status!==0)throw Error(`${label} failed`);};
run('TypeScript',[resolve(ROOT,'node_modules/typescript/bin/tsc'),'--noEmit','-p',ROOT]);
const source=verifyTree('public');if(source.problems.length)throw Error('public/ assets:\n'+source.problems.join('\n'));

const dist=assertWritable(resolve(ROOT,'dist'));
if(existsSync(dist))rmSync(dist,{recursive:true}); // a clean output every time
await build({root:ROOT,logLevel:'warn'});

// The built output must carry the same bytes as the verified sources.
const built=verifyTree('dist');if(built.problems.length)throw Error('dist/ assets:\n'+built.problems.join('\n'));
const arianna=verifyAriannaQuality(resolve(dist,'assets/characters/arianna/arianna.glb'));
const lilah=verifyLilahQuality(resolve(dist,'assets/characters/lilah/lilah.glb'));
const index=JSON.parse(readFileSync(resolve(dist,'world/index.json'),'utf8'));
for(const [name,region] of Object.entries(index.regions))
 if(sha256(readFileSync(resolve(dist,region.file)))!==region.sha256)throw Error(`dist/${region.file} differs from world/index.json (${name})`);

const entry=readdirSync(resolve(dist,'assets')).find(f=>/^index-.*\.js$/.test(f));
if(!entry)throw Error('No entry bundle in dist/assets');
let commit=process.env.VERCEL_GIT_COMMIT_SHA;
if(!commit){try{commit=execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{commit='uncommitted';}}
const release={commit,runtimeHash:sha256(readFileSync(resolve(dist,'assets',entry))).slice(0,16),entry:'assets/'+entry,savePrefix:'dumpling.three',
 engine:{three:JSON.parse(readFileSync(resolve(ROOT,'node_modules/three/package.json'),'utf8')).version},
 world:{source:index.source.commit,scene:index.source.scene},playcanvasReference:REFERENCE.playcanvasCommit,
 protected:{arianna:arianna.hash,lilah:lilah.hash},builtAt:new Date().toISOString()};
writeFileSync(resolve(dist,'release.json'),JSON.stringify(release,null,2)+'\n');
console.log(`Build verified: ${built.checked} assets, Arianna ${arianna.textures.map(t=>t.width).join('/')} px maps, Lilah ${lilah.textures.map(t=>t.width).join('/')} px maps, ${Object.keys(index.regions).length} world regions. Runtime ${release.runtimeHash}, commit ${commit.slice(0,12)}.`);
