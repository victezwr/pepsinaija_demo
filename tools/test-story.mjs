// Story during play: event dialogue, milestones, music intensity, Pulse timer, game-over payoff, mute.
// Usage: node tools/test-story.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
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
  await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 120000 });

  // Staged events need the run to last: nothing catches the runner until the test says so
  await page.evaluate(() => window.__dsm.gameDebugInvulnerable(9999));
  check('chase begins: "Bring that cap back!"', await heard('Bring that cap back!'));
  let w = await W();
  check('music layers engine on, core only at 0 m', w.intensity.running && w.intensity.level === 0, JSON.stringify(w.intensity));

  // Pulse first: it protects the run while the milestones are checked
  await page.evaluate(() => window.__dsm.gameDebugChill());
  await page.keyboard.press('b');
  check('pulse: "Ha! Wetin be that?!"', await heard('Ha! Wetin be that?!'));
  await shot('pulse-line');
  const lefts = [];
  for (let i = 0; i < 6; i++) {
    const s = await W();
    if (s.pulse === 'pulsing') lefts.push(+s.pulseLeft.toFixed(3));
    await page.waitForTimeout(300);
  }
  check('pulse: timer bar runs down', lefts.length >= 3 && lefts.every((x, i) => i === 0 || x <= lefts[i - 1]) && lefts[0] > lefts[lefts.length - 1], JSON.stringify(lefts));
  const timerShown = await page.locator('.pulse-timer__bar').isVisible();
  check('pulse: timer bar visible in the HUD', timerShown);
  await shot('pulse-timer');

  // Milestones (priority lines), with the music intensity following
  const mil = [
    [520, 'Chairman, this one no dey tire o!', 1],
    [1250, null, 2],
    [2050, 'All of una, run! Make una catch am!', 3],
    [3050, 'Abeg, make we calm down small.', 4],
  ];
  for (const [m, text, lvl] of mil) {
    await page.evaluate((m) => window.__dsm.gameDebugDistance(m), m);
    const who = text ? await heard(text, 15000) : true;
    await page.waitForTimeout(text ? 0 : 1200);
    w = await W();
    check(`${m} m: ${text ?? '(no line; cap energy + layers)'}`, who && w.intensity.level === lvl, `speaker ${who}, intensity ${w.intensity.level}, stage ${w.stage}`);
  }
  await shot('milestones');

  // Near misses: first one, then the taunt, then cooldown (no repeat)
  await page.waitForFunction(() => window.__dsm.gameDebugState().pulse === 'empty', null, { timeout: 120000 });
  const power = (await W()).bubble;
  await page.waitForFunction(() => !window.__dsm.gameDebugState().bubble, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.__dsm.gameDebugNearMiss());
  const first = await heard('Chairman, e dey escape!', 8000);
  await page.waitForFunction(() => !window.__dsm.gameDebugState().bubble, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.__dsm.gameDebugNearMiss());
  const taunt = await heard('You think say you fit run pass me?', 8000);
  await page.waitForFunction(() => !window.__dsm.gameDebugState().bubble, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => window.__dsm.gameDebugNearMiss());
  const repeat = await heard('You think say you fit run pass me?', 3000);
  check('near miss: first line, then taunt, then cooldown', first && taunt && !repeat, `first ${first}, taunt ${taunt}, repeat ${repeat}; pulse-end line seen: ${power}`);

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

  // RUN AGAIN: no cinematic, straight in; story lines reset per run
  await page.getByRole('button', { name: 'RUN AGAIN' }).click();
  await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 60000 });
  check('run again: no cinematic, start line again', !(await page.evaluate(() => window.__dsm.game().cinematic)) && (await heard('Bring that cap back!')));
} catch (e) {
  check('script', false, e.message.split('\n')[0]);
}
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
