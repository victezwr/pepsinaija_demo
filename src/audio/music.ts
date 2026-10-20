// Chase music. Uses public/audio/game-music.mp3 when the owner adds one; otherwise plays a
// generated Afrobeats-style loop (kick, clap, shaker, bell, log-drum bass, offbeat chord stabs,
// marimba hook) that speeds up with each speed stage.
import { audioGraph } from './sfx';

const CUSTOM_URL = '/audio/game-music.mp3';
const BASE_BPM = 108;
const BPM_PER_STAGE = 5;
const LEVEL = 0.32;

// Four bars: F, G, Em7, Am (root, then chord tones an octave up)
const BARS: ReadonlyArray<{ root: number; chord: number[] }> = [
  { root: 87.31, chord: [349.23, 440, 523.25] },
  { root: 98, chord: [392, 493.88, 587.33] },
  { root: 82.41, chord: [329.63, 392, 493.88] },
  { root: 110, chord: [440, 523.25, 659.25] },
];
const KICK = [0, 6, 8, 14];
const CLAP = [4, 12];
const BELL = [0, 3, 6, 10, 12];
const BASS = [0, 3, 7, 10, 13];
const STAB = [2, 6, 10, 14];
// Marimba hook (A minor pentatonic), one phrase per bar; 0 = rest
const HOOK: ReadonlyArray<ReadonlyArray<number>> = [
  [880, 0, 0, 784, 0, 0, 659, 0, 784, 0, 0, 659, 0, 0, 587, 0],
  [659, 0, 0, 587, 0, 0, 523, 0, 587, 0, 0, 0, 659, 0, 0, 0],
  [880, 0, 0, 784, 0, 0, 659, 0, 784, 0, 0, 880, 0, 0, 988, 0],
  [880, 0, 0, 0, 784, 0, 659, 0, 587, 0, 523, 0, 0, 0, 0, 0],
];

let bus: GainNode | null = null;
let timer = 0;
let step = 0;
let nextTime = 0;
let bpm = BASE_BPM;
let stage = 0;
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
  stage = atStage;
  bpm = BASE_BPM + stage * BPM_PER_STAGE;
  out.gain.cancelScheduledValues(g.ctx.currentTime);
  out.gain.setTargetAtTime(LEVEL, g.ctx.currentTime, 0.3);
  if (await hasCustomTrack()) {
    if (!custom) {
      custom = new Audio(CUSTOM_URL);
      custom.loop = true;
      g.ctx.createMediaElementSource(custom).connect(out);
    }
    custom.currentTime = 0;
    custom.playbackRate = 1;
    void custom.play().catch(() => undefined);
    return;
  }
  step = 0;
  nextTime = g.ctx.currentTime + 0.06;
  timer = window.setInterval(schedule, 25);
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
  const bar = BARS[Math.floor(i / 16)];
  const s = i % 16;
  if (KICK.includes(s)) kick(ctx, out, t);
  if (CLAP.includes(s)) hit(ctx, noise, out, t, 'bandpass', 1500, 0.4, 0.12);
  hit(ctx, noise, out, t, 'highpass', 7000, s % 2 ? 0.13 : 0.07, 0.03);
  if (stage >= 2 && s % 4 === 2) hit(ctx, noise, out, t, 'highpass', 6000, 0.08, 0.12); // open hat from stage 3
  if (BELL.includes(s)) note(ctx, out, t, 'triangle', 1760, 0.05, 0.05);
  if (BASS.includes(s)) logDrum(ctx, out, t, bar.root * (s === 10 ? 1.5 : 1));
  if (STAB.includes(s)) bar.chord.forEach((f) => note(ctx, out, t, 'triangle', f, 0.045, 0.16));
  const hook = HOOK[Math.floor(i / 16)][s];
  if (hook) {
    note(ctx, out, t, 'sine', hook, 0.09, 0.28);
    note(ctx, out, t, 'sine', hook * 4, 0.012, 0.08); // mallet click
  }
}

function envGain(ctx: AudioContext, out: AudioNode, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(out);
  return g;
}

function kick(ctx: AudioContext, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  o.connect(envGain(ctx, out, t, 0.85, 0.28));
  o.start(t);
  o.stop(t + 0.3);
}

function logDrum(ctx: AudioContext, out: AudioNode, t: number, f: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  o.connect(lp).connect(envGain(ctx, out, t, 0.55, 0.38));
  o.start(t);
  o.stop(t + 0.4);
}

function note(ctx: AudioContext, out: AudioNode, t: number, type: OscillatorType, f: number, peak: number, decay: number): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(envGain(ctx, out, t, peak, decay));
  o.start(t);
  o.stop(t + decay + 0.02);
}

function hit(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, t: number, type: BiquadFilterType, f: number, peak: number, decay: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = f;
  src.connect(filt).connect(envGain(ctx, out, t, peak, decay));
  src.start(t, Math.random() * 1.5);
  src.stop(t + decay + 0.02);
}
