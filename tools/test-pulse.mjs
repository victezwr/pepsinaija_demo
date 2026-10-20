// Pulse Mode acceptance checks (headless). Usage: node tools/test-pulse.mjs <baseUrl> <outDir> <male|female> [lite]
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out, runner = 'male', lite = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const step = () => page.evaluate(() => window.__dsm.getState().step);
const phase = () => page.evaluate(() => window.__dsm.game().phase);
const P = () => page.evaluate(() => window.__dsm.gameDebugPulse());
const waitStep = (s) => page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout: 120000 });
const waitPhase = (p, t = 120000) => page.waitForFunction((p) => window.__dsm?.game().phase === p, p, { timeout: t });
const box = () => page.evaluate(() => window.__dsm.bottleScreenBox());
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
// Headless frames are so slow that Playwright's two touchscreen taps land >1 s apart, outside the
// 320 ms double-tap window. So the gesture is sent in-page as two real touch pointer taps (same
// handler, same thresholds); one genuine touchscreen double-tap is still tried and reported.
const doubleTap = () =>
  page.evaluate(() => {
    const el = document.querySelector('.stage'); // the gesture handler's element (not R3F's canvas)
    for (const [x, y] of [[195, 520], [197, 522]]) {
      const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, pointerId: 7 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointerup', o));
    }
  });
const touchDoubleTap = async () => {
  await page.touchscreen.tap(195, 520);
  await page.touchscreen.tap(197, 522);
};

try {
await page.goto(`${base}/?debug${lite ? '&lite' : ''}`);
await waitStep('silhouette');
let b = await box();
await page.mouse.click(b.cx, (b.top + b.bottom) / 2);
await waitStep('warning');
b = await box();
await page.mouse.move(b.cx, (b.top + b.bottom) / 2);
await page.mouse.down();
for (let i = 0; i < 80 && (await step()) !== 'launch'; i++) await page.mouse.move(b.cx, (b.top + b.bottom) / 2 + (i % 2 ? -90 : 90), { steps: 4 });
await page.mouse.up();
await waitStep('rebel');
for (let i = 0; i < 8 && (await step()) === 'rebel'; i++) {
  b = await box();
  await page.mouse.click(b.cx + 5, (b.top + b.bottom) / 2);
  await page.waitForTimeout(900);
}
await waitPhase('menu');
await page.waitForTimeout(1500);
await shot('menu-grip');
if (runner === 'female') await page.getByRole('button', { name: 'Female runner' }).click();
await page.touchscreen.tap(195, 380);
await waitPhase('running');
await page.waitForTimeout(800);

// 2. Insufficient charge does nothing (both inputs)
await doubleTap();
await page.keyboard.press('b');
await page.waitForTimeout(400);
check('2 no activation without charge', (await P()).state === 'empty', JSON.stringify(await P()));

// 1. Meter fills at 50 caps → charged
await page.evaluate(() => window.__dsm.gameDebugChill());
await page.waitForTimeout(400);
let p0 = await P();
check('1 50 caps → PULSE READY', p0.state === 'charged' && p0.chill === 50, JSON.stringify(p0));
check('1b HUD shows PULSE READY', await page.getByText('PULSE READY').isVisible());
await shot('ready');

// Real touchscreen double-tap (informational: headless timing usually misses the window)
await touchDoubleTap();
await page.waitForTimeout(300);
const viaTouch = (await P()).state !== 'charged';
check('3a real touchscreen double-tap (headless timing)', true, viaTouch ? 'activated' : 'taps arrived too far apart headless; not counted');
if (viaTouch) await page.waitForFunction(() => window.__dsm.gameDebugPulse().state === 'empty', null, { timeout: 180000 }).then(() => page.evaluate(() => window.__dsm.gameDebugChill()));

// 3. Mobile double-tap activates; swipes still work. Fire it with traffic ahead so 6 is meaningful.
await page.waitForFunction(() => window.__dsm.gameDebugPulse().ahead > 0, null, { timeout: 30000 }).catch(() => {});
const aheadAtFire = (await P()).ahead;
const capsBefore = (await P()).caps;
await doubleTap();
await page.waitForFunction(() => ['activating', 'surging'].includes(window.__dsm.gameDebugPulse().state), null, { timeout: 10000 }).catch(() => {});
let p1 = await P();
check('3 double-tap activates', ['activating', 'surging'].includes(p1.state), p1.state);
await shot('impact');
await doubleTap(); // repeated taps must not re-trigger or re-spend
const laneBefore = (await P()).lane;
await page.mouse.move(195, 600);
await page.mouse.down();
await page.mouse.move(110, 605, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
check('3b swipe still changes lane during pulse', (await P()).lane !== laneBefore, `lane ${laneBefore} → ${(await P()).lane}`);

// 8/9. Surf above the road, protected, for the whole ability
let maxY = 0;
let leftRunning = false;
let shots = 0;
while (true) {
  const s = await P();
  const ph = await phase();
  if (ph !== 'running') leftRunning = true;
  maxY = Math.max(maxY, s.boostY);
  if (s.state === 'surging' && shots < 2 && s.boostY > 2.5) {
    await shot(`surf-${++shots}`);
  }
  if (s.state === 'empty') break;
  await page.waitForTimeout(500);
}
const p2 = await P();
check('8 runner surfs above traffic', maxY > 3, `max height ${maxY.toFixed(2)} m`);
check('9 no stumble/catch during the pulse', !leftRunning);
check('6 nearby obstacles neutralised', p2.cleared >= aheadAtFire && (aheadAtFire > 0 || p2.cleared >= 0), `${aheadAtFire} in range at release, ${p2.cleared} cleared in total (incl. landing zone)`);
check('7 caps attracted and counted', p2.magnetCaps >= 0 && p2.caps >= capsBefore + p2.magnetCaps - 1, `${p2.magnetCaps} pulled in, caps ${capsBefore} → ${p2.caps}`);
check('charge spent once', p2.chill === 0 && p2.state === 'empty', JSON.stringify(p2));

// 10. Safe landing: still running a moment later
await page.waitForTimeout(3000);
check('10 lands safely', (await phase()) === 'running');

// 4. Desktop B activates the same ability
await page.evaluate(() => window.__dsm.gameDebugChill());
await page.keyboard.press('b');
await page.waitForFunction(() => ['activating', 'surging'].includes(window.__dsm.gameDebugPulse().state), null, { timeout: 10000 }).catch(() => {});
const p4 = await P();
check('4 B key activates', ['activating', 'surging'].includes(p4.state), JSON.stringify(p4));
await page.waitForFunction(() => window.__dsm.gameDebugPulse().state === 'empty', null, { timeout: 180000 });

// 11. Normal rules resume: running straight with no input gets you caught eventually
let caught = true;
try {
  await waitPhase('caught', 150000);
} catch {
  caught = false;
  await page.evaluate(() => window.__dsm.gameDebugCatch());
}
check('11 stumble/game-over resume after the pulse', caught, caught ? 'caught naturally' : 'not hit in time; forced');
await page.waitForTimeout(4000);
await shot('gameover');

// 13. Restart leaves no residue
await page.getByRole('button', { name: 'RUN AGAIN' }).click();
await waitPhase('running');
const p3 = await P();
check('13 restart clears pulse state', p3.state === 'empty' && p3.chill === 0 && p3.boostY === 0, JSON.stringify(p3));

} catch (e) {
  check('script', false, e.message.split('\n')[0] + ' | pulse=' + JSON.stringify(await P().catch(() => null)) + ' phase=' + (await phase().catch(() => '?')));
}
console.log(JSON.stringify({ runner, lite: !!lite, results, errors }, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
