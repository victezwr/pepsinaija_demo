// Leaderboard storage and rules, shared by the /api functions (files starting with _ are not
// routes on Vercel).
//
// Storage: Upstash Redis over its REST API (Vercel dashboard → Storage → Upstash for Redis,
// connected to this project; it adds KV_REST_API_URL / KV_REST_API_TOKEN, or the UPSTASH_REDIS_
// names). No SDK. Without those the leaderboard reports itself offline and the game carries on.
// Local dev, `vite preview` and the tests use an in-memory store instead (vite.config.ts).
//
// Data: a sorted set of each player's best distance (lb:dist), their display names (lb:names),
// run tokens already used (lb:tok:*) and a short per-player submit throttle (lb:rl:*).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOP_N = 50;
const MAX_SPEED = 24; // m/s, the chase's top speed (src/game/gameConfig.ts)
const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------- stores

function redisStore(url, token) {
  const pipe = async (cmds) => {
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return (await r.json()).map((x) => {
      if (x.error) throw new Error(x.error);
      return x.result;
    });
  };
  return {
    async top(n) {
      const [flat] = await pipe([['ZREVRANGE', 'lb:dist', '0', String(n - 1), 'WITHSCORES']]);
      const ids = [];
      const dist = [];
      for (let i = 0; i < flat.length; i += 2) {
        ids.push(flat[i]);
        dist.push(Number(flat[i + 1]));
      }
      const [names] = ids.length ? await pipe([['HMGET', 'lb:names', ...ids]]) : [[]];
      return ids.map((id, i) => ({ id, name: names[i] ?? 'Runner', distance: dist[i] }));
    },
    async rankOf(id) {
      const [rank, score, name] = await pipe([
        ['ZREVRANK', 'lb:dist', id],
        ['ZSCORE', 'lb:dist', id],
        ['HGET', 'lb:names', id],
      ]);
      if (rank === null || rank === undefined) return null;
      return { id, rank: Number(rank) + 1, name: name ?? 'Runner', distance: Number(score) };
    },
    async total() {
      const [n] = await pipe([['ZCARD', 'lb:dist']]);
      return Number(n);
    },
    async submit(id, name, distance) {
      // GT: only a better run moves you up
      await pipe([
        ['ZADD', 'lb:dist', 'GT', String(distance), id],
        ['HSET', 'lb:names', id, name],
      ]);
    },
    async once(key, ttlS) {
      const [ok] = await pipe([['SET', key, '1', 'NX', 'EX', String(ttlS)]]);
      return ok === 'OK';
    },
  };
}

/** In-memory store (local dev, preview and tests only; resets when the server restarts). */
function memoryStore() {
  const best = new Map();
  const names = new Map();
  const keys = new Map();
  const ranked = () => [...best.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
  return {
    async top(n) {
      return ranked()
        .slice(0, n)
        .map(([id, distance]) => ({ id, name: names.get(id) ?? 'Runner', distance }));
    },
    async rankOf(id) {
      const i = ranked().findIndex(([k]) => k === id);
      return i < 0 ? null : { id, rank: i + 1, name: names.get(id) ?? 'Runner', distance: best.get(id) };
    },
    async total() {
      return best.size;
    },
    async submit(id, name, distance) {
      if (!best.has(id) || distance > best.get(id)) best.set(id, distance);
      names.set(id, name);
    },
    async once(key, ttlS) {
      const now = Date.now();
      if ((keys.get(key) ?? 0) > now) return false;
      keys.set(key, now + ttlS * 1000);
      return true;
    },
  };
}

let memory = null;

/** The configured store and the secret that signs run tokens, or null (leaderboard offline). */
export function storeFromEnv(env = process.env) {
  if (env.LEADERBOARD_MEMORY === '1') {
    memory ??= memoryStore();
    return { store: memory, secret: 'local-test-secret' };
  }
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { store: redisStore(url, token), secret: env.LEADERBOARD_SECRET || token };
}

// ---------------------------------------------------------------- rules

/** A player id: random, made by the browser on first visit. */
export const validPlayer = (p) => typeof p === 'string' && /^[a-z0-9]{16,32}$/.test(p);

// Words a public board shouldn't show (checked with spacing and look-alike digits removed)
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'dick', 'pussy', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'penis', 'vagina', 'asshole', 'bastard', 'ashawo', 'olosho', 'werey', 'mumu', 'pepsi'];

/**
 * A display name: 2–16 letters, digits, spaces and . _ ' -, tidied; null if not allowed.
 * ("pepsi" is reserved so nobody can pose as the brand.)
 */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N} ._'-]{2,16}$/u.test(name)) return null;
  const flat = name
    .toLowerCase()
    .replace(/[\s._'-]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return name;
}

const sign = (secret, data) => createHmac('sha256', secret).update(data).digest('base64url');

/** A run token: who, when the run started, signed. One per run, used once. */
export function makeToken(secret, player, now = Date.now()) {
  const body = `${player}.${now}`;
  return `${body}.${sign(secret, body)}`;
}

/** The run's start time if the token is genuine, this player's and recent; else null. */
export function checkToken(secret, token, player, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== player) return null;
  const want = Buffer.from(sign(secret, `${parts[0]}.${parts[1]}`));
  const got = Buffer.from(parts[2]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const start = Number(parts[1]);
  if (!Number.isFinite(start) || now - start < 0 || now - start > TOKEN_MAX_AGE_MS) return null;
  return start;
}

/** Could a run that started at `start` really have covered `distance` by now? */
export const plausible = (distance, start, now = Date.now()) => distance <= ((now - start) / 1000) * MAX_SPEED * 1.1 + 30;

/** The board as the game shows it: the top 50, the total, and this player's own entry. */
export async function board(store, player) {
  const [top, me, total] = await Promise.all([store.top(TOP_N), validPlayer(player) ? store.rankOf(player) : null, store.total()]);
  const strip = (e, rank) => ({ rank, name: e.name, distance: e.distance, me: e.id === player });
  return { top: top.map((e, i) => strip(e, i + 1)), me: me ? strip(me, me.rank) : null, total };
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
