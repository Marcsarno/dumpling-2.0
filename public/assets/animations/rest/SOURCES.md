# Resting pose adaptation

Source: CMU Graphics Lab Motion Capture Database, **140_08**, “Get Up From Ground
Laying on Back”: https://mocap.cs.cmu.edu/search.php?subjectnumber=140

Only frames 1–12 (the starting resting excerpt) supply elbow and knee flex to
`sleep.json`. Knee flex is reduced for the beds. Rig fitting, supine alignment,
the transition and subtle breathing loop are authored adaptations, not a claim
that the source contains a bed-entry animation. Original Arianna/Lilah meshes,
textures and embedded clips remain unchanged.

Source AMC/ASF are retained in `scripts/assets/rest/`. Rebuild with
`node scripts/prepare-rest-motion.mjs`. `RestingPose.ts` fits this to both rigs.

The data used in this project was obtained from mocap.cs.cmu.edu. The database
was created with funding from NSF EIA-0196217. CMU permits use including
commercial products but prohibits resale of the motion data itself; this is
not CC0. Terms: https://mocap.cs.cmu.edu/faqs.php

Breakfast sitting/eating is an authored runtime pose fitted to Arianna and the
kitchen chair, separate from these CMU-derived resting angles.

The follow-up adds an authored 3.2-second `SleepEnter` sequence: reach, tuck,
sit and recline, paired with continuous placement onto the bed or over the crib
rail. This is fitted to these two characters and furniture, not an imported
bed-climbing mocap clip. The existing CMU-derived lying/breathing pose follows it.
