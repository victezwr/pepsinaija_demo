// Chase music. Uses public/audio/game-music.mp3 when the owner adds one; otherwise plays a
// generated, high-energy endless-runner loop (original, in the spirit of the genre): punchy
// hip-hop drums, busy hats, a driving octave bass, offbeat chord plucks and a bright lead hook.
// Tempo rises with each speed stage.
import { audioGraph } from './sfx';

const CUSTOM_URL = '/audio/game-music.mp3';
const BASE_BPM = 120;
const BPM_PER_STAGE = 4;
const LEVEL = 0.42;

// C – G – Am – F
const BARS: ReadonlyArray<{ root: number; chord: number[] }> = [
  { root: 65.41, chord: [523.25, 659.25, 783.99] },
  { root: 98, chord: [493.88, 587.33, 783.99] },
  { root: 110, chord: [523.25, 659.25, 880] },
  { root: 87.31, chord: [523.25, 698.46, 880] },
];
const KICK = [0, 6, 8, 11];
const SNARE = [4, 12];
const PLUCK = [2, 6, 10, 14];
const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5;
// Lead hook, one 16-step phrase per bar (0 = rest)
const HOOK: ReadonlyArray<ReadonlyArray<number>> = [
  [E5, 0, G5, 0, A5, 0, G5, E5, 0, 0, D5, 0, E5, 0, 0, 0],
  [D5, 0, G5, 0, B5, 0, A5, 0, G5, 0, D5, 0, 0, E5, D5, 0],
  [C5, 0, E5, 0, A5, 0, G5, E5, 0, 0, A5, 0, C6, 0, 0, 0],
  [A5, 0, G5, 0, F5, 0, E5, 0, C5, 0, D5, 0, E5, 0, G5, 0],
];

let bus: GainNode | null = null;
let timer = 0;
let step = 0;
let nextTime = 0;
let bpm = BASE_BPM;
let stage = 0;
let pulse = false;
let lite = false;
let custom: HTMLAudioElement | null = null;
let customChecked: Promise<boolean> | null = null;

function hasCustomTrack(): Promise<boolean> {
  customChecked ??= fetch(CUSTOM_URL, { method: 'HEAD' })
    .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio'))
    .catch(() => false);
  return customChecked;
}

function ensureBus(): GainNode | null {
  const g = audioGraph();
  if (!g) return null;
  if (!bus) {
    bus = g.ctx.createGain();
    bus.gain.value = 0;
    bus.connect(g.master);
  }
  return bus;
}

export async function start(atStage: number): Promise<void> {
  const g = audioGraph();
  const out = ensureBus();
  if (!g || !out) return;
  stop(0);
  setStage(atStage);
  out.gain.cancelScheduledValues(g.ctx.currentTime);
  out.gain.setTargetAtTime(LEVEL, g.ctx.currentTime, 0.15);
  if (await hasCustomTrack()) {
    if (!custom) {
      custom = new Audio(CUSTOM_URL);
      custom.loop = true;
      g.ctx.createMediaElementSource(custom).connect(out);
    }
    custom.currentTime = 0;
    void custom.play().catch(() => undefined);
    return;
  }
  step = 0;
  nextTime = g.ctx.currentTime + 0.05;
  timer = window.setInterval(schedule, 25);
}

/** Pulse Mode: a sub-bass thump on every beat and open hats, for the 8-second surf. */
export function setPulse(on: boolean): void {
  pulse = on;
}

/** Lighter arrangement for slow phones (fewer oscillators per step). */
export function setLite(on: boolean): void {
  lite = on;
}

export function setStage(s: number): void {
  stage = s;
  bpm = BASE_BPM + s * BPM_PER_STAGE;
  if (custom) custom.playbackRate = 1 + s * 0.03;
}

export function stop(fade: number): void {
  const g = audioGraph();
  window.clearInterval(timer);
  timer = 0;
  if (g && bus) {
    bus.gain.cancelScheduledValues(g.ctx.currentTime);
    bus.gain.setTargetAtTime(0, g.ctx.currentTime, Math.max(0.01, fade / 3));
  }
  if (custom) {
    const c = custom;
    window.setTimeout(() => c.pause(), fade * 1000);
  }
}

