# Project Overview — Pepsi Naija "DON'T SHAKE ME"

## Summary
A cinematic, browser-based, interactive 3D story starring a cold 50 cl Pepsi bottle. The visitor wakes the bottle, is warned not to shake it, shakes it anyway, and triggers a fizzy launch that reveals Pepsi's **new yellow cap**. The bottle turns mischievous and dodges the visitor. Once caught, the visitor peels off its label; the label rolls away and the screen says **"YOU MONSTER."** The bare bottle storms off and a Pepsi end card closes with **"STAY ON THE PULSE."**

It is an **unofficial concept / spec piece** by **@VOtakpor**, built **for** (not **by**) Pepsi Naija, to be posted on X and tagged @PepsiNaija.

## Audience & goal weighting
| Goal | Weight | Meaning |
|---|---|---|
| **B: Live play on phones** | 60% | Most visitors arrive from X, on Android phones, often on mobile data in Nigeria. This goal wins every trade-off. |
| **A: Shareable X clip** | 20% | A clean 9:16 screen recording made on desktop using `?director`. |
| **C: Portfolio piece** | 20% | Clean public repo plus a short "how it was made" README. |

## Measurable goals
- **Time to first interaction:** ≤ 3 MB downloaded before the silhouette screen is interactive. Interactive in ≤ 4 s on 4G.
- **Minimum device:** **Tecno Spark 10C** (Unisoc T606 / Mali-G57 MP1) runs the full story at ≥ 30 fps on the Low tier.
- **Desktop:** steady 60 fps on the High tier on a mid-range laptop.
- **Run length:** one full run takes **30–40 s**. The intro after the tap is ≤ 6 s; on replay it's ≤ 2 s.
- **Completion rate** (story tracking events, once an analytics service is connected): target ≥ 50% of `started` reach `finished`.
- **Reliability:** zero dead ends. Every step can always move forward, and replay always restores the initial state.

## Core user flow (story steps)
```
SILHOUETTE → INTRO → WARNING → SHAKING → LAUNCH → REBEL → PEEL → MONSTER → EXIT → END CARD → (replay → INTRO)
```
| # | Step | User action | System response |
|---|---|---|---|
| 0 | **Silhouette** | Taps the bottle | Unlocks audio, starts the intro and the speed test. Shows "🔊 best with sound". |
| 1 | **Intro** | — (Skip available) | Rumble, blue rim light traces the bottle, camera push-in, halftone ring fades up. ≤ 6 s. |
| 2 | **Warning** | — | "DON'T SHAKE ME." Idle sway, droplets, quiet fizz, "drag to shake" hint. |
| 3 | **Shaking** | Drags back and forth. Android: physical shake also counts. Anyone: press-and-hold. | Shake meter fills with wobble, louder fizz and a pulsing ring. Captions escalate. A single click does nothing. |
| 4 | **Launch** | — (input locked) | Pressure hiss + bulge → **blue cap bursts off** → fizz geyser → the spray rockets the bottle around the frame on a sine-wave path, shrinking into the distance and growing back → capless landing → **the new yellow cap drops in and screws on.** |
| 5 | **Rebel** | Tries to touch or catch the bottle | "HUMANS CAN BE TRUSTED." The bottle dodges, always staying on screen. **Exactly 3 dodges**, then it gives up. |
| 6 | **Peel** | Grabs the label and drags | The label edge flaps as a cue. The label curls off following the drag. Released < 60%: springs back. ≥ 60%: finishes by itself. |
| 7 | **Monster** | — | The label rolls/flicks away → beat of silence → **"YOU MONSTER."** |
| 8 | **Exit** | — | The bare bottle springs out of frame, offended. Short pause. |
| 9 | **End card** | Replay | Logo in the halftone ring, "STAY ON THE **PULSE**", credit line, Replay button. |

### Helping stuck users
- Warning: hint pulses at 6 s; at 12 s the bottle starts trembling by itself.
- Rebel: a "try to catch it" hint after 8 s.
- Peel: the label edge flaps until it's grabbed.

### Inputs
- **Shaking:** drag is the main control everywhere. **Android** physical shake is a silent bonus (no pop-up). **iOS:** drag only, and the motion-permission pop-up is never shown. Press-and-hold is an accessibility alternative.
- **Dodges:** desktop, pointer coming close to the bottle; touch, tapping on or near the bottle.

## In scope (v1)
- The full story above, with placeholder sounds generated in code.
- Quality levels **High** and **Low**, chosen by a speed test during the intro. Overrides: `?lite`, `?director`, `?fps`.
- Fixed bottle model with separate Bottle, Cap and Label parts. Label small print replaced with concept text.
- Captions/visual cues so the story works muted. Mute, Skip, Replay buttons.
- Reduced-motion mode.
- Still-image fallback when WebGL or the model fails.
- Permanent "Unofficial concept by @VOtakpor" tag, plus a credit line on the end card.
- Analytics: Vercel Web Analytics page views, plus a `track()` layer for story events. Custom events need a non-Vercel provider on the free plan (see architecture).
- Hosting on Vercel, auto-deployed from GitHub.

## Deferred to v1.1
- **Video version** for phones below the Spark 10C (a pre-recorded clip with tap-to-continue moments).
- Professionally recorded and licensed sound design to replace the placeholders.
- Phone-shake tuning beyond the basic threshold.

## Out of scope (strict)
- Backend, database, accounts, user profiles, leaderboards, comments.
- E-commerce, giveaways, promotions, or anything implying a real Pepsi campaign.
- **Any BBNaija/MultiChoice branding** on the site.
- A domain or site wording that says "by Pepsi" or "official". The credit always says **"for @PepsiNaija"**.
- Liquid simulation, physics-solver stickers, multiplayer, VR/AR, native apps, multi-page navigation.
- The iOS motion-permission pop-up.

## Locked decisions
| Decision | Value |
|---|---|
| Product | 50 cl plastic bottle (not a can) |
| Peel target | The real label. The bare cola bottle underneath is the punchline. |
| Cap story | Starts **blue** (old cap) and turns **yellow** at the landing (Pepsi's new branding) |
| Closing line | **STAY ON THE PULSE** |
| Logo | Official circle-mark SVG supplied by the owner (`assets/source/pepsi-logo.svg`) |
| Credit | "Unofficial concept by @VOtakpor" (permanent corner tag + end card) |
| Domain | Owner-branded, e.g. `dontshakeme.vercel.app`. No "pepsi" in the domain. |
| Test device | Owner's Tecno Spark 10C, tested continuously |
