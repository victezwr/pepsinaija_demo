// GET /api/status: is the leaderboard switched on, and can it reach its storage? Shows only the
// names of the storage settings it found, never their values. Open it in a browser to check setup.
import { json, redisEnv, storeFromEnv } from './_store.js';

export async function GET() {
  const vars = redisEnv();
  const lb = storeFromEnv();
  if (!lb) {
    const seen = Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH/.test(k));
    return json({
      leaderboard: 'off',
      why: 'No Redis storage settings on this deployment. Connect Upstash for Redis to the project (Storage tab), then redeploy.',
      storageSettingsSeen: seen,
    });
  }
  try {
    const total = await lb.store.total();
    return json({ leaderboard: 'on', storage: 'reachable', settings: vars, runners: total });
  } catch (e) {
    return json({ leaderboard: 'on', storage: 'unreachable', settings: vars, error: String(e?.message ?? e).slice(0, 200) }, 502);
  }
}
