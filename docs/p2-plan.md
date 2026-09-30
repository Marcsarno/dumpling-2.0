# P2 plan — house and core daily loop

Started 2026-09-29. Scope and exit criteria come from the audit (§13.3):

- A scripted full day, 7:00 to sleep, completes.
- The routine pays **$12**: 3 morning + 5 afternoon + 3 night chores + tucking Lilah in. Timed rounds pay $3–$8.
- Rebuild-written `daily.v1`, `progress.v1` and `home-play.v1` are accepted by the PlayCanvas validators, which are the vendored `DailyClock`, `ProgressStore` and `HomePlayStore`.
- Screenshot parity per room meets the owner's bar.
- The dynamic-obstacle count is bounded.

Saves stay in the rebuild's own `dumpling.three.*` namespace. `arianna.*` is never read or written.

## Slices

Each slice is built, tested and shipped on its own.

1. **Clock, saves and HUD shell.**
   - `DailyLife` logic over the vendored `DailyClock` (0.5 game-min/s; morning 420→510, school, afternoon 900→1140, night to 1260).
   - `daily.v1` written about every 1 s and after each change; `ProgressStore.creditRound` receipts; `DailyPlayStore.ensure` each day.
   - The PlayCanvas pause policy.
   - HUD status card, menu and journal as a typed state (no DOM scraping), the `#action-button` shell, and wallet.
   - Node test: rebuild-written saves round-trip through the PlayCanvas validators.
2. **Interactions, carry, prompts and markers.**
   - A registry of the 62 interactions, overlaid with the 34 Editor anchors, on the vendored `InteractionSystem`/`InteractionGuidance`.
   - An approach-to-prop step, pickup/release on `CarrySocket`, and three.js markers (torus ring plus DOM icon).
   - Space/E and the hold button.
3. **Morning and night chores, sleep.**
   - Teeth, clothes, the breakfast chain (`EatSit`) and the bedtime book.
   - `sleep` with a bed-entry pose, and the day rollover.
4. **Afternoon chores, pet care and timed missions.**
   - Vacuum, spill, the 11 extras, and feed-dog/pet-care stages.
   - Mission picker and results: House $8, Bedroom $7, Pet $3, Practice.
   - The $12 routine becomes assertable here.
5. **Day/night lighting and audio.**
   - The 13 authored interior lights with a 1.2 s fade, lamp shades, and the dusk blend of sun and ambient.
   - Scene music, chore foley, and mute settings.
6. **Family life.**
   - Lilah: play-together, the 18:15 crib walk, and tuck-in ($1).
   - Marc's dinner.
   - Sunny's bowl and fetch.
7. **Home play (42 toys) and meals.**
   - `HomePlayStore` transactions and `PlayPhysics`.
   - Dinner and lunch plates.
   - A bounded dynamic-obstacle list in movement.
8. **Tornado and developer panel.**
   - `TornadoRules` round ($1–3, idempotent receipt).
   - A developer panel behind a flag.
   - A scripted full-day browser test and the PlayCanvas↔rebuild save differential.

Dependencies:

- 1 and 2 come first.
- 3 and 4 need 2.
- 5 needs only 1.
- 6 needs 2 and 3.
- 7 and 8 need 2 and 6.

Browser tests keep the PlayCanvas ids (`#action-button`, `#joystick`) and the `__roomTest.snapshot()` shapes, so PlayCanvas scripts can serve as parity references.

## Ledger

### Slice 1 — clock, saves and HUD shell (2026-09-29)

- **`src/game/DayLoop.ts`**: pure logic over the vendored `DailyClock`, `ProgressStore` and `DailyPlayStore`.
  - Writes `dumpling.three.daily.v1` every second and after each change.
  - `complete(id)` pays $1 once by receipt `day-{d}-{phase}-{id}`.
  - The journal hint text matches PlayCanvas.
  - The clock runs only at home, with no dialog open, the tab visible and no action under way; each step is capped at 2 s.
