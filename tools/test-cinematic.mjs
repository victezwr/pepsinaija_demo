// Opening cinematic + SKIP checks (headless).
// Usage: node tools/test-cinematic.mjs <baseUrl> <outDir> [watch|skip-early|skip-park|all]
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out, mode = 'all'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

async function run(kind) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
  // Count live intervals across the session (leak check)
  await page.addInitScript(() => {
    const live = new Set();
    const si = window.setInterval.bind(window);
    const ci = window.clearInterval.bind(window);
    window.setInterval = (fn, ms, ...a) => {
      const id = si(fn, ms, ...a);
      live.add(id);
      return id;
    };
    window.clearInterval = (id) => {
      live.delete(id);
      ci(id);
    };
    window.__liveIntervals = () => live.size;
  });
  let n = 0;
  const shot = (name) => page.screenshot({ path: `${out}/${kind}-${String(++n).padStart(2, '0')}-${name}.png` });
  const S = () => page.evaluate(() => ({ step: window.__dsm.getState().step, headline: window.__dsm.getState().headline?.text ?? '', game: window.__dsm.game(), w: window.__dsm.gameDebugState() }));
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
  await page.getByRole('button', { name: 'Female runner' }).click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  const t0 = Date.now();

  if (kind === 'watch') {
    // Record the order of everything the cinematic shows until the run starts
    const seen = [];
    const shots = new Set();
    const note = (x) => {
      if (x && seen[seen.length - 1] !== x) seen.push(x);
    };
    while (Date.now() - t0 < 400000) {
      const s = await S();
      note(s.headline && `H:${s.headline}`);
      if (s.w?.bubble) note(`${s.w.speaker}:${s.w.bubble}`);
      const key = s.headline || (s.w?.bubble ?? '') || s.game.phase;
      if (key && !shots.has(key) && (s.headline || s.w?.bubble || s.game.phase === 'starting')) {
        shots.add(key);
        await shot(key.replace(/[^A-Za-z]+/g, '-').slice(0, 30));
      }
      if (s.game.phase === 'running') break;
      await page.waitForTimeout(150);
    }
    const s = await S();
    await page.waitForTimeout(1500);
    await shot('running');
    const want = [
      'H:SOME THINGS SHOULD STAY CLOSED.',
      "H:DON'T SHAKE ME.",
      'AGBERO:Chairman, you see that thing?',
      'CHAIRMAN:Ha! Golden Cap! Omo, bring that one come!',
      'YOU:Na drink I come buy!',
      'CHAIRMAN:Oya! No let am escape!',
    ];
    let i = 0;
    for (const x of seen) if (x === want[i]) i++;
    check('watch: beats A-E in order', i === want.length, JSON.stringify(seen));
    check('watch: ends in a live run', s.game.phase === 'running' && !s.game.cinematic, `${s.game.phase}, cinematic ${s.game.cinematic}`);
    check('watch: chosen runner holds the can', s.game.runner === 'female' && s.w.holder === 'runner' && s.w.runnerVisible, `${s.game.runner}, holder ${s.w.holder}`);
    check('watch: camera behind the runner', s.w.camZ > 3, `cam z ${s.w.camZ.toFixed(2)}`);
    const p = await page.evaluate(() => window.__dsm.gameDebugPulse());
    check('watch: theme playing (chase soundtrack) and synced', p.synced, '');
    check('watch: SKIP gone once running', !(await page.getByRole('button', { name: 'SKIP' }).isVisible()));
  } else {
    // Skip either around the bottle (beats A-C) or in the motor park (beats D-E); press twice
    if (kind === 'skip-early') await page.waitForFunction(() => window.__dsm.getState().headline?.text === "DON'T SHAKE ME.", null, { timeout: 120000 });
    else await page.waitForFunction(() => window.__dsm.gameDebugState()?.bubble === 'Ha! Golden Cap! Omo, bring that one come!', null, { timeout: 300000 });
    await shot('before-skip');
    const skip = page.getByRole('button', { name: 'SKIP' });
    await skip.click();
    await skip.click({ timeout: 1000 }).catch(() => {}); // a second press must be harmless
    await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    await shot('after-skip');
    const s = await S();
    const p = await page.evaluate(() => window.__dsm.gameDebugPulse());
    check(`${kind}: valid running state`, s.game.phase === 'running' && !s.game.cinematic && s.step === 'game' && s.w.speed > 5, `${s.game.phase}, speed ${s.w.speed.toFixed(1)}`);
    check(`${kind}: runner holds the can, camera behind`, s.w.holder === 'runner' && s.w.runnerVisible && s.w.camZ > 3, `holder ${s.w.holder}, cam z ${s.w.camZ.toFixed(2)}`);
    check(`${kind}: theme playing and synced`, p.synced);
    check(`${kind}: no cinematic dialogue left over`, !['Chairman, you see that thing?', 'Ha! Golden Cap! Omo, bring that one come!', 'Na drink I come buy!', 'Oya! No let am escape!'].includes(s.w.bubble), s.w.bubble);
    // Controls live
    const lane0 = p.lane;
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    check(`${kind}: controls respond`, (await page.evaluate(() => window.__dsm.gameDebugPulse())).lane !== lane0);
    // Restart several times: live intervals must not pile up
    const before = await page.evaluate(() => window.__liveIntervals());
    for (let r = 0; r < 3; r++) {
      await page.evaluate(() => window.__dsm.gameDebugCatch());
      await page.waitForFunction(() => window.__dsm.game().phase === 'caught', null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'RUN AGAIN' }).click();
      await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 60000 });
      await page.waitForTimeout(800);
    }
    const after = await page.evaluate(() => window.__liveIntervals());
    check(`${kind}: no interval build-up over 3 restarts`, after <= before, `live intervals ${before} → ${after}`);
  }
  check(`${kind}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

for (const k of mode === 'all' ? ['skip-early', 'skip-park', 'watch'] : [mode]) {
  try {
    await run(k);
  } catch (e) {
    check(`${k}: script`, false, e.message.split('\n')[0]);
  }
}
console.log(JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
