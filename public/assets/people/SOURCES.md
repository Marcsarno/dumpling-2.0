# School people — CC0

- Creator: Quaternius.
- Official women pack (Worker, Casual): https://quaternius.com/packs/ultimatemodularwomen.html
- Official men pack (Casual_Hoodie, Casual_2): https://quaternius.com/packs/ultimatemodularcharacters.html
- License: CC0 1.0 Universal. Both official pack pages identify CC0. Included license text is the men's pack notice.
- Download mirror: https://github.com/agentkaerf/FreeModels (the official Google Drive downloads were quota limited).
- Original source paths: `Ultimate Modular Women - April 2022/Individual Characters/glTF/{Worker,Casual}.gltf`, `Ultimate Modular Men- Feb 2022/Individual Characters/glTF/{Casual_Hoodie,Casual_2}.gltf`.

The four selected source characters remain available for staff and comparison. Converted to GLB with Blender; original skin, skeleton and mesh retained. Idle_Neutral, Wave and Interact are the only retained animations. Surface normals are smoothed. Runtime child height is 1.34–1.38 m before the slight head enlargement; clothes use the game's pastel palette. Seated animation tracks adapt the original legs/feet to the existing seats without changing Arianna or the room furniture. Ms Maple uses the actual Worker safety vest and helmet; her handheld paddle is original game geometry. Lunch cook reuses Casual_2 with light clothing and an original fitted chef cap.

Rebuild selected GLBs: `blender --background --python scripts/prepare-school-people.py`, with the four source glTFs in ignored `artifacts/npc-upgrade/source`.

## Reference-led student sculpts (September 2026)

student-jules.glb, student-remy.glb and student-poppy.glb replace the students' visible adult meshes with original rounded character geometry based on the user's supplied concepts. The source CC0 skeletons and Idle_Neutral, Wave and Interact clips remain. Runtime chair fitting and blinking are original additions. The classroom and cafeteria instantiate these same three assets and trading identities. Arianna and the adult staff are unchanged.

The three sculpts contain 19,194 / 18,500 / 21,258 triangles, respectively, with two surface types per character and vertex colors instead of texture maps. Hair is fused and reduced before export; trousers have continuous knee weighting. These are real-time interpretations, not exact replicas of the concept render.

Rebuild: Blender 5.2, blender --background --python scripts/build-student-sculpts.py. Inputs are the existing Hoodie.gltf, CasualBoy.gltf, and CasualWoman.gltf source rigs in ignored artifacts/npc-upgrade/source. The report goes to artifacts/refinement/student-build.json.

## School-gate play variant (September 26, 2026)

`student-poppy-play.glb` retains the original Poppy sculpt, skeleton, materials, skin weights, and three existing animation clips. It adds the matching Quaternius `CasualWoman.gltf` Walk and Kick_Right clips for standing outdoor play. The classroom/cafeteria continue to use `student-poppy.glb` unchanged. Rebuild with `node scripts/build-poppy-play.mjs`; the ignored source is `artifacts/npc-upgrade/source/CasualWoman.gltf`. Original ball panels, schoolbag, bottle, and maple leaves are procedural game geometry/materials in `SchoolGatePlay.ts`.
