import gsap from 'gsap';
import * as THREE from 'three';
import * as C from '../config';
import * as music from '../audio/music';
import * as sfx from '../audio/sfx';
import { track } from '../analytics/track';
import { getState, setState, type Step } from '../state/store';
import { writePref } from '../util/storage';
import { cam, dom, getRig, lights, pose, ring, type Rig } from './rig';

// ---------------------------------------------------------------------------
// The intro: SAME TASTE. NEW LOOK. over the cold bottle, which you can spin, and PLAY.
// PLAY starts the theme song; the bottle rockets off on its beat and lands in the chase.
// Every step change goes through enter(); nothing else sets `step`.

let story: gsap.core.Timeline | null = null;
let clock = 0;
let stepStart = 0;
let probe = { frames: 0, time: 0, done: false };

/** Drag-to-spin state (radians, radians per second). */
const turn = { vel: 0, dragging: false, lastX: 0, lastY: 0, tilt: 0, releasedAt: -99 };

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function enter(step: Step): void {
  setState({ step });
  stepStart = clock;
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

/** PLAY: theme song from the top; the bottle rockets up on its beat and the chase opens. */
export function play(): void {
  if (getState().step !== 'intro') return;
  sfx.unlock();
  track('started');
  writePref('played', '1');
  enter('launch');
  turn.dragging = false;
  gsap.killTweensOf(pose);
  void music.startTheme().then((ok) => {
    // Lift-off lands on the song's third beat (about a second in); without the song, same feel.
    const lift = ok ? Math.max(0.35, music.secondsToBeat(2) ?? 0.9) : 0.9;
    launch(lift);
  });
}

function launch(lift: number): void {
  const rm = reduced();
  const tl = newStory(toGame);
  const beat = music.BEAT_S;
  sfx.hiss(lift);
  // Anticipation: the bottle squats and spins up to face you
  tl.to(pose, { ry: Math.round(pose.ry / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2, duration: lift, ease: 'power2.in' }, 0)
    .to(pose, { sy: 0.86, sx: 1.07, duration: lift, ease: 'power2.in' }, 0)
    .to(ring, { pulse: 1, duration: lift }, 0)
    .call(() => {
      sfx.whoosh(0.5, 0.45);
      burstFromCap(getState().tier === 'high' ? 160 : 50);
      ring.flash = 1;
      cam.shake = rm ? 0 : 0.02;
    }, [], lift)
    .to(pose, { sy: rm ? 1 : 1.15, sx: rm ? 1 : 0.92, duration: 0.12 }, lift)
    // Up and out of the frame within one beat
    .to(pose, { y: C.ESCAPE_HEIGHT, duration: beat, ease: 'power2.in' }, lift)
    .to(ring, { opacity: 0, duration: beat }, lift);
}

function burstFromCap(count: number): void {
  const r = rigOrNull();
  if (!r) return;
  r.cap.getWorldPosition(tmp);
  tmp.y += 0.04;
  tmp2.set(0, -1, 0); // the fizz sprays down as it takes off
  r.fizz.emit(count, tmp, tmp2, 2.2, 1.4);
}

/** The intro hands over to the chase (src/game). */
function toGame(): void {
  track('finished');
  enter('game');
}

/** Restores every animated property to the initial state. */
function resetScene(): void {
  story?.kill();
  story = null;
  gsap.killTweensOf([pose, cam, lights, ring]);
  Object.assign(pose, { x: 0, y: 0, ry: 0, rz: 0, sx: 1, sy: 1 });
  Object.assign(ring, { opacity: 0, scale: 0.85, pulse: 0, flash: 0 });
  Object.assign(lights, { key: C.KEY_INTENSITY, rimL: C.RIM_L_INTENSITY, rimR: C.RIM_R_INTENSITY, env: C.ENV_INTENSITY });
  Object.assign(turn, { vel: 0, dragging: false, tilt: 0, releasedAt: -99 });
  cam.shake = 0;
  setState({ headline: null, caption: null });
  rigOrNull()?.fizz.clear();
}

// ---------------------------------------------------------------------------
// Input: drag anywhere to spin the bottle (and tip it a little)

export function pointerDown(x: number, y: number): void {
  if (getState().step !== 'intro') return;
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

  // Bottle transform
  const sway = step === 'intro' && !reduced() ? Math.sin(clock * 1.3) * 0.015 : 0;
  r.root.position.set(pose.x, pose.y, 0);
  r.root.scale.set(pose.sx, pose.sy, pose.sx);
  r.spin.rotation.set(turn.tilt, pose.ry, pose.rz + sway);

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
  r.camera.position.set(sx, C.LOOK_Y + sy, dist * cam.dolly);
  r.camera.lookAt(sx * 0.5, C.LOOK_Y, 0);
  r.viewport.halfWidth = (vh * aspect * cam.dolly) / 2;
  r.viewport.pxPerWorld = r.viewport.h / (vh * cam.dolly);

  // Particles / droplets
  r.fizz.update(dt);
  r.droplets?.update(dt);

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

/** Test hook (?debug): the bottle's current spin, in radians. */
export function debugSpin(): number {
  return pose.ry;
}
