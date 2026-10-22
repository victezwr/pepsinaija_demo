// Recorded sounds and voice lines. Drop a file in public/audio/sfx/ or public/audio/voice/ named
// after a cue (e.g. sfx/pop.mp3, voice/chairman-drop-am.mp3; see public/audio/README.md) and it
// replaces the sound generated in code. The build lists which files exist (vite.config.ts), so a
// missing recording costs no request; until a file has loaded the generated sound plays.
import available from 'virtual:recordings';

const buffers = new Map<string, AudioBuffer>();
let started = false;

/** `sfx/pop.mp3` → `sfx/pop` */
const cueOf = (file: string): string => file.replace(/\.[a-z0-9]+$/i, '');
const files = new Map(available.map((f) => [cueOf(f), f]));

/** Is there a recording for this cue (loaded or not)? */
export function recorded(cue: string): boolean {
  return files.has(cue);
}

/** Is it loaded and ready to play? */
export function ready(cue: string): AudioBuffer | null {
  return buffers.get(cue) ?? null;
}

/** Fetch and decode every recording (once audio is unlocked). */
export function preloadRecordings(ctx: BaseAudioContext): void {
  if (started || !files.size) return;
  started = true;
  for (const [cue, file] of files) {
    fetch(`/audio/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => buffers.set(cue, buf))
      .catch(() => files.delete(cue)); // unreadable: keep the generated sound
  }
}

/**
 * Play a recording if it is loaded. `gain` 1 = as recorded, `pan` -1 (left) .. 1 (right),
 * `rate` 1 = as recorded (higher is higher and shorter). Returns false if there is none.
 */
export function playRecording(
  ctx: AudioContext,
  out: AudioNode,
  cue: string,
  o: { gain?: number; pan?: number; rate?: number; at?: number } = {},
): boolean {
  const buf = buffers.get(cue);
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = o.rate ?? 1;
  const g = ctx.createGain();
  g.gain.value = o.gain ?? 1;
  let node: AudioNode = g;
  if (o.pan && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    g.connect(p);
    node = p;
  }
  src.connect(g);
  node.connect(out);
  src.start(o.at ?? ctx.currentTime);
  return true;
}
