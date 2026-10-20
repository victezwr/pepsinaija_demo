// Placeholder sound design, generated with the Web Audio API (no files to download).
// Every cue also posts a caption so the story survives with the sound off.
import { getState, setState } from '../state/store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let fizzGain: GainNode | null = null;
let rumbleGain: GainNode | null = null;
let peelGain: GainNode | null = null;
let captionTimer = 0;

export function caption(text: string, ms = 1400): void {
  setState({ caption: text });
  window.clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => setState({ caption: null }), ms);
}

/** Must run inside a user gesture (the wake-up tap). */
export function unlock(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = getState().muted ? 0 : 0.9;
      master.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startLoops();
    }
    void ctx.resume();
  } catch {
    setState({ audioOk: false });
  }
}

/** Shared graph for the music module (null until the first tap unlocks audio). */
export function audioGraph(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  return ctx && master && noise ? { ctx, master, noise } : null;
}

export function setMuted(muted: boolean): void {
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
}

function noiseSource(loop = false): AudioBufferSourceNode | null {
  if (!ctx || !noise) return null;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = loop;
  if (loop) src.loopStart = Math.random();
  return src;
}

function startLoops(): void {
  if (!ctx || !master) return;
  // Fizz bed: high-passed noise, level driven by the story.
  const fz = noiseSource(true);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;
  fizzGain = ctx.createGain();
  fizzGain.gain.value = 0;
  fz?.connect(hp).connect(fizzGain).connect(master);
  fz?.start();

  // Rumble bed: low sine + low-passed noise.
  rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  const osc = ctx.createOscillator();
  osc.frequency.value = 42;
  const rn = noiseSource(true);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 110;
  osc.connect(rumbleGain);
  rn?.connect(lp).connect(rumbleGain);
  rumbleGain.connect(master);
  osc.start();
  rn?.start();

  // Peel crackle: band-passed noise, gain jittered per frame while dragging.
  const pn = noiseSource(true);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 2.5;
  peelGain = ctx.createGain();
  peelGain.gain.value = 0;
  pn?.connect(bp).connect(peelGain).connect(master);
  pn?.start();
}

export function fizz(level: number): void {
  if (ctx && fizzGain) fizzGain.gain.setTargetAtTime(Math.min(0.5, level), ctx.currentTime, 0.08);
}

export function rumble(seconds: number): void {
  if (!ctx || !rumbleGain) return;
  const g = rumbleGain.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.55, t + seconds * 0.6);
  g.linearRampToValueAtTime(0.06, t + seconds);
}

export function silence(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  rumbleGain?.gain.setTargetAtTime(0, t, 0.05);
  fizzGain?.gain.setTargetAtTime(0, t, 0.05);
  peelGain?.gain.setTargetAtTime(0, t, 0.03);
}

export function peelCrackle(speed: number): void {
  if (!ctx || !peelGain) return;
  const level = Math.min(0.6, speed) * (0.5 + Math.random() * 0.8);
  peelGain.gain.setTargetAtTime(level, ctx.currentTime, 0.02);
}

function env(node: AudioNode, peak: number, attack: number, decay: number, at = 0): GainNode | null {
  if (!ctx || !master) return null;
  const g = ctx.createGain();
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  node.connect(g).connect(master);
  return g;
}

function burst(filterType: BiquadFilterType, freq: number, peak: number, attack: number, decay: number, q = 1): void {
  if (!ctx) return;
  const src = noiseSource();
  if (!src) return;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f);
  env(f, peak, attack, decay);
  src.start();
  src.stop(ctx.currentTime + attack + decay + 0.05);
}

