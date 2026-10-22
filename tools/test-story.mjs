// Story during play: lines only on stumbles and the run's first Pulse; milestones (music, Pulse cost),
// Pulse timer, game-over payoff, mute.
// Usage: node tools/test-story.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await page.addInitScript(() => localStorage.setItem('dsm:playerName', 'Test Runner')); // (the runner pick needs a name)
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const W = () => page.evaluate(() => window.__dsm.gameDebugState());
const P = () => page.evaluate(() => window.__dsm.gameDebugPulse());
const phase = () => page.evaluate(() => window.__dsm.game().phase);
/** Wait until a given line is in the bubble; returns the speaker or null. */
const heard = async (text, timeout = 20000) => {
  try {
    await page.waitForFunction((t) => window.__dsm.gameDebugState()?.bubble === t, text, { timeout, polling: 50 });
    return (await W()).speaker;
  } catch {
    return null;
  }
};
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });

try {
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.getByRole('button', { name: 'SKIP' }).click();
  await page.getByRole('button', { name: 'Male runner', exact: true }).click();
  await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 120000 });

  // Staged events need the run to last: nothing catches the runner until the test says so
  await page.evaluate(() => window.__dsm.gameDebugInvulnerable(9999));
  /** Any line shown in the next `ms`? */
  const anyLine = async (ms) => {
    try {
      await page.waitForFunction(() => !!window.__dsm.gameDebugState()?.bubble, null, { timeout: ms, polling: 50 });
      return (await W()).bubble;
    } catch {
      return null;
    }
  };
  check('running: no lines at the start of the run', !(await anyLine(5000)), '');
  let w = await W();
  check('music layers engine on, core only at 0 m', w.intensity.running && w.intensity.level === 0, JSON.stringify(w.intensity));

  // First Pulse of the run: one line
  await page.evaluate(() => window.__dsm.gameDebugChill());
  await page.keyboard.press('b');
  check('first Pulse: "Ha! Wetin be that?!"', await heard('Ha! Wetin be that?!'));
  const lefts = [];
  for (let i = 0; i < 6; i++) {
    const s = await W();
    if (s.pulse === 'pulsing') lefts.push(+s.pulseLeft.toFixed(3));
    await page.waitForTimeout(300);
  }
  check('pulse: timer bar runs down', lefts.length >= 3 && lefts.every((x, i) => i === 0 || x <= lefts[i - 1]) && lefts[0] > lefts[lefts.length - 1], JSON.stringify(lefts));
  check('pulse: timer bar visible in the HUD', await page.locator('.pulse-timer__bar').isVisible());
  await shot('pulse-timer');
  await page.waitForFunction(() => window.__dsm.gameDebugState().pulse === 'empty', null, { timeout: 120000 });
  check('pulse end: no line', !(await anyLine(2500)));

  // Second Pulse: silent
  await page.evaluate(() => window.__dsm.gameDebugChill());
  await page.keyboard.press('b');
  await page.waitForFunction(() => window.__dsm.gameDebugState().pulse !== 'charged', null, { timeout: 10000 });
  check('second Pulse: no line', !(await anyLine(3000)));
  await page.waitForFunction(() => window.__dsm.gameDebugState().pulse === 'empty', null, { timeout: 120000 });

  // Milestones: the music (and the cap's glow) carry them now, no lines. The Pulse's cost no
  // longer depends on distance: two Pulses released → the next needs 6,000 saved caps.
  const mil = [
    [520, 1, 6000],
    [1250, 2, 6000],
    [2050, 3, 6000],
    [3050, 4, 6000],
  ];
  for (const [m, lvl, cost] of mil) {
    await page.evaluate((m) => window.__dsm.gameDebugDistance(m), m);
    const said = await anyLine(1500);
    w = await W();
    const g = await page.evaluate(() => window.__dsm.game());
    check(`${m} m: no line, music level ${lvl}, Pulse costs ${cost}`, !said && w.intensity.level === lvl && g.pulseCost === cost, `line ${said}, intensity ${w.intensity.level}, cost ${g.pulseCost}`);
  }
  check('meter shows the cost', await page.getByText(/^PULSE [\d,]+\/6,000$/).isVisible().catch(() => false));
  await shot('milestones');

  // Near miss: the whoosh only, no line
  await page.evaluate(() => window.__dsm.gameDebugNearMiss());
  check('near miss: no line', !(await anyLine(2500)));

  // Stumbles: the line every time
  await page.evaluate(() => window.__dsm.gameDebugStumble());
  check('stumble: "Oya drop am!"', await heard('Oya drop am!', 5000));
  // Past the second-stumble window (4 s of game time; headless game time runs slow)
  const tStumble = (await W()).time;
  await page.waitForFunction((t) => window.__dsm.gameDebugState().time > t + 4.5, tStumble, { timeout: 120000 });
  await page.waitForFunction(() => !window.__dsm.gameDebugState().bubble, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.__dsm.gameDebugStumble());
  check('stumble again: "Oya drop am!" again', await heard('Oya drop am!', 5000));

  // Game over payoff
  if ((await phase()) === 'running') await page.evaluate(() => window.__dsm.gameDebugCatch());
  await page.waitForFunction(() => window.__dsm.game().phase === 'caught', null, { timeout: 30000 });
  const puzzled = await heard('Ehn? Wetin dey inside this cap sef?', 60000);
  w = await W();
  await shot('gameover-payoff');
  check('game over: Chairman claims the can, cap sparks, puzzled line', puzzled && w.holder === 'chairman', `speaker ${puzzled}, holder ${w.holder}`);
  check('game over: results + share still there', (await page.getByText('AGBEROS DON COLLECT AM!').isVisible()) && (await page.getByRole('button', { name: /CHALLENGE FRIENDS/ }).isVisible()));
  check('game over: layers stopped', !(await W()).intensity.running);

  // Mute silences the master bus (everything routes through it)
  await page.getByRole('button', { name: 'Mute' }).click();
  await page.waitForTimeout(600);
  const gain = await page.evaluate(() => window.__dsm.audioGraph()?.master.gain.value);
  check('mute: master gain to 0', gain !== undefined && gain < 0.01, `gain ${gain}`);
  await page.getByRole('button', { name: 'Unmute' }).click();

  // RUN AGAIN: no cinematic, no lines, and the first Pulse line is back for the new run
  await page.getByRole('button', { name: 'RUN AGAIN' }).click();
  await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 60000 });
  await page.evaluate(() => window.__dsm.gameDebugInvulnerable(9999));
  const quiet = !(await page.evaluate(() => window.__dsm.game().cinematic)) && !(await anyLine(3000));
  await page.evaluate(() => window.__dsm.gameDebugChill());
  await page.keyboard.press('b');
  check('run again: no cinematic, quiet start, first-Pulse line again', quiet && (await heard('Ha! Wetin be that?!')));
} catch (e) {
  check('script', false, e.message.split('\n')[0]);
}
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
