# Marc animation revision 2 — awaiting visual review

**Current update:** `Run_Alternative` was rejected and removed from `marc.glb` and `marc.blend`. There are now 10 clips. Use the original `Running` clip for running. The alternate-run references below describe earlier review history, not the current export. Do not restore that clip.

Use `marc.glb` to test this revision. `marc.blend` is the editable source. This revision changes animation only; the fitted skeleton, mesh and skin weights are identical to the previous version.

## Clips to review

- `Idle`: corrected from Marc's own rest pose, with each arm brought inward by 0.22 radians (about 12.6 degrees). Original elbow flex and forearm relationship are retained, avoiding the backward bend from the previous transferred pose.
- `Walk_Basic`: Quaternius `Walk_Loop`, retargeted to Marc.
- `Run_Alternative`: Quaternius `Jog_Fwd_Loop`, retargeted to Marc.
- `SitDown`: Quaternius `Sitting_Enter`. Play once.
- `SitIdle`: Quaternius `Sitting_Idle_Loop`. Loop while seated.
- `StandUp`: Quaternius `Sitting_Exit`. Play once.
- `Running`: original run, retained without changing its Blender animation curves.

Previous `Walking`, `Casual_Walk`, `CarryWalk`, and `CarryRun` remain for comparison. The carry walk still uses the previous locomotion; it has not been replaced with the new basic walk.

All clips have separately named glTF animations. No Blender constraints or engine-specific scripts are needed for playback. Test stool and skeleton labels are viewer-only aids and are not part of the exported character.

## Sources and license

The five added library clips are from Quaternius's Universal Animation Library, using its 2025-06-10 CC0 snapshot archived at:
https://github.com/J-Ponzo/gltf-universal-animation-library

Author and original library page:
https://quaternius.itch.io/universal-animation-library

The download includes CC0 1.0 Universal. The exact source glTF, binary, README, and license are retained in `../../animation_sources/quaternius_cc0/`. A copy of the license accompanies this revision as `LICENSE_ANIMATIONS_CC0.txt`. No paid animation tier was used.

## Preservation and checks

The original blend and GLB are backed up at `../../backups/before_animation_revision_20260915/`. The original `../../game_ready/` exports are also untouched.

`validation.json` confirms exact skeleton, mesh/weight, and original Running-curve preservation. New animations were sampled at frames and half-frames for fixed bone lengths and ground contact, and front/side renders and live viewer poses were inspected. `gltf_validation.json` records zero errors, warnings, or informational messages.

Preview:
http://127.0.0.1:8768/experiments/meshy/test_viewer/?character=marc&inspect=rig&clip=Idle
