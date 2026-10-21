# Progress Tracker

Statuses: `Done` · `In progress` · `Next` · `To do` · `Blocked`
Rule: exactly one unit is `In progress` at a time (see `ai-workflow-rules.md`).

## Phase 0 — Asset preparation  ✅
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 0.1 | Inspect Tripo GLB | Done | 2026-10-19 | 50 cl bottle, 977k verts, single mesh, lighting baked into the texture, no label. Clean all the way round. |
| 0.2 | Fix model: simplify, de-light, split Cap, add Label | Done | 2026-10-19 | `tools/fix-model.mjs` → `assets/models/pepsi-bottle.glb` (8.4 MB). Before/after in `assets/previews/`. |
| 0.3 | Scrub label small print | Done | 2026-10-19 | `tools/scrub-label.py` → `assets/source/label-wrap-concept.png`. Bottler address, NAFDAC number and barcode replaced with concept text. |
| 0.4 | Logo SVG received | Done | 2026-10-19 | Save as `assets/source/pepsi-logo.svg`. |

## Phase 1 — System Setup  ✅
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 1.1 | Vite + React + TS + R3F scaffold at repo root | Done | 2026-10-19 | Vercel auto-detects Vite; production = default branch. |
| 1.2 | Rebuild model to budget | Done | 2026-10-19 | 1.17 MB (Draco + WebP), smoothed normals, concept label. Old 8.4 MB model removed. |
| 1.3 | Scene: stage, framing, lights, environment, materials | Done | 2026-10-19 | Translucent plastic via back/front pass; droplet normal map. |
| 1.4 | Halftone ring + fonts + overlay + credit tag | Done | 2026-10-19 | |
| 1.5 | Store + director with all steps and `resetScene()` | Done | 2026-10-19 | |
| 1.6 | Quality tiers + `?lite` / `?director` / `?fps` | Done | 2026-10-19 | Intro speed test: < 45 fps → Low. |
| 1.7 | WebGL/model failure fallback + poster | Done | 2026-10-19 | `public/poster.webp` also used as the link-preview image. |

## Phase 2 — Intro → Launch  ✅
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 2.1 | Silhouette + tap to unlock audio | Done | 2026-10-19 | |
| 2.2 | Intro timeline + Skip | Done | 2026-10-19 | ~5 s; replay ~2 s. |
| 2.3 | Warning idle + stuck-user hints | Done | 2026-10-19 | Hint 2.5 s, urgent 6 s, self-tremble 12 s. |
| 2.4 | Shake energy: drag, Android motion, hold, keyboard | Done | 2026-10-19 | Owner change: shaking is now **up and down** (vertical drag). No hint texts anywhere. |
| 2.5 | Launch + fizz + blue → yellow cap | Done | 2026-10-19 | |

## Phase 3 — Personality  ✅
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 3.1 | Dodges (3, clamped) | Done | 2026-10-19 | Owner change: line is now HUMANS CAN'T BE TRUSTED. → TOO SLOW. / NOPE. → CATCH ME IF YOU CAN. → bottle bolts into the distance. |
| 3.2 | Peel deformation + drag + spring-back | Removed from flow | 2026-10-19 | Owner: no peeling. Code is still in the repo but no longer reachable; delete when the game lands. |
| 3.3 | Roll-away + silence + YOU MONSTER | Removed from flow | 2026-10-19 | Goes with the peel. |
| 3.4 | Exit + end card + replay | Done | 2026-10-19 | |

## Phase 4 — Sound & polish
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 4.1 | Placeholder sounds generated in code + mute + captions | Done | 2026-10-19 | Captions shown when muted or when audio fails. |
| 4.2 | Condensation | Done | 2026-10-19 | Normal map everywhere; sliding beads on High only. |
| 4.3 | Reduced-motion variants | Done | 2026-10-19 | No spins or camera shake; hint says "press and hold". |
| 4.4 | Analytics | Done (waiting on owner) | 2026-10-19 | Vercel page views live. Story events go to Umami once `VITE_UMAMI_WEBSITE_ID` is set in Vercel. |

## Phase 5 — QA & publish
| # | Unit | Status | Notes |
|---|---|---|---|
| 5.1 | Playwright walkthrough of every step | Done | Story test retired with the story (6.19); `tools/smoke-game.mjs` covers intro → game. |
| 5.2 | Spark 10C tuning pass (owner) | **Next** | Open the site with `?fps`. Report: fps during idle/shake/peel, shake difficulty, dodge feel, peel feel, text size. |
| 5.3 | Vercel project/domain without "pepsi" | To do | Owner action. |
| 5.4 | Record 9:16 X clip with `?director` | To do | |

