import gsap from 'gsap';
import * as THREE from 'three';
import * as C from '../config';
import * as sfx from '../audio/sfx';
import { track } from '../analytics/track';
import { shake } from '../input/shake';
import { getState, setState, type Headline, type Step } from '../state/store';
import { writePref } from '../util/storage';
import { cam, dom, fx, getRig, lights, pose, ring, type Rig } from './rig';

// ---------------------------------------------------------------------------
// Step bookkeeping. Every step change goes through enter(); nothing else sets `step`.

let story: gsap.core.Timeline | null = null;
let clock = 0;
let stepStart = 0;
let launched = false;
let dodges = 0;
let dodging = false;
let lastDodgeMs = 0;
let peelDragging = false;
let peelStart = { x: 0, y: 0, p: 0 };
let peelLastP = 0;
let flap: gsap.core.Tween | null = null;
let labelPivot: THREE.Group | null = null;
let shakeLine = 0;
let probe = { frames: 0, time: 0, done: false };
let shortIntro = false;
const flight = { t: 0, lastX: 0, lastY: 0, spraying: false, emitAcc: 0, whooshAcc: 0 };

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function enter(step: Step): void {
  setState({ step });
  stepStart = clock;
}

function headline(h: Headline | null): void {
  setState({ headline: h });
}

function hint(text: string | null, urgent = false): void {
  setState({ hint: text, hintUrgent: urgent });
}

function newStory(onComplete?: () => void): gsap.core.Timeline {
  story?.kill();
  story = gsap.timeline({ onComplete });
  return story;
}

const reduced = (): boolean => getState().reducedMotion;
const rigOrNull = (): Rig | null => getRig();

// ---------------------------------------------------------------------------
// Silhouette → intro

export function ready(): void {
  resetScene();
  cam.dolly = C.INTRO_DOLLY;
  lights.key = 0;
  lights.env = 0;
  lights.rimL = C.SILHOUETTE_RIM;
  lights.rimR = C.SILHOUETTE_RIM * 0.6;
  ring.opacity = 0;
  enter('silhouette');
}

export function wake(): void {
  if (getState().step !== 'silhouette') return;
  sfx.unlock();
  track('started');
  playIntro();
}

function playIntro(): void {
  headline(null);
  hint(null);
  enter('intro');
  probe = { frames: 0, time: 0, done: getState().tierLocked };
  const rm = reduced();
  sfx.rumble(shortIntro ? 2.2 : 5);
  if (rm) cam.dolly = 1;
  const tl = newStory(enterWarning);
  tl.to(cam, { dolly: 1, duration: 4.4, ease: 'power2.inOut' }, 0)
    .to(lights, { rimL: C.RIM_L_INTENSITY, duration: 1.6, ease: 'power1.in' }, 0)
    .to(lights, { rimR: C.RIM_R_INTENSITY, duration: 1.6, ease: 'power1.in' }, 0.3)
    .to(lights, { key: C.KEY_INTENSITY, duration: 2, ease: 'power2.inOut' }, 1.6)
    .to(lights, { env: C.ENV_INTENSITY, duration: 2, ease: 'power2.inOut' }, 2)
    .to(ring, { opacity: 1, scale: 1, duration: 2, ease: 'power2.out' }, 2.4)
    .call(() => sfx.fizz(0.05), [], 3)
    .call(() => {
      headline({ text: "DON'T SHAKE ME." });
      sfx.slam();
    }, [], 4.5)
    .to({}, { duration: 0.45 });
  tl.timeScale(shortIntro ? C.INTRO_SHORT_TIMESCALE : 1);
}

export function skipIntro(): void {
  if (getState().step === 'intro' && story) story.progress(1);
}

// ---------------------------------------------------------------------------
// Warning / shaking → launch

function enterWarning(): void {
  enter('warning');
  shake.reset();
  shake.active = true;
  shakeLine = 0;
}

