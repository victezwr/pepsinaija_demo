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
| 5.1 | Playwright walkthrough of every step | Done | `tools/smoke.mjs`: phone 390×844, desktop 1280×800, Lite 360×800 all pass. |
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
| 6.9 | Spark 10C tuning (owner) | **Next** | | fps during the chase, difficulty of each speed stage, swipe feel, how long 1000 caps takes. |

## Backlog (v1.1)
- Video version for phones below the Spark 10C.
- Real recorded/licensed sound design (Howler.js).
- Phone-shake tuning.

## Owner to-do
- [ ] Rename the Vercel project or domain so it doesn't contain "pepsi" (e.g. `dontshakeme`).
- [ ] Create a free Umami or PostHog account for story events and add its key as a Vercel environment variable.
