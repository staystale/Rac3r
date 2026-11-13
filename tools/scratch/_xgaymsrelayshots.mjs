// _xgaymsrelayshots.mjs - L.A. LIVELY RE-LAID (?xgaymsloose=1) against today's, at phone size
// (scratch): the whole map zoomed right out, then the car parked (heading along the road) at every
// corner of the lap (each turn of more than CORNER_DEG over 20 m, 40 m apart), on the crossover's
// road over and under it both ways, on the joker by its kicker, and in the middle of each dirt lot -
// by day (TEST MODE's start hour 13) and at night (23), no AI. Written to OUT (default
// shots/xgaymsloose) as <off|on>-<day|night>-<spot>-<size>.png.
// node tools/scratch/_xgaymsrelayshots.mjs  (env SIZES "844x390,390x844", ZOOM, EXTRA; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.env.OUT || 'shots/xgaymsloose';
const SIZES = (process.env.SIZES || '844x390,390x844').split(',');
const ZOOM = +(process.env.ZOOM || 0.5), MAP_ZOOM = 0.1;
fs.mkdirSync(OUT, { recursive: true });

/** Page side: the spots [name, x, y, heading]: the corners, the crossover, the joker, the lots. */
function relaySpots() {
  const game = window.__game, sub = game.level.subtrack, pts = sub.pts, count = pts.length;
  const CORNER_DEG = 25, SPAN_M = 10, APART_M = 40;
  const at = (dist) => {
    const along = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
    let best = pts[0];
    for (const point of pts) if (point.dist <= along) best = point;
    return best;
  };
  const turnAt = (point) => {
    const before = at(point.dist - SPAN_M), after = at(point.dist + SPAN_M);
    const turn = after.heading - before.heading;
    return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) * 180 / Math.PI;
  };
  const corners = [];
  for (let i = 0; i < count; i++) {
    const turn = turnAt(pts[i]);
    if (turn < CORNER_DEG) continue;
    const near = corners.find((corner) => Math.abs(corner.dist - pts[i].dist) < APART_M);
    if (near && near.turn >= turn) continue;
    if (near) corners.splice(corners.indexOf(near), 1);
    corners.push({ dist: pts[i].dist, turn, point: pts[i] });
  }
  const spots = corners.sort((one, two) => one.dist - two.dist).map((corner, i) =>
    [`corner${i + 1}-${Math.round(corner.turn)}deg`, corner.point.x, corner.point.y,
      corner.point.heading]);
  const span = (sub.under || [])[0];
  if (span) {
    const under = at((span.d0 + span.d1) / 2), over = at(span.over);
    const into = at(span.d0 - 10), outOf = at(span.d1 + 10);
    spots.push(['under-in', into.x, into.y, into.heading],
      ['under-out', outOf.x, outOf.y, outOf.heading + Math.PI],
      ['over', over.x, over.y, over.heading], ['over-back', over.x, over.y, over.heading + Math.PI],
      ['under-mid', under.x, under.y, under.heading]);
  }
  const lane = (game.level.lanes || [])[0];
  const kicker = (game.level.bumps || []).find((bump) => bump.kind === 'ramp');
  if (lane && kicker) spots.push(['joker-jump', kicker.x + 25, kicker.y, Math.PI]);
  // (the joker's mouth off the lap and its way back on: its arrows, ?jokerarrow=1)
  if (lane) {
    const [mouthX, mouthY] = lane.pts[0], [nextX, nextY] = lane.pts[Math.min(5, lane.pts.length - 1)];
    const mouth = Math.atan2(nextY - mouthY, nextX - mouthX);
    spots.push(['joker-mouth', mouthX - Math.cos(mouth) * 25, mouthY - Math.sin(mouth) * 25, mouth]);
    const [endX, endY] = lane.pts.at(-1);
    // (it rejoins the street heading south)
    spots.push(['joker-merge', endX, endY, Math.PI / 2]);
  }
  let run = null;
  const lots = [];
  for (const point of pts) {
    const sector = sub.sectorAt ? sub.sectorAt(point.dist) : null;
    const dirt = !!(sector && sector.surface && sector.surface.id === 'dirt');
    if (dirt && !run) run = [point];
    else if (dirt) run.push(point);
    else if (run) { lots.push(run); run = null; }
  }
  if (run) lots.push(run);
  lots.forEach((lot, i) => {
    const mid = lot[Math.floor(lot.length / 2)];
    spots.push([`dirt${i + 1}`, mid.x, mid.y, mid.heading]);
  });
  return spots;
}

/** Page side: the car at a spot, held on the brake, the camera at a zoom. */
async function parkAt([x, y, heading, zoom]) {
  const game = window.__game, { reset } = await import('/src/vehicle.ts');
  game.car.crossing = -1;
  reset(game.car, x, y, heading);
  game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  game.renderer.debugZoom(zoom);
}

/**
 * One side at one size: each hour, the map and every spot.
 * @param browser the browser
 * @param base the server's url
 * @param side 'off' or 'on'
 * @param size 'WxH'
 */
async function shootSide(browser, base, side, size) {
  const [width, height] = size.split('x').map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // (env EXTRA: switches on both sides, e.g. &jokerarrow=1)
  const query = (side === 'on' ? '&xgaymsloose=1' : '') + (process.env.EXTRA || '');
  await gotoGame(page, `${base}/?pc=1&guide=0&menu=0&noaudio=1&level=xgayms${query}`);
  await page.mouse.click(width / 2, height / 2);
  let count = 0;
  for (const [hour, when] of [[13, 'day'], [23, 'night']]) {
    await page.evaluate((time) => window.__game.launch('xgayms', window.__game.car.spec.id,
      { ai: 0, laps: 3, time }), hour);
    await page.waitForTimeout(2500);
    await page.evaluate(parkAt, [0, -30, 0, MAP_ZOOM]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${side}-${when}-map-${size}.png` });
    const spots = await page.evaluate(relaySpots);
    for (const [name, x, y, heading] of spots) {
      await page.evaluate(parkAt, [x, y, heading, ZOOM]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${side}-${when}-${name}-${size}.png` });
    }
    count = spots.length;
  }
  console.log(side, size, count, 'spots',
    errors.length ? `ERRORS ${errors.slice(0, 3).join(' | ')}` : 'errors none');
  await context.close();
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const size of SIZES) for (const side of ['off', 'on']) {
    await shootSide(browser, server.url, side, size);
  }
} finally {
  await browser.close();
  server.stop();
}
