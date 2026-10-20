// Agbero shouts. Real recordings win: drop public/audio/agbero-1.mp3 … agbero-6.mp3 (people
// shouting "Oya!", "Hold am!", "Where you dey go?!") and they are used at random. Until then a
// formant synth makes rough, angry two-syllable shouts ("o-YA!", "HEY!").
import { audioGraph } from './sfx';

const MAX_CLIPS = 6;
let clips: AudioBuffer[] | null = null;
let loading: Promise<void> | null = null;
let lastShout = 0;

/** Fetch any owner-provided shout recordings (missing files are simply skipped). */
export function preloadVoices(): void {
  const g = audioGraph();
  if (!g || loading) return;
  loading = (async () => {
    const found: AudioBuffer[] = [];
    for (let i = 1; i <= MAX_CLIPS; i++) {
      try {
        const r = await fetch(`/audio/agbero-${i}.mp3`);
        if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('audio')) continue;
        found.push(await g.ctx.decodeAudioData(await r.arrayBuffer()));
      } catch {
        /* optional asset */
      }
    }
    clips = found;
  })();
}

/** One shout, or a crowd of `voices` overlapping shouts. Rate-limited so they never pile up. */
export function shout(voices = 1, loud = 0.5): void {
  const g = audioGraph();
  if (!g) return;
  const now = g.ctx.currentTime;
  if (now - lastShout < 0.35) return;
  lastShout = now;
  for (let v = 0; v < voices; v++) {
    const at = now + v * 0.09 + Math.random() * 0.06;
    if (clips?.length) playClip(g.ctx, g.master, clips[Math.floor(Math.random() * clips.length)], at, loud);
    else synthShout(g.ctx, g.master, g.noise, at, loud / Math.sqrt(voices));
  }
}

function playClip(ctx: AudioContext, out: AudioNode, buf: AudioBuffer, at: number, loud: number): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.92 + Math.random() * 0.16; // a different voice each time
  const g = ctx.createGain();
  g.gain.value = loud * 1.6;
  src.connect(g).connect(out);
  src.start(at);
}

// Vowel formants (Hz): o, a, e
const VOWELS: ReadonlyArray<[number, number, number]> = [
  [570, 840, 2410],
  [730, 1090, 2440],
  [530, 1840, 2480],
];

function synthShout(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, t: number, peak: number): void {
  const f0 = 115 + Math.random() * 55; // stocky men, angry
  const twoSyllables = Math.random() < 0.65; // "o-YA!" vs "HEY!"
  if (twoSyllables) syllable(ctx, out, noise, t, f0 * 0.95, VOWELS[0], 0.12, peak * 0.7);
  const t2 = twoSyllables ? t + 0.13 : t;
  syllable(ctx, out, noise, t2, f0 * 1.25, VOWELS[1 + Math.floor(Math.random() * 2)], 0.38, peak);
}

function syllable(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, t: number, f0: number, formants: [number, number, number], len: number, peak: number): void {
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(f0 * 0.85, t);
  src.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + len * 0.25); // the angry rise
  src.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + len);
  // Rasp: soft clipping
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 3);
  }
  shaper.curve = curve;
  src.connect(shaper);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.025);
  env.gain.setValueAtTime(peak, t + len * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  env.connect(out);
  formants.forEach((f, i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 7;
    const g = ctx.createGain();
    g.gain.value = [1, 0.55, 0.25][i] * 3;
    shaper.connect(bp).connect(g).connect(env);
  });
  // Breath
  const br = ctx.createBufferSource();
  br.buffer = noise;
  const bf = ctx.createBiquadFilter();
  bf.type = 'bandpass';
  bf.frequency.value = 2200;
  const bg = ctx.createGain();
  bg.gain.value = 0.25;
  br.connect(bf).connect(bg).connect(env);
  src.start(t);
  src.stop(t + len + 0.05);
  br.start(t, Math.random());
  br.stop(t + len + 0.05);
}
