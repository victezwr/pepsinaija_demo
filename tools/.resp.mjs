import { chromium } from 'playwright';
import fs from 'fs';
const [base, out, only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sizes = [[320, 568, 'phone-small', true], [360, 640, 'phone', true], [390, 844, 'phone-tall', true], [844, 390, 'phone-landscape', true], [768, 1024, 'tablet', true], [1366, 768, 'laptop', false], [1920, 1080, 'desktop', false]].filter((s) => !only || s[2] === only);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, name, touch] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900 });
  const p = await ctx.newPage();
  // (headless renders slowly: let one-off CSS animations finish before each picture)
  const settle = () => p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 30000 }).catch(() => {});
  const shot = async (s) => {
    await settle();
    await p.screenshot({ path: `${out}/${name}-${s}.png` });
  };
  try {
    await p.goto(`${base}/?debug&lite`);
    await p.waitForFunction(() => window.__dsm?.getState().step === 'intro', null, { timeout: 120000 });
    await p.waitForTimeout(2500);
    await shot('1-intro');
    await p.getByRole('button', { name: 'Leaderboard' }).click();
    await p.waitForTimeout(1200);
    await shot('2-board-empty');
    await p.keyboard.press('Escape');
    await p.getByRole('button', { name: 'PLAY' }).click();
    await p.waitForFunction(() => window.__dsm.getState().step === 'choose', null, { timeout: 120000 });
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.choose')).opacity === '1', null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await shot('3-choose');
    await p.getByPlaceholder('Type your name').fill('Chukwuemeka O.');
    await p.getByRole('button', { name: 'Female runner', exact: true }).click();
    await p.waitForFunction(() => window.__dsm.gameDebugState()?.bubble?.startsWith('Afa'), null, { timeout: 200000 });
    await p.waitForTimeout(500);
    await shot('4-street-line');
    await p.waitForFunction(() => window.__dsm.game().phase === 'running', null, { timeout: 200000 });
    await p.evaluate(() => window.__dsm.gameDebugInvulnerable(9999));
    await p.waitForTimeout(1500);
    await shot('5-running');
    await p.evaluate(() => window.__dsm.gameDebugStumble());
    await p.waitForTimeout(400);
    await shot('6-stumble-line');
    await p.keyboard.press('p');
    await p.waitForTimeout(500);
    await shot('7-paused');
    await p.keyboard.press('p');
    await p.waitForFunction(() => !window.__dsm.game().paused, null, { timeout: 20000 });
    await p.evaluate(() => window.__dsm.gameDebugChill());
    await p.waitForTimeout(400);
    await shot('8-pulse-ready');
    await p.evaluate(() => { window.__dsm.gameDebugInvulnerable(0); window.__dsm.gameDebugCatch(); });
    await p.waitForFunction(() => window.__dsm.game().phase === 'caught', null, { timeout: 30000 });
    await p.waitForTimeout(4500);
    await shot('9-gameover');
    await p.getByRole('button', { name: 'LEADERBOARD' }).click();
    await p.waitForTimeout(1500);
    await shot('10-board');
  } catch (e) {
    console.log(name, 'error', e.message.split('\n')[0]);
  }
  await ctx.close();
  console.log('done', name);
}
await b.close();
