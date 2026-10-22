# THE YELLOW CHASE

SAME TASTE. NEW LOOK. A cold Pepsi bottle with the new yellow cap you can spin in 3D, then an endless runner through a Lagos street set to the theme song.

> **Unofficial concept / spec project** by [@VOtakpor](https://x.com/VOtakpor) for @Pepsi_naija. Not affiliated with or endorsed by PepsiCo.

**SAME TASTE. NEW LOOK.** over the fridge-cold bottle (drag to spin it; shake it long enough and it blows) → or **PLAY**: a cinematic (the Golden Cap wakes, DON'T SHAKE ME, POP) → **WHO CATCHES IT?** (pick your runner) → the motor park (the Chairman wants it, "Na drink I come buy!") → **The Yellow Chase** to the theme song: outrun the agberos, grab yellow caps (saved across runs), release the Golden Cap's Pulse once you've saved 2,000 (then 4,000, 6,000...) → STAY ON THE PULSE.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run typecheck
```

URL flags: `?fps` (frame counter), `?lite` (force low quality), `?director` (force max quality for screen recording), `?debug` (test hook for the walkthrough).

## How it's built

| | |
|---|---|
| Stack | Vite · React 18 · TypeScript · Three.js via React Three Fiber · GSAP · Zustand |
| Audio | Theme song `public/audio/theme.mp3` (the clock the game is timed to) + sound effects generated with the Web Audio API |
| Hosting | Static, Vercel. No backend. |
| First load | ~1.8 MB (JS 323 KB gz + 1.17 MB model + Draco decoder) |

- **The intro and cinematic** live in `src/story/director.ts` (around the bottle: the shake build-up in `buildPressure`, PLAY's cinematic in `play`, the runner pick in `choose`) and `src/game/world.ts` (`revealStep`, motor park). SKIP works from either half. The shake tuning is `SHAKE` in `src/config.ts`.
- **Generated score** (`src/audio/score.ts`): dùndún talking drum, agogo, trumpet and brass, tuned to the theme, for the cinematic and the distance-based intensity layers. The cold look (mist, drip trails, beads, wet clear-coat) is `src/scene/chill.ts` + `condensation.ts`.
- **Beat sync** (`src/audio/music.ts`): the theme is decoded before the first tap, erupts at the end of the cinematic (or on SKIP) and loops on whole 16-beat phrases (seam crossfaded over a beat). `beat()` gives the song position in beats (124 BPM); the chase world is stepped by song time, obstacle rows are placed to reach the runner exactly on a beat, caps fall on 16th notes and the Pulse rings fire on the beat.
- **Quality tiers:** the intro doubles as a speed test and drops weaker phones to a lighter tier; the chase keeps measuring and drops to LITE if it sags.

Product, architecture, standards and progress are documented in [`/context`](context/).

## Assets

| Path | What it is |
|---|---|
| `assets/source/tripo-bottle-original.glb` | Original Tripo export (57 MB, merged mesh, lighting baked into the texture) |
| `assets/source/label-wrap.png` / `label-wrap-concept.png` | Flat label / same with regulatory small print replaced by concept text |
| `assets/source/pepsi-logo.svg` | Logo for the end card |
| `public/models/pepsi-bottle.glb` | Web model, 1.17 MB: separate `Bottle`, `Cap`, `Label` |

Rebuild the web model: `cd tools && npm install && npm run fix-model`. The model script simplifies the mesh, removes the baked lighting from the texture, smooths the crinkled plastic, splits off the cap, wraps the label on its own cylinder, and compresses everything (Draco + WebP).

Game assets (`assets/source/game/` → `public/game/`): `cd tools && npm install && node prep-game.mjs ../assets/source/game ../public/game`. The low-poly bottle the runner carries: `node make-chase-bottle.mjs ../public/models/pepsi-bottle.glb ../public/game/bottle-chase.glb`.

Walkthrough tests: `npm run build && npx vite preview`, then `node tools/smoke-game.mjs http://localhost:4173 ./shots 390 844` (intro → spin → PLAY → chase → Pulse → game over → run again). Pulse Mode acceptance checks: `node tools/test-pulse.mjs http://localhost:4173 ./shots male` (add `lite` for LITE). Beat sync: `node tools/test-pulse.mjs http://localhost:4173 ./shots male sync`. Cinematic + SKIP: `node tools/test-cinematic.mjs http://localhost:4173 ./shots`. Story during play (lines only on stumbles and the first Pulse, milestones, music layers, Pulse cost, game-over payoff, mute): `node tools/test-story.mjs http://localhost:4173 ./shots`. Shaking the intro bottle (slosh → fizz → foam → blow → pick → run): `node tools/test-shake.mjs http://localhost:4173 ./shots phone` (or `drag`).

Recorded sounds and voices: see [`context/recording-script.md`](context/recording-script.md) for what to record and the file names; drop files in `public/audio/voice/` and `public/audio/sfx/`.
