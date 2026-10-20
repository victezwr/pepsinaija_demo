// Music. The theme song (public/audio/theme.mp3) starts on PLAY and runs under the whole
// experience; everything rhythmic in the game (obstacle rows, cap chimes, the Pulse) is timed
// to its beat grid via beat(). If the song can't load, a generated high-energy loop plays
// instead and the game keeps its own clock at the same tempo.
import { audioGraph } from './sfx';

// Theme beat grid, measured from the file: 155.76 BPM, first beat 0.320 s in.
const THEME_URL = '/audio/theme.mp3';
export const THEME_BPM = 155.76;
export const BEAT_S = 60 / THEME_BPM;
const FIRST_BEAT_S = 0.32;
// Loop a whole number of 16-beat phrases, so the grid never slips when it wraps: from beat 51
// (19.97 s, past the quieter opening, same level as the end) to just before the fade-out
// (130.91 s). The song's first 20 s play once, from the chase start.
const LOOP_START = FIRST_BEAT_S + 51 * BEAT_S;
const LOOP_END = LOOP_START + 18 * 16 * BEAT_S;
const THEME_LEVEL = 0.8;
const DUCK_LEVEL = 0.3;

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

// Theme playback
let themeData: Promise<AudioBuffer | null> | null = null;
let themeBus: GainNode | null = null;
let themeSrc: AudioBufferSourceNode | null = null;
let themeStart = 0; // ctx time the song's 0:00 played at
let pulseTimer = 0;
let nextPulseBeat = 0;

/**
 * Fetch and decode the theme early (before any tap: an offline context needs no gesture),
 * so PLAY can start it instantly.
 */
export function preloadTheme(): Promise<AudioBuffer | null> {
  themeData ??= fetch(THEME_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((buf) => {
      const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      return new OAC(1, 1, 44100).decodeAudioData(buf);
    })
    .catch(() => null);
  return themeData;
}

/** PLAY: the theme from the top. Call inside the tap, after sfx.unlock(). */
export async function startTheme(): Promise<boolean> {
  const g = audioGraph();
  if (!g) return false;
  const buffer = await preloadTheme();
  if (!buffer) return false;
  stopGenerated();
  themeSrc?.stop();
  if (!themeBus) {
    themeBus = g.ctx.createGain();
    themeBus.connect(g.master);
  }
  themeBus.gain.cancelScheduledValues(g.ctx.currentTime);
  themeBus.gain.setValueAtTime(THEME_LEVEL, g.ctx.currentTime);
  const src = g.ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = LOOP_START;
  src.loopEnd = Math.min(LOOP_END, buffer.duration);
  src.connect(themeBus);
  themeStart = g.ctx.currentTime + 0.03;
  src.start(themeStart);
  themeSrc = src;
  return true;
}

export function themePlaying(): boolean {
  return themeSrc !== null;
}

/**
 * Where the theme is right now, in beats since its first beat (continuous across loops,
 * corrected for output latency so visuals land on what you hear). Null without the theme.
 */
export function beat(): number | null {
  const g = audioGraph();
  if (!g || !themeSrc) return null;
  const heard = g.ctx.currentTime - (g.ctx.outputLatency || g.ctx.baseLatency || 0);
  return (heard - themeStart - FIRST_BEAT_S) / BEAT_S;
}

/** Audio-clock time at which beat `n` of the theme is heard (null without the theme). */
export function beatTime(n: number): number | null {
  const g = audioGraph();
  if (!g || !themeSrc) return null;
  return themeStart + FIRST_BEAT_S + n * BEAT_S + (g.ctx.outputLatency || g.ctx.baseLatency || 0);
}

/** Seconds from now until the theme reaches beat `n` (null without the theme). */
export function secondsToBeat(n: number): number | null {
  const b = beat();
  return b === null ? null : (n - b) * BEAT_S;
}

/** Game over: the song sinks under the crowd; RUN AGAIN brings it back. */
export function duck(on: boolean): void {
  const g = audioGraph();
  if (!g || !themeBus) return;
  themeBus.gain.cancelScheduledValues(g.ctx.currentTime);
  themeBus.gain.setTargetAtTime(on ? DUCK_LEVEL : THEME_LEVEL, g.ctx.currentTime, on ? 0.25 : 0.1);
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

/** Run start. With the theme already playing it just keeps going (un-ducked). */
export function start(atStage: number): void {
  setStage(atStage);
  if (themeSrc) {
    duck(false);
    return;
  }
  const g = audioGraph();
  const out = ensureBus();
  if (!g || !out) return;
  stopGenerated();
  out.gain.cancelScheduledValues(g.ctx.currentTime);
  out.gain.setTargetAtTime(LEVEL, g.ctx.currentTime, 0.15);
  step = 0;
  nextTime = g.ctx.currentTime + 0.05;
  timer = window.setInterval(schedule, 25);
}

/** Pulse Mode: a sub-bass thump on every beat (locked to the theme's grid) and open hats. */
export function setPulse(on: boolean): void {
  pulse = on;
  window.clearInterval(pulseTimer);
  pulseTimer = 0;
  const b = beat();
  if (!on || b === null) return;
  nextPulseBeat = Math.ceil(b);
  pulseTimer = window.setInterval(schedulePulse, 25);
}

function schedulePulse(): void {
  const g = audioGraph();
  const b = beat();
  if (!g || !themeBus || b === null) return;
  // Schedule thumps up to 0.12 s ahead, on the theme's own beat times.
  while ((nextPulseBeat - b) * BEAT_S < 0.12) {
    const at = themeStart + FIRST_BEAT_S + nextPulseBeat * BEAT_S + (g.ctx.outputLatency || g.ctx.baseLatency || 0);
    if (at > g.ctx.currentTime) subPulse(g.ctx, themeBus, at);
    nextPulseBeat++;
  }
}

/** Lighter arrangement for slow phones (fewer oscillators per step). */
export function setLite(on: boolean): void {
  lite = on;
}

export function setStage(s: number): void {
  stage = s;
  bpm = BASE_BPM + s * BPM_PER_STAGE;
}

/** Game over without the theme: fade the generated loop out. */
export function stop(fade: number): void {
  if (themeSrc) {
    duck(true);
    return;
  }
  const g = audioGraph();
  window.clearInterval(timer);
  timer = 0;
  if (g && bus) {
    bus.gain.cancelScheduledValues(g.ctx.currentTime);
    bus.gain.setTargetAtTime(0, g.ctx.currentTime, Math.max(0.01, fade / 3));
  }
}

function stopGenerated(): void {
  window.clearInterval(timer);
  timer = 0;
  const g = audioGraph();
  if (g && bus) bus.gain.setTargetAtTime(0, g.ctx.currentTime, 0.05);
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
