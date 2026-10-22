// Spoken lines are shown as text (the speech bubbles); there are no generated voices. A line is
// heard only if its recording has been added: public/audio/voice/<cue>.mp3 (the cues below; what
// to record is in context/recording-script.md).
import { playRecording } from './recordings';
import { audioGraph } from './sfx';

/** The spoken lines, by their text → the recording that voices them. */
export const LINE_CUES: Readonly<Record<string, string>> = {
  'Afa, wetin be that wey dey shine? Gimme am ASAP!': 'agbero-gimme',
  'If I catch you!': 'agberos-if-i-catch-you',
  'You dey use me play, abi?!': 'agbero-use-me-play',
  'Ha! Wetin be that?!': 'chairman-wetin',
  'We don catch am!': 'agberos-caught',
  'Ehn? Wetin dey inside this cap sef?': 'chairman-inside-cap',
};

/** A line of dialogue: its recording, if there is one; otherwise it's read, not heard. */
export function speak(text: string): void {
  const g = audioGraph();
  const cue = LINE_CUES[text];
  if (g && cue) playRecording(g.ctx, g.master, `voice/${cue}`);
}
