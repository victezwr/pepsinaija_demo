# Walkthrough: DON'T SHAKE ME → THE YELLOW CHASE

What a visitor experiences today on https://dontshakeme.vercel.app, from the first screen to the
game-over screen. Unofficial concept by @VOtakpor for @Pepsi_naija.

---

## Part 1: The bottle story (about 30 seconds)

### 1. Wake it up
- Black screen. A Pepsi bottle stands in the dark, lit only by a faint blue rim light.
- On screen: **TAP TO WAKE IT**, with a small speaker icon and "best with sound".
- **Tap.** Sound switches on with a low rumble. Light slowly fills the bottle, the camera pushes in, and the blue halftone ring fades up behind it. (A **SKIP** button is available.)

### 2. The warning
- **DON'T SHAKE ME.** The bottle is cold and sweating, with droplets sliding down the label, and it fizzes quietly. The cap is the **old blue cap**.
- There are no instructions. If nobody touches it, it starts trembling by itself after a while.

### 3. Shake it
- **Drag up and down** on the bottle (on Android, physically shaking the phone also counts).
- The bottle wobbles harder and the fizz gets louder: **EASY…** → **I'M WARNING YOU.**
- Pressure builds, then **POP**. The bottle shoots into the air, spins and lands with a thud. The blue cap flashes into the **new yellow cap**.

### 4. The rebel
- **HUMANS CAN'T BE TRUSTED.**
- Reach for it and it dodges: **TOO SLOW.** → **NOPE.**
- After the third dodge: **CATCH ME IF YOU CAN.** The bottle rockets straight up out of the screen.

---

## Part 2: The Yellow Chase (the game)

### 5. Motor park (main menu)
- A warm flash, then a Lagos motor park at sunset. The bottle falls out of the sky and **lands in your runner's hand**.
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
- The camera swings round behind your runner and the chase begins. The music kicks in.

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

Every row of traffic always leaves you a way through.

**Collectibles:** lines of **yellow Pepsi caps**, some arcing over the jumps. Each cap chimes, and quick streaks climb in pitch.

**Speed:** starts fast and jumps up a stage at **500 m, 1,200 m, 2,000 m and 3,000 m** ("SPEED UP!"). The music speeds up with it.

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
- **The surf (8 seconds):** your runner rises on a column of cola foam and surfs above the traffic, with blue rings pulsing out from under their feet on the beat. The street light pulses, the music adds a sub-bass thump, caps keep flying in, and **STAY ON THE PULSE** shows under the score. Nothing can hit you, and you can still change lanes.
- **The landing:** the road where you'll land is cleared, you glide down, the music settles back, and you keep about a second of protection to find your feet.
- Then the meter starts again from empty. Double-tapping with an empty meter does nothing.
- On **LITE**, the gameplay is identical, with fewer rings, a softer flash, a lighter foam column and no camera-facing burst.

### 11. Caught: game over
- A crash, and the crowd yells: **"We don catch am!"**
- The camera swings round to the front for the **trophy shot**: your runner sits defeated on the road while the Chairman **holds up your Pepsi** and the boys gather round. A big **Pepsi bottle with the yellow cap** spins in the corner.
- The game-over panel shows:
  - **AGBEROS DON COLLECT AM!**
  - Your **metres**, **caps** and **best** distance
  - **RUN AGAIN**: straight back into the chase (whistle, swing, go)
  - **CHALLENGE FRIENDS**: opens X with a ready-made post:
    > I dodged the agberos for 1,234m and grabbed 87 yellow caps with the new yellow-cap Pepsi @Pepsi_naija! Can you beat my score? #PepsiYellowChase
    >
    > https://dontshakeme.vercel.app
  - **STAY ON THE PULSE** with the Pepsi logo
  - **Watch the intro again**: back to the bottle story

---

## Always on screen
- **LITE / HD** (top left): lighter graphics for slower phones. Weak phones switch to it automatically.
- **Speaker** (top right): mute/unmute, remembered for your next visit.
- **"Unofficial concept by @VOtakpor"** (bottom left).

## Placeholders, to be replaced
- **Agbero voices:** generated in code until the voice-over is recorded (`public/audio/agbero-1.mp3` … `agbero-6.mp3`).
- **Music:** an original generated track until a licensed one is added (`public/audio/game-music.mp3`).
- **Agbero hand props:** pending a decision.
- **Running on the danfo roofs via ramps:** planned, not built yet.
