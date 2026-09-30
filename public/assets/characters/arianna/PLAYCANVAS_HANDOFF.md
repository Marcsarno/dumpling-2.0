# Current PlayCanvas handoff

This folder now contains the Meshy carry_v1 revision, replacing the older V3.2.0
25-bone character. See README.md and asset_manifest.json for the current model.

Use the supplied Idle, CarryWalk and CarryRun, plus Walking and Running for
ordinary locomotion. Casual_Walk is preserved but not selected by gameplay.
CarryWalk/CarryRun preserve the original walking/running body channels.
The rig uses LeftHand and RightHand; old hand.L/hand.R names do not apply.

character.json enables the meshy adapter. The adapter keeps interaction poses
outside the GLB. Replace these temporary poses when real PickUp, PutDown,
CarryIdle and Celebrate clips arrive. Gameplay uses the existing controller
and carry socket rather than joint names.

MovementPace.ts defines normal/small-item pace at 3.15 units/s and bulky pace
at 1.65. Item carryPace metadata chooses bulky walking. Original binary clips,
geometry, rig and materials remain unchanged.
