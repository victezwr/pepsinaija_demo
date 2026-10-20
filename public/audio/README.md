# Chase audio you can replace

Without these files the game falls back to sounds generated in code.

| File | What it does |
|---|---|
| `theme.mp3` | The theme song. Starts on PLAY and loops under the whole game. **The game is timed to it**: the beat grid (155.76 BPM, first beat at 0.320 s, loop points) is set at the top of `src/audio/music.ts`. If you swap the song, re-measure those numbers. Without the file, a generated loop plays instead. |
| `agbero-1.mp3` … `agbero-6.mp3` | Agbero shouts, picked at random (pitch varies a little each time so it sounds like different men). Record short, angry pidgin lines, about 0.5–1.5 s each: "Oya!", "Hold am!", "Where you dey go?!", "Bring am come!", "Na our own be dat!", "Stop there!". |

Use only audio you own or have a licence for.
