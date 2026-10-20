// Walks the whole story headless and screenshots each step.
// Usage: node tools/smoke.mjs <baseUrl> <outDir> [width] [height] [query]
import { chromium } from 'playwright';
import fs from 'fs';

const [base, out, w = '390', h = '844', q = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const step = () => page.evaluate(() => window.__dsm.getState().step);
const waitStep = async (s, timeout = 60000) => {
  await page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout });
};
const box = () => page.evaluate(() => window.__dsm.bottleScreenBox());
let n = 0;
const shot = async (name) => page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });

await page.goto(`${base}/?debug${q ? '&' + q : ''}`);
await waitStep('silhouette');
await page.waitForTimeout(800);
await shot('silhouette');

let b = await box();
await page.mouse.click(b.cx, (b.top + b.bottom) / 2);
await page.waitForTimeout(2500);
await shot('intro');
await waitStep('warning');
await page.waitForTimeout(3500);
await shot('warning');

// Shake: vigorous up-and-down drag on the bottle.
b = await box();
const cy = (b.top + b.bottom) / 2;
await page.mouse.move(b.cx, cy);
await page.mouse.down();
let shook = 0;
for (let i = 0; i < 80 && (await step()) !== 'launch'; i++) {
  await page.mouse.move(b.cx, cy + (i % 2 ? -90 : 90), { steps: 4 });
  if (++shook === 8) await shot('shaking');
}
await page.mouse.up();
await page.waitForTimeout(400);
await shot('launch');
await waitStep('rebel');
await page.waitForTimeout(600);
await shot('yellow-cap');

// Rebel: reach for it until it runs off.
for (let i = 0; i < 6 && (await step()) === 'rebel'; i++) {
  b = await box();
  await page.mouse.click(b.cx + 5, (b.top + b.bottom) / 2);
  await page.waitForTimeout(1200);
  await shot(`dodge-${i + 1}`);
}
await page.waitForTimeout(700);
await shot('escape');
await waitStep('game');
await page.waitForTimeout(1500);
await shot('handoff-to-game');

console.log(JSON.stringify({ ok: true, tier: await page.evaluate(() => window.__dsm.getState().tier), errors }, null, 1));
await browser.close();
