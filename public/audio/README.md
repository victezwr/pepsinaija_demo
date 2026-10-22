# Chase audio you can replace

Without these files the game falls back to sounds generated in code. **What to record, line by
line and sound by sound: [`context/recording-script.md`](../../context/recording-script.md).**

| File | What it does |
|---|---|
| `theme.mp3` | The theme song (the chase soundtrack). Erupts at the end of the opening cinematic and loops under the whole chase. **The game is timed to it**: the beat grid (163.53 BPM, first beat at 0.234 s, loop 11.98 s → 41.33 s) is set at the top of `src/audio/music.ts`. If you swap the song, re-measure those numbers. Without the file, a generated loop plays instead. |
| (generated, `src/audio/score.ts`) | The cinematic's talking-drum groove, suspicious trumpet notes and fanfare; the chase intensity layers (agogo, brass stabs, talking-drum fills, risers, shaker) added on top of the theme at 500 / 1,200 / 2,000 / 3,000 m; the game-over trumpet. Tuned to the theme (G minor, 163.53 BPM). |
| `agbero-1.mp3` … `agbero-6.mp3` | Agbero shouts, picked at random (pitch varies a little each time so it sounds like different men). Record short, angry pidgin lines, about 0.5–1.5 s each: "Oya!", "Hold am!", "Where you dey go?!", "Bring am come!", "Na our own be dat!", "Stop there!". |

| `voice/<line>.mp3` | The spoken lines (Chairman, agberos, your runner), one file per line, e.g. `voice/chairman-drop-am.mp3`. Names and lines are in the recording script. Each replaces that line's generated shout. |
| `sfx/<cue>.mp3` | The sound effects, one file per cue, e.g. `sfx/pop.mp3`, `sfx/coin.mp3`, `sfx/fizz-loop.mp3` (a seamless loop). Names in the recording script. Each replaces that generated sound. |

Any file you add is picked up at the next build (the build lists what's in `voice/` and `sfx/`, so missing files cost nothing). MP3, WAV, M4A or OGG.

Use only audio you own or have a licence for.
