# Arianna carry revision

The enabled GLB is the user's Meshy revisions/carry_v1/arianna/arianna.glb
(original SHA-256 35cfde9dba8d20d53019d654728972c04f7455ccc533040d00818f86d3f82989,
14,694 triangles) with the owner-approved armpit fix of 2026-09-29.
SHA-256: 747b164324d4fd7d0eb1719daaa537d149b0801fa488834ed738225985cbf9ea.

The Meshy mesh fused each sleeve to the jacket side from the hem to just under the
shoulder, so lifting an arm dragged the jacket into a "bat wing".
tools/arianna-armpit/build.py opens those seams, adds hidden inner-sleeve and
jacket-side panels (15,822 triangles in total) and reweights the sleeves and
jacket sides. The 28-joint rig, material, all six clips and the two embedded
2048px textures are byte-identical to the original, and every original vertex
keeps its position, normal, UV and tangent. The rebuild keeps this file when
syncing assets from PlayCanvas (tools/asset-rules.mjs OVERRIDES). The supplied
preservation and validator reports describe the original file.

All six supplied clips remain in the file: Casual_Walk, Walking, Running,
Idle, CarryWalk and CarryRun. The older game_ready file has only three clips.

MeshyGameplayAdapter uses the actual Idle and carry clips. Runtime gait copies
remove the 1/15-second export lead-in, joining the authored matching endpoints.
Walk/Run aliases use Walking/Running. The controller runs at 3.15 units/s by
default; vacuum and scooper carry at 1.65 units/s. Analog input can walk slowly.
Playback follows actual speed, up to 1x; gait blends preserve normalized phase.
Facing follows actual velocity, including collisions.

CarryIdle uses the supplied carry-arm pose with stationary legs. Pickup, put-down
and celebration still use temporary runtime poses because these clips were not
supplied. Pickup/put-down take 0.8 seconds and commit at 0.4 seconds, once each.
The generic carry socket follows LeftHand/RightHand. The vacuum uses a handle
attachment and 0.75 carried scale; its original scale returns when placed.

Display height is 1.38345m (15% larger than the previous 1.203m), +Y up / +Z forward. Floors/rugs move only the visual
alignment. The collider, camera and portrait layout are unchanged.
Run scripts/new-arianna-browser-test.mjs for current model checks.
