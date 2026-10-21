import gsap from 'gsap';
import * as THREE from 'three';
import * as C from '../config';
import * as score from '../audio/score';
import * as sfx from '../audio/sfx';
import { track } from '../analytics/track';
import { chooseRunner, gameSkipCinematic } from '../game/GameScene';
import { useGame, type Runner } from '../game/gameStore';
import { getState, setState, type Headline, type Step } from '../state/store';
import { writePref } from '../util/storage';
import { cam, dom, getRig, lights, pose, ring, type Rig } from './rig';

// ---------------------------------------------------------------------------
// The intro: SAME TASTE. NEW LOOK. over the cold bottle, which you can spin and shake, and PLAY.
// Two ways in:
// - PLAY runs the opening cinematic, beats A–C here (the Golden Cap wakes, DON'T SHAKE ME, the
//   pop and lift-off).
// - Shaking the bottle: the cola only sloshes at first; keep shaking and it fizzes, the foam climbs
//   the neck (DON'T SHAKE ME), and with the foam at the cap it blows and lifts off, shedding cola.
// Either way: WHO CATCHES IT? (pick a runner), then the motor park (beats D–E, src/game/world.ts).
// SKIP works throughout. Every step change goes through enter(); nothing else sets `step`.

let story: gsap.core.Timeline | null = null;
let clock = 0;
let stepStart = 0;
let probe = { frames: 0, time: 0, done: false };

/** Drag-to-spin state (radians, radians per second). */
const turn = { vel: 0, dragging: false, lastX: 0, lastY: 0, tilt: 0, releasedAt: -99 };
/** Pressure building in the bottle (jitter amplitude). */
const fx = { tremble: 0 };
/** The liquid's inputs: last frame's spin/tilt (to feel accelerations) and the phone's gravity. */
const slosh = { ry: 0, tilt: 0, spinVel: 0, tiltVel: 0, primed: false };
const phoneUp = new THREE.Vector3(0, 1, 0);
let phoneSeen = 0; // clock time of the last motion reading
/**
 * Pressure from shaking: `shakeT` is how long it has been shaken (the first seconds only slosh),
 * `fizz` builds after that (0..1; the foam climbs with it), `hold` is time spent shaking with the
 * foam at the cap (it blows at C.SHAKE.holdS), `level` is how hard it is being shaken.
 */
const press = { fizz: 0, shakeT: 0, hold: 0, level: 0 };
/** Cola shed by the bottle as it lifts off, until this clock time. */
let dripUntil = 0;
/** SKIP was pressed before the runner pick: go straight into the run after it. */
let skipPark = false;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function enter(step: Step): void {
  setState({ step });
  stepStart = clock;
}

function headline(h: Headline | null): void {
  setState({ headline: h });
}

/** A blue energy ripple out of the bottle (DOM rings; `big` for the pop's shockwave). */
function ripple(big: boolean): void {
  setState({ ripple: getState().ripple + 1, rippleBig: big });
}

function newStory(onComplete?: () => void): gsap.core.Timeline {
  story?.kill();
  story = gsap.timeline({ onComplete });
  return story;
}

const reduced = (): boolean => getState().reducedMotion;
const rigOrNull = (): Rig | null => getRig();

/** The model is in: light it up and spin the bottle in. */
export function ready(): void {
  resetScene();
  enter('intro');
  probe = { frames: 0, time: 0, done: getState().tierLocked };
  const rm = reduced();
  cam.dolly = rm ? 1 : C.INTRO_DOLLY;
  lights.key = 0;
  lights.env = 0;
  lights.rimL = C.SILHOUETTE_RIM;
  lights.rimR = C.SILHOUETTE_RIM * 0.6;
  pose.ry = rm ? 0 : -Math.PI * 1.5;
  const tl = newStory();
  tl.to(cam, { dolly: 1, duration: 1.6, ease: 'power3.out' }, 0)
    .to(pose, { ry: 0, duration: 1.8, ease: 'power3.out' }, 0)
    .to(lights, { rimL: C.RIM_L_INTENSITY, rimR: C.RIM_R_INTENSITY, duration: 1, ease: 'power1.in' }, 0)
    .to(lights, { key: C.KEY_INTENSITY, env: C.ENV_INTENSITY, duration: 1.2, ease: 'power2.inOut' }, 0.3)
    .to(ring, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, 0.5);
}

