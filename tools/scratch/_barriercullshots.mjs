// _barriercullshots.mjs - BARRIER CULLING BY STRETCH (?barriercull=1): does it draw the same?
// For each level and screen size the car is parked on the lap next to stretch ends of the longest
// barriers (and at the start), the page frozen (tools/lib/determinism.mjs: nothing moves unless
// stepped), and the SAME frame rendered three times: the switch off, on, off again (FIX flipped in
// the page). Each pair is compared pixel by pixel; off/off is the noise floor (it must be 0). Each
// spot logs how many stretch ends are on screen and how many barriers run off the screen's edge.
// Shots in OUT (default shots/barriercull). CPU raster, as renderhash.
// node tools/scratch/_barriercullshots.mjs [levels,comma,separated]  (env OUT, SPOTS; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';
import { decodePng } from '../lib/png.mjs';

const LEVELS = (process.argv[2] || 'xgayms,birdsmess,dieatona').split(',');
const SIZES = [[844, 390], [390, 844]];
const OUT = process.env.OUT || 'shots/barriercull';
const SPOTS = +(process.env.SPOTS || 5);
// the photo zooms (renderer.debugZoom): near, and far out where lines are at their least width
const ZOOMS = (process.env.ZOOMS || '0.6,0.3').split(',').map(Number);
const CPU_RASTER_ARGS = [
  '--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];
fs.mkdirSync(OUT, { recursive: true });

/** Page side: the spots - the lap point nearest each of a few stretch ends, and the start. */
async function pickSpots(count) {
  const game = window.__game, { LEVEL } = await import('/src/world/state.ts');
  const { FIX } = await import('/src/core/fixes.ts');
  FIX.barriercull = true;
  window.__game.renderer.frame(game, 0, performance.now() / 1000);
  const sub = game.level.subtrack, ends = [];
  const longest = LEVEL.barriers.filter((bar) => bar._stretches)
    .sort((one, two) => two._stretches.firsts.length - one._stretches.firsts.length);
  for (const bar of longest.slice(0, count)) {
    const firsts = bar._stretches.firsts, mid = firsts[Math.floor(firsts.length / 2)];
    ends.push(bar.pts[mid]);
  }
  const spots = [{ x: sub.pts[0].x, y: sub.pts[0].y, heading: sub.pts[0].heading }];
  for (const [ex, ey] of ends) {
    let best = sub.pts[0], bestDist = Infinity;
    for (const point of sub.pts) {
      const dist = Math.hypot(point.x - ex, point.y - ey);
      if (dist < bestDist) [best, bestDist] = [point, dist];
    }
    spots.push({ x: best.x, y: best.y, heading: best.heading });
  }
  return spots;
}

/** Page side: park the car at a spot, held on the brake, and let the camera settle. */
async function parkAt([spot, zoom]) {
  const game = window.__game, { reset } = await import('/src/vehicle.ts');
  game.car.crossing = -1;
  reset(game.car, spot.x, spot.y, spot.heading);
  game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  game.renderer.debugZoom(zoom);
  window.__rt.step(150);
}

/** Page side: render the frozen frame with the switch set, as a PNG data URL (ground + screen). */
async function renderWith(isOn) {
  const { FIX } = await import('/src/core/fixes.ts');
  FIX.barriercull = isOn;
  const game = window.__game;
  game.renderer.frame(game, 0, performance.now() / 1000);
  const screen = document.getElementById('c'), ground = document.getElementById('glground');
  if (!ground) return screen.toDataURL('image/png');
  const out = document.createElement('canvas');
  out.width = screen.width;
  out.height = screen.height;
  out.getContext('2d').drawImage(ground, 0, 0);
  out.getContext('2d').drawImage(screen, 0, 0);
  return out.toDataURL('image/png');
}

/** Page side: stretch ends on screen, barriers running off its edge, stretches shown of all. */
async function screenFacts() {
  const { LEVEL } = await import('/src/world/state.ts');
  let endsOnScreen = 0, edgeCrossers = 0, shown = 0, total = 0;
  for (const bar of LEVEL.barriers) {
    const str = bar._stretches;
    if (!str) continue;
    let some = 0;
    for (let index = 0; index < str.shown.length; index++) {
      total++;
      if (str.shown[index]) [shown, some] = [shown + 1, some + 1];
      if (index && str.shown[index] && str.shown[index - 1]) endsOnScreen++;
    }
    if (some && some < str.shown.length) edgeCrossers++;
  }
  return { endsOnScreen, edgeCrossers, shown, total };
}

/** Pixels that differ between two PNGs (any channel), and the largest channel difference. */
function countDiff(pngA, pngB) {
  const one = decodePng(pngA), two = decodePng(pngB);
  if (one.width !== two.width || one.height !== two.height) return { pixels: -1, delta: 255 };
  let pixels = 0, delta = 0;
  for (let index = 0; index < one.rgba.length; index += 4) {
    let most = 0;
    for (let channel = 0; channel < 3; channel++)
      most = Math.max(most, Math.abs(one.rgba[index + channel] - two.rgba[index + channel]));
    if (most) pixels++;
    delta = Math.max(delta, most);
  }
  return { pixels, delta };
}

const toPng = (url) => Buffer.from(url.split(',')[1], 'base64');
const server = await startServer();
const browser = await launchBrowser({ args: CPU_RASTER_ARGS });
let worstPixels = 0, worstDelta = 0, shots = 0;
try {
  for (const level of LEVELS) {
    for (const [width, height] of SIZES) {
      const context = await browser.newContext({ viewport: { width, height },
        deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.addInitScript(installDeterminism);
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&level=${level}`,
        'window.__rt');
      await page.waitForTimeout(SETTLE_MS);
      await page.evaluate(() => window.__rt.step(10));
      await page.evaluate(launchLevel, [level, {}]);
      await page.waitForTimeout(SETTLE_MS);
      await page.evaluate(() => window.__rt.step(60));
      const spots = await page.evaluate(pickSpots, SPOTS);
      for (const [index, spot] of spots.entries()) for (const zoom of ZOOMS) {
        await page.evaluate(parkAt, [spot, zoom]);
        const offOne = toPng(await page.evaluate(renderWith, false));
        const onShot = toPng(await page.evaluate(renderWith, true));
        const facts = await page.evaluate(screenFacts);
        const offTwo = toPng(await page.evaluate(renderWith, false));
        const name = `${level}-${width}x${height}-${index}-z${zoom}`;
        fs.writeFileSync(`${OUT}/${name}-off.png`, offOne);
        fs.writeFileSync(`${OUT}/${name}-on.png`, onShot);
        const onDiff = countDiff(offOne, onShot), floor = countDiff(offOne, offTwo);
        worstPixels = Math.max(worstPixels, onDiff.pixels, floor.pixels);
        worstDelta = Math.max(worstDelta, onDiff.delta, floor.delta);
        shots++;
        console.log(`${name}: off/on ${onDiff.pixels} px (most ${onDiff.delta} levels), ` +
          `off/off ${floor.pixels} px | stretches shown ` +
          `${facts.shown}/${facts.total}, stretch joins on screen ${facts.endsOnScreen}, ` +
          `barriers off the edge ${facts.edgeCrossers}`);
      }
      if (errors.length) console.log(`${level}: page errors: ${errors.join(' | ')}`);
      await context.close();
    }
  }
  console.log(`barriercull shots: ${shots}, worst ${worstPixels} px differ, most by ${worstDelta}` +
    ` levels of 255 (${worstPixels ? 'DIFFERENT' : 'SAME'})`);
} finally {
  await browser.close();
  server.stop();
}
