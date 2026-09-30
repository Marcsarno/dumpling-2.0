# Sunny Pup

Source: Marc's `Meshy_AI_Sunny_Pup_0919020946_texture.glb`, preserved unchanged.
SHA-256: `38a8584ebc5ed2944472e84b2b3292915b390798f13657f9d7adf611a57c8524`.
The user-supplied mesh/textures are not asserted to be CC0.

Runtime asset: `sunny-pup.glb`. Same mesh, UVs and textures, with a fitted quadruped
skeleton, four-influence skin weights, Idle and Walk animations. Bind-pose height
is normalized to **0.48 game units**, matching the previous pug. Proportions are
preserved with uniform scaling. The previous `pug.glb` is retained as a backup.

Rig and source animation: [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app),
`static/animations/fox-animations.glb`, commit
`3ce7f9d97d25e608b4779ce797da343775ded62b`.
Original SHA-256: `80e80641a5692a14aba7616a46d2a28d3595479764887c578c766b99dba8a0d0`.
Mesh2Motion's rigs and animations are released under
[CC0](https://github.com/Mesh2Motion/mesh2motion-app/blob/3ce7f9d97d25e608b4779ce797da343775ded62b/LICENSE-CC0.MD).
The source asset and license are retained in `scripts/assets/dog/` in the repository.

Adaptation: fitted joint landmarks, smooth anatomical skin envelopes, head/eye
protection, world-space rotation retargeting, reduced torso/head/tail motion,
neutral-relative idle, exact cyclic endpoints, and baked vertical grounding.
Only Idle (1.6 s) and Walk (1.2 s) are exported. This is a retargeted quadruped
animation, not newly captured dog motion. Unused source meshes/actions are not
in the runtime model.

Rebuild from the repository root with Blender 5.2:

    blender --background --python scripts/rig-meshy-dog.py

`DogAnimator` advances the clip with actual world movement and respects world,
developer and arcade pauses. The Tornado cameo uses a 0.30-unit/second walk;
the old whole-model bounce is removed. Normal placement and the poop chore are
unchanged. No save schema or player progress changes.
