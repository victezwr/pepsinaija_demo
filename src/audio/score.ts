// The Nigerian arcade layer, generated with the Web Audio API and tuned to the theme (D minor,
// 124 BPM): dùndún talking drum, agogo bell, trumpet and brass stabs.
// - The cinematic's own score: a low talking-drum groove, three suspicious trumpet notes and
//   the fanfare that throws into the theme.
// - Chase intensity layers stacked on the theme at the distance milestones, locked to its beat
//   grid (music.beatTime), faded in and out smoothly.
// Everything goes through the master bus, so mute silences it.
import * as music from './music';
import { audioGraph } from './sfx';

// D minor (the theme's key): tonic, b3, 4, 5 in the drum's range; the trumpet's D, Eb (the
// suspicious b2), F, A, D, C
const D3 = 146.83, F3 = 174.61, G3 = 196.0, A3 = 220.0;
const D4 = 293.66, EB4 = 311.13, F4 = 349.23, A4 = 440.0, D5 = 587.33, C5 = 523.25;

type Ctx = AudioContext;

function envGain(ctx: Ctx, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

/**
 * Dùndún stroke: a tight membrane whose pitch the player squeezes (`bend`: ratio over the stroke),
 * a stick click and a little body.
 */
function talkingDrum(ctx: Ctx, out: AudioNode, noise: AudioBuffer, t: number, f: number, bend: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * bend, t + 0.16);
  const o2 = ctx.createOscillator(); // the drum's second mode, slightly inharmonic
  o2.type = 'sine';
  o2.frequency.setValueAtTime(f * 1.58, t);
  o2.frequency.exponentialRampToValueAtTime(f * 1.58 * bend, t + 0.16);
  const body = envGain(ctx, out, t, peak, 0.004, 0.24);
  o.connect(body);
  const g2 = envGain(ctx, out, t, peak * 0.3, 0.003, 0.12);
  o2.connect(g2);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.3);
  o2.stop(t + 0.18);
  // Stick on skin
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 1.4;
  n.connect(bp).connect(envGain(ctx, out, t, peak * 0.35, 0.001, 0.03));
  n.start(t, Math.random());
  n.stop(t + 0.05);
}

