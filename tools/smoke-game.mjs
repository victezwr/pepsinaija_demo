// Plays the story into the chase and screenshots every game screen.
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
const waitStep = (s, timeout = 60000) => page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout });
const waitPhase = (p, timeout = 90000) => page.waitForFunction((p) => window.__dsm?.game().phase === p, p, { timeout });
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
await page.waitForFunction(() => ['reveal', 'card'].includes(window.__dsm.game().phase), null, { timeout: 90000 });
await page.waitForTimeout(800);
await shot('reveal');
await waitPhase('card');
await page.waitForTimeout(500);
await shot('card');
await page.getByRole('button', { name: 'NEXT' }).click();
await waitPhase('select');
await page.waitForTimeout(800);
await shot('select-male');
await page.getByRole('button', { name: 'Female runner' }).click();
await page.waitForTimeout(800);
await shot('select-female');
await page.getByRole('button', { name: 'START' }).click();
await waitPhase('running');
await page.waitForTimeout(1500);
await shot('running');
// Swipe left with the mouse, jump, then let it run into something.
await page.mouse.move(195, 500);
await page.mouse.down();
await page.mouse.move(120, 505, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(400);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(250);
await shot('jump');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);
await shot('duck');
let caughtCoins = null;
try {
  await waitPhase('caught', 120000);
  await page.waitForTimeout(600);
  await shot('caught-fall');
  await page.waitForTimeout(2200);
  await shot('caught-card');
  caughtCoins = await page.evaluate(() => window.__dsm.game().coins);
  await page.getByRole('button', { name: 'RUN AM AGAIN' }).click();
  await waitPhase('running');
  await page.waitForTimeout(1200);
  await shot('rerun');
} catch {
  // Survived the whole window without hitting anything: fine, carry on to the win path.
}
// Win path: reload with the autopilot so the finish can be reached headless.
await page.goto(`${base}/?debug&autopilot${q ? '&' + q : ''}`);
await waitStep('silhouette');
b = await box();
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
await waitPhase('card');
await page.getByRole('button', { name: 'NEXT' }).click();
await waitPhase('select');
await page.getByRole('button', { name: 'START' }).click();
await waitPhase('running');
await page.waitForTimeout(6000);
await shot('autopilot');
await page.evaluate(() => window.__dsm.gameDebugCoins(1000));
await page.waitForFunction(() => window.__dsm.game().unlocked, null, { timeout: 20000 });
await page.waitForTimeout(300);
await shot('unlocked');
// Survive the final stretch: hop between lanes is not needed for the check; just wait for the finish or a catch.
await page.waitForFunction(() => ['won', 'end', 'caught'].includes(window.__dsm.game().phase), null, { timeout: 120000 });
const finish = await phase();
await page.waitForTimeout(1200);
await shot(`finish-${finish}`);
if (finish !== 'caught') {
  try {
    await waitPhase('end', 150000);
    await page.waitForTimeout(1500);
    await shot('end-card');
  } catch {
    errors.push(`end card never shown; phase stuck at ${await phase()} ${JSON.stringify(await page.evaluate(() => window.__dsm.gameDebugState()))}`);
  }
}
console.log(JSON.stringify({ ok: true, caughtCoins, finish, tier: await page.evaluate(() => window.__dsm.getState().tier), errors }, null, 1));
await browser.close();
