# Walkthrough: THE YELLOW CHASE

What a visitor experiences today on https://dontshakeme.vercel.app, from the first screen to the
game-over screen. Unofficial concept by @VOtakpor for @Pepsi_naija.

---

## Part 1: The intro

### 1. Same taste, new look
- Black screen. The Pepsi bottle with the **new yellow cap** spins in as the light comes up, with the blue halftone ring behind it.
- On screen: **SAME TASTE.** (white) / **NEW LOOK.** (yellow) above the bottle.
- The bottle looks **straight out of the fridge**: misted plastic, a fogged label with clear trails where drops have run down, water beads all round, and (on HD) a wet gloss and beads slowly sliding down.
- It's a **live 3D model**: drag anywhere to spin it (flick it and it coasts), drag up or down to tip it a little. Left it alone, it turns slowly on its own. Arrow keys spin it on a computer.

### 2. PLAY
- **PLAY** sits beneath the bottle, with "best with sound".
- **Tap PLAY** (or Enter / Space): the **theme song starts**. The bottle squats and spins up to face you, and **on the song's beat** it rockets up out of the frame with a burst of fizz.

---

## Part 2: The Yellow Chase (the game)

### 5. Motor park (main menu)
- A warm flash, then a Lagos motor park at sunset. The bottle falls out of the sky and **lands in your runner's hand**, two beats later. The theme keeps playing.
- Your runner stands beside a parked yellow **danfo**, holding the Pepsi.
- Behind them, three **agberos** stare at the yellow cap: the **Chairman** (biggest, yellow singlet) and his boys (red, green). The Chairman says **"Ah-ah! Yellow cap?!"**
- On screen:
  - **THE YELLOW CHASE**
  - **Choose your runner:** male or female
  - **TAP TO POP & RUN**
  - Control hints: swipe to dodge · double-tap to pulse
  - Your best distance (after your first run)

### 6. The start
- **Tap.** *Psssht*: the cap twists open.
- The Chairman shouts **"Oya hold am!"** and blows his **whistle**. The boys shout and give chase.
- The camera swings round behind your runner and the chase begins, to the theme song.

### 7. The run
An endless run down a three-lane Lagos street lined with shops, balconies and electric poles.

**Controls**

| Phone | Computer | Move |
|---|---|---|
| Swipe left / right | ← → or A / D | Change lane (with a swoosh) |
| Swipe up | ↑, W or Space | Jump |
| Swipe down | ↓ or S | Slide (body thrown back, feet first). Mid-air, this slams you down into a slide. |
| Double-tap | B | Release the Pulse (when the meter is full) |

**Obstacles**

| Obstacle | How to beat it |
|---|---|
| Danfo bus, keke | Change lane |
| Okada | Change lane. **They ride towards you**, and you hear a *pim-pim* horn from their lane first. |
| Concrete barrier with cones, sachet-water table | Jump |
| Banner on poles | Slide under |

Every row of traffic always leaves you a way through. **Rows reach you on the beat of the theme song**: one every 4 beats at first, every 3 beats from 2,000 m.

**Collectibles:** lines of **yellow Pepsi caps**, some arcing over the jumps. They're spaced one per 16th note of the song, so a streak of chimes runs in time with it, climbing in pitch.

**Speed:** 17 m/s, stepping up at **500 m, 1,200 m, 2,000 m and 3,000 m** ("SPEED UP!") to 24 m/s. The song keeps its own tempo.

**On screen during the run:** distance in metres and speed stage (top left), caps and the **PULSE** meter (top right).

### 8. The agberos
- They run right behind you, shouting pidgin in speech bubbles: "Hold am!", "Where you dey go?!", "Oya drop am!", "Bring that Pepsi come!", "Stop there!"
- After a few seconds they drop back out of view, until you make a mistake.

### 9. Stumbles and getting caught
- **Clip the side of something** and you **stumble**. The **Chairman surges right up behind you**, reaching for the Pepsi: **"Oya drop am!"**
- **A second stumble within 4 seconds**, or **running head-on into anything**, and you're caught.

### 10. Pulse Mode
- **Charging:** every cap fills the **PULSE** meter. It throbs faster as it fills. At **50 caps** it turns electric blue and reads **PULSE READY** ("double-tap" underneath), a rising fizz-and-bass sound plays, a blue ring breathes on the road under your runner, and the bottle in their hand glows.
- **Release (double-tap, or B on a computer):** **RELEASE THE PULSE.**
  - Concentric electric-blue shockwave rings with a white-hot core race out across the road, with a short camera jolt, a quick blue flash and a deep bass drop with a fizzy release.
  - The agberos are blown back and stagger.
  - Traffic and barriers just ahead are flung aside (each one only once).
  - Caps ahead fly straight to you.
- **Then you keep running.** No floating, no foam: for **16 beats** (one phrase of the song, about 6 seconds) a ring pulses out from your feet **on every beat**, flinging away anything within about 26 m ahead, while caps keep flying to you and the street light pulses with it. A sub-bass thump joins the song on each beat. **STAY ON THE PULSE** shows under the score. Nothing can hit you, and you can still change lanes, jump and slide.
- After the last ring you get half a second of protection and the meter starts again from empty. Double-tapping with an empty meter does nothing.
- On **LITE**, the gameplay is identical, with fewer rings, a softer flash and no camera-facing burst.

### 11. Caught: game over
- A crash, and the crowd yells: **"We don catch am!"** The theme drops low under them.
- The camera swings round to the front for the **trophy shot**: your runner sits defeated on the road while the Chairman **holds up your Pepsi** and the boys gather round. A big **Pepsi bottle with the yellow cap** spins in the corner.
- The game-over panel shows:
  - **AGBEROS DON COLLECT AM!**
  - Your **metres**, **caps** and **best** distance
  - **RUN AGAIN**: straight back into the chase (whistle, swing, go); the song comes back up
  - **CHALLENGE FRIENDS**: opens X with a ready-made post:
    > I dodged the agberos for 1,234m and grabbed 87 yellow caps with the new yellow-cap Pepsi @Pepsi_naija! Can you beat my score? #PepsiYellowChase
    >
    > https://dontshakeme.vercel.app
  - **STAY ON THE PULSE** with the Pepsi logo
  - **Watch the intro again**: back to SAME TASTE. NEW LOOK.

---

## Always on screen
- **LITE / HD** (top left): lighter graphics for slower phones. Weak phones switch to it automatically.
- **Speaker** (top right): mute/unmute, remembered for your next visit.
- **"Unofficial concept by @VOtakpor"** (bottom left).

## Placeholders, to be replaced
- **Agbero voices:** generated in code until the voice-over is recorded (`public/audio/agbero-1.mp3` … `agbero-6.mp3`).
- **Music:** the owner's theme song (`public/audio/theme.mp3`). Swapping it means re-measuring the beat grid in `src/audio/music.ts`.
- **Agbero hand props:** pending a decision.
- **Running on the danfo roofs via ramps:** planned, not built yet.