/** Agogo bell: two inharmonic partials, fast decay. */
function agogo(ctx: Ctx, out: AudioNode, t: number, f: number, peak: number): void {
  for (const [ratio, amp] of [[1, 1], [2.76, 0.35]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    o.connect(envGain(ctx, out, t, peak * amp, 0.002, 0.16));
    o.start(t);
    o.stop(t + 0.2);
  }
}

/** Trumpet: a brassy blat (filter opens on the attack), a lip scoop into the note, then vibrato. */
function trumpet(ctx: Ctx, out: AudioNode, t: number, f: number, len: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 0.94, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5.5;
  vibAmt.gain.setValueAtTime(0, t);
  vibAmt.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, len));
  vib.connect(vibAmt).connect(o.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(600, t);
  lp.frequency.exponentialRampToValueAtTime(3800, t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(1800, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
  g.gain.setValueAtTime(peak * 0.8, t + Math.max(0.05, len - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  vib.start(t);
  o.stop(t + len + 0.08);
  vib.stop(t + len + 0.08);
}

/** Brass section stab: the D minor triad, short and punchy. */
function brassStab(ctx: Ctx, out: AudioNode, t: number, peak: number): void {
  for (const f of [D4, F4, A4]) trumpet(ctx, out, t, f, 0.12, peak / 2);
}

/** Tension riser: noise sweeping up over `len`. */
function riser(ctx: Ctx, out: AudioNode, noise: AudioBuffer, t: number, len: number, peak: number): void {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + len * 0.95);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
  n.connect(bp).connect(g).connect(out);
  n.start(t);
  n.stop(t + len + 0.1);
}

// ---------------------------------------------------------------------------
// Cinematic score (before the theme starts)

// One bar of dùndún "speech": [step, pitch, bend, level]. Low, conversational, a question and an answer.
const GROOVE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, D3, 1.0, 1],
  [3, F3, 0.86, 0.6],
  [6, D3, 1.0, 0.7],
  [8, A3, 0.8, 0.8],
  [10, G3, 1.12, 0.5],
  [11, F3, 0.9, 0.55],
  [14, D3, 1.0, 0.6],
];

let cineBus: GainNode | null = null;
let grooveTimer = 0;
let grooveNext = 0;
let grooveStep = 0;

function cineOut(): { ctx: Ctx; out: GainNode; noise: AudioBuffer } | null {
  const g = audioGraph();
  if (!g) return null;
  if (!cineBus) {
    cineBus = g.ctx.createGain();
    cineBus.connect(g.master);
  }
  return { ctx: g.ctx, out: cineBus, noise: g.noise };
}

/** The low talking-drum groove under the cinematic (`level` 0..1). */
export function startGroove(level: number): void {
  const a = cineOut();
  if (!a) return;
  stopGroove(0);
  a.out.gain.cancelScheduledValues(a.ctx.currentTime);
  a.out.gain.setTargetAtTime(0.55 * level, a.ctx.currentTime, 0.4);
  grooveStep = 0;
  grooveNext = a.ctx.currentTime + 0.05;
  grooveTimer = window.setInterval(scheduleGroove, 25);
}

export function stopGroove(fade: number): void {
  window.clearInterval(grooveTimer);
  grooveTimer = 0;
  const a = cineOut();
  if (a && fade > 0) a.out.gain.setTargetAtTime(0, a.ctx.currentTime, fade / 3);
}

function scheduleGroove(): void {
  const a = cineOut();
  if (!a) return;
  const sixteenth = music.BEAT_S / 4;
  while (grooveNext < a.ctx.currentTime + 0.12) {
    const s = grooveStep % 16;
    for (const [step, f, bend, lvl] of GROOVE) if (step === s) talkingDrum(a.ctx, a.out, a.noise, grooveNext, f, bend, 0.5 * lvl);
    grooveNext += sixteenth;
    grooveStep++;
  }
}

/** Beat A: three short, suspicious trumpet notes. */
export function suspiciousTrumpet(): void {
  const a = cineOut();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  const b = music.BEAT_S;
  trumpet(a.ctx, a.out, t, D4, b * 0.45, 0.16);
  trumpet(a.ctx, a.out, t + b, EB4, b * 0.45, 0.16);
  trumpet(a.ctx, a.out, t + b * 2, D4, b * 0.9, 0.16);
}

/** Beat E: the trumpet motif and drums that throw into the theme. */
export function fanfare(): void {
  const a = cineOut();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  const s = music.BEAT_S / 2;
  a.out.gain.cancelScheduledValues(a.ctx.currentTime);
  a.out.gain.setValueAtTime(0.55, a.ctx.currentTime);
  [D4, F4, A4].forEach((f, i) => trumpet(a.ctx, a.out, t + i * s, f, s * 0.8, 0.2));
  trumpet(a.ctx, a.out, t + 3 * s, D5, s * 2.2, 0.22);
  // Drum roll up into it
  for (let i = 0; i < 6; i++) talkingDrum(a.ctx, a.out, a.noise, t + i * (s / 2), D3 * (1 + i * 0.08), 1.1, 0.4 + i * 0.06);
}

// ---------------------------------------------------------------------------
// Chase intensity layers, on the theme's beat grid

let layerBus: GainNode | null = null;
let layerTimer = 0;
let layerBeat = 0; // next sixteenth (in beats, quarter-steps) to schedule
let intensity = 0; // 0..4 (speed stage)

// Agogo: high/low bell pattern over one bar of 16ths
const AGOGO_HI = [0, 3, 6, 10, 12];
const AGOGO_LO = [8, 14];
// Talking-drum fill over two beats (8 sixteenths): [step, pitch, bend]
const FILL: ReadonlyArray<readonly [number, number, number]> = [
  [0, A3, 0.85],
  [2, G3, 1.1],
  [3, F3, 0.9],
  [4, A3, 1.0],
  [5, G3, 0.85],
  [6, D3, 1.15],
  [7, F3, 0.8],
];

/** Start the layer engine at run start. It waits for the theme's clock if the song is still loading. */
export function startLayers(): void {
  const g = audioGraph();
  if (!g) return;
  if (!layerBus) {
    layerBus = g.ctx.createGain();
    layerBus.gain.value = 0;
    layerBus.connect(g.master);
  }
  window.clearInterval(layerTimer);
  layerBeat = NaN;
  layerTimer = window.setInterval(scheduleLayers, 25);
}

/** Distance milestone (speed stage 0..4). Fades the layer bus so nothing spikes. */
export function setIntensity(stage: number): void {
  intensity = stage;
  const g = audioGraph();
  if (!g || !layerBus) return;
  layerBus.gain.setTargetAtTime(stage > 0 ? 0.5 : 0, g.ctx.currentTime, 0.6);
}

/** Test hook: the current layer intensity (0..4) and whether the engine runs. */
export function debugIntensity(): { level: number; running: boolean } {
  return { level: intensity, running: layerTimer !== 0 };
}

export function stopLayers(): void {
  window.clearInterval(layerTimer);
  layerTimer = 0;
  const g = audioGraph();
  if (g && layerBus) layerBus.gain.setTargetAtTime(0, g.ctx.currentTime, 0.2);
}

function scheduleLayers(): void {
  const g = audioGraph();
  const b = music.beat();
  if (!g || !layerBus || b === null) return;
  // First tick on the song's clock, or the clock jumped (tab was hidden)
  if (Number.isNaN(layerBeat) || layerBeat < b - 1) layerBeat = Math.ceil(b * 4) / 4;
  while ((layerBeat - b) * music.BEAT_S < 0.12) {
    const at = music.beatTime(layerBeat);
    if (at !== null && at > g.ctx.currentTime) playLayerStep(g.ctx, layerBus, g.noise, Math.round(layerBeat * 4), at);
    layerBeat += 0.25;
  }
}

function playLayerStep(ctx: Ctx, out: AudioNode, noise: AudioBuffer, sixteenth: number, t: number): void {
  if (intensity <= 0) return;
  const s = ((sixteenth % 16) + 16) % 16;
  const bar = Math.floor(sixteenth / 16);
  // 500 m: agogo + brass accents every 4 bars
  if (AGOGO_HI.includes(s)) agogo(ctx, out, t, C5 * 1.5, 0.09);
  if (AGOGO_LO.includes(s)) agogo(ctx, out, t, A4 * 1.5, 0.08);
  const stabEvery = intensity >= 4 ? 1 : intensity >= 3 ? 2 : 4;
  if (s === 0 && bar % stabEvery === 0) brassStab(ctx, out, t, 0.18);
  // 1,200 m: talking-drum fills answering every 2 bars (every bar at full intensity)
  if (intensity >= 2) {
    const fillEvery = intensity >= 4 ? 1 : 2;
    if (bar % fillEvery === fillEvery - 1 && s >= 8) {
      for (const [step, f, bend] of FILL) if (step === s - 8) talkingDrum(ctx, out, noise, t, f, bend, 0.32);
    }
  }
  // 2,000 m: tension riser into every 8th bar, pickup stabs
  if (intensity >= 3) {
    if (bar % 8 === 7 && s === 0) riser(ctx, out, noise, t, music.BEAT_S * 4, 0.12);
    if (s === 14 && bar % 2 === 1) brassStab(ctx, out, t, 0.12);
  }
  // 3,000 m: shaker 16ths on top
  if (intensity >= 4) {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    n.connect(hp).connect(envGain(ctx, out, t, s % 4 === 2 ? 0.07 : 0.035, 0.002, 0.05));
    n.start(t, Math.random());
    n.stop(t + 0.07);
  }
}

/** Game over: a deflating trumpet ("wah, wah, wah, waaah"). */
export function gameOverSting(): void {
  const a = cineOut();
  if (!a) return;
  a.out.gain.cancelScheduledValues(a.ctx.currentTime);
  a.out.gain.setValueAtTime(0.55, a.ctx.currentTime);
  const t = a.ctx.currentTime + 0.35;
  [A3, 207.65, G3].forEach((f, i) => trumpet(a.ctx, a.out, t + i * 0.32, f, 0.26, 0.15));
  trumpet(a.ctx, a.out, t + 0.96, 185.0, 0.9, 0.15);
}