/**
 * Shaken-bottle rocket: pressure bulge → cap bursts off → geyser → the spray drives the
 * bottle base-first around the frame on a sine path, shrinking into the distance and
 * growing back → capless landing → the new yellow cap drops in and screws on.
 */
function launch(): void {
  if (launched) return;
  launched = true;
  shake.active = false;
  enter('launch');
  track('launched');
  hint(null);
  headline(null);
  const rm = reduced();
  const flightS = rm ? C.FLIGHT_DURATION_REDUCED : C.FLIGHT_DURATION;
  const takeoff = C.CAP_POP_AT + C.GEYSER_HOLD;
  const landAt = takeoff + flightS;
  Object.assign(flight, { t: 0, lastX: 0, lastY: 0, spraying: false, emitAcc: 0, whooshAcc: 0 });
  const tl = newStory(enterRebel);
  sfx.hiss(C.CAP_POP_AT);
  tl.to(fx, { tremble: 0.03, duration: C.CAP_POP_AT, ease: 'power2.in' }, 0)
    .to(pose, { sx: 1.05, duration: C.CAP_POP_AT, ease: 'power2.in' }, 0)
    .to(ring, { pulse: 1, duration: C.CAP_POP_AT }, 0)
    .call(popCap, [], C.CAP_POP_AT)
    .to(pose, { sx: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' }, C.CAP_POP_AT)
    .to(flight, { t: 1, duration: flightS, ease: 'none', onUpdate: flyStep }, takeoff)
    .call(() => {
      flight.spraying = false;
      sfx.fizz(0.05);
    }, [], landAt - 0.35)
    .call(land, [], landAt)
    .to(pose, { sy: 0.86, sx: 1.08, duration: 0.07, ease: 'power2.out' }, landAt)
    .to(pose, { sy: 1, sx: 1, duration: 0.7, ease: 'elastic.out(1, 0.35)' }, landAt + 0.07)
    .to(ring, { pulse: 0, duration: 0.6 }, landAt)
    .call(dropYellowCap, [], landAt + C.CAP_DROP_DELAY)
    .to({}, { duration: 1.3 });
}

function popCap(): void {
  const r = rigOrNull();
  if (!r) return;
  const rm = reduced();
  fx.tremble = 0;
  sfx.pop();
  sfx.whoosh(0.7, 0.5);
  sfx.fizz(0.5);
  ring.flash = 1;
  cam.shake = rm ? 0 : 0.025;
  sprayFromNozzle(getState().tier === 'high' ? C.POP_BURST.high : C.POP_BURST.low, 2.6, 0.5);
  flight.spraying = true;
  // Fly the old cap off in world space, independent of the bottle.
  r.scene.attach(r.cap);
  gsap.to(r.cap.position, {
    x: r.cap.position.x + (Math.random() - 0.5) * 0.8,
    y: r.cap.position.y + 2.6,
    duration: 0.9,
    ease: 'power2.out',
    onComplete: () => {
      r.cap.visible = false;
    },
  });
  gsap.to(r.cap.rotation, { x: rm ? 0 : 9, z: rm ? 0 : 5, duration: 0.9, ease: 'power1.out' });
}

function flyStep(): void {
  const r = rigOrNull();
  if (!r) return;
  const rm = reduced();
  const t = flight.t;
  const env = Math.sin(Math.PI * t);
  const x = rm ? 0 : r.viewport.halfWidth * C.FLIGHT_SWING * Math.sin(3 * Math.PI * t) * env;
  const y = rm ? 0.18 * env : C.FLIGHT_HEIGHT * Math.pow(env, 0.6) + 0.16 * Math.sin(6 * Math.PI * t) * env;
  pose.x = x;
  pose.y = y;
  pose.s = rm ? 1 : 1 - C.FLIGHT_SHRINK * Math.pow(env, 1.2);
  const vx = x - flight.lastX;
  const vy = y - flight.lastY;
  flight.lastX = x;
  flight.lastY = y;
  if (rm || Math.hypot(vx, vy) < 1e-5) return;
  // The spray pushes the bottle base-first: its neck points against the direction of travel.
  let target = Math.atan2(vx, -vy);
  while (target - pose.rz > Math.PI) target -= Math.PI * 2;
  while (target - pose.rz < -Math.PI) target += Math.PI * 2;
  pose.rz += (target - pose.rz) * 0.2;
  const upright = THREE.MathUtils.smoothstep(t, 0.85, 0.98);
  if (upright > 0) pose.rz += (Math.round(pose.rz / (Math.PI * 2)) * Math.PI * 2 - pose.rz) * upright;
}

function land(): void {
  pose.rz = 0;
  pose.s = 1;
  sfx.thud();
  cam.shake = reduced() ? 0 : 0.035;
  ring.flash = 1;
}

function dropYellowCap(): void {
  const r = rigOrNull();
  if (!r) return;
  r.capParent.add(r.cap);
  r.cap.position.set(0, 1.4, 0);
  r.cap.rotation.set(0, 0, 0);
  r.cap.scale.set(1, 1, 1);
  r.capMat.map = r.yellowMap;
  r.cap.visible = true;
  sfx.whoosh(0.45, 0.2);
  gsap.to(r.cap.rotation, { y: Math.PI * 4, duration: 0.6, ease: 'power2.out' });
  gsap.to(r.cap.position, {
    y: 0,
    duration: 0.6,
    ease: 'bounce.out',
    onComplete: () => {
      sfx.click();
      r.capMat.emissive.set(0xffc400);
      r.capMat.emissiveIntensity = 0.9;
      gsap.to(r.capMat, { emissiveIntensity: 0, duration: 1.2, ease: 'power2.out' });
      r.capFlash.intensity = 3;
      gsap.to(r.capFlash, { intensity: 0, duration: 1.1, ease: 'power2.out' });
      ring.flash = 1;
      sfx.sparkle();
    },
  });
}

/** Emits along the bottle's neck axis (works upside down mid-flight). */
function sprayFromNozzle(count: number, speed: number, spread: number): void {
  const r = rigOrNull();
  if (!r) return;
  r.nozzle.getWorldPosition(tmp);
  r.spin.getWorldPosition(tmp2);
  tmp2.subVectors(tmp, tmp2).normalize();
  r.fizz.emit(count, tmp, tmp2, speed, spread);
}

// ---------------------------------------------------------------------------
// Rebel: exactly DODGES_BEFORE_TIRED dodges, then it gives up

function enterRebel(): void {
  enter('rebel');
  dodges = 0;
  dodging = false;
  headline({ text: 'HUMANS CAN BE TRUSTED.' });
}

/** pointerWorldX: where the visitor reached, in world x at the bottle's depth. */
function dodge(pointerWorldX: number): void {
  const now = performance.now();
  if (dodging || now - lastDodgeMs < C.DODGE_COOLDOWN_MS) return;
  const r = rigOrNull();
  if (!r) return;
  dodging = true;
  lastDodgeMs = now;
  dodges++;
  hint(null);
  const reach = Math.max(0.15, Math.min(0.55, r.viewport.halfWidth - C.DODGE_EDGE_MARGIN));
  let target = pointerWorldX > pose.x ? -reach : reach;
  if (Math.abs(target - pose.x) < 0.12) target = -target; // cornered: hop to the other side
  const rm = reduced();
  const dist = Math.abs(target - pose.x);
  const line = C.DODGE_LINES[dodges - 1];
  if (line) headline({ text: line });
  sfx.whoosh(0.3, 0.3);
  gsap
    .timeline({
      onComplete: () => {
        dodging = false;
        if (dodges >= C.DODGES_BEFORE_TIRED) tired();
      },
    })
    .to(pose, { sy: 0.9, sx: 1.06, duration: 0.07, ease: 'power2.out' })
    .to(pose, { x: target, duration: rm ? 0.5 : 0.36, ease: 'power3.out' })
    .to(pose, { y: rm ? 0 : 0.08 + dist * 0.25, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, '<')
    .to(pose, { rz: Math.sign(target - pose.x) * -0.25, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, '<')
    .to(pose, { sy: 1, sx: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)' }, '>-0.05');
}

function tired(): void {
  enter('peel');
  headline({ text: '…FINE.', size: 'md' });
  sfx.whoosh(0.8, 0.12);
  const tl = newStory();
  tl.to(pose, { x: 0, duration: 0.7, ease: 'power2.inOut' }, 0.2)
    .to(pose, { ry: C.PEEL_TURN_Y, duration: 0.9, ease: 'power2.inOut' }, 0.2)
    .to(cam, { dolly: C.PEEL_DOLLY, duration: 1.1, ease: 'power2.inOut' }, 0.2)
    .call(() => {
      startFlap();
      hint('peel the label');
    }, [], 1.2);
}

// ---------------------------------------------------------------------------
// Peel

function startFlap(): void {
  const r = rigOrNull();
  if (!r) return;
  flap?.kill();
  const o = { p: 0 };
  flap = gsap.to(o, {
    p: 0.06,
    duration: 0.35,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    repeatDelay: 0.6,
    onUpdate: () => r.peel.set(o.p),
  });
}

function peelDown(x: number, y: number): void {
  const r = rigOrNull();
  if (!r) return;
  flap?.kill();
  flap = null;
  peelDragging = true;
  peelStart = { x, y, p: r.peel.progress };
  peelLastP = r.peel.progress;
  hint(null);
  headline(null);
  r.droplets?.mesh.removeFromParent();
}

function peelMove(x: number, y: number): void {
  const r = rigOrNull();
  if (!r || !peelDragging) return;
  const span = C.PEEL_DRAG_SPAN * Math.min(r.viewport.w, r.viewport.h);
  const p = Math.max(0, Math.min(1, peelStart.p + Math.hypot(x - peelStart.x, y - peelStart.y) / span));
  r.peel.set(p);
  sfx.peelCrackle(Math.abs(p - peelLastP) * 30);
  peelLastP = p;
}

function peelUp(): void {
  const r = rigOrNull();
  if (!r || !peelDragging) return;
  peelDragging = false;
  sfx.peelCrackle(0);
  const o = { p: r.peel.progress };
  if (o.p >= C.PEEL_COMMIT) {
    enter('monster');
    gsap.to(o, { p: 1, duration: 0.35, ease: 'power2.in', onUpdate: () => r.peel.set(o.p), onComplete: monster });
  } else {
    gsap.to(o, {
      p: 0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.5)',
      onUpdate: () => r.peel.set(o.p),
      onComplete: () => {
        if (getState().step === 'peel') {
          startFlap();
          hint('keep pulling');
        }
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Monster → exit → end card

function monster(): void {
  const r = rigOrNull();
  if (!r) return;
  track('peeled');
  // Detach the rolled label into world space so it can fly off on its own pivot.
  r.label.geometry.computeBoundingBox();
  r.label.geometry.boundingBox?.getCenter(tmp);
  r.label.localToWorld(tmp);
  labelPivot = new THREE.Group();
  labelPivot.position.copy(tmp);
  r.scene.add(labelPivot);
  labelPivot.attach(r.label);
  const rm = reduced();
  const tl = newStory(exit);
  tl.call(() => sfx.flick(), [], 0)
    .to(labelPivot.position, { x: tmp.x + r.viewport.halfWidth + 1, y: tmp.y - 0.5, duration: 0.85, ease: 'power2.in' }, 0)
    .to(labelPivot.rotation, { y: rm ? 0 : -Math.PI * 6, z: -0.5, duration: 0.85, ease: 'power1.in' }, 0)
    .call(() => sfx.silence(), [], 0.85)
    .call(() => {
      headline({ text: 'YOU MONSTER.', accent: true });
      sfx.monster();
      cam.shake = rm ? 0 : 0.015;
    }, [], 1.45)
    .to(fx, { tremble: 0.004, duration: 0.3 }, 1.6)
    .to(cam, { dolly: 1, duration: 1.4, ease: 'power2.inOut' }, 1.6)
    .to({}, { duration: 1.4 });
}

function exit(): void {
  const r = rigOrNull();
  if (!r) return;
  enter('exit');
  const rm = reduced();
  const tl = newStory(endCard);
  tl.to(fx, { tremble: 0, duration: 0.1 }, 0)
    .call(() => headline(null), [], 0.1)
    .to(pose, { sy: 0.84, sx: 1.08, duration: 0.14, ease: 'power2.out' }, 0.15)
    .call(() => sfx.boing(), [], 0.29)
    .to(pose, { sy: 1.1, sx: 0.95, duration: 0.12 }, 0.29)
    .to(pose, { x: r.viewport.halfWidth + 0.7, duration: rm ? 0.6 : 0.55, ease: 'power2.in' }, 0.3)
    .to(pose, { y: rm ? 0 : 0.45, duration: 0.28, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.3)
    .to(pose, { rz: -0.5, duration: 0.5 }, 0.3)
    .to(ring, { opacity: 0, duration: 0.6 }, 0.6)
    .to({}, { duration: 0.75 });
}

function endCard(): void {
  enter('end');
  sfx.fizz(0);
  window.setTimeout(() => sfx.sting(), 350);
  track('finished');
  writePref('finished', '1');
}

export function replay(): void {
  track('replayed');
  sfx.unlock();
  resetScene();
  shortIntro = true;
  cam.dolly = reduced() ? 1 : 1.25;
  playIntro();
}

/** Restores every animated property to the initial state (invariant #4). */
function resetScene(): void {
  story?.kill();
  story = null;
  flap?.kill();
  flap = null;
  gsap.killTweensOf([pose, cam, lights, ring, fx]);
  Object.assign(pose, { x: 0, y: 0, ry: 0, rz: 0, sx: 1, sy: 1, s: 1 });
  Object.assign(ring, { opacity: 0, scale: 0.85, pulse: 0, flash: 0 });
  Object.assign(lights, { key: C.KEY_INTENSITY, rimL: C.RIM_L_INTENSITY, rimR: C.RIM_R_INTENSITY, env: C.ENV_INTENSITY });
  fx.tremble = 0;
  cam.shake = 0;
  launched = false;
  dodges = 0;
  dodging = false;
  peelDragging = false;
  shake.reset();
  shake.active = false;
  setState({ headline: null, hint: null, caption: null });
  const r = rigOrNull();
  if (!r) return;
  gsap.killTweensOf([r.capMat, r.capFlash, r.cap.position, r.cap.rotation]);
  flight.spraying = false;
  r.capParent.add(r.cap);
  r.cap.position.set(0, 0, 0);
  r.cap.rotation.set(0, 0, 0);
  r.cap.scale.set(1, 1, 1);
  r.cap.visible = true;
  r.capMat.map = r.blueMap;
  r.capMat.emissiveIntensity = 0;
  r.capFlash.intensity = 0;
  r.fizz.clear();
  if (labelPivot) {
    r.labelParent.attach(r.label);
    labelPivot.removeFromParent();
    labelPivot = null;
  }
  r.label.position.set(0, 0, 0);
  r.label.rotation.set(0, 0, 0);
  r.label.scale.set(1, 1, 1);
  r.peel.set(0);
  if (r.droplets && !r.droplets.mesh.parent) r.labelParent.add(r.droplets.mesh);
}

// ---------------------------------------------------------------------------
// Input routing

/** Screen-space bottle box: cheaper than raycasting a 150k-triangle mesh on low-end GPUs. */
export function bottleScreenBox(): { cx: number; top: number; bottom: number; hw: number } | null {
  const r = rigOrNull();
  if (!r) return null;
  const toPx = (x: number, y: number): [number, number] => {
    tmp.set(x, y, 0).project(r.camera);
    return [(tmp.x * 0.5 + 0.5) * r.viewport.w, (-tmp.y * 0.5 + 0.5) * r.viewport.h];
  };
  const [cx, bottom] = toPx(pose.x, pose.y);
  const [, top] = toPx(pose.x, pose.y + C.BOTTLE_HEIGHT);
  const [ex] = toPx(pose.x + C.BOTTLE_HALF_WIDTH, pose.y + C.BOTTLE_CENTER_Y);
  return { cx, top, bottom, hw: Math.abs(ex - cx) };
}

function nearBottle(x: number, y: number, padPx: number): boolean {
  const b = bottleScreenBox();
  if (!b) return false;
  return Math.abs(x - b.cx) < b.hw + padPx && y > b.top - padPx && y < b.bottom + padPx;
}

function pointerWorldX(x: number): number {
  const r = rigOrNull();
  const b = bottleScreenBox();
  if (!r || !b) return 0;
  return pose.x + (x - b.cx) / r.viewport.pxPerWorld;
}

export function pointerDown(x: number, y: number, type: string): void {
  const step = getState().step;
  const touchPad = type === 'mouse' ? 10 : 36;
  switch (step) {
    case 'silhouette':
      wake();
      break;
    case 'warning':
    case 'shaking':
      shake.pointerDown(x, y, performance.now());
      break;
    case 'rebel':
      if (nearBottle(x, y, touchPad + 30)) dodge(pointerWorldX(x));
      else if (clock - stepStart > C.HINT_REBEL_S) hint('try to catch it');
      break;
    case 'peel':
      if (nearBottle(x, y, touchPad + 20)) peelDown(x, y);
      break;
    case 'loading':
    case 'intro':
    case 'launch':
    case 'monster':
    case 'exit':
    case 'end':
      break;
    default: {
      const never: never = step;
      return never;
    }
  }
}

export function pointerMove(x: number, y: number, type: string, pressed: boolean, dtS: number): void {
  const step = getState().step;
  if ((step === 'warning' || step === 'shaking') && pressed) shake.pointerMove(x, y, dtS);
  else if (step === 'rebel' && type === 'mouse' && nearBottle(x, y, C.DODGE_PROXIMITY_PX)) dodge(pointerWorldX(x));
  else if (step === 'peel' && peelDragging) peelMove(x, y);
}

export function pointerUp(): void {
  shake.pointerUp();
  peelUp();
}

// ---------------------------------------------------------------------------
// Per-frame update (called from the scene's useFrame)

export function update(dt: number): void {
  clock += dt;
  const r = rigOrNull();
  if (!r) return;
  const { step } = getState();
  const el = clock - stepStart;
  const now = performance.now();
  let tilt = 0;
  let dragX = 0;
  let tremble = fx.tremble;
  let sway = 0;

  if (step === 'intro') probeFps(dt);

  if (step === 'warning' || step === 'shaking') {
    const e = shake.tick(dt, now);
    if (shake.touched && step === 'warning') {
      enter('shaking');
      track('shook');
      hint(null);
    }
    if (step === 'warning') {
      if (el > C.HINT_WARNING_S && !getState().hint) hint(reduced() ? 'press and hold' : 'drag to shake');
      if (el > C.HINT_URGENT_S && !getState().hintUrgent) hint(getState().hint, true);
      if (el > C.SELF_TREMBLE_S) tremble = Math.max(tremble, 0.004 + 0.003 * Math.sin(clock * 3));
    }
    dragX = Math.max(-0.16, Math.min(0.16, (shake.offsetPx / r.viewport.pxPerWorld) * 0.35));
    tilt = Math.max(-0.4, Math.min(0.4, shake.velocity * -0.00035));
    tremble = Math.max(tremble, e * e * 0.02 + (shake.isHolding ? 0.006 : 0));
    ring.pulse = e;
    sfx.fizz(0.05 + e * 0.45);
    if (e > 0.6 && Math.random() < dt * e * 20) sprayFromNozzle(2, 1.6, 1.2);
    while (shakeLine < C.SHAKE_LINES.length && e >= C.SHAKE_LINES[shakeLine][0]) {
      headline({ text: C.SHAKE_LINES[shakeLine][1] });
      shakeLine++;
    }
    if (e >= 1) launch();
  }

  if (step === 'warning' || step === 'shaking' || step === 'rebel' || step === 'peel') {
    sway = Math.sin(clock * 1.3) * 0.02;
  }

  // Compose the bottle transform: authored pose + live input + noise.
  const jx = tremble ? (Math.random() - 0.5) * tremble * 2 : 0;
  const jr = tremble ? (Math.random() - 0.5) * tremble * 6 : 0;
  r.root.position.set(pose.x + dragX + jx, pose.y, 0);
  r.root.scale.set(pose.sx * pose.s, pose.sy * pose.s, pose.sx * pose.s);
  r.spin.rotation.set(0, pose.ry, pose.rz + tilt + sway + jr);

  // Lights / environment
  r.key.intensity = lights.key;
  r.rimL.intensity = lights.rimL;
  r.rimR.intensity = lights.rimR;
  r.scene.environmentIntensity = lights.env;
  (r.glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.min(1, lights.rimL / C.RIM_L_INTENSITY) * Math.max(0, 1 - pose.y * 1.5);

  // Camera framing + shake
  const aspect = r.viewport.w / Math.max(1, r.viewport.h);
  const vh = Math.max(C.FRAME_HEIGHT, C.FRAME_MIN_WIDTH / aspect);
  const dist = vh / 2 / Math.tan(THREE.MathUtils.degToRad(C.CAMERA_FOV / 2));
  cam.shake *= Math.pow(0.02, dt);
  const sx = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const sy = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const lookY = C.LOOK_Y - (1 - cam.dolly) * 0.12;
  r.camera.position.set(sx, lookY + sy, dist * cam.dolly);
  r.camera.lookAt(sx * 0.5, lookY, 0);
  r.viewport.halfWidth = (vh * aspect * cam.dolly) / 2;
  r.viewport.pxPerWorld = r.viewport.h / (vh * cam.dolly);

  // Rocket spray + whooshes on the flight's swings
  if (flight.spraying) {
    flight.emitAcc += dt * (getState().tier === 'high' ? C.SPRAY_RATE.high : C.SPRAY_RATE.low);
    const n = Math.floor(flight.emitAcc);
    flight.emitAcc -= n;
    if (n > 0) sprayFromNozzle(n, 1.8, 0.45);
    flight.whooshAcc += dt;
    if (flight.whooshAcc > 0.62 && step === 'launch' && flight.t > 0) {
      flight.whooshAcc = 0;
      sfx.whoosh(0.45, 0.3);
    }
  }

  // Particles / droplets
  r.fizz.update(dt);
  if (r.droplets?.mesh.parent) r.droplets.update(dt);

  // Halftone ring (DOM), transform + opacity only
  ring.flash *= Math.pow(0.05, dt);
  if (dom.ring) {
    const s = ring.scale * (1 + ring.pulse * 0.06 * (0.6 + 0.4 * Math.sin(clock * 30)) + ring.flash * 0.08);
    tmp.set(0, C.BOTTLE_CENTER_Y, 0).project(r.camera);
    dom.ring.style.top = `${((-tmp.y * 0.5 + 0.5) * r.viewport.h).toFixed(1)}px`;
    dom.ring.style.opacity = String(Math.min(1, ring.opacity * (0.85 + ring.flash * 0.6)));
    dom.ring.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
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

export function keyShake(held: boolean): void {
  const step = getState().step;
  if (step === 'warning' || step === 'shaking') shake.key(held);
}

export function motion(magnitude: number): void {
  shake.motion(magnitude);
}
