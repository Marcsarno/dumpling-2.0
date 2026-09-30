# P1 progress — characters and movement

Started on 2026-09-29 after the owner approved P0.

## Owner direction for this phase

- Keep the run; the owner likes it.
- Fix the **right wrist**.
- Eating and several other animations are only "okay"; do better.
- Stay on her existing rig and mesh, and keep the jacket safe from the bat-wing stretch.
- The owner reviews full front and side captures before sign-off.

## Done

- **Arianna loaded untouched.** The runtime probe reports:
  - pixel ratio = devicePixelRatio (3 at 390×844, 1170×2532)
  - 2048×2048 colour and normal maps, with tangents intact
  - 14,694 triangles and 28 joints
  - The only rendering change is anisotropic filtering, which affects sampling; the texture data is untouched.
- **Motion lab** (`lab.html`, `pnpm capture:motion`): any clip at any time from front, left, right, back, three-quarter and game views. It saves full-resolution frames plus review strips to `artifacts/motion/`.
- **Run** (`src/characters/run.ts`): keeps the PlayCanvas balanced body.
  - The torso lean is averaged over the mirrored half stride and the hips are centred.
  - The right arm is reflected onto the left.
  - Both wrists now share one rule: rest roll, 30% of the authored bend (at most 10°) and a two-frame follow-through lag. PlayCanvas had a flicking right wrist (a 12° clamp only) and a left wrist pinned to one pose.
- **Actions** (`src/characters/actions.ts` and `actionSpecs.ts`): keyed goals baked at load onto the existing bones.
  - Hand points move on Catmull-Rom arcs with eased timing.
  - Hands can be attached to the mouth so they follow her head.
  - Forearms roll and the soft wrist applies.
  - Legs sit or squat with planted feet.
  - The torso leans, the head follows, and she breathes during holds.
  - Elbow guard: elbows stay within 3 cm of their rest width.
  - Clips: CarryIdle, PickUp and PutDown (a real child's squat), Celebrate (a jacket-safe "yay!" with a hop and fist pump), MealSit, MealIdle, MealBite (two-handed arc to the mouth, head meets it, small chew), MealDrink (the head tips back instead of copying the bite), MealStand, EatSit (sit, two bites, stand) and SitCar.
  - Durations and event times match PlayCanvas (for example, bite contact at 0.65 s of 1.25 s, attach and release at 0.4 s of 0.8 s).
- **Animator** (`src/characters/CharacterAnimator.ts`):
  - AnimationMixer with phase-synced gait blends (0.14 s) and 0.08 s blends into actions.
  - Owner-approved relaxed cadence; run engages above 1.3 m/s and holds down to 1.05 m/s.
  - Smoothed turning replaces the PlayCanvas per-frame snap.
  - Events fire on the clip clock; CarryIdle plays when she's carrying.
- **Movement** (`src/game/movement.ts`): PlayCanvas-identical collision, plus about 55 ms velocity easing. Joystick (12% dead zone) and WASD/arrow input.
- **Play mode** is the default at `/`: Arianna in the house or a shop, follow camera and grounding on rugs.
- **Tests:** `tests/browser/play-walk.mjs` drives real keyboard and CDP touch input. It checks run, walk, idle, wall collision, the quality probe, and that the bite contact fires at about 650 ms.

## Arianna armpit fix (owner-approved, swapped in 2026-09-29)

- **Problem:** the Meshy mesh is one shell with no inner sleeve. Each sleeve was fused to the jacket side from the hem (~0.48 m) to just under the shoulder (~0.75 m), so lifting an arm dragged the jacket into the "bat wing" the owner rejected.
- **Fix:** `tools/arianna-armpit/build.py` (headless Blender Python). It finds the front and back creases on horizontal slices, rips the seam along them, adds hidden inner-sleeve and jacket-side panels (UVs mirrored from the neighbouring jacket islands, kept 4 texels inside), makes the sleeves follow the arm and the jacket sides follow the spine, and blends a hinge at the armpit apex.
- **Preserved:** `tools/arianna-armpit/verify-candidate.mjs` confirms the 2048×2048 colour and normal maps, rig, material and all six clips are byte-identical, and every original vertex keeps its position, normal, UV and tangent. Rest pose is unchanged.
- **Shipped file:** sha256 `747b1643…`, 19,419 vertices, **15,822 triangles** (was 14,694). The original (`35cfde9d…`) is archived in `artifacts/armpit/original/`, the PlayCanvas repo and git history.
- **Guards updated with owner approval:** verifier hash (a recorded `patched` vendored file in `tools/core-files.mjs`), `tools/protected.mjs`, runtime probe expectation, play-walk test. `pnpm assets:sync` keeps the fix via `OVERRIDES` in `tools/asset-rules.mjs`.
- **Review:** `node tests/browser/record-armpit-review.mjs` records original vs shipped side by side; the lab accepts `?glb=<path>` in dev.
- **Deferred to polish (owner, 2026-09-29):** the braid is weighted to RightShoulder/RightArm and lifts with that arm.
- **Follow-up:** the coat-safe limits on upper-arm lift in `actionSpecs.ts` were set for the fused mesh and can now be relaxed where a motion looks better with more lift.

## Lilah (2026-09-29)

- **Loaded untouched** in play mode: runtime probe reports 2048×2048 colour, 1024×1024 metallic/roughness, 11,271 triangles, 25 joints, native pixel ratio. Height 0.625 × Arianna (0.8647 m).
- **Clips:** her eight authored clips as supplied (`buildLilahClips`). PickUp/PutDown play at 3× (0.8 s) with take-toy at 1.1 s and drop-toy at 1.3 s of clip time; Celebrate is a one-shot. She never runs.
- **Animator:** the shared `CharacterAnimator` now takes per-character travel speeds, `canRun` and action rates (Lilah walks at 0.7 m/s).
- **Carry socket:** `CarrySocket` (hand midpoint in yaw-pivot space, 2.5 cm forward) for both Arianna (LeftHand/RightHand) and Lilah (hand.L/hand.R, which three.js names handL/handR). Lilah's favourite block rides there.
- **Behaviour** (`src/game/Lilah.ts`, `HousePath.ts` ported from PlayCanvas): first decision at 3 s, then every 12 s; 55% follow a spot beside Arianna, otherwise one of six explore spots; next decision 7 s after arriving; reaches each waypoint before turning; stops 0.4 m short of Arianna. Speech bubbles as in PlayCanvas. She stays home (hidden, clock paused) during shop visits.
- **Deliberate upgrades:** follows to the nearest free spot beside Arianna (PlayCanvas always tried the same corner first); waits up to 1 s for Arianna to step aside before re-deciding (PlayCanvas dropped the route at once); turns to watch Arianna while standing within 3.5 m.
- **Tests:** `tests/node/house-path.test.mjs` (routes on the real house), `tests/browser/lilah-house.mjs` (quality, pace, free floor, personal space, carry socket, 3× PickUp timing, shop visit). Review video: `node tests/browser/record-lilah-play.mjs`.
- **Later, with their features (P2):** bedtime (Sleep pose and crib), play-together, home-toy invites, messes and the Tornado event, and the evening "sleepy" walk to the crib. Braid secondary motion is a polish idea.

## Remaining in P1

- Owner review of the motion captures. The eating, pick-up and celebrate motions are new.
- The chore, sleep, fishing, scooter and play clips land with their features (P2/P4). Their inputs (CMU and KayKit motion) are already shipped assets.
- Marc and Sunny Pup loaders and animators.
- Owner review of Lilah in play (`artifacts/play/lilah-play.webm`).
