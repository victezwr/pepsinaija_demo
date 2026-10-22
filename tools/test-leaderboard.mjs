// Name entry, pause and the leaderboard (headless, against `vite preview`, which serves the /api
// functions with an in-memory board).
// Usage: node tools/test-leaderboard.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const api = (path, body) =>
  fetch(`${base}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined).then((r) => r.json());

// 60 other runners already on the board, all ahead of a short test run (100–159 m)
const others = Array.from({ length: 60 }, (_, i) => `seed${String(i).padStart(2, '0')}${Math.random().toString(36).slice(2, 14).padEnd(12, 'x')}`);
const tokens = await Promise.all(others.map((player) => api('/api/run', { player })));
await new Promise((r) => setTimeout(r, 7000)); // (a run needs time to cover its distance)
await Promise.all(others.map((player, i) => api('/api/leaderboard', { player, name: `Runner ${i + 1}`, distance: 100 + i, token: tokens[i].token })));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const G = () => page.evaluate(() => ({ ...window.__dsm.game(), w: { ...window.__dsm.gameDebugState(), lane: window.__dsm.gameDebugPulse().lane }, audio: window.__dsm.audioGraph()?.ctx.state }));
const waitPhase = (p, ms = 300000) => page.waitForFunction((p) => window.__dsm.game().phase === p, p, { timeout: ms });
const notPaused = () => page.waitForFunction(() => !window.__dsm.game().paused, null, { timeout: 30000 });

try {
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
  check('intro has a Leaderboard button', await page.getByRole('button', { name: 'Leaderboard' }).isVisible());
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.getByRole('button', { name: 'SKIP' }).click();
  await page.waitForFunction(() => window.__dsm.getState().step === 'choose', null, { timeout: 60000 });

  // Name first
  const input = page.getByPlaceholder('Type your name');
  check('runner pick asks for a name (empty, focused)', (await input.inputValue()) === '' && (await input.evaluate((el) => el === document.activeElement)));
  await page.getByRole('button', { name: 'Male runner', exact: true }).click();
  await page.waitForTimeout(300);
  check('no name: the run does not start, a hint shows', (await page.evaluate(() => window.__dsm.getState().step)) === 'choose' && (await page.getByText('Type your name first').isVisible()));
  await shot('choose-no-name');
  await input.fill('Ada Okafor');
  await shot('choose-name');
  await page.getByRole('button', { name: 'Male runner', exact: true }).click();
  await waitPhase('running');
  check('name remembered', (await page.evaluate(() => localStorage.getItem('dsm:playerName'))) === 'Ada Okafor');
  await page.evaluate(() => window.__dsm.gameDebugInvulnerable(9999)); // the run lasts until the test ends it
  await page.waitForTimeout(1500);

  // Pause button: the world and the song's clock stand still, input is ignored
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(300);
  let a = await G();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(2000);
  let b = await G();
  check('pause: world frozen, audio suspended, input ignored', a.paused && b.w.distance === a.w.distance && b.audio === 'suspended' && b.w.lane === a.w.lane, `distance ${a.w.distance.toFixed(2)} → ${b.w.distance.toFixed(2)}, audio ${b.audio}`);
  check('pause menu: RESUME, RESTART RUN', (await page.getByRole('button', { name: 'RESUME' }).isVisible()) && (await page.getByRole('button', { name: 'RESTART RUN' }).isVisible()));
  await shot('paused');
  await page.getByRole('button', { name: 'RESUME' }).click();
  await page.waitForTimeout(150);
  check('resume counts 3, 2, 1', (await G()).resumeCount === 3 && (await page.getByText('3', { exact: true }).isVisible()));
  await shot('countdown');
  await notPaused();
  await page.waitForTimeout(1500);
  const c = await G();
  check('resumed: running again, audio back', c.w.distance > b.w.distance && c.audio === 'running', `distance ${c.w.distance.toFixed(2)}, audio ${c.audio}`);

  // P key, and leaving the page
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  check('P pauses', (await G()).paused);
  await page.keyboard.press('p');
  await notPaused();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  check('leaving the page pauses', (await G()).paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  // RESTART RUN: a fresh run
  await page.getByRole('button', { name: 'RESTART RUN' }).click();
  await waitPhase('running');
  const r = await G();
  check('restart: a fresh run, not paused', !r.paused && r.w.distance < 30, `distance ${r.w.distance.toFixed(1)}`);
  await page.evaluate(() => window.__dsm.gameDebugInvulnerable(0));
  await page.waitForTimeout(3000);

  // Caught: the run goes on the board, your place shows
  await page.evaluate(() => window.__dsm.gameDebugCatch());
  await waitPhase('caught', 30000);
  await page.waitForFunction(() => /#\d+ of \d+/.test(document.querySelector('.gameover__rank')?.textContent ?? ''), null, { timeout: 30000 });
  const rankText = await page.locator('.gameover__rank').textContent();
  const m = /Leaderboard: #(\d+) of (\d+)/.exec(rankText) ?? [];
  check('game over shows your leaderboard place (past 50: the seeded runners are all ahead)', +m[1] > 50 && +m[2] >= 61, rankText);
  await page.waitForTimeout(1500);
  await shot('gameover');

  // The board: top 50, …, you
  await page.getByRole('button', { name: 'LEADERBOARD' }).click();
  await page.waitForSelector('.lb__row');
  const rows = await page.locator('.lb__row').count();
  const gap = await page.locator('.lb__gap').count();
  const last = await page.locator('.lb__row').last().textContent();
  const first = await page.locator('.lb__row').first().textContent();
  check('board: 50 rows, then …, then you', rows === 51 && gap === 1 && /Ada Okafor/.test(last) && /\(you\)/.test(last), `${rows} rows, gap ${gap}, last "${last}"`);
  const dists = await page.locator('.lb__row .lb__dist').allTextContents();
  const top = dists.slice(0, 50).map((t) => Number(t.replace(/[^\d]/g, '')));
  check('board: longest run first, in order', top.every((d, i) => i === 0 || d <= top[i - 1]) && top[0] >= 159, `${first} … ${top.slice(-1)} m`);
  await shot('leaderboard');
  await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-leaderboard-end.png`, fullPage: false });
  await page.locator('.lb__list').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot('leaderboard-bottom');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Esc closes the board', (await page.locator('.lb').count()) === 0);

  // Next run: the name is already there
  await page.reload();
  await page.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.getByRole('button', { name: 'SKIP' }).click();
  await page.waitForFunction(() => window.__dsm.getState().step === 'choose', null, { timeout: 60000 });
  check('next visit: name filled in', (await page.getByPlaceholder('Type your name').inputValue()) === 'Ada Okafor');
} catch (e) {
  check('script', false, e.message.split('\n')[0]);
}
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