function tone(type: OscillatorType, from: number, to: number, peak: number, dur: number, at = 0): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  const t = ctx.currentTime + at;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(o, peak, 0.005, dur, at);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function hiss(seconds: number): void {
  caption('[pressure building]');
  if (!ctx) return;
  const src = noiseSource();
  if (!src) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(1500, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(6000, ctx.currentTime + seconds);
  src.connect(f);
  env(f, 0.5, seconds * 0.9, 0.1);
  src.start();
  src.stop(ctx.currentTime + seconds + 0.2);
}

export function pop(): void {
  caption('[POP!]');
  burst('highpass', 900, 0.9, 0.003, 0.09);
  tone('sine', 520, 70, 0.8, 0.14);
}

export function whoosh(seconds = 0.35, peak = 0.35): void {
  if (!ctx) return;
  const src = noiseSource();
  if (!src) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(350, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + seconds);
  src.connect(f);
  env(f, peak, seconds * 0.45, seconds * 0.55);
  src.start();
  src.stop(ctx.currentTime + seconds + 0.1);
}

export function thud(): void {
  caption('[THUD]');
  tone('sine', 120, 42, 0.95, 0.4);
  burst('lowpass', 260, 0.6, 0.002, 0.12);
  tone('triangle', 1900, 1700, 0.06, 0.5, 0.01); // faint plastic ring
}

export function slam(): void {
  tone('sine', 90, 50, 0.5, 0.25);
  burst('lowpass', 600, 0.25, 0.002, 0.08);
}

export function flick(): void {
  caption('[label flies off]');
  whoosh(0.45, 0.5);
  burst('bandpass', 3500, 0.3, 0.002, 0.05, 3);
}

export function monster(): void {
  tone('sine', 70, 38, 0.9, 0.9);
  tone('sawtooth', 110, 55, 0.08, 0.7);
}

export function boing(): void {
  caption('[storms off]');
  tone('triangle', 180, 520, 0.35, 0.28);
  whoosh(0.4, 0.4);
}

export function sting(): void {
  caption('[sting]', 1800);
  // Bright, short major chord over a sub hit.
  [523.25, 659.25, 783.99].forEach((f, i) => tone('triangle', f, f * 0.995, 0.18, 1.1, i * 0.03));
  tone('sine', 65, 45, 0.7, 0.6);
}

let lastCoin = 0;
export function coin(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const step = now - lastCoin < 0.25 ? 1.12 : 1; // quick streaks climb in pitch
  lastCoin = now;
  tone('square', 1320 * step, 1980 * step, 0.06, 0.09);
}

// ---- Chase sounds (no captions on the frequent ones: the visuals carry them)

export function jump(): void {
  tone('sine', 260, 720, 0.35, 0.16);
  whoosh(0.22, 0.14);
}

export function land(): void {
  tone('sine', 140, 60, 0.4, 0.12);
  burst('lowpass', 500, 0.18, 0.002, 0.05);
}

export function slide(): void {
  if (!ctx) return;
  const src = noiseSource();
  if (!src) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(900, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.5);
  src.connect(f);
  env(f, 0.4, 0.03, 0.5);
  src.start();
  src.stop(ctx.currentTime + 0.6);
}

/** Hitting an obstacle: a glancing knock, or (hard) the full smash when you're caught. */
export function crash(hard: boolean): void {
  burst('lowpass', hard ? 900 : 1400, hard ? 0.9 : 0.55, 0.002, hard ? 0.35 : 0.16);
  // Metal panel ring: inharmonic partials like a danfo door
  [410, 587, 911].forEach((f, i) => tone('triangle', f, f * 0.97, (hard ? 0.16 : 0.1) / (i + 1), hard ? 0.5 : 0.25));
  tone('sine', hard ? 90 : 130, 40, hard ? 0.9 : 0.5, hard ? 0.5 : 0.22);
  if (hard) {
    caption('[CRASH]');
    burst('bandpass', 750, 0.3, 0.04, 0.5, 1.2); // the crowd's "ehn!"
  }
}

export function sparkle(): void {
  caption('[new yellow cap]');
  [1318.5, 1760, 2093].forEach((f, i) => tone('sine', f, f, 0.12, 0.35, i * 0.06));
}
