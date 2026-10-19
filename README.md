# DON'T SHAKE ME

An interactive 3D story about a cold Pepsi bottle that really doesn't want to be shaken.

> **Unofficial concept / spec project** by [@VOtakpor](https://x.com/VOtakpor) for @PepsiNaija. Not affiliated with or endorsed by PepsiCo.

Wake the bottle → ignore the warning → shake it → watch the new **yellow cap** land → try to catch it → peel its label → **YOU MONSTER.** → STAY ON THE PULSE.

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
| Audio | Placeholder sounds generated with the Web Audio API (no audio files) |
| Hosting | Static, Vercel. No backend. |
| First load | ~1.8 MB (JS 323 KB gz + 1.17 MB model + Draco decoder) |

- **The story** lives in `src/story/director.ts`: one step at a time, each with its own GSAP timeline. `resetScene()` restores everything for replay.
- **Shake detection** (`src/input/shake.ts`) only rewards back-and-forth drags. Android phone-shake and press-and-hold also count.
- **The peel** (`src/scene/labelPeel.ts`) is an authored deformation: the label leaves the bottle tangentially and curls into a roll. No physics solver.
- **Quality tiers:** the intro doubles as a speed test and drops weaker phones to a lighter tier without anyone noticing.

Product, architecture, standards and progress are documented in [`/context`](context/).

## Assets

| Path | What it is |
|---|---|
| `assets/source/tripo-bottle-original.glb` | Original Tripo export (57 MB, merged mesh, lighting baked into the texture) |
| `assets/source/label-wrap.png` / `label-wrap-concept.png` | Flat label / same with regulatory small print replaced by concept text |
| `assets/source/pepsi-logo.svg` | Logo for the end card |
| `public/models/pepsi-bottle.glb` | Web model, 1.17 MB: separate `Bottle`, `Cap`, `Label` |

Rebuild the web model: `cd tools && npm install && npm run fix-model`. The model script simplifies the mesh, removes the baked lighting from the texture, smooths the crinkled plastic, splits off the cap, wraps the label on its own cylinder, and compresses everything (Draco + WebP).

Walkthrough test: `npm run build && npx vite preview`, then `node tools/smoke.mjs http://localhost:4173 ./shots 390 844`.
