// _hwbarrelshots.mjs - THE HIGHWAY'S CRASH-CUSHION BARRELS (?hwbarrels=1) in the real game: the
// autopilot down a highway (no traffic) until a TARGET stands 80-500 m ahead - MODE=median: the
// start of a Jersey barrier's or Armco's run in the central reservation after an open one (found
// from the barriers, so the same spot with the switch off); MODE=gore: a cluster at a slip's nose.
// Then: a photo of it with your car held beside it (zoom pinned 1.2), and a CRASH - your car put
// RUN_M before the end (median) or the cluster's front (gore) on its line at KMH, let go with no
// input; photos as it meets it and after; then the damage (the four corners' sum), the speed left,
// the barrels popped / leaking and the wet cells near. Writes <OUT>/<on|off>-<mode>-<W>x<H>-*.png.
// [VIEW=844x390] [MODE=median] [TARGET_S=m] [ROAD=motorway] [SCENERY=countryside] [HWBARRELS=1] [KMH=90]
//   [OUT=dir] [LIMIT_S=300] CHECK_PORT=8092 node tools/scratch/_hwbarrelshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const MODE = process.env.MODE || 'median', ROAD = process.env.ROAD || 'motorway';
const SCENERY = process.env.SCENERY || 'countryside', KMH = +(process.env.KMH || 90);
const OUT = process.env.OUT || 'tools/scratch/_hwbarrels', ON = process.env.HWBARRELS === '1';
const LIMIT_S = +(process.env.LIMIT_S || 300);
// m before the end / the cluster's front the car is let go (a median's street lights stand on its
// line: from 45 m back the car met a column first)
const RUN_M = +(process.env.RUN_M || 12);
// a median end's road distance to go to instead of the first found (MEASURED: a run found an
// Armco piece's start at a stretch join where the piece before had been dropped - no end there)
const TARGET_S = +(process.env.TARGET_S || 0);
const tag = `${ON ? 'on' : 'off'}-${MODE}-${SCENERY}-${ROAD}-${width}x${height}`;
mkdirSync(OUT, { recursive: true });

/**
 * Page side: the target ahead, or null - its road distance (median: the barrier's start; gore:
 * the cluster's front barrel) and offset.
 * @param args the mode ('median' or 'gore'), a fixed median end, m (0: none), and whether a
 *   median end must have barrels
 * @returns { s, off } or null
 */
async function targetAhead([mode, fixedS, withBarrels]) {
  const { roadFrame } = await import('/src/highway.ts');
  const game = window.__game, level = game.level, car = game.car;
  const here = roadFrame(level, car.x, car.y, null);
  if (!here) return null;
  const ahead = (dist) => dist - here.s > 80 && dist - here.s < 500;
  if (fixedS) return ahead(fixedS) ? { s: fixedS, off: 0 } : null;
  if (mode === 'median') {
    const onLine = [];
    for (const barrier of level.barriers) {
      if (barrier.kind !== 'jersey' && barrier.kind !== 'armco') continue;
      for (const [x, y] of barrier.pts) {
        const frame = roadFrame(level, x, y, here.s);
        if (frame && Math.abs(frame.off) < 0.5) onLine.push(frame.s);
      }
    }
    for (const barrier of level.barriers) {
      if (barrier.kind !== 'jersey' && barrier.kind !== 'armco') continue;
      const first = roadFrame(level, barrier.pts[0][0], barrier.pts[0][1], here.s);
      if (!first || Math.abs(first.off) > 0.5 || !ahead(first.s)) continue;
      const [endX, endY] = barrier.pts[0];
      // (with the switch: only an end the barrels stand at - a piece's start at a stretch join can
      // look like an end once the piece before it is dropped behind)
      const guarded = !withBarrels || game.cones.list.some((obj) => obj.kind === 'cushion'
        && Math.hypot(obj.x - endX, obj.y - endY) < 5);
      if (guarded && !onLine.some((dist) => dist < first.s - 0.1 && dist > first.s - 8))
        return { s: first.s, off: 0 };
    }
    return null;
  }
  const hw = level._hw.geo.hw;
  const gore = game.cones.list.filter((obj) => obj.kind === 'cushion').map((obj) => ({ obj,
    frame: roadFrame(level, obj.x, obj.y, here.s) })).filter(({ frame }) => frame
    && frame.off < -hw && ahead(frame.s));
  if (!gore.length) return null;
  const front = gore.reduce((best, item) => (item.frame.s < best.frame.s ? item : best));
  const mates = gore.filter((item) => Math.abs(item.frame.s - front.frame.s) < 10);
  return { s: front.frame.s, off: mates.reduce((sum, item) => sum + item.frame.off, 0)
    / mates.length };
}