function schedule(): void {
  const g = audioGraph();
  if (!g || !bus) return;
  while (nextTime < g.ctx.currentTime + 0.12) {
    playStep(g.ctx, g.noise, bus, step, nextTime);
    nextTime += 60 / bpm / 4;
    step = (step + 1) % 64;
  }
}

function playStep(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, i: number, t: number): void {
  const barIdx = Math.floor(i / 16);
  const bar = BARS[barIdx];
  const s = i % 16;
  const sixteenth = 60 / bpm / 4;
  // Drums
  if (KICK.includes(s)) kick(ctx, noise, out, t);
  if (pulse && s % 4 === 0) subPulse(ctx, out, t);
  if (SNARE.includes(s)) snare(ctx, noise, out, t, 0.55);
  if (s === 15 && barIdx % 2 === 1) snare(ctx, noise, out, t, 0.18); // ghost fill
  hit(ctx, noise, out, t, 'highpass', 8000, s % 2 ? 0.07 : 0.14, 0.035);
  if (s % 4 === 2) hit(ctx, noise, out, t, 'highpass', 6500, stage >= 1 || pulse ? 0.12 : 0.06, 0.14); // open hat
  // Bass: driving 8ths bouncing between root and octave
  if (s % 2 === 0) bass(ctx, out, t, bar.root * (s % 4 === 2 ? 2 : 1), sixteenth * 1.8);
  // Offbeat chord plucks
  if (PLUCK.includes(s)) (lite ? bar.chord.slice(0, 1) : bar.chord).forEach((f) => pluck(ctx, out, t, f, lite ? 0.06 : 0.035));
  // Lead hook (doubled an octave up from stage 3)
  const n = HOOK[barIdx][s];
  if (n) {
    const len = HOOK[barIdx][(s + 1) % 16] ? sixteenth * 0.9 : sixteenth * 1.8;
    lead(ctx, out, t, n, len, 0.075);
    if (stage >= 2 && !lite) lead(ctx, out, t, n * 2, len, 0.025);
  }
}

function envGain(ctx: AudioContext, out: AudioNode, t: number, peak: number, decay: number, attack = 0.004): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(out);
  return g;
}

function subPulse(ctx: AudioContext, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(62, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  o.connect(envGain(ctx, out, t, 0.7, 0.32, 0.01));
  o.start(t);
  o.stop(t + 0.35);
}

function kick(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
  o.connect(envGain(ctx, out, t, 1.0, 0.26));
  o.start(t);
  o.stop(t + 0.3);
  hit(ctx, noise, out, t, 'highpass', 3000, 0.12, 0.012); // beater click
}

function snare(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number, peak: number): void {
  hit(ctx, noise, out, t, 'bandpass', 1900, peak, 0.16);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(230, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  o.connect(envGain(ctx, out, t, peak * 0.5, 0.1));
  o.start(t);
  o.stop(t + 0.12);
}

function bass(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number): void {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 6;
  lp.frequency.setValueAtTime(1400, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + len);
  o.connect(lp).connect(envGain(ctx, out, t, 0.32, len + 0.04));
  o.start(t);
  o.stop(t + len + 0.06);
}

function pluck(ctx: AudioContext, out: AudioNode, t: number, f: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3500, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 0.12);
  o.connect(lp).connect(envGain(ctx, out, t, peak, 0.14));
  o.start(t);
  o.stop(t + 0.16);
}

function lead(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.025); // little scoop, like a brass stab
  if (!lite) {
    // Vibrato (skipped on slow phones: one oscillator fewer per note)
    const vib = ctx.createOscillator();
    const vibAmt = ctx.createGain();
    vib.frequency.value = 6;
    vibAmt.gain.value = f * 0.008;
    vib.connect(vibAmt).connect(o.frequency);
    vib.start(t);
    vib.stop(t + len + 0.08);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  o.connect(lp).connect(envGain(ctx, out, t, peak, len + 0.06, 0.008));
  o.start(t);
  o.stop(t + len + 0.08);
}

function hit(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number, type: BiquadFilterType, f: number, peak: number, decay: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = f;
  src.connect(filt).connect(envGain(ctx, out, t, peak, decay, 0.002));
  src.start(t, Math.random() * 1.5);
  src.stop(t + decay + 0.02);
}
