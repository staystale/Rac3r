// _hwchevronshots.mjs - THE HIGHWAY'S CHEVRON BOARDS (?hwchevron=1) photographed in the real game:
// the autopilot down a highway; when a chevron board first stands 15-45 m ahead your car is held
// still 5 m from it on the road's side and the view pinned at zoom 1.2: a photo, then the same
// board knocked flat (its fall set by hand). Prints the board's place and paint. Writes
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
    // (no traffic car standing over it: a broken-down lorry on the verge hid one)
    const hidden = game.traffic.list.some((slot) => Math.hypot(slot.car.x - obj.x,
      slot.car.y - obj.y) < 12);
    return !hidden && gap > 15 && gap < 45
      && dx * Math.cos(car.heading) + dy * Math.sin(car.heading) > 0;
  });
}

/**
 * Page side: holds your car still 5 m from a board on the road's side of it (the view centres on
 * your car), the view zoomed in; the board kept as window.__board.
 * @param index the board's index in the live loose objects
 * @returns the board's distance from the road's middle, m, and its paint
 */
async function holdBeside(index) {
  const game = window.__game, board = window.__board = game.cones.list[index];
  const { roadPose } = await import('/src/highway.ts');
  const middle = roadPose(game.level, board._s ?? 0, 0), car = game.car;
  const gap = Math.hypot(board.x - middle.x, board.y - middle.y);
  const share = 5 / Math.max(5, gap);
  const spot = { x: board.x + (middle.x - board.x) * share, y: board.y + (middle.y - board.y)
    * share };
  game.setAutopilot(false);
  game.renderer.debugZoom(1.2);
  window.__hold = setInterval(() => {
    Object.assign(car, { x: spot.x, y: spot.y, vx: 0, vy: 0, heading: middle.h, yawRate: 0 });
  }, 4);
  return `${gap.toFixed(1)} m from the road's middle, paint ${board.paint || 'none (rally yellow)'}`;
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
  for (let waited = 0; waited < LIMIT_S * 10 && found < 0; waited++) {
    found = await page.evaluate(boardAhead);
    if (found < 0) await page.waitForTimeout(100);
  }
  if (found < 0) console.log('no board met in', LIMIT_S, 's');
  else {
    const where = await page.evaluate(holdBeside, found);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${tag}-up.png` });
    await page.evaluate(() => {
      window.__board.down = 1;
      window.__board.moved = true;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${tag}-down.png` });
    console.log(`${tag}: board ${where}`);
  }
  console.log(errors.length ? 'page errors: ' + errors.slice(0, 3).join(' | ') : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}
