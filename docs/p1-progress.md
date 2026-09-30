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

## Remaining in P1

- Owner review of the motion captures. The eating, pick-up and celebrate motions are new.
- The chore, sleep, fishing, scooter and play clips land with their features (P2/P4). Their inputs (CMU and KayKit motion) are already shipped assets.
- Lilah, Marc and Sunny Pup loaders and animators. Lilah is protected too, so she also gets a runtime quality probe.
- Carry socket (midpoint of the hands) for held props.
