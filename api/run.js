// POST /api/run {player} → {token}: a run is starting (signed, so its score can be checked later).
import { json, makeToken, storeFromEnv, validPlayer } from './_store.js';

export async function POST(request) {
  const lb = storeFromEnv();
  if (!lb) return json({ error: 'offline' }, 503);
  const body = await request.json().catch(() => null);
  if (!validPlayer(body?.player)) return json({ error: 'player' }, 400);
  return json({ token: makeToken(lb.secret, body.player) });
}
