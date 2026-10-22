import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `virtual:recordings`: the recorded sounds and voice lines in public/audio/sfx and
 * public/audio/voice (e.g. ["sfx/pop.mp3"]), so the game only fetches files that exist.
 * Drop a file in and rebuild (or restart the dev server).
 */
function recordings(): Plugin {
  const id = 'virtual:recordings';
  return {
    name: 'recordings',
    resolveId: (s) => (s === id ? `\0${id}` : null),
    load(s) {
      if (s !== `\0${id}`) return null;
      const found: string[] = [];
      for (const dir of ['sfx', 'voice']) {
        const full = path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'public/audio', dir);
        if (!fs.existsSync(full)) continue;
        for (const f of fs.readdirSync(full).sort()) if (/\.(mp3|m4a|ogg|wav)$/i.test(f)) found.push(`${dir}/${f}`);
      }
      return `export default ${JSON.stringify(found)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), recordings()],
  build: { chunkSizeWarningLimit: 1200 },
});
