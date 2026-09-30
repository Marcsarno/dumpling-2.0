# P0 progress — 2026-09-29

P0 is complete and committed. The owner approved the first commit and the public `Marcsarno/dumpling-three` repo on 2026-09-29.

## Done and verified

- **Scaffold:** pnpm 11.19.0 with a local store. Pinned versions: three 0.186.1, TypeScript 5.9.3 (strict), Vite 7.3.6 and playwright-core 1.63.0. Everything is LF via `.gitattributes`.
- **Assets:** 269 files (91 MiB) copied byte-identical, with a sha256 manifest and licence family per file. A protected deny-list rejects 4 forbidden copies.
- **Protected-character verifiers:** byte-identical copies, passing on both `public/` and `dist/`.
- **Core:** 48 files vendored (46 verbatim, 2 recorded divergences). The sync checker passes.
- **Tests:** 21/21 Node test files pass:
  - the 18 PlayCanvas core tests
  - the registry and determinism golden
  - the save-namespace guard
  - world parity: house and shop colliders, walkables, 34 interactions, shop sites and exits all match the PlayCanvas runtime
- **Baseline:** PlayCanvas metrics and world dump in `baseline/playcanvas-9a40b4e/`; 40 screenshots in `artifacts/baseline/`.
- **Converter:** all census and count assertions pass, and all 295 previews match their GLB placements.
  - The front doorway and garden-route edits are baked in as data.
  - Found and fixed: `layout-source` records hierarchy-enabled state, which is not the same as the code flag.
- **Viewer:**
  - three.js renderer at native DPR (1170×2532 at ratio 3), on-demand rendering, a single resize owner.
  - Daylight with a fitted shadow camera.
  - The material library supports Editor, code-primitive and glTF-painted materials, plus procedural surfaces.
  - Load-time checks on each primitive's vertex count report 0 problems.
- **Upgrade:** static batching by surface and cell, with paint colours moved into vertex colours.
  - House: 96–166 draws (shadows included) against PlayCanvas's roughly 293 authored and 487–591 as played.
  - Shops: 103–135 draws.
- **Visual comparison:** 0.9–4.7% changed pixels in the house, 1.2–2.8% in the shops. Side-by-side images are in `artifacts/compare/`.
- **Build:** `pnpm build` produces a clean `dist/`, verifies assets, both protected characters and world hashes, and writes `release.json`.
- **Save guard:** `pnpm test:browser` confirms no `arianna.*` access across three modes, with a seeded production save left untouched.

## Known gaps, for later phases

- **Materials:** the PlayCanvas specular workflow (F0 about 0.007) is approximated by three.js standard F0 0.04. Light masks come in with the night lamps (P2). The crib slats shade slightly darker.
- **Geometry:** shop sign glyph geometry is heavy, at 300–490k triangles per shop view. It is a candidate for meshopt or a texture-based sign in P5.
- **Evidence:** all measurements come from desktop headless Edge. No phone measurements yet.

## Next: P1

Characters and movement, starting with Arianna loaded byte-identical plus a runtime quality probe.