/**
 * Page side: holds your car still at a road distance and offset, along the road, view pinned.
 * @param spot { s, off }
 */
async function holdAt(spot) {
  const { roadPose } = await import('/src/highway.ts');
  const game = window.__game, car = game.car, pose = roadPose(game.level, spot.s, spot.off);
  game.setAutopilot(false);
  game.renderer.debugZoom(1.2);
  clearInterval(window.__hold);
  window.__hold = setInterval(() => {
    Object.assign(car, { x: pose.x, y: pose.y, vx: 0, vy: 0, heading: pose.h, yawRate: 0,
      delta: 0 });
  }, 4);
}

/**
 * Page side: lets your car go from where it is held at a speed along its heading, damage cleared.
 * @param speed m/s
 */
function letGo(speed) {
  const car = window.__game.car;
  clearInterval(window.__hold);
  car.dmg = [0, 0, 0, 0];
  car.vx = Math.cos(car.heading) * speed;
  car.vy = Math.sin(car.heading) * speed;
}

/**
 * Page side: what the crash did.
 * @returns the line
 */
function crashReport() {
  const game = window.__game, car = game.car, list = game.cones.list;
  const near = (obj) => Math.hypot(obj.x - car.x, obj.y - car.y) < 40;
  const popped = list.filter((obj) => obj.kind === 'cushionpop' && near(obj)).length;
  const leaking = list.filter((obj) => obj.kind === 'cushion' && near(obj) && obj.water != null
    && obj.water < 6).length;
  const whole = list.filter((obj) => obj.kind === 'cushion' && near(obj) && obj.water == null)
    .length;
  const damage = (car.dmg || []).reduce((sum, corner) => sum + corner, 0);
  return `damage ${damage.toFixed(3)} (corners ${(car.dmg || []).map((corner) =>
    corner.toFixed(2)).join(' ')}), speed now ${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)}`
    + ` km/h, barrels near: popped ${popped}, leaking ${leaking}, untouched ${whole}`;
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
    + (ON ? '&hwbarrels=1' : ''));
  await page.touchscreen.tap(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic: 0 }), [ROAD, SCENERY]);
  await page.waitForTimeout(6000);
  let target = null;
  for (let waited = 0; waited < LIMIT_S * 2 && !target; waited++) {
    target = await page.evaluate(targetAhead, [MODE, TARGET_S, ON]);
    if (!target) await page.waitForTimeout(500);
  }
  if (!target) console.log(`${tag}: no target met in ${LIMIT_S} s`);
  else {
    console.log(`${tag}: target at s ${target.s.toFixed(1)}, off ${target.off.toFixed(2)}`);
    await page.evaluate(holdAt, { s: target.s - 6, off: MODE === 'median' ? -3.6
      : target.off + 4 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${tag}-cluster.png` });
    await page.evaluate(holdAt, { s: target.s - RUN_M, off: target.off });
    await page.waitForTimeout(800);
    const speed = KMH / 3.6;
    await page.evaluate(letGo, speed);
    await page.waitForTimeout(Math.round(((RUN_M - 2) / speed) * 1000));
    await page.screenshot({ path: `${OUT}/${tag}-hit.png` });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${tag}-after.png` });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${tag}-wet.png` });
    console.log(`${tag}: crash at ${KMH} km/h: ${await page.evaluate(crashReport)}`);
  }
  console.log(errors.length ? 'page errors: ' + errors.slice(0, 3).join(' | ') : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}
