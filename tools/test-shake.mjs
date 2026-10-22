// Shaking the intro bottle (headless): slosh only at first, then fizz and foam, DON'T SHAKE ME,
// it settles when left alone, and shaken on with the foam at the cap it blows: lift-off with cola
// shed, WHO CATCHES IT?, then the motor park and the run.
// Usage: node tools/test-shake.mjs <baseUrl> <outDir> [phone|drag]
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out, how = 'phone'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('dsm:playerName', 'Test Runner')); // (the runner pick needs a name)
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}/${how}-${String(++n).padStart(2, '0')}-${name}.png` });
const P = () => page.evaluate(() => ({ ...window.__dsm.debugPressure(), step: window.__dsm.getState().step, warn: window.__dsm.getState().shakeWarn }));

/** Shake for `ms` of page time: Android motion events (4 Hz, hard) or quick back-and-forth drags. */
const shake = async (ms) => {
  if (how === 'phone') {
    await page.evaluate(
      (ms) =>
        new Promise((done) => {
          const t0 = performance.now();
          const id = setInterval(() => {
            const t = (performance.now() - t0) / 1000;
            const ax = 16 * Math.sin(2 * Math.PI * 4 * t);
            const e = new DeviceMotionEvent('devicemotion', {
              acceleration: { x: ax, y: 0, z: ax * 0.4 },
              accelerationIncludingGravity: { x: ax, y: 9.8, z: ax * 0.4 },
              interval: 16,
            });
            window.dispatchEvent(e);
            if (t * 1000 > ms) {
              clearInterval(id);
              done();
            }
          }, 16);
        }),
      ms,
    );
  } else {
    // A hand shakes over several frames per swing (headless draws a few frames a second, so pace
    // the moves by frames, not by wall time)
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const t0 = Date.now();
    await page.mouse.move(195, 420);
    await page.mouse.down();
    let dir = 1;
    while (Date.now() - t0 < ms) {
      for (let k = 1; k <= 3; k++) {
        await page.mouse.move(195 + dir * (-110 + (220 * k) / 3), 420 + dir * 30);
        await frame();
      }
      dir = -dir;
    }
    await page.mouse.up();
  }
};

try {
  await page.goto(`${base}/?debug`);
  await page.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  // A plain spin is not a shake
  await page.mouse.move(100, 420);
  await page.mouse.down();
  await page.mouse.move(300, 425, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  let p = await P();
  check('a spin alone: no fizz', p.fizz === 0, JSON.stringify(p));

  // The first moments of shaking: the cola sloshes, nothing fizzes yet
  await shake(900);
  p = await P();
  check('first second of shaking: sloshing, no fizz', p.slosh > 0.1 && p.fizz === 0, JSON.stringify(p));
  await shot('slosh');

  // Keep shaking: the fizz builds, the foam climbs, the title warns
  let warned = null;
  // (Headless renders a few frames a second and the story clock is capped per frame: allow long)
  for (let i = 0; i < 240 && !warned; i++) {
    await shake(500);
    p = await P();
    if (p.warn) warned = p;
  }
  check('sustained shaking: fizz builds and the title warns', !!warned && warned.fizz > 0.5, JSON.stringify(p));
  await shot('foam-warn');
  check('warning shows DON\'T SHAKE ME', await page.getByText('SHAKE ME.').isVisible());

  // Left alone, it settles a little (the foam sinks back)
  const before = (await P()).fizz;
  await page.waitForTimeout(12000);
  const after = (await P()).fizz;
  check('left alone: the fizz settles', after < before && (await P()).step === 'intro', `${before.toFixed(2)} → ${after.toFixed(2)}`);

  // Shake on until it blows
  let launched = false;
  let foamTop = false;
  for (let i = 0; i < 300 && !launched; i++) {
    await shake(400);
    p = await P();
    if (p.fizz >= 1 && !foamTop) {
      foamTop = true;
      await shot('foam-top');
    }
    launched = p.step !== 'intro';
  }
  check('shaken on with the foam at the cap: it blows', launched, JSON.stringify(p));
  for (let i = 0; i < 6 && (await P()).step === 'cinematic'; i++) {
    await shot('lift-off');
    await page.waitForTimeout(1200);
  }
  await page.waitForFunction(() => window.__dsm.getState().step === 'choose', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await shot('choose');
  check('WHO CATCHES IT? after the launch', await page.getByText('WHO CATCHES').isVisible());
  check('no SKIP on the pick', !(await page.getByRole('button', { name: 'SKIP' }).isVisible()));
  await page.getByRole('button', { name: 'Male runner', exact: true }).click();
  await page.waitForFunction(() => window.__dsm.gameDebugState()?.speaker === 'AGBERO', null, { timeout: 300000 });
  await shot('motor-park');
  await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 400000 });
  const s = await page.evaluate(() => ({ g: window.__dsm.game(), w: window.__dsm.gameDebugState() }));
  check('motor park, then a live run with the picked runner', s.g.runner === 'male' && s.w.holder === 'runner' && !s.g.cinematic, `${s.g.runner}, holder ${s.w.holder}`);
} catch (e) {
  check('script', false, e.message.split('\n')[0]);
}
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.map((f) => f.name).join(', ')}` : 'ALL PASSED');
await browser.close();
