// Captures the story → chase hand-off frame by frame, plus the slide.
import { chromium } from 'playwright';
import fs from 'fs';
const [base, out, w = '390', h = '844'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = () => page.evaluate(() => window.__dsm.getState().step);
const waitStep = (s) => page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout: 90000 });
const box = () => page.evaluate(() => window.__dsm.bottleScreenBox());
await page.goto(`${base}/?debug`);
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
await waitStep('exit');
const t0 = Date.now();
const log = [];
for (let i = 0; i < 16; i++) {
  await page.screenshot({ path: `${out}/h${String(i).padStart(2, '0')}.png` });
  log.push(`${i}: ${Date.now() - t0}ms step=${await step()} phase=${await page.evaluate(() => window.__dsm.game().phase)}`);
  await page.waitForTimeout(150);
}
await page.waitForFunction(() => window.__dsm.game().phase === 'card', null, { timeout: 90000 });
await page.getByRole('button', { name: 'NEXT' }).click();
await page.getByRole('button', { name: 'START' }).click();
await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.keyboard.press('ArrowDown');
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/slide${i}.png` });
}
console.log(log.join('\n'));
console.log(JSON.stringify({ errors }));
await browser.close();
