// Measures real audio output (RMS on the master bus) during the story and the chase.
import { chromium } from 'playwright';
const [base] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
const step = () => page.evaluate(() => window.__dsm.getState().step);
const waitStep = (s) => page.waitForFunction((s) => window.__dsm?.getState().step === s, s, { timeout: 90000 });
const box = () => page.evaluate(() => window.__dsm.bottleScreenBox());
const level = (label) => page.evaluate(async (label) => {
  const g = window.__dsm.audioGraph();
  if (!g) return `${label}: no audio graph`;
  if (!window.__an) { window.__an = g.ctx.createAnalyser(); window.__an.fftSize = 2048; g.master.connect(window.__an); }
  const buf = new Float32Array(2048); let peak = 0;
  for (let i = 0; i < 20; i++) { window.__an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; peak = Math.max(peak, Math.sqrt(s / buf.length)); await new Promise((r) => setTimeout(r, 100)); }
  return `${label}: ctx=${g.ctx.state} master=${g.master.gain.value.toFixed(2)} peakRMS=${peak.toFixed(4)}`;
}, label);
await page.goto(`${base}/?debug&autopilot`);
await waitStep('silhouette');
let b = await box();
await page.mouse.click(b.cx, (b.top + b.bottom) / 2);
console.log(await level('intro (rumble)'));
await waitStep('warning');
b = await box();
await page.mouse.move(b.cx, (b.top + b.bottom) / 2); await page.mouse.down();
for (let i = 0; i < 80 && (await step()) !== 'launch'; i++) await page.mouse.move(b.cx, (b.top + b.bottom) / 2 + (i % 2 ? -90 : 90), { steps: 4 });
await page.mouse.up();
await waitStep('rebel');
for (let i = 0; i < 8 && (await step()) === 'rebel'; i++) { b = await box(); await page.mouse.click(b.cx + 5, (b.top + b.bottom) / 2); await page.waitForTimeout(900); }
await page.waitForFunction(() => window.__dsm.game().phase === 'reveal', null, { timeout: 90000 });
console.log(await level('reveal (shouts)'));
await page.waitForFunction(() => window.__dsm.game().phase === 'card', null, { timeout: 90000 });
console.log(await level('card (silence expected)'));
await page.getByRole('button', { name: 'NEXT' }).click();
await page.getByRole('button', { name: 'START' }).click();
await page.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 30000 });
console.log(await level('running (music)'));
console.log(await level('running (music, later)'));
await browser.close();
