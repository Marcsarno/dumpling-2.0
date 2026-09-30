# Arianna carry revision

The enabled GLB is the user's Meshy revisions/carry_v1/arianna/arianna.glb.
SHA-256: 35cfde9dba8d20d53019d654728972c04f7455ccc533040d00818f86d3f82989.
It is copied byte-for-byte: 14,694 triangles, 28 joints, one baked PBR material,
and two embedded 2048px textures. No mesh, texture, material or rig edits.

All six supplied clips remain in the file: Casual_Walk, Walking, Running,
Idle, CarryWalk and CarryRun. The older game_ready file has only three clips.
The supplied preservation and validator reports are included beside the model.

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
