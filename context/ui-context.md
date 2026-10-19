# UI Context

Design guidelines, layout behaviour and design tokens. No code. Visual reference: Pepsi's current site hero, "STAY ON THE **PULSE**" over a blue halftone ring on pure black.

## Principles
- **Every effect serves the joke.** If it doesn't move the story forward or sharpen the timing, cut it.
- **The bottle is the interface.** No tutorial walls. Hints are one short line, and only when the visitor is stuck.
- **Black, blue, white, then yellow.** The yellow cap is the only warm colour until the end card, so it reads as the payoff.
- **Phones first.** Design at 360×800 (Spark 10C), then scale up to desktop.

## Colour tokens
| Token | Value | Use |
|---|---|---|
| `bg` | `#000000` | Page and scene background |
| `bg-scene-tint` | `#020308` | 3D clear colour (a hair off black, for depth) |
| `pepsi-blue-electric` | `#0033FF` | Accent headline word ("PULSE", "MONSTER"), ring dots |
| `pepsi-blue-deep` | `#0E0E96` | Logo lower band, deep fills |
| `pepsi-red` | `#FF1501` | Logo only. Never used for UI. |
| `rim-blue` | `#2A6BFF` / `#5FA0FF` | 3D rim lights |
| `cap-yellow` | from the model texture (≈ `#F2C200`) | The cap reveal; nothing else is yellow |
| `text-primary` | `#FFFFFF` | Headlines |
| `text-muted` | `rgba(255,255,255,0.6)` | Hints, credit, captions |

## Typography
| Role | Font | Style | Size (mobile → desktop) |
|---|---|---|---|
| Story headline ("DON'T SHAKE ME.") | Archivo, width 125, weight 900 | Uppercase, tight tracking (−0.02em), line-height 0.9 | `clamp(36px, 10vw, 96px)` |
| End card accent ("PULSE") | Archivo, width 125, weight 900 | Uppercase, electric blue | `clamp(64px, 20vw, 200px)` |
| Hints / captions | Archivo, width 100, weight 600 | Sentence case, letter-spacing 0.04em | 14–16px |
| Credit tag | Archivo, width 100, weight 500 | 11–12px, `text-muted` |

Headlines are always **two to four words**. No paragraphs anywhere in the experience.

## Layout (portrait first)
```
┌─────────────────────────┐
│ [lite]            [🔊]  │  top bar: 44px tap targets, 16px inset
│                         │
│     DON'T SHAKE ME.     │  headline zone: top 22% of the viewport
│                         │
│          ▓▓▓            │
│          ▓▓▓  ← bottle  │  bottle ≈ 45% of viewport height, centred
│          ▓▓▓            │  halftone ring behind, ≈ 110% of min(vw, vh)
│                         │
│     drag to shake       │  hint zone: bottom 18%
│ Unofficial concept by … │  credit tag: bottom-left, 16px inset
└─────────────────────────┘
```
- **Landscape/desktop:** same vertical stack, centred column of max 720px. The bottle stays centred.
- Safe areas: respect `env(safe-area-inset-*)` for notches and gesture bars.
- The page never scrolls. While the visitor is dragging, browser gestures over the canvas are disabled (`touch-action: none` on the stage only).

## Components (behaviour, not code)
- **Silhouette screen:** the bottle shown only as a rim-lit outline. "TAP TO WAKE IT" pulses softly under it; "🔊 best with sound" is smaller below. Both fade out on tap.
- **Headline:** slams in (scale 1.15 → 1, opacity 0 → 1, 250 ms), holds, then fades out before the next headline. Only one headline is on screen at a time.
- **Hint:** fades in after a delay and pulses gently (opacity 0.4 ↔ 0.9) while the visitor is stuck. Disappears on first valid input.
- **Shake meter:** no bar. The meter is the bottle's trembling, the ring's pulse and escalating captions ("easy…" → "I'M WARNING YOU").
- **Captions (sound cues):** small italic line at the bottom, e.g. *[fizz rising]*, *[POP]*. Always shown when muted or when audio failed, otherwise hidden.
- **Buttons:** Skip (intro only), Mute, Lite toggle, Replay (end card). Text or icon with visible focus ring, minimum 44×44 px.
- **End card:** halftone ring + logo centred, "STAY ON THE" (white) over "PULSE" (electric blue), Replay button, credit line "Unofficial concept by @VOtakpor for @PepsiNaija · Not affiliated with PepsiCo".
- **Fallback:** poster still of the bottle + the end card, plus "Your browser can't run the 3D version" in muted text.

## Halftone ring
- Concentric rings of blue dots. Dots are largest and densest just outside the logo or bottle and shrink and thin outward, as in the reference.
- States: hidden (silhouette) → fades and scales in (intro) → slow breathing (idle) → pulses with shake energy → one bright flash at the landing → recentres behind the logo (end card).

## Motion
- Easing: `power3.out` for entrances, `back.out(2)` for playful bottle moves, `expo.in` for the launch, `bounce`-like custom squash for landings.
- Durations: UI 150–300 ms; bottle moves 300–600 ms; the launch arc ≈ 1.6 s total.
- **Reduced motion:** no spins, no camera shake, dodges become short slides, the launch becomes a small hop, and shaking becomes press-and-hold.
- Comedic timing: a **400–700 ms silence/stillness** before "YOU MONSTER." and before the end card.

## Copy deck
| Moment | Text |
|---|---|
| Silhouette | TAP TO WAKE IT · 🔊 best with sound |
| Warning | DON'T SHAKE ME. · *drag to shake* |
| Shaking (45% / 78%) | EASY… / I'M WARNING YOU. |
| Rebel | HUMANS CAN BE TRUSTED. · *try to catch it* |
| Dodges 2 / 3 | TOO SLOW. / NOPE. |
| After 3 dodges | …FINE. · *peel the label* (after a failed peel: *keep pulling*) |
| Punchline | YOU MONSTER. (white with electric-blue glow) |
| End card | STAY ON THE **PULSE** |
