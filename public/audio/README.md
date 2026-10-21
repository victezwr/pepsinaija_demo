# Chase audio you can replace

Without these files the game falls back to sounds generated in code.

| File | What it does |
|---|---|
| `theme.mp3` | The theme song (the chase soundtrack). Erupts at the end of the opening cinematic and loops under the whole chase. **The game is timed to it**: the beat grid (163.53 BPM, first beat at 0.234 s, loop 11.98 s → 41.33 s) is set at the top of `src/audio/music.ts`. If you swap the song, re-measure those numbers. Without the file, a generated loop plays instead. |
| (generated, `src/audio/score.ts`) | The cinematic's talking-drum groove, suspicious trumpet notes and fanfare; the chase intensity layers (agogo, brass stabs, talking-drum fills, risers, shaker) added on top of the theme at 500 / 1,200 / 2,000 / 3,000 m; the game-over trumpet. Tuned to the theme (G minor, 163.53 BPM). |
| `agbero-1.mp3` … `agbero-6.mp3` | Agbero shouts, picked at random (pitch varies a little each time so it sounds like different men). Record short, angry pidgin lines, about 0.5–1.5 s each: "Oya!", "Hold am!", "Where you dey go?!", "Bring am come!", "Na our own be dat!", "Stop there!". |

Use only audio you own or have a licence for.