/**
 * PLAY: the opening cinematic, beats A–C (about 9 s), timed against the dùndún groove.
 * A 0–3 s  lights out, a blue rim finds the can: SOME THINGS SHOULD STAY CLOSED. + three trumpet notes
 * B 3–7 s  the camera circles, the yellow cap glows gold, a blue ripple: DON'T SHAKE ME. The music stops.
 * C 7–9 s  pressure builds, POP: cap flash, blue shockwave, and the bottle rockets off to the motor park.
 */
export function play(): void {
  if (getState().step !== 'intro') return;
  sfx.unlock();
  track('started');
  writePref('played', '1');
  enter('cinematic');
  useGame.setState({ cinematic: true });
  turn.dragging = false;
  gsap.killTweensOf(pose);
  const rm = reduced();
  const front = Math.round(pose.ry / (Math.PI * 2)) * Math.PI * 2;
  const tl = newStory(toChoose);
  // Beat A: the awakening
  tl.to(lights, { key: 0, env: 0, rimL: 0, rimR: 0, duration: 0.5, ease: 'power2.out' }, 0)
    .to(ring, { opacity: 0, duration: 0.4 }, 0)
    .to(pose, { ry: front, duration: 0.6, ease: 'power2.inOut' }, 0)
    .to(turn, { tilt: 0, duration: 0.4 }, 0)
    .call(() => {
      sfx.reveal();
      score.startGroove(0.7);
    }, [], 0.5)
    .to(lights, { rimL: C.RIM_L_INTENSITY, rimR: C.RIM_R_INTENSITY, duration: 1.0, ease: 'power1.in' }, 0.8)
    .fromTo(cam, { dolly: rm ? 1.05 : 1.3 }, { dolly: 1.05, duration: 6.2, ease: 'sine.inOut', immediateRender: false }, 0.5)
    .call(() => headline({ text: 'SOME THINGS SHOULD STAY CLOSED.', size: 'cine' }), [], 1.1)
    .call(() => score.suspiciousTrumpet(), [], 1.8)
    // Beat B: the Golden Cap
    .call(() => headline(null), [], 3.1)
    .to(lights, { key: C.KEY_INTENSITY * 0.5, env: C.ENV_INTENSITY * 0.6, duration: 1.2 }, 3.1)
    .to(cam, { orbit: rm ? 0 : 0.75, duration: 3.6, ease: 'sine.inOut' }, 3.1)
    .call(goldenGlow, [], 3.9)
    .call(() => ripple(false), [], 4.5)
    .to(ring, { opacity: 0.7, scale: 1, duration: 0.8 }, 4.5)
    .call(() => headline({ text: "DON'T SHAKE ME.", accent: true }), [], 5.1)
    .call(() => score.stopGroove(0.25), [], 5.9) // the music holds its breath
    // Beat C: the pop
    .call(() => {
      headline(null);
      sfx.hiss(1.6);
    }, [], 7.0)
    .to(cam, { orbit: 0, duration: 1.4, ease: 'sine.inOut' }, 6.9)
    .to(fx, { tremble: rm ? 0.004 : 0.03, duration: 1.6, ease: 'power2.in' }, 7.0)
    .to(press, { fizz: 1, duration: 1.5, ease: 'power1.in' }, 7.0) // the foam climbs to the cap
    .to(ring, { pulse: 1, duration: 1.6 }, 7.0)
    .call(popOpen, [], 8.6)
    .to(pose, { sy: rm ? 1 : 1.15, sx: rm ? 1 : 0.92, duration: 0.12 }, 8.65)
    .to(pose, { y: C.ESCAPE_HEIGHT, duration: 0.45, ease: 'power2.in' }, 8.7)
    .call(() => sfx.whoosh(0.5, 0.45), [], 8.7)
    .to(ring, { opacity: 0, duration: 0.4 }, 8.8)
    .call(() => {}, [], 9.5); // the shed cola falls clear
}

/**
 * Shaken until it blew: no build-up, straight to the pop and the lift-off (beat C's ending),
 * shedding cola from the body as it goes, then the runner pick.
 */
