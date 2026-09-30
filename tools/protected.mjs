import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';

/**
 * Owner-protected characters. They ship byte-identical and no tool may optimise,
 * compress, resize, re-export or otherwise rewrite them (see AGENTS.md / CLAUDE.md
 * in the PlayCanvas project). Paths are relative to public/ and dist/.
 *
 * Arianna's entry is the owner-approved armpit fix (2026-09-29): the original Meshy file
 * (sha256 35cfde9d…, still in the PlayCanvas repo and this repo's history) with its fused
 * sleeve seams opened by tools/arianna-armpit/build.py. Textures, rig, material and clips
 * are byte-identical to the original; only the mesh data around the armpits changed.
 */
export const PROTECTED=[
 {path:'assets/characters/arianna/arianna.glb',bytes:6293876,sha256:'747b164324d4fd7d0eb1719daaa537d149b0801fa488834ed738225985cbf9ea',
  rule:'Arianna (owner-approved armpit fix of the original): mesh, rig, materials and 2048x2048 colour + normal maps. Native display resolution.'},
 {path:'assets/characters/lilah/lilah.glb',bytes:6864000,sha256:'9070bb9846d6ef53d46a0af0296ab6e8eadffb2c25139267323b2574d6b68a6e',
  rule:'Lilah original mesh, rig, animations, 2048x2048 colour + owner-approved 1024x1024 metallic/roughness map.'},
];

/** Known wrong copies that must never appear anywhere in this repository or its builds. */
export const FORBIDDEN=[
 {sha256:'e36ae8c3636bf2bb08e4c9050d698273dac5fbf4b4824abae988b4647534a79f',why:'degraded Arianna upload copy (2x1024 maps) from PlayCanvas migration/upload/'},
 {sha256:'d31234fb4e2e5f14cfb1e97b394ffd4c4935afcd89177704f9aeb2325620465c',why:'degraded Lilah upload copy (1024 + 512 maps) from PlayCanvas migration/upload/'},
 {sha256:'1236fca01d74a3a6ece5b3ff4e725ff3267d236b75515ad467ba21a2aa583a80',why:'pre-approval Lilah (4096 metallic/roughness) from PlayCanvas editor-release/'},
 {sha256:'d7cdf893feefd79cec247877c7f1b92a3c3f1732a3784482ccf29075ccca079a',why:'Editor-converted pilot-arianna.glb from PlayCanvas editor-release/'},
];

const normal=p=>p.split(sep).join('/').replace(/^\.?\//,'');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const isProtectedPath=path=>{const p=normal(path);return PROTECTED.some(entry=>p===entry.path||p.endsWith('/'+entry.path));};

/**
 * Call before any asset transform (compression, resizing, re-export). Throws for
 * protected characters by path and by content, so renamed copies are caught too.
 */
export function assertNotProtected(file,root=process.cwd()){
 const rel=normal(relative(root,resolve(root,file)));
 if(isProtectedPath(rel))throw Error(`${rel} is a protected character asset; it must not be transformed.`);
 const hash=sha256(readFileSync(resolve(root,file)));
 const match=PROTECTED.find(entry=>entry.sha256===hash);
 if(match)throw Error(`${rel} has the same bytes as protected ${match.path}; it must not be transformed.`);
}

/** Validate one file against the protected and forbidden lists. Returns problems (empty when fine). */
export function checkFile(rel,bytes){
 const p=normal(rel),hash=sha256(bytes),problems=[];
 const bad=FORBIDDEN.find(entry=>entry.sha256===hash);if(bad)problems.push(`${p}: ${bad.why}`);
 const entry=PROTECTED.find(entry=>p===entry.path||p.endsWith('/'+entry.path));
 if(entry&&(hash!==entry.sha256||bytes.length!==entry.bytes))problems.push(`${p}: protected asset changed (sha256 ${hash.slice(0,12)}, expected ${entry.sha256.slice(0,12)})`);
 return problems;
}
