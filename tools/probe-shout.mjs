import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${process.argv[2]}/?debug`);
await page.waitForFunction(() => window.__dsm?.getState().step === 'silhouette', null, { timeout: 90000 });
const b = await page.evaluate(() => window.__dsm.bottleScreenBox());
await page.mouse.click(b.cx, (b.top + b.bottom) / 2);
await page.waitForTimeout(6000); // let the intro rumble die down
console.log(await page.evaluate(async () => {
  const g = window.__dsm.audioGraph();
  const an = g.ctx.createAnalyser(); an.fftSize = 2048; g.master.connect(an);
  const buf = new Float32Array(2048);
  const rms = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); };
  const sample = async (ms) => { let p = 0; const end = performance.now() + ms; while (performance.now() < end) { p = Math.max(p, rms()); await new Promise((r) => setTimeout(r, 20)); } return p; };
  const before = await sample(400);
  window.__dsm.shout(1, 0.5);
  const one = await sample(700);
  await new Promise((r) => setTimeout(r, 400));
  window.__dsm.shout(3, 0.7);
  const crowd = await sample(900);
  return `background=${before.toFixed(4)} oneShout=${one.toFixed(4)} crowd=${crowd.toFixed(4)}`;
}));
await browser.close();