- **Upgrades over PlayCanvas:**
  - An unreadable daily save is kept as `daily.v1.unreadable` and reported, instead of silently becoming a fresh day 1.
  - A reward that can't be saved waits and retries instead of being lost.
  - After keyboard play, the joystick fades out but still takes the first touch (PlayCanvas hid it, so that touch fell through).
- **`src/ui/AdventureHUD.ts` + `hud.css`**: the owner-reviewed redesign (status card, wallet, menu, journal, round timer, action button), driven by a typed `HudState` instead of scraping hidden DOM.
  - The menu lists only destinations that exist.
  - A "Visit a place (preview)" entry replaces the old region picker until doors land.
  - `src/ui/ActionButton.ts` is copied from PlayCanvas; it has no actions yet (slice 2).
- **Tests:**
  - `tests/node/day-loop.test.mjs`: rebuild saves read back unchanged by the PlayCanvas validators; pause and 2 s cap; receipts pay once; reload; the unreadable-save backup; reward retry; sleep → day 2.
  - `tests/browser/day-hud.mjs`: HUD text; the clock runs, then pauses in the journal and in shops; a chore updates the wallet and count; a reload resumes the day; no `arianna.*` keys.

### Slice 2 — interactions, carry, prompts and markers (2026-09-29)

- **`src/game/Chores.ts`**: the gameplay half of PlayCanvas `CleanupGame`.
  - Press → walk up → perform, driven by the vendored `InteractionSystem` (nearest available target within range, with 0.1 m hysteresis) and `MissionSystem`.
  - PickUp and PutDown commit on the clip's attach/release events at 0.4 s, and she turns toward the target while they play.
  - Tap work (crayons, 450 ms) and hold work (vacuum, 1150 ms). Releasing early, or walking out of range, cancels the work and the mess grows back.
  - A timed round finishes with a celebration and the results dialog, and pays once by receipt through `DayLoop.credit`.
  - Modes so far: `day` and `bedroom` (60 s, five tasks, $1 each + $2 all-clean bonus).
- **`cleanupProps.ts`** (replaces the temporary type shim):
  - Teddy, shirt, book, vacuum, crayons and their cup, and the dust pile, built from primitives exactly as PlayCanvas builds them.
  - Drop-off spots come from the Editor's `semantics.interactions` (for example, the moved bookshelf).
  - **`RoundMesses.ts`** scatters each round to free, reachable spots, as PlayCanvas does.
- **`CarrySystem.ts`**: re-parents the item to the hand socket at its grip or bounds centre. The vacuum is carried at 0.75 scale and at the steady carry pace (1.65 × 1.5 m/s, CarryWalk).
- **`movement.ts` `approachProp`**: the PlayCanvas walk-up (rings 0.32–1.8 m, within 2.2 m, clear line, prefer close to the prop). Stick or key input cancels it.
- **`CleanupFeedback.ts` + `cleanup.css`**: glowing floor rings, icon labels (nearby, destination, off-screen arrow) and the +$1 pop, ported to three.js.
- **HUD:**
  - The action button shows the PlayCanvas titles ("Pick up", "Put away", "Tidy up", "Hold to clean", "Moving closer…") and fills with hold progress.
  - The round timer card appears in timed rounds.
  - The menu has "Choose an activity" (Daily life, Bedroom · 5).
  - The day clock pauses during rounds, as in PlayCanvas.
- **Test:** `tests/browser/chores-bedroom.mjs` plays the whole round with real key presses:
  - the carry socket, and pickups refused while her hands are full;
  - put-away positions, the crayon tap, and the early-release vacuum reset;
  - $7 with the bonus, the wallet, receipt idempotence, and replay.
- **Not yet:** the Vacuum and Wipe work clips (she holds the vacuum in CarryIdle while cleaning) and chore audio. These land with slice 4.
