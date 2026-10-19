# Code Standards

> This project uses **Vite + React + React Three Fiber**, not Next.js. There is no App Router, no server components and no API routes. The rules below replace the Next.js section of the original template.

## TypeScript
- `strict: true`. No `any`. Use `unknown` and narrow it. Don't silence the compiler with `// @ts-ignore`; use `@ts-expect-error` with a reason only when a third-party type is wrong.
- Story steps are a **string union**, never loose strings:
  `type Step = 'silhouette' | 'intro' | 'warning' | 'shaking' | 'launch' | 'rebel' | 'peel' | 'monster' | 'exit' | 'end'`.
- Use `switch` on `Step` with an exhaustive `never` check.
- Exported functions have explicit return types. Use `type` for unions and props, `interface` for object contracts shared across modules.
- Tunable numbers (thresholds, durations, distances) live in `src/config.ts` as named constants. Don't scatter magic numbers.
- Units: Three.js world units (the bottle is ≈ 0.98 tall), seconds for GSAP, milliseconds only for `performance.now()` math. The unit goes in the name where it's ambiguous (`dodgeCooldownMs`).

## React / R3F
- React renders **structure**: the canvas, overlay text, buttons. **Per-frame motion never goes through React state.** Use refs, `useFrame`, or GSAP on Three.js objects.
- Components read from Zustand with **narrow selectors** (`useStore(s => s.step)`), never the whole store.
- Never create Three.js objects in render bodies. Use `useMemo`/`useEffect` and dispose in cleanup (geometry, material, texture).
- Keep a single `<Canvas>`. Use `frameloop="always"` only while animating; demand mode is allowed on the end card.
- Pointer handling goes through `src/input/*`, not R3F mesh events. Raycasting the high-poly bottle is too expensive on low-end devices, so hit tests are done in screen space.

## Animation (GSAP)
- Each story step has one timeline factory in `story/director.ts` that returns a `gsap.core.Timeline`.
- Every timeline is **killed** before a new step starts and on `reset()`. No orphan tweens.
- Respect `prefers-reduced-motion`: each factory takes `reducedMotion: boolean` and produces a calmer variant.

## Error handling
- **Model load failure, WebGL context failure or context loss** → set `fallback = true` in the store and render the poster + end card. Never show a blank screen.
- Audio: wrap `AudioContext` creation and `resume()` in try/catch. If audio fails, keep going silently and show captions.
- Storage: every `localStorage` access goes through a helper that catches errors.
- `track()` must never throw and never block. Fire-and-forget.
- No `console.log` in committed code except behind `import.meta.env.DEV`.

## Performance rules
- No per-frame allocations in `useFrame` (reuse vectors and arrays).
- Particles use one `Points` / `InstancedMesh`; never one mesh per particle.
- New assets must fit the budget in `architecture.md`. Check `dist/` size on every build.

## Naming & files
- Components `PascalCase.tsx`; modules `camelCase.ts`; constants `SCREAMING_SNAKE_CASE` in `config.ts`.
- One concern per file; split anything over ~250 lines.
- Comments explain **why**, not what.

## Checks before every push
1. `npm run typecheck` (tsc --noEmit) passes.
2. `npm run build` passes, and the size of `dist/` is reported.
3. A Playwright smoke script walks every step headless and saves screenshots.
4. The diff is re-read for dead code, magic numbers and leftover debug output.

## Git
- Work on the designated branch. Use small commits named after the unit (`peel: spring-back below threshold`).
- Never commit `node_modules/` or `dist/`. Generated assets in `public/models/` are committed, because they're built by `tools/`.
