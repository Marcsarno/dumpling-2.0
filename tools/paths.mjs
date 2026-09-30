import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const REFERENCE=JSON.parse(readFileSync(resolve(ROOT,'reference.json'),'utf8'));

/** The PlayCanvas checkout this rebuild reads from. Override with DUMPLING_PLAYCANVAS_ROOT. */
export const PLAYCANVAS_ROOT=resolve(process.env.DUMPLING_PLAYCANVAS_ROOT??resolve(ROOT,'..','Dumpling Game File'));

// The owner's original Codex copy is off limits, even for reads by these tools.
const FORBIDDEN_ROOTS=[/[\\/]Codex Game Projects[\\/]/i];
for(const pattern of FORBIDDEN_ROOTS)if(pattern.test(PLAYCANVAS_ROOT+'/'))
 throw Error(`Refusing to use ${PLAYCANVAS_ROOT}: the Codex copy must not be touched. Point DUMPLING_PLAYCANVAS_ROOT at the Claude copy.`);

export function playcanvasAvailable(){return existsSync(resolve(PLAYCANVAS_ROOT,REFERENCE.editorSceneFile));}
export function requirePlaycanvas(){
 if(!playcanvasAvailable())throw Error(`PlayCanvas reference checkout not found at ${PLAYCANVAS_ROOT}. Set DUMPLING_PLAYCANVAS_ROOT.`);
 return PLAYCANVAS_ROOT;
}
export const fromPlaycanvas=(...parts)=>resolve(PLAYCANVAS_ROOT,...parts);

/** Every write these tools make must land inside this repository. */
export function assertWritable(path){
 const rel=relative(ROOT,resolve(path));
 if(rel.startsWith('..')||isAbsolute(rel))throw Error(`Refusing to write outside Dumpling Three: ${path}`);
 return path;
}

/** Read-only git queries against the PlayCanvas checkout. */
export function playcanvasGit(args,options={}){
 return execFileSync('git',['-C',PLAYCANVAS_ROOT,...args],{encoding:options.encoding??'utf8',maxBuffer:1<<28});
}
export function playcanvasHead(){return playcanvasGit(['rev-parse','HEAD']).trim();}
/** Committed bytes of a tracked file at the pinned reference commit. */
export function playcanvasBlob(path,commit=REFERENCE.playcanvasCommit){
 return execFileSync('git',['-C',PLAYCANVAS_ROOT,'show',`${commit}:${path}`],{maxBuffer:1<<28});
}
export function warnIfReferenceMoved(){
 const head=playcanvasHead();
 if(head!==REFERENCE.playcanvasCommit)console.warn(`Note: PlayCanvas HEAD is ${head.slice(0,7)}, reference.json pins ${REFERENCE.playcanvasCommit.slice(0,7)}. Reads use the pinned commit where possible.`);
 return head;
}
