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
| 6.13 | Agbero hand props | Waiting on owner | | Owner asked for planks of wood; flagged brand risk, alternatives offered. |
| 6.14 | Bus-roof running via ramps | To do | | Last in the owner's order. |
| 6.15 | Voice-over | Waiting on owner | | Drop `public/audio/agbero-1..6.mp3`; placeholders until then. |
| 6.16 | Spark 10C tuning (owner) | **Next** | | Owner: lag steady after 6.17, double-tap OK. Next: re-test the new intro, song sync and pace. |
| 6.17 | Lag + bottle-in-hand glitch | Done | 2026-10-20 | Scenery scrolls once per frame (was every collision sub-step); no per-frame allocations; chase resolution capped (HD 1.5×, LITE 1×); mid-chase guard drops to LITE if fps < 40 for 3 s; lighter music arrangement on LITE. Menu idle is now a still frame (the looping idle made the hand twitch); the held bottle draws opaque (no transparency sorting flicker). Needs owner re-test on the Spark 10C. |
| 6.18 | Pulse Mode (replaces Fizz Boost) | Done | 2026-10-20 | States EMPTY → CHARGED → ACTIVATING → SURGING → ENDING. 50-cap meter, PULSE READY + glow + charge sound. Double-tap / B → shockwave rings (`src/game/pulse.ts`, pooled additive shader), camera jolt, flash, bass + fizz; agberos knocked back; obstacles within 32 m cleared once; caps pulled in. 8 s surf with rings at the feet, foam, magnet, beat lighting, sub-bass music layer; landing zone cleared + 1 s grace. LITE: fewer rings, no burst, half foam. Headless acceptance test: `tools/test-pulse.mjs`. |
| 6.19 | New intro: SAME TASTE. NEW LOOK. | Done | 2026-10-20 | Owner: replace the shake story. Title + live 3D bottle (yellow cap, drag to spin with inertia, tip, slow auto-turn) with a fridge-cold look (`src/scene/chill.ts`: mist + drip trails + beads; wet clear-coat on HD) + PLAY beneath. PLAY starts the theme; the bottle rockets up on its beat into the motor park. Shake/dodge/peel code removed. The chase builds behind the intro. |
| 6.20 | Theme song + beat sync | Done | 2026-10-20 | Owner's theme (`public/audio/theme.mp3`): 155.76 BPM, first beat 0.320 s, loops on 16-beat phrases. Chase stepped by song time; rows reach the runner on the beat (every 4 beats, 3 from 2,000 m); caps on 16th notes; Pulse rings on the beat; theme ducks on game over. Speed lowered (owner: "a bit fast"): 17 → 24 m/s. Headless sync check: every row due exactly on its beat. |
| 6.21 | Pulse on the ground | Done | 2026-10-20 | Owner: no foam, no floating; just pulse, clear and keep running. Release shockwave, then a ring from the feet on each of 16 beats clearing 26 m ahead. Foam trail removed. |

## Backlog (v1.1)
- Video version for phones below the Spark 10C.
- Real recorded/licensed sound design (Howler.js).
- Phone-shake tuning.

## Owner to-do
- [ ] Rename the Vercel project or domain so it doesn't contain "pepsi" (e.g. `dontshakeme`).
- [ ] Create a free Umami or PostHog account for story events and add its key as a Vercel environment variable.
