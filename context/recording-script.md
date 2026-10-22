# Recording script: THE YELLOW CHASE

Everything you can record to replace the sounds the game makes in code. Record any of them, in
any order: each file you add replaces just that one sound, and anything you haven't recorded
keeps its generated version.

There are **6 voice lines** (Part 1) and **23 sound effects** (Part 2). The theme song is music, not covered here (it's already `public/audio/theme.mp3`).

---

## How to record

- **Where:** a quiet room with soft things around (a wardrobe of clothes, a bedroom with curtains).
  No echo: the game adds its own space. A phone's voice-memo app is fine, held 15–20 cm from the
  mouth (or the object), slightly off to the side so breath doesn't pop.
- **Format:** MP3 (or WAV / M4A / OGG), mono is fine. 44.1 or 48 kHz.
- **Trim tight:** cut the silence before and after. The game plays a file the instant the moment
  happens, so any silence at the start makes it late.
- **Level:** loud and clean but never clipping (the loudest peak a little under the top).
  No music, no background noise, no effects.
- **Takes:** do 3–4 takes of each and keep the best one.
- **Length:** each item says how long it should be. Lines over their length get cut off by the
  next thing on screen.
- **Rights:** only use your own recordings, or voices of people who agreed to it.

**Where the files go:** voice lines in `public/audio/voice/`, sound effects in
`public/audio/sfx/`, named exactly as in the tables
(lower case, with the dashes). Then commit and push: the next deploy picks them up. Or send them
to me and I'll put them in.

---

## Part 1: Voice lines (`public/audio/voice/`)

Optional. The lines show as speech bubbles either way; there are no generated voices. A line is
only heard once its recording is added.

**The cast**
- **THE CHAIRMAN (the lead agbero):** the big one. Older, slow and sure of himself, a deep voice used to being obeyed. Lagos Pidgin. Greedy and amused, until the cap scares him at the end. On screen his lines are labelled AGBERO or CHAIRMAN.
- **AGBEROS:** two or three of the boys together (record it as a group, or layer 2–3 takes). Younger, rough, quick.

| File | Who | Line | When it plays | How to say it | Max length |
|---|---|---|---|---|---|
| `agbero-gimme.mp3` | CHAIRMAN | "Afa, wetin be that wey dey shine? Gimme am ASAP!" | Street scene: your runner has just picked up the shining bottle | Curious first ("Afa, wetin be that..."), then greedy and demanding. "Gimme am ASAP!" snapped like an order | 2.8 s |
| `agberos-if-i-catch-you.mp3` | AGBEROS | "If I catch you!" | Street scene: your runner bolts with it; the chase starts | Furious, shouted after the runner as they set off | 1.5 s |
| `agbero-use-me-play.mp3` | CHAIRMAN | "You dey use me play, abi?!" | Every time you stumble and he catches up | Right on your heels, annoyed and mocking. Plays often, so short and punchy | 1.8 s |
| `chairman-wetin.mp3` | CHAIRMAN | "Ha! Wetin be that?!" | The first time you release the Pulse in a run | Shocked, thrown back by the blast | 1.5 s |
| `agberos-caught.mp3` | AGBEROS | "We don catch am!" | Game over: they catch you | Triumphant, a group cheer, slightly breathless from running | 2.4 s |
| `chairman-inside-cap.mp3` | CHAIRMAN | "Ehn? Wetin dey inside this cap sef?" | Game over: the cap rattles and sparks in his hand | Unsure, a bit spooked, looking at the bottle. Quieter than his other lines | 2.5 s |

---

## Part 2: Sound effects (`public/audio/sfx/`)

Ideas for each are in "How to make it": everyday things you can record at home. Record each one
dry and close.

### The intro bottle and the street scene

| File | When it plays | What it should sound like | How to make it | Length |
|---|---|---|---|---|
| `fizz-loop.mp3` | Loops while the intro bottle fizzes from shaking; its volume follows how hard it's shaken | Steady carbonation: the fine crackle of a freshly opened, shaken soda | Open a cold fizzy drink, pour it into a glass, hold the phone just above it. Must **loop seamlessly**: cut it so the end runs into the start with no click or jump | 3–6 s |
| `fizz-pop.mp3` | Single bubbles bursting on top of the fizz (many times, random pitch) | One tiny bubble pop / click | Close up on the fizzing glass; cut out one single crackle | under 0.1 s |
| `hiss.mp3` | The pressure building: the foam surging up after PLAY, and DON'T SHAKE ME when shaking | A rising, tightening gas hiss, getting higher | Slowly crack open a shaken bottle's cap just enough to hiss, tighten it again; or a slow "sssss" rising in pitch | 1–1.6 s |
| `pop.mp3` | The bottle blows (PLAY, or shaken too hard) | A sharp, clean pop | A finger popped out of the cheek, or a cork / tight lid off a bottle | 0.2–0.6 s |
| `cap-open.mp3` | Plays with the pop: the gas rushing out | "Psssht!": a fast gas release | Twist open a cold, shaken bottle of soda fast | 0.3–0.5 s |
| `whoosh.mp3` | The bottle rocketing up out of the intro; the SPEED UP! moments | A fast air whoosh going past | Swing a thin stick or a belt fast past the phone | 0.4–0.6 s |
| `gold-glint.mp3` | The cap shines gold in the road (street scene) | A bright, magical sparkle / glint | A few light taps on wine glasses, or a wind chime brushed once | 0.6–0.8 s |
| `catch.mp3` | The bottle hits the road, and again when your runner snatches it up | A plastic bottle smacking down / into a palm | Drop a closed plastic bottle on a hard floor; slap one into your palm | 0.1–0.2 s |
| `whistle.mp3` | The Chairman blows his whistle: the chase starts (also on RUN AGAIN) | A referee-style pea whistle, one long trilling "FEEEEW!" | A real pea whistle (sports or police type), one blast | about 0.75 s |

### The chase

These play very often, so keep them short and not too loud.

| File | When it plays | What it should sound like | How to make it | Length |
|---|---|---|---|---|
| `coin.mp3` | Grabbing a yellow cap (quick streaks climb in pitch automatically) | A small, bright, satisfying "ting" / bottle-cap click | Flick a metal bottle cap against a glass, or drop one on a plate | under 0.15 s |
| `swoosh.mp3` | Changing lanes (panned left or right automatically) | A short, airy swoosh | A quick swipe of a hand or a jacket sleeve past the mic | 0.2–0.3 s |
| `jump.mp3` | Jumping | A light "hup" of effort, or a short springy whoosh | A short "hup!" from the runner, or a quick upward swipe | 0.2–0.3 s |
| `land.mp3` | Landing after a jump | A soft thud of trainers on tarmac | Jump and land on a hard floor in trainers, phone near the floor | 0.1–0.2 s |
| `slide.mp3` | Sliding under a banner | A scrape of clothes and trainers sliding on the road | Slide a shoe or a pair of jeans across a rough floor | about 0.5 s |
| `near-miss.mp3` | Something flies past you very close (panned automatically) | A tight, fast "zip" of air past the ear | A very fast swipe of a thin stick right past the mic | 0.2–0.3 s |
| `horn.mp3` | An okada coming at you down your lane (panned to its lane) | An okada horn: two quick "pim-pim" beeps | A real motorbike horn if you can; or a bicycle horn | about 0.3 s |
| `crash.mp3` | Stumbling into something (you keep running) | A glancing knock: a body bumping a metal panel | Bump a shoulder into a metal door or a car door (gently) | 0.2–0.3 s |
| `crash-hard.mp3` | Getting caught: the full smash | A big crash: a body slamming into a danfo's side, metal ringing, maybe a crowd "ehn!" | Slam a palm hard on a metal door or bin lid; add a short group "ehn!" | 0.5–0.8 s |

### The Pulse (the Golden Cap's power)

| File | When it plays | What it should sound like | How to make it | Length |
|---|---|---|---|---|
| `pulse-charge.mp3` | The Pulse is ready (enough caps saved) | A rising fizz with a deep swell: power building up | Fizz from a shaken bottle, slowly opened, recorded close, ending on its loudest point | 0.7–0.9 s |
| `pulse-windup.mp3` | The split second after the double-tap, before the blast | A quick intake: a sharp breath in, sucked inward | A fast, sharp inhale close to the mic; or a reverse whoosh | about 0.2 s |
| `pulse-release.mp3` | The Pulse blasts out | The big one: a pressure blast with a deep bass hit and a burst of bubbles | Open a well-shaken big bottle fast right by the mic (stand back!), with a deep thump on a drum or table at the same moment | 0.6–0.9 s |
| `pulse-end.mp3` | The Pulse runs out | A fizz fading and falling away | The tail of a fizzing glass settling, or a hiss falling in pitch | about 0.7 s |

### Game over

| File | When it plays | What it should sound like | How to make it | Length |
|---|---|---|---|---|
| `cap-rattle.mp3` | The cap rattles and sparks in the Chairman's hand | A cap rattling on a bottle neck with an electric zap | Rattle a loose metal cap on a glass bottle neck, then a short static crackle (rubbing a balloon, or a lighter's click) | 0.4–0.6 s |

---

## Checklist

- [ ] Voice lines (6): agbero-gimme, agberos-if-i-catch-you, agbero-use-me-play, chairman-wetin,
      agberos-caught, chairman-inside-cap
- [ ] Intro and street scene (9): fizz-loop, fizz-pop, hiss, pop, cap-open, whoosh, gold-glint,
      catch, whistle
- [ ] Chase (9): coin, swoosh, jump, land, slide, near-miss, horn, crash, crash-hard
- [ ] Pulse (4): pulse-charge, pulse-windup, pulse-release, pulse-end
- [ ] Game over (1): cap-rattle
