/**
 * Which PlayCanvas public/ files the rebuild ships, and the licence family of each.
 * Excluded files were never shipped by the PlayCanvas production build (audit §5.4)
 * or are working sources. They stay in the PlayCanvas repository.
 */
export const EXCLUDE=[
 {test:p=>p==='assets/pets/Meshy_AI_Sunny_Pup_0919020946_texture.glb',why:'unrigged Meshy source for Sunny Pup (15.7 MiB); runtime uses pets/sunny-pup.glb'},
 {test:p=>p==='assets/pets/pug.glb',why:'unused backup pet'},
 {test:p=>p==='assets/audio/cozy-house.ogg',why:'never shipped; the .mp3 variant is the shipped copy'},
 {test:p=>p.startsWith('assets/squishies/concepts/'),why:'concept art, not loaded'},
 {test:p=>/^assets\/pop\/audio\/.+\.ogg$/.test(p),why:'never shipped; Squishy Pop uses the .wav set'},
 {test:p=>p==='assets/store-kit/store-kit.blend',why:'Blender working source for the store kit'},
 {test:p=>p.endsWith('/.gitkeep'),why:'empty directory marker'},
];

/**
 * Files the rebuild deliberately ships in a different version from PlayCanvas. The sync
 * keeps the rebuild's file (it must already be in public/) instead of copying PlayCanvas's.
 */
export const OVERRIDES=[
 {path:'assets/characters/arianna/arianna.glb',why:'owner-approved armpit fix (tools/arianna-armpit/build.py); PlayCanvas has the original'},
 {path:'assets/characters/arianna/README.md',why:'documents the armpit fix'},
 {path:'assets/characters/arianna/asset_manifest.json',why:'describes the armpit-fixed file'},
];
export const override=path=>OVERRIDES.find(rule=>rule.path===path);

/** Top-level public files copied alongside assets/. */
export const EXTRA_PUBLIC=['asset-credits.html','favicon.svg'];

const RULES=[
 [/^assets\/characters\/(arianna|lilah|marc)\//,'owner-supplied character (Meshy); no redistribution licence recorded — see the folder README'],
 [/^assets\/characters\/classmates\//,'CC0-1.0 Kenney Mini Characters — characters/classmates/SOURCES.md'],
 [/^assets\/pets\/poop\.glb$/,'CC-BY-3.0 "Dog Poop" by J-Toastie (Poly by Google) — pets/LICENSES.md; attribution required'],
 [/^assets\/pets\/sunny-pup\.glb$/,'owner-supplied model (Meshy); CC0 rig and animations — pets/SUNNY_PUP.md'],
 [/^assets\/pets\//,'see pets/LICENSES.md and pets/sources.json'],
 [/^assets\/environment\/kenney\//,'CC0-1.0 Kenney kits — ASSET_SOURCES.md'],
 [/^assets\/environment\/nursery\//,'CC-BY-3.0 Crib (Poly by Google) — environment/nursery/README.md; attribution required'],
 [/^assets\/environment\/school\//,'CC-BY-3.0 Blackboard and Bulletin board (Poly by Google) — environment/school/sources.json; attribution required'],
 [/^assets\/animations\//,'CMU Graphics Lab Motion Capture: use allowed, resale of the motion data forbidden, acknowledgment requested'],
 [/^assets\/audio\/Squishy /,'owner-supplied music (Suno-generated); rights depend on the owner plan — audio/SOURCES.md'],
 [/^assets\/audio\/foley\//,'CC0 foley — audio/SOURCES.md'],
 [/^assets\/audio\//,'CC0 music — audio/SOURCES.md'],
 [/^assets\/outdoors\//,'CC0 KayKit / Quaternius and project-authored — outdoors/SOURCES.md'],
 [/^assets\/people\//,'CC0 Quaternius base characters with project edits — people/SOURCES.md'],
 [/^assets\/pop\//,'project-authored sprites and CC0 audio — pop/ART_NOTES.md, pop/audio/SOURCES.md'],
 [/^assets\/squishies\//,'project-authored — squishies/SOURCES.md'],
 [/^assets\/store-kit\//,'project-authored; sign text uses Comic Sans Bold glyph outlines — store-kit/SOURCES.md'],
 [/^assets\/school-kit\//,'project-authored — school-kit/SOURCES.md'],
 [/^assets\/food\//,'see food/SOURCES.md'],
 [/^assets\/backgrounds\//,'owner-supplied bedroom art'],
];
export const licenceFor=path=>RULES.find(([pattern])=>pattern.test(path))?.[1]??'unclassified — see PlayCanvas ASSET_SOURCES.md';
export const excluded=path=>EXCLUDE.find(rule=>rule.test(path));