function shakeLaunch(): void {
  if (getState().step !== 'intro') return;
  sfx.unlock();
  track('started', { via: 'shake' });
  writePref('played', '1');
  enter('cinematic');
  useGame.setState({ cinematic: true });
  setState({ shakeWarn: false });
  turn.dragging = false;
  gsap.killTweensOf(pose);
  const rm = reduced();
  const tl = newStory(toChoose);
  tl.to(ring, { opacity: 0, duration: 0.3 }, 0)
    .to(turn, { tilt: 0, vel: 0, duration: 0.2 }, 0)
    .call(popOpen, [], 0.05)
    .to(pose, { sy: rm ? 1 : 1.15, sx: rm ? 1 : 0.92, duration: 0.12 }, 0.1)
    .to(pose, { y: C.ESCAPE_HEIGHT, duration: 0.8, ease: 'power2.in' }, 0.2)
    .call(() => sfx.whoosh(0.6, 0.45), [], 0.3)
    .to(lights, { key: C.KEY_INTENSITY * 0.4, env: C.ENV_INTENSITY * 0.4, duration: 0.8 }, 0.4)
    .call(() => {}, [], 1.7); // the shed cola falls clear
}

/** Beat B: the yellow cap glows gold for a moment. */
function goldenGlow(): void {
  const r = rigOrNull();
  if (!r) return;
  sfx.goldGlint();
  r.capMat.emissive.set(0xffb000);
  gsap.fromTo(r.capMat, { emissiveIntensity: 0 }, { emissiveIntensity: 1.3, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.5 });
  gsap.fromTo(r.capFlash, { intensity: 0 }, { intensity: 2.5, duration: 0.3, yoyo: true, repeat: 1, repeatDelay: 0.5 });
}

/** Beat C: the can opens: pop, cap flash, the blue shockwave (a taste of PULSE MODE). */
function popOpen(): void {
  const r = rigOrNull();
  fx.tremble = 0;
  sfx.pop();
  sfx.capOpen();
  ripple(true);
  ring.flash = 1;
  cam.shake = reduced() ? 0 : 0.035;
  burstFromCap(getState().tier === 'high' ? 160 : 50);
  dripUntil = clock + 1.0; // cola sheds off the body as it lifts off
  press.fizz = 1;
  if (!r) return;
  r.liquid.push(1.6, 1.1); // the whole bottle fizzes up
  r.capMat.emissive.set(0xfff0b0);
  gsap.fromTo(r.capMat, { emissiveIntensity: 2.5 }, { emissiveIntensity: 0, duration: 0.8, ease: 'power2.out' });
  gsap.fromTo(r.capFlash, { intensity: 4 }, { intensity: 0, duration: 0.8, ease: 'power2.out' });
}

/** SKIP (cinematic only): straight into a correctly set-up run. Safe to press repeatedly. */
export function skipCinematic(): void {
  const step = getState().step;
  if (step === 'cinematic') {
    story?.kill();
    story = null;
    score.stopGroove(0.1);
    fx.tremble = 0;
    skipPark = true; // after the pick, straight into the run
    toChoose();
    return;
  }
  if (step === 'game' && useGame.getState().cinematic) gameSkipCinematic();
}

/** WHO CATCHES IT?: the pick opens the motor park (or, after SKIP, the run itself). */
export function choose(r: Runner): void {
  if (getState().step !== 'choose') return;
  sfx.unlock();
  chooseRunner(r);
  enter('game');
  if (skipPark) gameSkipCinematic();
  skipPark = false;
}

function burstFromCap(count: number): void {
  const r = rigOrNull();
  if (!r) return;
  r.cap.getWorldPosition(tmp);
  tmp.y += 0.04;
  tmp2.set(0, 1, 0); // the fizz erupts out of the open neck
  r.fizz.emit(count, tmp, tmp2, 2.2, 1.4);
}

/** The bottle is gone: pick who catches it (then the chase, src/game). */
function toChoose(): void {
  track('finished');
  sfx.fizzLevel(0);
  headline(null);
  setState({ shakeWarn: false });
  enter('choose');
}

