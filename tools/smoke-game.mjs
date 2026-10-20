// Plays the story into The Yellow Chase and screenshots every game state.
// Usage: node tools/smoke-game.mjs <baseUrl> <outDir> [width] [height] [query]
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out, w = '390', h = '844', q = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
const step = () => page.evaluate(() => window.__dsm.getState().step);
const phase = () => page.evaluate(() => window.__dsm.game().phase);
const waitStep = (s, timeout = 90000) => page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout });
const waitPhase = (p, timeout = 120000) => page.waitForFunction((p) => window.__dsm?.game().phase === p, p, { timeout });
const box = () => page.evaluate(() => window.__dsm.bottleScreenBox());
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });

await page.goto(`${base}/?debug${q ? '&' + q : ''}`);
await waitStep('silhouette');
let b = await box();
await page.mouse.click(b.cx, (b.top + b.bottom) / 2);
await waitStep('warning');
b = await box();
const cy = (b.top + b.bottom) / 2;
await page.mouse.move(b.cx, cy);
await page.mouse.down();
for (let i = 0; i < 80 && (await step()) !== 'launch'; i++) await page.mouse.move(b.cx, cy + (i % 2 ? -90 : 90), { steps: 4 });
await page.mouse.up();
await waitStep('rebel');
for (let i = 0; i < 8 && (await step()) === 'rebel'; i++) {
  b = await box();
  await page.mouse.click(b.cx + 5, (b.top + b.bottom) / 2);
  await page.waitForTimeout(900);
}
await waitStep('game');
await page.waitForTimeout(700);
await shot('reveal-drop');
await waitPhase('menu');
await page.waitForTimeout(1200);
await shot('menu-male');
await page.getByRole('button', { name: 'Female runner' }).click();
await page.waitForTimeout(1000);
await shot('menu-female');
// Tap the scene (not a button) to pop & run
await page.mouse.click(+w / 2, +h * 0.45);
await page.waitForTimeout(500);
await shot('start-whistle');
await page.waitForTimeout(900);
await shot('start-swing');
await waitPhase('running', 60000);
await page.waitForTimeout(1500);
await shot('running');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(250);
await shot('jump');
await page.evaluate(() => window.__dsm.gameDebugChill());
await page.waitForTimeout(300);
await shot('fizz-full');
await page.keyboard.press('b');
await page.waitForTimeout(2500);
await shot('fizz-boost');
await page.waitForTimeout(4000);
await shot('fizz-boost-later');
let caught = true;
try {
  await waitPhase('caught', 45000);
} catch {
  // Survived: force the catch so the trophy shot and game-over sheet are still checked.
  await page.evaluate(() => window.__dsm.gameDebugCatch());
  caught = false;
}
{
  await page.waitForTimeout(1200);
  await shot('caught-swing');
  await page.waitForTimeout(2500);
  await shot('gameover');
  await page.waitForTimeout(7000);
  await shot('trophy');
  const shareVisible = await page.getByRole('button', { name: /CHALLENGE FRIENDS/ }).isVisible();
  await page.getByRole('button', { name: 'RUN AGAIN' }).click();
  await waitPhase('running', 60000);
  await page.waitForTimeout(1200);
  await shot('run-again');
  console.log(JSON.stringify({ shareVisible }));
}
const s = await page.evaluate(() => window.__dsm.game());
console.log(JSON.stringify({ ok: true, caught, distance: s.distance, caps: s.caps, best: s.best, errors }, null, 1));
await browser.close();
