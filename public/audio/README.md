# Chase audio you can replace

Without these files the game falls back to sounds generated in code. **What to record, line by
line and sound by sound: [`context/recording-script.md`](../../context/recording-script.md).**

| File | What it does |
|---|---|
| `theme.mp3` | The theme song, "Morning Train to Somewhere" (the chase soundtrack), cut from the full song to start a bar before the drums come in (2 min 37 s, 96 kbps, so it loads fast). Erupts at the end of the opening cinematic, plays through once, then loops its last high section. **The game is timed to it**: the beat grid (124 BPM, first beat at 0.048 s, loop beats 240 → 320) is set at the top of `src/audio/music.ts`. If you swap the song, re-measure those numbers. Without the file, a generated loop plays instead. |
| (generated, `src/audio/score.ts`) | The cinematic's talking-drum groove, suspicious trumpet notes and fanfare; the chase intensity layers (agogo, brass stabs, talking-drum fills, risers, shaker) added on top of the theme at 500 / 1,200 / 2,000 / 3,000 m; the game-over trumpet. Tuned to the theme (D minor, 124 BPM). |

| `voice/<line>.mp3` | The spoken lines, one file per line, e.g. `voice/agbero-gimme.mp3`. Names and lines are in the recording script. Without a recording a line is a speech bubble only (there are no generated voices). |
| `sfx/<cue>.mp3` | The sound effects, one file per cue, e.g. `sfx/pop.mp3`, `sfx/coin.mp3`, `sfx/fizz-loop.mp3` (a seamless loop). Names in the recording script. Each replaces that generated sound. |

Any file you add is picked up at the next build (the build lists what's in `voice/` and `sfx/`, so missing files cost nothing). MP3, WAV, M4A or OGG.

Use only audio you own or have a licence for.