/** Restores every animated property to the initial state. */
function resetScene(): void {
  story?.kill();
  story = null;
  gsap.killTweensOf([pose, cam, lights, ring, fx, turn, press]);
  Object.assign(pose, { x: 0, y: 0, ry: 0, rz: 0, sx: 1, sy: 1 });
  Object.assign(ring, { opacity: 0, scale: 0.85, pulse: 0, flash: 0 });
  Object.assign(lights, { key: C.KEY_INTENSITY, rimL: C.RIM_L_INTENSITY, rimR: C.RIM_R_INTENSITY, env: C.ENV_INTENSITY });
  Object.assign(turn, { vel: 0, dragging: false, tilt: 0, releasedAt: -99 });
  fx.tremble = 0;
  cam.shake = 0;
  cam.orbit = 0;
  Object.assign(press, { fizz: 0, shakeT: 0, hold: 0, level: 0 });
  dripUntil = 0;
  skipPark = false;
  setState({ headline: null, caption: null, shakeWarn: false });
  const r = rigOrNull();
  if (!r) return;
  r.fizz.clear();
  r.drips.clear();
  gsap.killTweensOf([r.capMat, r.capFlash]);
  r.capMat.emissiveIntensity = 0;
  r.capFlash.intensity = 0;
}

// ---------------------------------------------------------------------------
// Input: drag anywhere to spin the bottle (and tip it a little)

export function pointerDown(x: number, y: number): void {
  if (getState().step !== 'intro') return;
  sfx.unlock(); // touching the bottle is a gesture: its fizz can be heard from now on
  gsap.killTweensOf(pose, 'ry');
  turn.dragging = true;
  turn.lastX = x;
  turn.lastY = y;
  turn.vel = 0;
}

export function pointerMove(x: number, y: number, dtS: number): void {
  if (!turn.dragging || getState().step !== 'intro') return;
  const r = rigOrNull();
  const pxPerRad = r ? Math.max(120, r.viewport.w * 0.45) : 200;
  const d = (x - turn.lastX) / pxPerRad;
  pose.ry += d;
  turn.vel = turn.vel * 0.5 + (d / dtS) * 0.5;
  turn.tilt = Math.max(-C.TILT_MAX, Math.min(C.TILT_MAX, turn.tilt + (y - turn.lastY) / pxPerRad));
  turn.lastX = x;
  turn.lastY = y;
}

export function pointerUp(): void {
  if (!turn.dragging) return;
  turn.dragging = false;
  turn.releasedAt = clock;
  turn.vel = Math.max(-C.SPIN_MAX, Math.min(C.SPIN_MAX, turn.vel));
}

/** Keyboard: arrows nudge the spin. */
export function nudge(dir: -1 | 1): void {
  if (getState().step !== 'intro') return;
  gsap.killTweensOf(pose, 'ry');
  turn.vel = dir * 4;
  turn.releasedAt = clock;
}

// ---------------------------------------------------------------------------
// Per-frame update (called from the scene's useFrame)

