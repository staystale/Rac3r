// devshot.mjs — photograph the REAL game in a REAL browser (CLAUDE.md §3: a synthetic harness tests
// the code you wrote; a screenshot tests the game that exists).
//
// Drives with real key events / touch taps so what is photographed is what a player gets.
//   node tools/devshot.mjs                    the default set
//   node tools/devshot.mjs cars               one shot per car, driving
//
// Playwright lives in the plant sim's node_modules (CLAUDE.md §5); launched with channel msedge.

import { startServer, launchBrowser } from '../lib/browser.mjs';
import { mkdirSync } from 'node:fs';
const srv = await startServer();
process.on('exit', srv.stop);

const BASE = srv.url;
const OUT = 'tools/scratch';
mkdirSync(OUT, { recursive: true });

const SIZES = {
  phoneLand: { width: 844, height: 390, dpr: 3, mobile: true },
  phonePort: { width: 390, height: 844, dpr: 3, mobile: true },
  desktop: { width: 1280, height: 720, dpr: 1, mobile: false },
};

const browser = await launchBrowser();
const errors = [];

async function shot(name, { size = 'phoneLand', url = '/?dev=1', drive = null, settle = 400 } = {}) {
  const S = SIZES[size];
  const ctx = await browser.newContext({
    viewport: { width: S.width, height: S.height },
    deviceScaleFactor: S.dpr,
    isMobile: S.mobile,
    hasTouch: S.mobile,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: PAGEERROR ${e.message}`));
  await page.goto(BASE + url, { waitUntil: 'load' });
  // tap to start
  await page.mouse.click(S.width / 2, S.height / 2);
  await page.waitForTimeout(150);
  if (drive) await drive(page, S);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const info = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { err: 'no __game' };
    return {
      car: g.car.spec.id,
      kph: +(Math.hypot(g.car.vx, g.car.vy) * 3.6).toFixed(1),
      gear: g.car.gear, rpm: Math.round(g.car.rpm),
      marks: g.marks.stamps,
      fps: Math.round(g.fps), steps: g.stepsLastFrame,
      satF: +g.car.t.satF.toFixed(2), satR: +g.car.t.satR.toFixed(2),
      slipF: +g.car.t.slipSpeedF.toFixed(2), slipR: +g.car.t.slipSpeedR.toFixed(2),
    };
  });
  console.log(name.padEnd(22), JSON.stringify(info));
  await ctx.close();
}

// hold keys for a duration, in wall-clock ms
const hold = (keys, ms) => async (page) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};
const seq = (...steps) => async (page, S) => { for (const s of steps) await s(page, S); };
const Q = '&smokeover=1';
await shot('_over-donut', { url: '/?dev=1&car=muscle-rwd' + Q, drive: seq(hold(['w'], 1500), hold(['w', 'd'], 8000)) });
await shot('_over-gravel', { url: '/?dev=1&level=stage-sahara-sandpants&car=rally-4x4' + Q, drive: seq(hold(['w'], 6000), hold(['w', 'a'], 1200)) });
console.log(errors.join('\n') || 'no errors');
await browser.close();
