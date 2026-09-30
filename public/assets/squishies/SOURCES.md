# Original reference-led squishy assets

Created for this game in Blender from Marc's two supplied visual references:
`a9f654c0-9828-4855-81ad-4197a24adf1a.png` (dumpling) and
`b92eb5fe-e639-47f3-8ced-a05842336959.png` (hinged bamboo container).
All exported geometry, UVs, satin/blush and bamboo textures, and render portraits
were authored for this project. No downloaded third-party model is included.

- `bao-squishy.glb`: continuous pleated dough mesh, rounded gathered top, domed
  chocolate eyes with catchlights, smile, cheeks, optional eyelids and charms.
- `bamboo-steamer.glb`: hollow base, inset nest, rolled bindings, actual over-under
  woven lid on both sides, curved handle, clasp and `LidHinge` pivot.
- `bamboo-steamer-shelf.glb`: static closed LOD for small shop stock displays.
- `portraits/*.webp`: 26 transparent PlayCanvas renders of these same models, using
  the existing collectible colors/expressions/accessories. Total about 122 KiB.

Build geometry: `scripts/build-squishy-assets.py` with Blender 5.2. For current
materials and portraits, run `node scripts/build-squishy-satin.mjs` and, with
local Vite running, `node scripts/render-squishy-engine-portraits.mjs`.
The previous Blender portrait script remains available for source review.
Editable `.blend` and full-size review renders are generated under
`artifacts/squishy-art/` (not served or committed). Sources and conversion scripts
are retained; original user reference files remain untouched.

Research, reviewed but **not used**:

- [Bamboo steamer by Jingbari](https://sketchfab.com/3d-models/bamboo-steamer-436b6a5e02834c92aa74a8c5426195df):
  CC Attribution, approximately 179k triangles; scanned real cookware rather
  than a hinged toy container.
- [Dough Character by Plewr](https://plewr.itch.io/plewr-character-model-v1): CC0
  toon character, different design.
- [Dumpling Buddy by Modelmonster](https://www.meshy.ai/3d-models/Dumpling-Buddy-AroundTheWorld-v2-01967726-73a6-7faa-a929-d855a723a491):
  listed CC0; custom modeling chosen for closer control over the supplied design.

The project does not assert that these references or models are an official
version of any branded toy.
## September 20 satin / rarity polish

Original project-authored procedural satin color and packed normal/roughness
maps: `scripts/build-squishy-satin.mjs`. No external image inputs or new licenses.
The existing models remain intact; material setup is refined at runtime.
Current portraits are rendered with the actual PlayCanvas materials by
`scripts/render-squishy-engine-portraits.mjs`, then encoded with the existing WebP
script. See SQUISHY_POLISH.md. The original Blender build above remains available.

## Rejected pearl friends — superseded September 21, 2026

Eight original variants add PlayCanvas primitive ears, horns, wings, foil flecks, and procedural glitter/pearl ribbon textures to the existing sculpted bao. Authoring code: `src/game/SpecialSquishies.ts`. No third-party model or texture assets were added. Engine-rendered portraits match the runtime models. Existing IDs and ownership are retained; original higher-tier designs are now Rare.

That implementation was rejected and removed. Its saved IDs now reference the Dumpling Friends models below.

## Dumpling Friends — approved concept, 3D implementation for review

Subsequent user feedback approved the shapes. `scripts/finish-animal-squishies.py` adds project-authored baked local ambient visibility to those unchanged meshes, using 64 ray samples per vertex. Runtime color, satin reflectance, and kitten marking refinements remain authored in `src/game/AnimalSquishy.ts`. No new external texture source is used.

`animal-panda.glb`, `animal-frog.glb`, `animal-bunny.glb`, and `animal-cat.glb` are original Blender sculpts built by `scripts/build-animal-squishies.py`, following Marc's approved generated concept (`concepts/animal-friends-approved.png`) and supplied Animal Friends reference. Bodies, ears, paws, surface markings, and faces are authored geometry. The kitten uses a project-authored continuous color mask. No downloaded models/textures or third-party asset licenses were introduced. Runtime material palettes are in `src/game/AnimalSquishy.ts`. Portraits show the actual PlayCanvas models. See ANIMAL_SCULPTS.md for exact assets, budgets, validation, and reference provenance.
