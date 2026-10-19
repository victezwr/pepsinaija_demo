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

## Phase 1 — System Setup
| # | Unit | Status | Notes |
|---|---|---|---|
| 1.1 | Vite + React + TS + R3F scaffold at the repo root; Vercel builds it | Next | |
| 1.2 | Rebuild model to budget (≤ 2 MB: WebP textures, smoothed normals, concept label) → `public/models/` | To do | Also fixes the crinkled-plastic look. |
| 1.3 | Scene: black stage, camera framing (portrait + landscape), lights, environment, bottle materials | To do | |
| 1.4 | Halftone ring (2D canvas) + fonts + overlay layout + credit tag | To do | |
| 1.5 | Store + director skeleton with all steps and `reset()` | To do | |
| 1.6 | Quality tiers + `?lite` / `?director` / `?fps` | To do | |
| 1.7 | WebGL/model failure fallback + poster | To do | |

## Phase 2 — Intro → Launch
| # | Unit | Status | Notes |
|---|---|---|---|
| 2.1 | Silhouette + tap to unlock audio | To do | |
| 2.2 | Intro timeline (≤ 6 s, 2 s on replay) + Skip | To do | |
| 2.3 | Warning idle + stuck-user hints | To do | |
| 2.4 | Shake energy: drag, Android motion, hold | To do | |
| 2.5 | Launch timeline + fizz particles + blue → yellow cap reveal | To do | |

## Phase 3 — Personality
| # | Unit | Status | Notes |
|---|---|---|---|
| 3.1 | Dodges (exactly 3, clamped to view) | To do | |
| 3.2 | Label peel deformation + drag + spring-back | To do | |
| 3.3 | Label roll-away + silence + YOU MONSTER | To do | |
| 3.4 | Exit + end card + replay | To do | |

## Phase 4 — Sound & polish
| # | Unit | Status | Notes |
|---|---|---|---|
| 4.1 | Web Audio placeholder sounds + mute + captions | To do | |
| 4.2 | Condensation (normal map + sliding droplets on High) | To do | |
| 4.3 | Reduced-motion variants | To do | |
| 4.4 | Analytics `track()` + Vercel page views | To do | Custom events need a free provider (Umami/PostHog). Owner to create the account. |

## Phase 5 — QA & publish
| # | Unit | Status | Notes |
|---|---|---|---|
| 5.1 | Playwright smoke walk-through of every step | To do | |
| 5.2 | Spark 10C tuning pass (owner) | To do | |
| 5.3 | Custom domain/project name without "pepsi" | To do | Owner action in Vercel. |
| 5.4 | Record the 9:16 X clip with `?director` | To do | |

## Backlog (v1.1)
- Video version for phones below the Spark 10C.
- Real recorded/licensed sound design (Howler.js).
- Phone-shake tuning.

## Owner to-do
- [ ] Rename the Vercel project or domain so it doesn't contain "pepsi" (e.g. `dontshakeme`).
- [ ] Create a free Umami or PostHog account for story events and add its key as a Vercel environment variable.
