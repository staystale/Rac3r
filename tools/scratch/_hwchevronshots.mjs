// _hwchevronshots.mjs - THE HIGHWAY'S CHEVRON BOARDS (?hwchevron=1) photographed in the real game:
// the autopilot down a highway; a photo when a chevron board first stands 15-45 m ahead (on
// screen), then the same board knocked flat (its fall set by hand). Writes
// <OUT>/<on|off>-<scenery>-<road>-<W>x<H>-<up|down>.png.
// [VIEW=390x844] [ROAD=twisty] [SCENERY=countryside] [HWCHEVRON=1] [OUT=dir] [LIMIT_S=240]
//   node tools/scratch/_hwchevronshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const ROAD = process.env.ROAD || 'twisty', SCENERY = process.env.SCENERY || 'countryside';
const OUT = process.env.OUT || 'tools/scratch/_hwchevron', ON = process.env.HWCHEVRON === '1';
const LIMIT_S = +(process.env.LIMIT_S || 240);
const tag = `${ON ? 'on' : 'off'}-${SCENERY}-${ROAD}-${width}x${height}`;
mkdirSync(OUT, { recursive: true });

/**
 * Page side: the index of a chevron board 15-45 m ahead of your car, or -1.
 * @returns the index in the live loose objects
 */
function boardAhead() {
  const game = window.__game, car = game.car, list = game.cones.list;
  return list.findIndex((obj) => {
    if (obj.kind !== 'chevron' || obj.down > 0) return false;
    const dx = obj.x - car.x, dy = obj.y - car.y, gap = Math.hypot(dx, dy);
    return gap > 15 && gap < 45 && dx * Math.cos(car.heading) + dy * Math.sin(car.heading) > 0;
  });
}

const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + (ON ? '&hwchevron=1' : ''));
  await page.touchscreen.tap(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic: 0.3 }), [ROAD, SCENERY]);
  await page.waitForTimeout(6000);
  let found = -1;
  for (let waited = 0; waited < LIMIT_S * 4 && found < 0; waited++) {
    found = await page.evaluate(boardAhead);
    if (found < 0) await page.waitForTimeout(250);
  }
  if (found < 0) console.log('no board met in', LIMIT_S, 's');
  else {
    await page.screenshot({ path: `${OUT}/${tag}-up.png` });
    const paint = await page.evaluate((index) => {
      const obj = window.__game.cones.list[index];
      obj.down = 1;
      obj.moved = true;
      return obj.paint || 'none (the rally yellow)';
    }, found);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${tag}-down.png` });
    console.log(`${tag}: board photographed, paint ${paint}`);
  }
  console.log(errors.length ? 'page errors: ' + errors.slice(0, 3).join(' | ') : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}
