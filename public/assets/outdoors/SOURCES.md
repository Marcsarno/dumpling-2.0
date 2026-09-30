# Outdoor assets and licenses

Only selected files are included in production. Full source downloads stay in ignored artifacts/outdoors/source.

| Asset | Creator | Source | License | Use |
|---|---|---|---|---|
| CommonTree_1, CommonTree_3, Bush_Common, Bush_Common_Flowers, Rock_Medium_1, Rock_Medium_3, Plant_1 | Quaternius | https://quaternius.com/packs/stylizednaturemegakit.html | CC0; bundled License_Standard.txt retained | Selected plants/rocks converted to embedded GLB, maps resized to 512px; foliage colors adapted to the game |
| Goldfish, Betta, ArmoredCatfish, Puffer, FishingRod_Lvl1 | Quaternius | https://quaternius.com/packs/cutefish.html | CC0 | FBX converted to embedded GLB with original fish animations |
| Fishing_Cast, Fishing_Idle, Fishing_Bite, Fishing_Reeling, Fishing_Catch (Rig_Medium_Tools, v1.1) | Kay Lousberg / KayKit | https://kaylousberg.itch.io/kaykit-character-animations | CC0; bundled License.txt retained | Sampled world rotations and joint positions at 30 fps; bind-pose correction, matched arm directions and supporting-hand IK on Arianna's unchanged original bones |
| Worker | Quaternius | https://quaternius.com/packs/ultimatemodularwomen.html | CC0; see ../people/SOURCES.md | Actual Worker model with original safety vest, hardhat and Wave clip; original handheld stop paddle |
| splash2_0.wav | Peludo | https://opengameart.org/content/water-splash-and-sand-footsteps ; creator project https://rnan.itch.io/ | CC0 | Filtered 0.8-second mono splash; quiet cast/release feedback |

Pond geometry, lily pads, boardwalk, bench, paths, cottage exterior shell/roof, safety accessories, signs, road markings and school facade are original project geometry. No new point lights, water reflection pass, traffic, inventory, or currency. Existing roof/interior art and school rooms remain separate from these additions.

Reviewed alternatives: Quaternius Modular Streets and Ultimate Modular Women; Kenney City Kit Roads. The initially reused Kenney NPCs were replaced after user review with the requested Quaternius Worker and matching casual characters. The small quiet road is purpose-built to fit this route rather than adding an unused city kit. KayKit's complete free fishing set was selected over Universal Animation Library 2.

## Maple Lane daily play — September 26, 2026

All fifteen play-*.glb props are original Blender geometry (scripts/build-daily-play-props.py). Their moving parts are rigid toy pivots; they do not contain or modify Arianna's skeleton. The Blender sources and full-resolution game captures are retained under artifacts/daily-play.

play-motion.json samples KayKit Character Animations 1.1 (CC0, existing KayKit-CC0.txt): General Idle_A, Interact, PickUp, Throw, Use_Item; CombatMelee Melee_Unarmed_Attack_Kick; Simulation Waving; MovementBasic Jump_Full_Short. Retargeting preserves original target lengths and full rotations, adapts lateral arm excursion into a forward swing, and keeps the supporting foot grounded. Original character geometry, weights and 2048px maps remain untouched.

The design research used House House developer interviews about repeatable object reactions and expressive actions. No Untitled Goose Game models, sounds, code, animations or exact puzzles were copied. All new toy sounds are procedural original synthesis.
