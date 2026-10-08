// devshot.mjs — photograph the REAL game in a REAL browser (CLAUDE.md §3: a synthetic harness tests
// the code you wrote; a screenshot tests the game that exists).
//
// Drives with real key events / touch taps so what is photographed is what a player gets.
//   node tools/devshot.mjs                    the default set
//   node tools/devshot.mjs cars               one shot per car, driving
//
// Playwright lives in the plant sim's node_modules (CLAUDE.md §5); launched with channel msedge.

import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:8080';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const SIZES = {
  phoneLand: { width: 844, height: 390, dpr: 3, mobile: true },
  phonePort: { width: 390, height: 844, dpr: 3, mobile: true },
  desktop: { width: 1280, height: 720, dpr: 1, mobile: false },
};

const browser = await chromium.launch({ channel: 'msedge' });
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

const mode = process.argv[2] || 'default';

if (mode === 'default' || mode === 'all') {
  await shot('00-rest-desktop', { size: 'desktop', url: '/?dev=1' });
  await shot('01-rest-land', { size: 'phoneLand', url: '/?dev=1&touch=1' });
  await shot('02-rest-port', { size: 'phonePort', url: '/?dev=1&touch=1' });
  await shot('03-straight', { size: 'phoneLand', url: '/?dev=1', drive: hold(['w'], 3000) });
  await shot('04-corner', { size: 'phoneLand', url: '/?dev=1', drive: seq(hold(['w'], 2200), hold(['w', 'd'], 1400)) });
  await shot('05-handbrake', { size: 'phoneLand', url: '/?dev=1', drive: seq(hold(['w'], 2200), hold(['d', ' '], 1100)) });
  await shot('06-lockup', { size: 'phoneLand', url: '/?dev=1', drive: seq(hold(['w'], 3500), hold(['s'], 1400)) });
  await shot('07-donut', { size: 'phoneLand', url: '/?dev=1&car=muscle-rwd', drive: seq(hold(['w'], 1200), hold(['w', 'd'], 3500)) });
  await shot('08-selector', { size: 'phoneLand', url: '/?dev=0&touch=1', drive: async (page) => { await page.mouse.click(70, 29); } });
  await shot('09-port-drive', { size: 'phonePort', url: '/?touch=1', drive: seq(hold(['w'], 1800), hold(['w', 'a'], 1200)) });
}

if (mode === 'cars' || mode === 'all') {
  for (const id of ['hatch-fwd', 'hatch-rwd', 'estate-4x4', 'muscle-rwd', 'rally-4x4', 'track-rwd']) {
    await shot(`car-${id}`, {
      size: 'desktop', url: `/?dev=1&car=${id}`,
      drive: seq(hold(['w'], 1800), hold(['w', 'd'], 2000)),
    });
  }
}

await browser.close();
if (errors.length) {
  console.log('\n*** CONSOLE ERRORS (CLAUDE.md rule 13 — an unimported symbol reads as "my UI vanished") ***');
  for (const e of errors) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('\nno console errors.');
}