## Phase 6 — The Chase (game)  ✅ v1
| # | Unit | Status | Date | Notes |
|---|---|---|---|---|
| 6.0 | Choose game | Done | 2026-10-20 | Subway Surfers-style runner through a Lagos street, chased by agberos. |
| 6.1 | Tripo assets: 3 rigged characters + 11 props | Done | 2026-10-20 | Checked frame by frame. No slide clip from Tripo: duck uses the crouch from the jump. |
| 6.2 | Asset pipeline `tools/prep-game.mjs` | Done | 2026-10-20 | 24 MB → 4.4 MB (Draco + WebP 1K), canonical clip names, root motion locked. Preloads during the story. |
| 6.3 | Story hand-off + reveal | Done | 2026-10-20 | CATCH ME IF YOU CAN. → camera starts on the bottle atop the water tower and pulls back down the street → agberos: "Na our own be dat!" |
| 6.4 | Game card → choose runner → start | Done | 2026-10-20 | Thumbnails rendered from the models. |
| 6.5 | Runner: lanes, jump, duck, stumble, caught | Done | 2026-10-20 | Swipe or arrows/WASD. Side graze = stumble; 2nd within 4 s or head-on = caught → start over from 0. |
| 6.6 | Coins + 1000 target + speed stages | Done | 2026-10-20 | Yellow caps. Stage speeds 12 → 23 m/s at 0/200/400/600/800 coins. Tower only approaches once 1000 is reached. |
| 6.7 | Win → STAY ON THE PULSE | Done | 2026-10-20 | Bottle flies down to the runner, cheer, end card with coin count; Play again / Watch the intro again. |
| 6.8 | Walkthrough test `tools/smoke-game.mjs` | Done | 2026-10-20 | Phone + desktop. `?debug&autopilot` dodges by itself to verify the finish. |
| 6.9 | Owner feedback round 1 | Done | 2026-10-20 | Hand-off synced (bottle rockets up → lands on the tower; chase pre-built + shaders pre-compiled during the dodges, assets download from the first tap). Duck → real slide (lean back, scrape). Emojis → SVG icons. Generated Afrobeats music (or `public/audio/game-music.mp3`). SFX: jump, land, slide, crash, caught. Speed: owner OK. |
| 6.10 | Owner feedback round 2 | Done | 2026-10-20 | Panned lane-change swoosh. High-energy runner music (120 BPM + 4/stage). Agbero shouts (synth, or owner recordings `public/audio/agbero-N.mp3`) at the reveal, chase start, speech bubbles, stumble and catch. Opening speed = old stage 4 (20 m/s) rising to 29 m/s; collision sub-stepping; FOV widens with speed. |
| 6.11 | Redesign B: The Yellow Chase (endless) | Done | 2026-10-20 | Owner chose B. Story's bottle lands in the runner's hand at a motor park → idle menu (title, runner pick, TAP TO POP & RUN) → psssht + Chairman "Oya hold am!" + whistle → camera swings behind → endless run scored in metres, speed stages by distance. Okadas ride at you with a panned "pim-pim" horn. Chairman (bigger lead agbero) surges on a stumble: "Oya drop am!". Fizz meter (50 caps) → double-tap / B → 8 s Fizz Boost surfing above traffic, invincible (upgraded to Pulse Mode in 6.18). Caught → trophy shot (Chairman holds the Pepsi, hero bottle spins) + RUN AGAIN / CHALLENGE FRIENDS ON X (@Pepsi_naija, #PepsiYellowChase). 1000-cap target, tower and win flow removed. |
| 6.12 | Owner feedback: grip, outfits, fizz | Done | 2026-10-20 | Bottle parented to the right-hand bone with fingers curled round it (Mixamo finger bones, local-X curl; no re-rig needed). Agberos dressed differently: Chairman yellow, red with denim shorts, green. Fizz Boost rebuilt: eased rise/bob/glide, soft foam-puff column (custom point shader) anchored under the runner instead of sparks. |
| 6.13 | Agbero hand props | Dropped | 2026-10-21 | Owner: leave it. |
| 6.14 | Bus-roof running via ramps | To do | | Last in the owner's order. |
| 6.15 | Voice-over | Waiting on owner | | Drop `public/audio/agbero-1..6.mp3`; placeholders until then. |
| 6.16 | Spark 10C tuning (owner) | **Next** | | Owner (10-21): cinematic plays, SKIP and double-tap fine, start < 3 s; chase still lags on the Spark (fine on a slightly better phone), jumps lost at the run start. Re-test after 6.35. |
| 6.17 | Lag + bottle-in-hand glitch | Done | 2026-10-20 | Scenery scrolls once per frame (was every collision sub-step); no per-frame allocations; chase resolution capped (HD 1.5×, LITE 1×); mid-chase guard drops to LITE if fps < 40 for 3 s; lighter music arrangement on LITE. Menu idle is now a still frame (the looping idle made the hand twitch); the held bottle draws opaque (no transparency sorting flicker). Needs owner re-test on the Spark 10C. |
| 6.18 | Pulse Mode (replaces Fizz Boost) | Done | 2026-10-20 | States EMPTY → CHARGED → ACTIVATING → SURGING → ENDING. 50-cap meter, PULSE READY + glow + charge sound. Double-tap / B → shockwave rings (`src/game/pulse.ts`, pooled additive shader), camera jolt, flash, bass + fizz; agberos knocked back; obstacles within 32 m cleared once; caps pulled in. 8 s surf with rings at the feet, foam, magnet, beat lighting, sub-bass music layer; landing zone cleared + 1 s grace. LITE: fewer rings, no burst, half foam. Headless acceptance test: `tools/test-pulse.mjs`. |
| 6.19 | New intro: SAME TASTE. NEW LOOK. | Done | 2026-10-20 | Owner: replace the shake story. Title + live 3D bottle (yellow cap, drag to spin with inertia, tip, slow auto-turn) with a fridge-cold look (`src/scene/chill.ts`: mist + drip trails + beads; wet clear-coat on HD) + PLAY beneath. PLAY starts the theme; the bottle rockets up on its beat into the motor park. Shake/dodge/peel code removed. The chase builds behind the intro. |
| 6.20 | Theme song + beat sync | Done | 2026-10-20 | Owner's theme (`public/audio/theme.mp3`): 155.76 BPM, first beat 0.320 s, loops on 16-beat phrases. Chase stepped by song time; rows reach the runner on the beat (every 4 beats, 3 from 2,000 m); caps on 16th notes; Pulse rings on the beat; theme ducks on game over. Speed lowered (owner: "a bit fast"): 17 → 24 m/s. Headless sync check: every row due exactly on its beat. |
| 6.21 | Pulse on the ground | Done | 2026-10-20 | Owner: no foam, no floating; just pulse, clear and keep running. Release shockwave, then a ring from the feet on each of 16 beats clearing 26 m ahead. Foam trail removed. |
| 6.22 | Golden Cap opening cinematic | Done | 2026-10-20 | Owner spec. PLAY → ~20 s cinematic: beats A–C around the bottle (`story/director.ts`: dark → rim reveal, SOME THINGS SHOULD STAY CLOSED., trumpet; orbit, gold cap glow, ripple, DON'T SHAKE ME., music stops; tremble, POP, shockwave, launch) and D–E in the motor park (`game/world.ts` `revealStep` + camera shots: catch + gold flare, AGBERO/CHAIRMAN/YOU lines, whistle, fanfare into the theme, swing behind). SKIP/Esc from any point → valid run. Runner choice moved to the intro card; the motor-park menu phase is gone. RUN AGAIN skips the cinematic. |
| 6.23 | Story during play | Done | 2026-10-20 | Speaker-anchored bubbles (pinned with the name when off-screen); event lines with once-per-run / cooldown rules: chase start, near misses (new detection + whoosh), Pulse, Pulse end, 500/2,000/3,000 m; Golden Cap beat glow from 1,200 m. |
| 6.24 | Pulse: 8 s, timer, wind-up, bubbles | Done | 2026-10-20 | Owner chose to keep it on the ground. 21 beats (≈ 8 s), HUD timer bar (DOM, no React per frame), 0.16 s wind-up before the shockwave, pooled bubble burst. Double-tap window in config. |
| 6.25 | Nigerian arcade audio layer | Done | 2026-10-20 | `audio/score.ts` (generated, F minor, on the theme's grid): cinematic dùndún groove, trumpet notes, fanfare; chase intensity layers by milestone; game-over trumpet. New cues: reveal, gold glint, pop, near miss, Pulse wind-up, cap rattle. Theme loop moved to 19.97 → 130.91 s (no quiet dip at the seam). |
| 6.26 | Game-over payoff | Done | 2026-10-20 | Chairman claims the can → cap sparks + rattle → "Ehn? Wetin dey inside this cap sef?" → existing results/share unchanged. |
| 6.27 | New theme | Done | 2026-10-21 | Owner's second theme: 163.53 BPM (tight, 7 ms beat jitter vs 55 ms), G minor, full energy throughout. Loop beats 32 → 112 (11.98 → 41.33 s), inside the part of the screen recording that sits on the grid (it drifts ~0.15 s from ~47 s). Generated score retuned to G minor; Pulse 22 beats. Sync check: 364 rows, worst 9 ms. |
| 6.28 | Cap-follow glitch | Done | 2026-10-21 | Root cause: caps pulled by the Pulse kept scrolling with the road while being pulled in; at real frame rates they balanced ~1.6 m behind the runner, never collected (invisible headless at ~2 fps). Now: only caps ahead are pulled, they move in runner space at ≥ 30 m/s, collected within ~0.1 s. |
| 6.29 | Spark lag | Done (needs owner re-test) | 2026-10-21 | Measured (4× CPU throttle): main thread mostly idle, GPU-bound. 1) The bottle in the hand was the 153k-triangle intro model (57% of all triangles): now an 8k-triangle copy (`tools/make-chase-bottle.mjs`, 46 KB, reuses the intro textures). Triangles/frame 272k → 63k, draw calls 42 → 20. 2) First-use texture uploads (~0.1 s freezes at the run start = lost jumps): all uploaded during the pre-warm. 3) Agbero shouts rendered once offline. |
| 6.30 | Dialogue while running | Done | 2026-10-21 | Owner: no lines once running except stumbles (every time) and the first Pulse of each run. Start line, ambient shouts, near-miss lines, milestone lines and the Pulse-end line removed (near-miss whoosh kept). Cinematic and game-over lines unchanged. |
| 6.31 | Pulse cost by distance | Done | 2026-10-21 | 50 / 70 / 90 / 110 / 130 caps at 0 / 500 / 1,200 / 2,000 / 3,000 m; the meter shows have/need. |
| 6.32 | Cola + condensation in the intro | Done | 2026-10-21 | Liquid mesh (`scene/liquid.ts`): world-level surface, damped-spring slosh from spin/tilt changes, cinematic tremble/pop and Android phone gravity/shake; foam line, bubbles; fizz hiss + bubble pops by agitation. Shell made clear PET (baked cola removed, highlights kept). Condensation rebuilt from research (`scene/chill.ts`): rough milky fog, glassy lens beads with darker rims, power-law sizes larger at the bottom, wiped runs, cylindrical mapping; sliding beads on LITE too. |
| 6.33 | Pepsi branding on the street | Done | 2026-10-21 | Code-drawn billboards (logo + STAY ON THE PULSE / SAME TASTE. NEW LOOK.) on both pavements, pooled and scrolling; Pepsi print on the overhead banner obstacle. |
| 6.34 | Clean yellow cap | Done | 2026-10-21 | Owner: blue residue on the cap. Cause: the generated cap mesh has dents and a jagged lower edge (the dark-blue background showed through) and shares the bottle's texture atlas. Now rebuilt in code (`scene/cap.ts`): ridged side, rounded top, tamper ring, plain Pepsi yellow; used in the intro, the hand and the trophy shot; the clear shell is no longer drawn over it. |
| 6.35 | Spark lag, round 2 | Done (needs owner re-test) | 2026-10-21 | 1) Smooth clock: the world moves by frame time, steered onto the song (stepping by the audio clock stuttered where it ticks in 20-40 ms chunks, typical of low-end Android). 2) LITE: Lambert materials instead of PBR (bottle excepted), chase resolution 0.85, 20 building slots instead of 24 with closer fog, the crew doesn't crowd the camera at the start; the mid-run drop to LITE switches materials too. 3) Jump buffer: a swipe up up to 0.25 s before landing jumps on landing. Headless LITE chase (CPU-rendered, fill-bound like a weak GPU): 2.3 → 16 fps. Sync: worst 22 ms. |

## Backlog (v1.1)
- Video version for phones below the Spark 10C.
- Real recorded/licensed sound design (Howler.js).
- Phone-shake tuning.

## Owner to-do
- [ ] Rename the Vercel project or domain so it doesn't contain "pepsi" (e.g. `dontshakeme`).
- [ ] Create a free Umami or PostHog account for story events and add its key as a Vercel environment variable.
