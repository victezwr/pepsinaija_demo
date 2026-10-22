// Agbero shouts. Real recordings win: drop public/audio/agbero-1.mp3 … agbero-6.mp3 (people
// shouting "Oya!", "Hold am!", "Where you dey go?!") and they are used at random. Until then a
// formant synth makes rough, angry two-syllable shouts ("o-YA!", "HEY!"), rendered once offline
// into a few buffers so a shout during play is a single playback node (cheap on slow phones).
import { playRecording } from './recordings';
import { audioGraph } from './sfx';

/** The spoken lines, by their text → the recording that voices them (public/audio/voice/<cue>.mp3). */
export const LINE_CUES: Readonly<Record<string, string>> = {
  'Afa, wetin be that wey dey shine? Gimme am ASAP!': 'agbero-gimme',
  'If I catch you!': 'agberos-if-i-catch-you',
  'You dey use me play, abi?!': 'agbero-use-me-play',
  'Ha! Wetin be that?!': 'chairman-wetin',
  'We don catch am!': 'agberos-caught',
  'Ehn? Wetin dey inside this cap sef?': 'chairman-inside-cap',
};

/** A line of dialogue: its recording if there is one, else (voices > 0) a generic shout. */
export function speak(text: string, voices: number, loud: number): void {
  const g = audioGraph();
  const cue = LINE_CUES[text] ?? '';
  if (g && cue && playRecording(g.ctx, g.master, `voice/${cue}`)) return;
  if (voices > 0) shout(voices, loud);
}

const MAX_CLIPS = 6;
let clips: AudioBuffer[] | null = null;
let synthClips: AudioBuffer[] | null = null;
const SYNTH_VARIANTS = 6;
let loading: Promise<void> | null = null;
let lastShout = 0;

/** Fetch any owner-provided shout recordings (missing files are simply skipped); pre-render the synth ones. */
export function preloadVoices(): void {
  const g = audioGraph();
  if (!g || loading) return;
  void renderSynthShouts(g.ctx.sampleRate);
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
    else if (synthClips) playClip(g.ctx, g.master, synthClips[Math.floor(Math.random() * synthClips.length)], at, loud / Math.sqrt(voices) / 0.8);
    else synthShout(g.ctx, g.master, g.noise, at, loud / Math.sqrt(voices));
  }
}

async function renderSynthShouts(rate: number): Promise<void> {
  try {
    const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const out: AudioBuffer[] = [];
    for (let i = 0; i < SYNTH_VARIANTS; i++) {
      const off = new OAC(1, Math.ceil(rate * 0.65), rate);
      const noise = off.createBuffer(1, rate, rate);
      const d = noise.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
      synthShout(off, off.destination, noise, 0.01, 0.5);
      out.push(await off.startRendering());
    }
    synthClips = out;
  } catch {
    synthClips = null; // fall back to live synthesis
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

const RASP = new Float32Array(256).map((_, i) => Math.tanh((i / 128 - 1) * 3));

// Vowel formants (Hz): o, a, e
const VOWELS: ReadonlyArray<[number, number, number]> = [
  [570, 840, 2410],
  [730, 1090, 2440],
  [530, 1840, 2480],
];

function synthShout(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, peak: number): void {
  const f0 = 115 + Math.random() * 55; // stocky men, angry
  const twoSyllables = Math.random() < 0.65; // "o-YA!" vs "HEY!"
  if (twoSyllables) syllable(ctx, out, noise, t, f0 * 0.95, VOWELS[0], 0.12, peak * 0.7);
  const t2 = twoSyllables ? t + 0.13 : t;
  syllable(ctx, out, noise, t2, f0 * 1.25, VOWELS[1 + Math.floor(Math.random() * 2)], 0.38, peak);
}

function syllable(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, f0: number, formants: [number, number, number], len: number, peak: number): void {
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(f0 * 0.85, t);
  src.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + len * 0.25); // the angry rise
  src.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + len);
  // Rasp: soft clipping
  const shaper = ctx.createWaveShaper();
  shaper.curve = RASP;
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
