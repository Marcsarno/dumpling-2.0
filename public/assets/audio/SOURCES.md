# Scene music

## User-provided replacement tracks — September 20

Marc supplied these MP3s directly, preserved unchanged. No open-source license
is claimed for them. They replace the previous house playlist:

- `Squishy home clean.mp3` (1:58): home morning and night.
- `Squishy Home clean v2.mp3` (1:40): home after-school chores.
- `Squishy school trading.mp3` (1:08): classroom/recess trading.
- `Squishy shopping.mp3` (2:07) and `Squishy shopping v2.mp3` (1:57): alternate
  when entering a different store. Pausing or opening Pop does not switch songs.
- `Squishy unlock.mp3` (9.56 seconds): RESERVED ONLY, not loaded or played.
  Marc is undecided; consider a shorter Epic/Legendary-only excerpt later.

One runtime audio voice, quiet volume, transition/end fades and a five-second
gap before repeating the selected song. Pause during Pop/Tornado/DEV/hidden tab;
existing music mute preference is retained. Reveal sequences gently duck music.
Squishy Pop's soundtrack and the current reveal cues are unchanged.

## Previous CC0 playlist (retained backups, no longer selected)

Previous playlist (both CC0):

- `sunny-house.mp3`: **Happy Ukelele Island Surfing Theme**, Tarush Singhal.
  https://opengameart.org/content/happy-ukelele-island-surfing-theme
  Source https://opengameart.org/sites/default/files/ukele.mp3
- `evening-house.mp3`: **Forget Me Not**, Kistol.
  https://opengameart.org/content/forget-me-not
  Source https://opengameart.org/sites/default/files/forget_me_not_in_f_major_looped.ogg

FFmpeg derivatives use loudnorm I=-23:TP=-3:LRA=7, 44.1kHz MP3 q5,
1.5-second opening fades, plus a two-second ending fade for the ukulele track.
Runtime volume ramps to 0.32, fades over the last three seconds, and waits
12 seconds before another track. Daytime alternates tracks; night uses piano.
Playback pauses outside house gameplay, during Pop/Tornado/developer pause,
and when hidden. Persistent mute uses its own key, independent of progress.

The original first-pass music below is retained as a source/backup, not played:

`cozy-house.ogg` is **relax_background1** by **joaquinton**, released under CC0.
Source: https://opengameart.org/content/relaxbackground1
Download: https://opengameart.org/sites/default/files/relax_background1_0.ogg
License: https://creativecommons.org/publicdomain/zero/1.0/

Original OGG retained; MP3 derivative created with FFmpeg for browser compatibility.

## Household action sounds — September 21, 2026

`src/ui/ChoreAudio.ts` synthesizes original vacuum hum, munching, wiping/washing swishes, and soft handling sounds with Web Audio. No external recordings or additional licenses. A separate persistent Sounds toggle controls these effects.

## Recorded household foley — September 21 refinement

The earlier noise synthesis has been replaced by locally hosted recorded CC0 clips. All downloads were checked against the original creator pages. Files are mono 24 kHz MP3; long actions are trimmed to at most six seconds, level-normalized and edge-faded. Footstep files are retained as unused source assets; walking no longer loads or plays them. No network streaming occurs during play.

- vacuum.mp3: wjtaylor, vacuum_cleaner.wav — https://freesound.org/people/wjtaylor/sounds/266099/
- munch.mp3: Closetwalrus, chewing.wav — https://freesound.org/people/Closetwalrus/sounds/370297/
- wipe.mp3: polyn, wipe and scrub.wav — https://freesound.org/people/polyn/sounds/540972/
- water.mp3: miacx, tap water — https://freesound.org/people/miacx/sounds/614493/
- step-*.mp3 and handle.mp3: Kenney, Impact Sounds — https://kenney.nl/assets/impact-sounds (footstep wood/carpet/concrete 000–002, impactSoft_medium_000).
- All above: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/

Music defaults to a 50% slider level and its base gain was reduced a further 10%. Existing explicit slider values are retained. Music/effects sliders persist independently. The supplied Squishy unlock.mp3 remains reserved; opening choreography is deferred.
