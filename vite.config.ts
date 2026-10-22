import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

/**
 * The /api functions (deployed by Vercel from api/) served by `vite` and `vite preview` too,
 * with an in-memory leaderboard, so the whole game (and the tests) run locally.
 */
function localApi(): Plugin {
  const root = fileURLToPath(new URL('.', import.meta.url));
  type Handler = (r: Request) => Promise<Response>;
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const m = /^\/api\/([a-z]+)(?:\?|$)/.exec(req.url ?? '');
    if (!m) return next();
    process.env.LEADERBOARD_MEMORY ??= '1';
    try {
      const mod = (await import(pathToFileURL(path.join(root, 'api', `${m[1]}.js`)).href)) as Record<string, Handler | undefined>;
      const fn = mod[req.method ?? 'GET'];
      if (!fn) {
        res.statusCode = 405;
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const out = await fn(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body }));
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  };
  return {
    name: 'local-api',
    configureServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res, next)),
    configurePreviewServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res, next)),
  };
}

export default defineConfig({
  plugins: [react(), recordings(), localApi()],
  build: { chunkSizeWarningLimit: 1200 },
});
