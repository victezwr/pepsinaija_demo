// Sound effects, generated with the Web Audio API (no files to download). Every cue also posts
// a caption so the game still reads with the sound off.
import { getState, setState } from '../state/store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
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
    }
    if (ctx.state !== 'running') void ctx.resume();
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

let lastCoin = 0;
export function coin(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const step = now - lastCoin < 0.25 ? 1.12 : 1; // quick streaks climb in pitch
  lastCoin = now;
  tone('square', 1320 * step, 1980 * step, 0.06, 0.09);
}

// ---- Chase sounds (no captions on the frequent ones: the visuals carry them)

/** Lane change: an airy swoosh that sweeps across the stereo field in the swipe direction. */
export function swoosh(dir: -1 | 1): void {
  if (!ctx || !master) return;
  const src = noiseSource();
  if (!src) return;
  const t = ctx.currentTime;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
  f.frequency.exponentialRampToValueAtTime(1200, t + 0.26);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  let node: AudioNode = g;
  if (typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.6 * dir, t);
    pan.pan.linearRampToValueAtTime(0.8 * dir, t + 0.26);
    g.connect(pan);
    node = pan;
  }
  src.connect(f).connect(g);
  node.connect(master);
  src.start(t, Math.random());
  src.stop(t + 0.32);
}

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

/** The Chairman's pea whistle: a high, trilling "FEEEEW!". */
export function whistle(): void {
  caption('[whistle]');
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(2600, t);
  o.frequency.linearRampToValueAtTime(3000, t + 0.08);
  o.frequency.linearRampToValueAtTime(2850, t + 0.7);
  const trill = ctx.createOscillator();
  const depth = ctx.createGain();
  trill.frequency.value = 32; // the pea rattling
  depth.gain.value = 0.5;
  const amp = ctx.createGain();
  amp.gain.value = 0.5;
  trill.connect(depth).connect(amp.gain);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
  g.gain.setValueAtTime(0.32, t + 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  o.connect(amp).connect(g).connect(master);
  o.start(t);
  trill.start(t);
  o.stop(t + 0.8);
  trill.stop(t + 0.8);
}

/** Twisting the cap: a sharp gas hiss ("psssht"). */
export function capOpen(): void {
  caption('[psssht]');
  burst('highpass', 3500, 0.5, 0.004, 0.32);
  burst('bandpass', 6000, 0.25, 0.002, 0.12, 2);
}

/** Okada horn: a quick "pim-pim", panned to the lane it is coming down. */
export function horn(lane: number): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.22;
  let dest: AudioNode = out;
  if (typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = lane * 0.7;
    out.connect(pan);
    dest = pan;
  }
  dest.connect(master);
  [0, 0.16].forEach((dt) => {
    [420, 527].forEach((f) => {
      const o = ctx!.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.5, t + dt + 0.01);
      g.gain.setValueAtTime(0.5, t + dt + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.12);
      o.connect(g).connect(out);
      o.start(t + dt);
      o.stop(t + dt + 0.13);
    });
  });
}

/** The bottle smacking into a palm. */
export function catchIt(): void {
  burst('bandpass', 1800, 0.45, 0.002, 0.07, 1.5);
  tone('sine', 220, 120, 0.3, 0.1);
}

// ---- Pulse Mode

/** The meter just filled: a short rising fizz + bass swell. */
export function pulseCharge(): void {
  caption('[pulse ready]');
  if (!ctx) return;
  const src = noiseSource();
  if (src) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(800, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(5200, ctx.currentTime + 0.7);
    src.connect(f);
    env(f, 0.28, 0.6, 0.15);
    src.start();
    src.stop(ctx.currentTime + 0.8);
  }
  tone('sine', 55, 110, 0.4, 0.75);
}

/** Release: pressure hiss, a deep punchy bass hit, then a bubbling fizz layer. */
export function pulseRelease(): void {
  caption('[PULSE]');
  burst('highpass', 2500, 0.55, 0.003, 0.35);
  tone('sine', 120, 38, 1.0, 0.6);
  tone('triangle', 70, 35, 0.35, 0.5);
  if (!ctx) return;
  // Bubbles: a scatter of tiny high blips over half a second
  for (let i = 0; i < 14; i++) {
    const f = 1400 + Math.random() * 2600;
    tone('sine', f, f * 1.4, 0.05, 0.05, 0.08 + Math.random() * 0.5);
  }
}

/** End of the surf: a descending fizz tail. */
export function pulseEnd(): void {
  if (!ctx) return;
  const src = noiseSource();
  if (!src) return;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1;
  f.frequency.setValueAtTime(4500, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.7);
  src.connect(f);
  env(f, 0.3, 0.05, 0.7);
  src.start();
  src.stop(ctx.currentTime + 0.8);
}

