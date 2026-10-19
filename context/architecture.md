# Architecture

## System boundary
The product is a **static single-page site**. There is no server code, no database and no user data at rest.

```
┌──────────── Browser (the whole product) ────────────┐
│  React UI overlay  ◄──►  Story state (Zustand)      │
│          ▲                     ▲                    │
│          │                     │                    │
│  Input layer ──► Director (GSAP timelines) ──► 3D scene (R3F/Three.js)
│  (pointer, motion,             │                    │
│   keyboard)                    └──► Audio (Web Audio)│
│                                 └──► track() ──────────────► Analytics provider
└──────────────────────────────────────────────────────┘
          ▲  static files (HTML/JS/GLB/fonts/poster)
          │
     Vercel CDN  ◄── auto-deploy ── GitHub (victezwr/pepsinaija_demo)
```

## Tech stack
| Layer | Choice | Notes |
|---|---|---|
| Build / dev | **Vite 5 + React 18 + TypeScript** | Single page at the repo root. Output `dist/`. |
| 3D | **Three.js** via **@react-three/fiber 8** | One `<Canvas>`. Scene objects are driven imperatively through refs. |
| Animation | **GSAP 3** | Authored timelines for every story step. Direct Three.js transforms for per-frame input response. |
| State | **Zustand** | Single store: current step, quality tier, mute, captions, counters. |
| Audio | **Web Audio API** (placeholder sounds generated in code) | Howler.js is added only when real audio files are introduced (v1.1). |
| Model loading | `GLTFLoader` + `DRACOLoader` with a **self-hosted** decoder at `/draco/` | No third-party CDN at runtime. |
| Background ring | 2D `<canvas>` behind a transparent WebGL canvas | Cheaper than a shader on low-end GPUs. |
| Fonts | Google Fonts: **Archivo** (`wdth 125, wght 900` for headlines) | Free match for Pepsi's wide, heavy display style. |
| Analytics | `@vercel/analytics` (page views) + an internal `track()` wrapper | Vercel **custom events need Pro**, so story events go to a free provider (Umami Cloud or PostHog) once keys exist. Until then `track()` is a no-op in production and logs in dev. |
| Hosting | **Vercel** (Hobby), Git integration | The production branch is the repo's default branch. |
| Asset pipeline | `tools/` (Node + gltf-transform + sharp, Python + Pillow) | Fully reproducible from `assets/source/`. |

## Storage model ("hybrid" = three places data lives)
| Where | What | Lifetime |
|---|---|---|
| **Static files (CDN)** | JS bundle, `pepsi-bottle.glb`, Draco decoder, poster image, logo SVG | Immutable per deploy |
| **Browser memory** | Story step, shake energy, dodge count, peel progress, quality tier | One page session; reset on replay |
| **localStorage** (optional, wrapped in try/catch) | Mute preference, "has finished once" (enables the short intro) | Per device; can be lost at any time without breaking anything |
| **Analytics provider** | Anonymous events: `started`, `shook`, `launched`, `peeled`, `finished`, `replayed`, `quality_drop`, `fallback` + tier | Provider retention. No personal data, no cookies. |

## Module layout
```
src/
  main.tsx, App.tsx
  state/store.ts            Zustand store; the only source of truth for the current step
  story/director.ts         Step transitions + GSAP timelines (intro, launch, dodge, peel, exit, reset)
  scene/Experience.tsx      Canvas contents: camera rig, lights, environment
  scene/Bottle.ts           Loads the GLB, prepares materials, exposes Bottle / Cap / Label handles
  scene/labelPeel.ts        CPU deformation of the label cylinder from peel progress
  scene/fizz.ts             Particle burst
  scene/condensation.ts     Droplet normal map + sliding droplets (High tier)
  input/shake.ts            Drag + device-motion + hold → shake energy
  input/pointer.ts          Screen-space hit test, dodge proximity, peel drag
  audio/sfx.ts              Web Audio sounds generated in code, master gain/mute
  quality/tier.ts           Frame-rate sampling, tier choice, URL overrides
  analytics/track.ts        Provider-agnostic event wrapper
  ui/                       Overlay text, captions, buttons, end card, fallback
public/
  models/pepsi-bottle.glb   Built by tools/ from assets/source/
  draco/                    Decoder files copied from three/examples
  poster.webp, logo.svg
```

## Asset pipeline
1. `assets/source/tripo-bottle-original.glb`: Tripo export (57 MB, one merged mesh, lighting baked into the texture).
2. `tools/scrub-label.py`: `label-wrap.png` → `label-wrap-concept.png` (bottler address, NAFDAC number and barcode replaced with concept text).
3. `tools/fix-model.mjs`: simplify → de-light the texture → split **Cap** → add **Label** cylinder (r ≈ 0.1336, y ≈ 0.28–0.57, logo facing +Z) → Draco + WebP. Target **≤ 2 MB**.

Model units: bottle height ≈ 0.98, max radius ≈ 0.15, base at y = 0, logo faces +Z.

## Quality tiers
| | High | Low |
|---|---|---|
| Pixel ratio | min(devicePixelRatio, 2) | 1–1.25 |
| Fizz particles | 300 | 80 |
| Sliding droplets | yes | no (normal map only) |
| Environment reflections | full | reduced |

Selection: sample the frame rate for ~2 s during the intro. Below 45 fps on High → drop to Low. Overrides: `?lite` forces Low, `?director` forces High plus max pixel ratio, `?fps` shows a counter.

## System invariants (must always hold)
1. **Exactly one active step**, held in the store. All transitions go through `director.goTo(step)`; nothing else changes the step.
2. **Input is locked during authored timelines** (intro, launch, monster, exit). Input handlers check the step and ignore everything else.
3. **The launch can fire only once per run.** Re-entering the shake step requires `reset()`.
4. **Replay restores all of the following:** bottle transform, cap = blue, label geometry and visibility, particles, camera, ring, captions, counters, audio loops.
5. **The bottle stays in view while dodging.** Dodge targets are clamped to the visible frustum minus a margin.
6. **The story never needs sound.** Every sound cue has a visual or caption equivalent.
7. **The story never needs a WebGL-capable device.** If WebGL or the model fails, show the poster and end card.
8. **No hover-only interactions.** Every hover action has a tap equivalent.
9. **The iOS motion-permission prompt is never called.**
10. **The credit tag is always visible**, and nothing on the site claims to be official.
11. **The first-interaction payload stays ≤ 3 MB.**
