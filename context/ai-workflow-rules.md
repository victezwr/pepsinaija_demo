# AI Workflow Rules

Rules for any AI assistant working on this repository. They are mandatory.

## Before starting anything
1. Read all six files in `/context`. Where they conflict, `project-overview.md` (product decisions) wins, then `architecture.md` (invariants), then the others.
2. Open `progress-tracker.md` and pick **exactly one** unit with status `Next`. If none is marked `Next`, take the first `To do` unit in the current phase and mark it `In progress`.

## One unit at a time
- A **unit** is the smallest change that can be tested on its own (e.g. "shake energy meter", "peel spring-back"). Units are listed in `progress-tracker.md`.
- Work on **only** that unit. Do not refactor, rename, restyle or "improve" anything outside it. If you notice something that needs work, add it to the tracker's **Backlog** with one line of context instead.
- If a unit turns out to be bigger than expected, split it in the tracker **before** continuing, and finish only the first part.
- Never change a **locked decision** or **system invariant** on your own. Propose the change to the owner and wait.

## Definition of done for a unit
1. Code follows `code-standards.md`.
2. `typecheck` and `build` pass, and the bundle and asset size is still within budget.
3. The smoke script reaches at least the step this unit affects. Screenshots of the affected step are checked by eye.
4. Low tier and reduced motion still work for that step.
5. Committed with a message naming the unit, and pushed to the designated branch.
6. **`progress-tracker.md` updated in the same commit:** the unit's status, date, a short note, and anything the owner must test on the Spark 10C.

## Owner involvement
- The owner tests on a **Tecno Spark 10C**. Every unit that changes feel or timing ends with a short "please test" note listing the exact thing to try and the `?fps` link.
- Owner feedback becomes new tracker units. It isn't silently folded into unrelated work.
- Ask the owner only about product decisions (copy, look, timing preferences). Decide technical details yourself and record them in the unit note.

## Never
- Add a backend, database, accounts, or third-party runtime CDN.
- Use BBNaija branding, or wording that implies the site is official or made by Pepsi.
- Call the iOS motion permission API.
- Commit secrets. Analytics keys go in Vercel environment variables (`VITE_*`), never in the repo.
- Skip the tracker update.
