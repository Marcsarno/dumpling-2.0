# Lilah

User-provided Meshy review model, copied byte-for-byte from
`Dumpling Collector/experiments/meshy/revisions/v2/lilah/lilah_review.glb`.

SHA256: `1236fca01d74a3a6ece5b3ff4e725ff3267d236b75515ad467ba21a2aa583a80`

The GLB's mesh, baked material, textures, 25-joint rig and eight animation clips
are preserved. Source rest height is 1.03 m; +Y is up and +Z is forward.

Lilah is two years old. Her runtime height is Arianna's configured height times
0.625: initially half-height, then enlarged 25% at the user's request. With the
current Arianna this is 0.86465625 m. Scale is applied to the model entity;
ground alignment, hand attachment and animation bones remain intact.

Clips: Idle, Walk, CarryIdle, CarryWalk, PickUp, PutDown, Celebrate, SitCar.
Locomotion loops; pickup/put-down use 3x playback (0.8 seconds). Her route speed
is 0.7 units/second. Animation presentation uses the existing CharacterAnimator,
while Lilah.ts makes personality decisions and HousePath handles navigation.

She explores, follows Arianna and proudly makes three kinds of mess: toys,
juice, and cracker crumbs. LilahMesses owns their daily budget, interactions
and save state. At most three incidents per day and two outstanding messes;
playing together postpones mischief by 75 seconds. No new nighttime messes.

Verification: scripts/lilah-browser-test.mjs and
scripts/house-lighting-browser-test.mjs exercise the actual GLB, phone controls,
cleanup, carrying, reward persistence, play interaction and nighttime behavior.
