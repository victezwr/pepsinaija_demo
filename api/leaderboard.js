// GET  /api/leaderboard?player=…  → the board: top 50, total, your own entry (rank, even past 50).
// POST /api/leaderboard {player, name, distance, token} → records the run (your best counts) and
//   returns the board. The run token must be genuine, this player's, unused, and the distance
//   possible in the time since it was issued.
import { board, checkToken, cleanName, json, plausible, storeFromEnv, validPlayer } from './_store.js';

export async function GET(request) {
  const lb = storeFromEnv();
  if (!lb) return json({ error: 'offline' }, 503);
  const player = new URL(request.url).searchParams.get('player') ?? '';
  try {
    return json(await board(lb.store, player));
  } catch {
    return json({ error: 'storage' }, 502);
  }
}

export async function POST(request) {
  const lb = storeFromEnv();
  if (!lb) return json({ error: 'offline' }, 503);
  const body = await request.json().catch(() => null);
  const player = body?.player;
  if (!validPlayer(player)) return json({ error: 'player' }, 400);
  const name = cleanName(body.name);
  if (!name) return json({ error: 'name' }, 400);
  const distance = Math.floor(Number(body.distance));
  if (!Number.isFinite(distance) || distance < 0 || distance > 1e6) return json({ error: 'distance' }, 400);
  const start = checkToken(lb.secret, body.token, player);
  if (start === null) return json({ error: 'token' }, 400);
  if (!plausible(distance, start)) return json({ error: 'distance' }, 400);
  try {
    if (!(await lb.store.once(`lb:tok:${body.token.split('.')[2]}`, 4 * 3600))) return json({ error: 'token' }, 400);
    await lb.store.submit(player, name, distance);
    return json(await board(lb.store, player));
  } catch {
    return json({ error: 'storage' }, 502);
  }
}
