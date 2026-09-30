# Dumpling Three

A three.js rebuild of the Dumpling / Arianna family-life game, built side by side with the
PlayCanvas original (`Marcsarno/Dumpling`). This is not a line-by-line copy: the PlayCanvas
game is the reference for layout, rules and saves, and this engine aims to do better.

**Status:** phase P0 (foundation). Converted authored world (house and three shops) renders at
native resolution with daylight and shadows. Characters, gameplay and UI arrive in P1–P4.

## Hard rules

- **Arianna and Lilah are protected.** Their GLBs ship byte-identical (`tools/protected.mjs`,
  `scripts/verify-*-quality.mjs`), at the display's full `devicePixelRatio`, never capped. No
  optimiser, compressor or re-export may touch them; call `assertNotProtected()` before any asset transform.
- **Saves are isolated.** Everything uses the `dumpling.three` prefix
  (`src/systems/SaveNamespace.ts`); nothing reads or writes the PlayCanvas `arianna.*` keys.
  Moving real saves is a separate, owner-approved cutover.
- **The PlayCanvas checkout is read-only.** Tools read `../Dumpling Game File` (or
  `DUMPLING_PLAYCANVAS_ROOT`) at the commit pinned in `reference.json` and never write there.

## Commands

Node 22.12+. Always use the pinned pnpm: `corepack pnpm@11.19.0 …` (the repo also declares
`packageManager`).

```sh
corepack pnpm@11.19.0 install --frozen-lockfile
pnpm dev             # viewer at http://127.0.0.1:5200/?view=house-bedroom
pnpm check           # tsc, protected characters, asset manifest, core sync
pnpm test            # Node suites: vendored PlayCanvas core tests + rebuild tests
pnpm build           # clean dist/, verified assets and protected characters, dist/release.json
pnpm test:browser    # built output never touches arianna.* keys; native resolution
```

Viewer parameters: `?region=house|store-corner|store-toys|store-collector`, `&view=<id>` (see
`tests/viewpoints.mjs`), `&focus=x,z&height=h`, `&capture=1`, `&loop=1`, `&nobatch=1`.

## Regenerating from the PlayCanvas reference

| Command | What it does |
|---|---|
| `pnpm assets:sync` | Copies shipped `public/` files byte-identical from the pinned commit; writes `assets.manifest.json` |
| `node tools/vendor-core.mjs` | Vendors `src/data`, `src/systems`, `DeveloperSaves` and their Node tests; writes `core.sync.json` |
| `pnpm convert` | Converts `editor-release/2600724.json` into `public/world/*.json` with count assertions |
| `pnpm baseline:playcanvas` | Captures PlayCanvas reference screenshots/metrics in a disposable browser context |
| `pnpm capture:three`, `node tests/browser/compare-baseline.mjs` | Same viewpoints in three.js; side-by-side and difference images in `artifacts/compare/` |

## How the world is built

`tools/convert-editor-scene.mjs` reproduces, offline and once, what PlayCanvas's
`LayoutBridge` merges at startup: Editor transforms are authoritative; each record's
code-built material is painted with the Editor colour and gloss (`tools/runtime-material-rules.mjs`);
furniture previews become references to the shipped public GLBs. Deliberate edits are recorded
in `public/world/index.json` (`edits`), e.g. the front doorway PlayCanvas cuts at runtime.

At load, `src/world/staticBatch.ts` merges static scenery by surface and 8 m cell, moving flat
paint colours into vertex colours: the house draws 96–166 times per frame (shadows included)
against about 293 authored and 487–591 as-played in PlayCanvas.

## Deployment

GitHub: [Marcsarno/dumpling-2.0](https://github.com/Marcsarno/dumpling-2.0) (public), with its own Vercel project. Never the PlayCanvas repo, whose `main`
auto-deploys to production). Vercel needs `ENABLE_EXPERIMENTAL_COREPACK=1` so the pinned pnpm is used.