export function update(dt: number): void {
  clock += dt;
  const r = rigOrNull();
  if (!r) return;
  const { step } = getState();

  if (step === 'intro') {
    probeFps(dt);
    if (!turn.dragging) {
      // Coast after a flick, then settle into a slow showroom turn
      const settled = clock - turn.releasedAt > C.SPIN_IDLE_S;
      const target = reduced() ? 0 : C.SPIN_AUTO;
      turn.vel += ((settled ? target : 0) - turn.vel) * Math.min(1, dt * (settled ? 0.8 : 1.6));
      if (!gsap.isTweening(pose)) pose.ry += turn.vel * dt;
      turn.tilt *= Math.pow(0.03, dt); // springs back upright
    }
  }

  // Bottle transform (+ pressure jitter in the cinematic)
  const sway = step === 'intro' && !reduced() ? Math.sin(clock * 1.3) * 0.015 : 0;
  const jx = fx.tremble ? (Math.random() - 0.5) * fx.tremble * 2 : 0;
  const jr = fx.tremble ? (Math.random() - 0.5) * fx.tremble * 6 : 0;
  r.root.position.set(pose.x + jx, pose.y, 0);
  r.root.scale.set(pose.sx, pose.sy, pose.sx);
  r.spin.rotation.set(turn.tilt, pose.ry, pose.rz + sway + jr);

  // Lights / environment
  r.key.intensity = lights.key;
  r.rimL.intensity = lights.rimL;
  r.rimR.intensity = lights.rimR;
  r.scene.environmentIntensity = lights.env;
  (r.glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.min(1, lights.rimL / C.RIM_L_INTENSITY) * Math.max(0, 1 - pose.y * 1.5);

  // Camera framing + shake: leave room for the title above and PLAY below
  const aspect = r.viewport.w / Math.max(1, r.viewport.h);
  const vh = Math.max(aspect > 1 ? C.FRAME_HEIGHT_WIDE : C.FRAME_HEIGHT, C.FRAME_MIN_WIDTH / aspect);
  const dist = vh / 2 / Math.tan(THREE.MathUtils.degToRad(C.CAMERA_FOV / 2));
  cam.shake *= Math.pow(0.02, dt);
  const sx = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const sy = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  // The cinematic circles the bottle (cam.orbit, radians round the bottle's axis)
  const d = dist * cam.dolly;
  r.camera.position.set(Math.sin(cam.orbit) * d + sx, C.LOOK_Y + sy, Math.cos(cam.orbit) * d);
  r.camera.lookAt(sx * 0.5, C.LOOK_Y, 0);
  r.viewport.halfWidth = (vh * aspect * cam.dolly) / 2;
  r.viewport.pxPerWorld = r.viewport.h / (vh * cam.dolly);

  // Particles / droplets
  r.fizz.update(dt);
  if (clock < dripUntil) shedCola(r, dt);
  r.drips.update(dt);
  if (step === 'intro' || step === 'cinematic') updateLiquid(r, dt);
  r.droplets?.update(dt);

  // Halftone ring (DOM), transform + opacity only
  ring.flash *= Math.pow(0.05, dt);
  if (dom.ring) {
    const s = ring.scale * (1 + ring.pulse * 0.06 * (0.6 + 0.4 * Math.sin(clock * 30)) + ring.flash * 0.08);
    tmp.set(0, C.BOTTLE_CENTER_Y, 0).project(r.camera);
    dom.ring.style.top = `${((-tmp.y * 0.5 + 0.5) * r.viewport.h).toFixed(1)}px`;
    dom.ring.style.opacity = String(Math.min(1, ring.opacity * (0.85 + ring.flash * 0.6)));
    dom.ring.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    if (dom.ripple) dom.ripple.style.top = dom.ring.style.top;
  }
}

function probeFps(dt: number): void {
  if (probe.done) return;
  const el = clock - stepStart;
  if (el < C.FPS_PROBE_START_S) return;
  probe.frames++;
  probe.time += dt;
  if (probe.time < C.FPS_PROBE_LEN_S) return;
  probe.done = true;
  const fps = probe.frames / probe.time;
  if (getState().tier === 'high' && fps < C.FPS_LOW_THRESHOLD) {
    setState({ tier: 'low' });
    track('quality_drop', { fps: Math.round(fps) });
  }
}

export function setMuted(muted: boolean): void {
  setState({ muted });
  writePref('muted', muted ? '1' : '0');
  sfx.setMuted(muted);
}

/** Test hook (?debug): the bottle's current spin, in radians. */
export function debugSpin(): number {
  return pose.ry;
}

/** Test hook (?debug): the shake build-up (fizz, how long shaken, foam-at-the-cap hold, slosh). */
export function debugPressure(): { fizz: number; shakeT: number; hold: number; level: number; slosh: number } {
  return { ...press, slosh: getRig()?.liquid.slosh ?? 0 };
}

/**
 * The cola sloshes from the bottle's own movement (changes in spin and tilt: a quick back-and-forth
 * drag is a shake), the cinematic's pressure tremble and, on Android, the phone itself: its
 * gravity tips the surface and a real shake sloshes it. The fizz follows the agitation.
 */
function updateLiquid(r: Rig, dt: number): void {
  const liq = r.liquid;
  if (dt > 0) {
    const spinVel = (pose.ry - slosh.ry) / dt;
    const tiltVel = (turn.tilt - slosh.tilt) / dt;
    if (slosh.primed) {
      const dSpin = THREE.MathUtils.clamp(spinVel - slosh.spinVel, -20, 20);
      const dTilt = THREE.MathUtils.clamp(tiltVel - slosh.tiltVel, -8, 8);
      liq.push(-dSpin * C.DRAG_SLOSH, -dTilt * C.DRAG_SLOSH * 6);
    }
    slosh.ry = pose.ry;
    slosh.tilt = turn.tilt;
    slosh.spinVel = spinVel;
    slosh.tiltVel = tiltVel;
    slosh.primed = true;
  }
  if (fx.tremble > 0) liq.push((Math.random() - 0.5) * fx.tremble * 35, (Math.random() - 0.5) * fx.tremble * 35);
  // Phone gravity (Android): eases back to plain "up" if the readings stop
  if (clock - phoneSeen > 1) phoneUp.set(0, 1, 0);
  liq.up.lerp(phoneUp, Math.min(1, dt * 6)).normalize();
  const light = Math.min(1, 0.12 + (lights.key / C.KEY_INTENSITY) * 0.6 + (lights.rimL / C.RIM_L_INTENSITY) * 0.35);
  if (getState().step === 'intro') buildPressure(liq.slosh, dt);
  liq.fizz = press.fizz;
  liq.foam = THREE.MathUtils.smoothstep(press.fizz, 0.3, 1);
  liq.update(Math.min(dt, 1 / 30), clock, light);
  sfx.fizzLevel(press.fizz);
  if (Math.random() < press.fizz * dt * 30) sfx.fizzPop();
}

/**
 * Shaking, as in real life: the first seconds only slosh the cola; keep at it and it starts to
 * fizz, the foam climbs the neck (the title warns DON'T SHAKE ME), and shaken on with the foam at
 * the cap, it blows. Left alone, the fizz slowly settles and the foam sinks back.
 */
function buildPressure(slosh: number, dt: number): void {
  const S = C.SHAKE;
  // A peak-hold envelope: the slosh swings through zero twice a cycle, a shake doesn't stop there
  press.level = Math.max(slosh, press.level - dt * S.release);
  const shaking = press.level > S.min;
  press.shakeT = shaking ? press.shakeT + dt : Math.max(0, press.shakeT - dt * S.cool);
  if (shaking && press.shakeT > S.sloshS) press.fizz = Math.min(1, press.fizz + dt * S.build * Math.min(1.5, press.level / S.full));
  else if (!shaking) press.fizz = Math.max(0, press.fizz - dt * S.settle);
  press.hold = press.fizz >= 1 && shaking ? press.hold + dt : Math.max(0, press.hold - dt * 2);
  ring.pulse = Math.max(0, press.fizz - 0.5) * 2; // the halftone ring throbs with the pressure
  const warn = press.fizz > S.warn;
  if (warn !== getState().shakeWarn) {
    setState({ shakeWarn: warn });
    if (warn) sfx.hiss(0.6);
  }
  if (press.hold > S.holdS) shakeLaunch();
}

/** Drops of cola thrown off the body as the bottle blows and lifts off; they fall away. */
function shedCola(r: Rig, dt: number): void {
  const body = r.liquid.mesh.parent;
  if (!body) return;
  const n = Math.floor(dt * C.DRIP_RATE + Math.random());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = 0.12 + Math.random() * 0.72;
    body.localToWorld(tmp.set(Math.cos(a) * C.LABEL_RADIUS, y, Math.sin(a) * C.LABEL_RADIUS));
    body.localToWorld(tmp2.set(Math.cos(a) * C.LABEL_RADIUS * 2, y, Math.sin(a) * C.LABEL_RADIUS * 2)).sub(tmp).normalize();
    tmp2.y = 0.1;
    r.drips.emit(1, tmp, tmp2, 1.3, 0.7);
  }
}

/**
 * Android motion (no permission prompt there): `gravity` is accelerationIncludingGravity, which
 * points "up" relative to the phone at rest; `shake` is the acceleration without gravity.
 */
export function motion(gx: number, gy: number, gz: number, ax: number, ay: number, az: number): void {
  const step = getState().step;
  if (step !== 'intro' && step !== 'cinematic') return;
  const r = rigOrNull();
  if (!r) return;
  const g = Math.hypot(gx, gy, gz);
  if (g > 4) {
    phoneUp.set(gx / g, gy / g, gz / g); // phone axes ≈ the view's: x right, y up, z towards you
    phoneSeen = clock;
  }
  const a = Math.hypot(ax, ay, az);
  if (a > 2.5) r.liquid.push(-ax * 0.03, az * 0.03 - ay * 0.01);
}
