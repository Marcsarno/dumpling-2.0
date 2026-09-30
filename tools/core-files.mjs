import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from './paths.mjs';

/**
 * The engine-free rules and save layer, vendored from the PlayCanvas game at the
 * same relative paths so its own Node tests run unchanged. `verbatim` files must
 * stay byte-identical to the PlayCanvas commit; `patched` files apply a recorded,
 * deterministic change; `replaced` files are rebuild-owned but track their source.
 */
const DATA=['collection','dailyPlay','homePlay','house','hunt','popIdentity','popLevels','squishyPop','squishyPresentation','ticketPrizes','tradeHelp','trading'].map(n=>`src/data/${n}.ts`);
const SYSTEMS=['DailyClock','DailyPlayStore','FishingRound','HomePlayStore','InteractionGuidance','InteractionSystem','MissionSystem','PlayPhysics','ProgressStore','SchoolBallPhysics','ScooterDynamics','TornadoRules','saveId'].map(n=>`src/systems/${n}.ts`);
const TESTS=['animal-sculpt','daily-clock','daily-play','fishing','home-play-state','hunt','life-polish','mission','pop-core','pop-levels','pop-milestone','pop-rules','progress','school-ball','scooter','tornado-rules','trading'].map(n=>`scripts/${n}-test.mjs`);

export const CORE_FILES=[
 ...DATA.map(path=>({path,mode:'verbatim'})),
 ...SYSTEMS.map(path=>({path,mode:'verbatim'})),
 {path:'src/dev/DeveloperSaves.ts',mode:'verbatim'},
 {path:'src/systems/SaveNamespace.ts',mode:'replaced',
  reason:'Rebuild saves use the dumpling.three prefix with the same precedence; no branch can resolve to arianna.* before an owner-approved cutover.',
  override:'tools/core-overrides/SaveNamespace.ts'},
 // Owner-protected verifiers: byte-identical, never edited (CLAUDE.md), except the one
 // owner-approved change below. Every other check (2048x2048 maps, joints) is untouched.
 {path:'scripts/verify-arianna-quality.mjs',mode:'patched',
  reason:'Owner-approved armpit fix (2026-09-29): the expected hash moves from the original 35cfde9d… to the fixed file 747b1643…; the 2048x2048 texture checks are unchanged.',
  patch:source=>{
   const from=" assert.equal(hash,'35cfde9dba8d20d53019d654728972c04f7455ccc533040d00818f86d3f82989',\n  `${path}: Arianna must retain the original full-quality source asset. Never replace it with an optimized copy.`);";
   const to=" // Owner-approved armpit fix of the original (35cfde9d…), 2026-09-29: same textures, rig and clips.\n assert.equal(hash,'747b164324d4fd7d0eb1719daaa537d149b0801fa488834ed738225985cbf9ea',\n  `${path}: Arianna must retain the approved full-quality source asset. Never replace it with an optimized copy.`);";
   if(!source.includes(from))throw Error('verify-arianna-quality patch no longer applies; review the PlayCanvas change.');
   return source.replace(from,to);
  }},
 {path:'scripts/verify-lilah-quality.mjs',mode:'verbatim'},
 {path:'scripts/test-register.mjs',mode:'verbatim'},
 ...TESTS.map(path=>({path,mode:'verbatim'})),
 {path:'scripts/developer-saves-test.mjs',mode:'patched',
  reason:'Seeds keys through saveKey() instead of hard-coded arianna.* keys (the original fails outside production for this reason).',
  patch:source=>{
   let out=source.replace("import {DeveloperSaves} from '../src/dev/DeveloperSaves.ts';","import {DeveloperSaves} from '../src/dev/DeveloperSaves.ts';\nimport {saveKey} from '../src/systems/SaveNamespace.ts';")
    .replace("keys=['arianna.progress.v1','arianna.daily.v1','arianna.lilah.v1']","keys=[saveKey('progress.v1'),saveKey('daily.v1'),saveKey('lilah.v1')]")
    .replaceAll("'arianna.developer.checkpoint.v1'","saveKey('developer.checkpoint.v1')");
   if(out===source||/arianna\./.test(out))throw Error('developer-saves-test patch no longer applies; review the PlayCanvas change.');
   return out;
  }},
];

export const produce=(entry,source)=>entry.mode==='verbatim'?source
 :entry.mode==='patched'?Buffer.from(entry.patch(source.toString('utf8')),'utf8')
 :readFileSync(resolve(ROOT,entry.override));
