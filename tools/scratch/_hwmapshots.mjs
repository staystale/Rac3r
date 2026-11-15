// _hwmapshots.mjs - THE HIGHWAY'S MINIMAP EXTRAS (?hwmap=1) photographed in the real game: the
// autopilot down a highway with traffic, a photo when a petrol station, a road leaving the
// motorway, a police car not chasing, a junction's roundabout and a road bridge's road are each
// first in the minimap's reach ahead; then 1 star held (a chaser sent) and two photos FLASH_GAP ms
// apart once it is in reach (the flash). Writes <OUT>/<tag>-<W>x<H>-<what>.png. Without HWMAP=1
// the same moments with the switch off.
// [VIEW=390x844] [ROAD=motorway] [SCENERY=countryside] [HWMAP=1] [OUT=dir] [LIMIT_S=240]
//   node tools/scratch/_hwmapshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const ROAD = process.env.ROAD || 'motorway', SCENERY = process.env.SCENERY || 'countryside';
const OUT = process.env.OUT || 'tools/scratch/_hwmap', ON = process.env.HWMAP === '1';
const LIMIT_S = +(process.env.LIMIT_S || 240);
// m: "in the minimap's reach ahead" (the window shows ~140-450 m ahead with the zoom)
const REACH_M = 140;
// ms between the two chase photos (a dot's half flash is 125 ms)
const FLASH_GAP = 125;
const tag = `${ON ? 'on' : 'off'}-${SCENERY}-${ROAD}`;
mkdirSync(OUT, { recursive: true });

/**
 * Page side: what is in reach ahead now - a pump, a road leaving the motorway, a police car (its
 * mode), m away.
 * @param reach m
 * @returns the nearest of each ahead, or null
 */
function inReach(reach) {
  const game = window.__game, car = game.car, level = game.level || window.__game.LEVEL;
  const ahead = (x, y) => (x - car.x) * Math.cos(car.heading) + (y - car.y) * Math.sin(car.heading);
  const gap = (x, y) => Math.hypot(x - car.x, y - car.y);
  const near = (x, y) => gap(x, y) < reach && ahead(x, y) > 10;
  const props = (level && level.props) || [], lanes = (level && level.lanes) || [];
  const pump = props.find((prop) => prop.kind === 'gasstation' && near(prop.x, prop.y));
  const side = lanes.find((lane) => lane.field == null && !lane.band && lane.width <= 7
    && lane.pts.some(([x, y]) => near(x, y)));
  const cop = game.traffic.list.find((slot) => slot.police && !slot.police.angry
    && near(slot.car.x, slot.car.y));
  // a junction's roundabout (a closed lane); a road bridge's approach (it shares a cut's points)
  const ring = lanes.find((lane) => lane.pts.length > 8 && Math.hypot(lane.pts[0][0]
    - lane.pts[lane.pts.length - 1][0], lane.pts[0][1] - lane.pts[lane.pts.length - 1][1]) < 1
    && lane.pts.some(([x, y]) => near(x, y)));
  const cutPts = new Set(((level._hw && level._hw.cuts) || []).map((cut) => cut.pts));
  // (a plain road bridge: no roundabout within 80 m of its road)
  const rings = lanes.filter((lane) => lane.pts.length > 8 && Math.hypot(lane.pts[0][0]
    - lane.pts[lane.pts.length - 1][0], lane.pts[0][1] - lane.pts[lane.pts.length - 1][1]) < 1);
  const bridge = lanes.find((lane) => cutPts.has(lane.pts) && lane.width === 7
    && lane.pts.some(([x, y]) => near(x, y)) && !rings.some((ringLane) => Math.hypot(
      ringLane.pts[0][0] - lane.pts[0][0], ringLane.pts[0][1] - lane.pts[0][1]) < 80));
  return { pump: pump ? Math.round(gap(pump.x, pump.y)) : null, side: side ? side.width : null,
    cop: cop ? cop.police.mode : null, ring: ring ? 'ring' : null,
    bridge: bridge ? 'road bridge' : null };
}

/**
 * Holds your heat at 1 star (a chaser is sent; no escape while photographing).
 * @param page the page
 */
async function holdOneStar(page) {
  await page.evaluate(() => {
    window.__holder = setInterval(() => {
      const heat = window.__game.traffic.police().heats.get(window.__game.car);
      if (!heat || window.__game.busted) return;
      heat.stars = Math.max(heat.stars, 1);
      heat.escapeT = 0;
    }, 50);
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
    + (ON ? '&hwmap=1' : ''));
  await page.touchscreen.tap(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic: 0.6 }), [ROAD, SCENERY]);
  await page.waitForTimeout(6000);
  // (no heat of your own until the chase photos: the autopilot's speeding would set chases going)
  await page.evaluate(() => {
    window.__calm = setInterval(() => {
      const heat = window.__game.traffic.police().heats.get(window.__game.car);
      if (heat) heat.stars = 0;
    }, 20);
  });
  const want = new Set(['pump', 'side', 'cop', 'ring', 'bridge']);
  for (let waited = 0; waited < LIMIT_S * 4 && want.size; waited++) {
    const seen = await page.evaluate(inReach, REACH_M);
    for (const what of [...want]) {
      if (seen[what] == null) continue;
      await page.screenshot({ path: `${OUT}/${tag}-${width}x${height}-${what}.png` });
      console.log(`${what}: ${seen[what]} at ${(waited / 4).toFixed(1)} s`);
      want.delete(what);
    }
    await page.waitForTimeout(250);
  }
  if (want.size) console.log('not met:', [...want].join(', '));
  await page.evaluate(() => clearInterval(window.__calm));
  await holdOneStar(page);
  for (let waited = 0; waited < 120; waited++) {
    const chaser = await page.evaluate((reach) => {
      const game = window.__game, car = game.car;
      return game.traffic.list.some((slot) => slot.police && slot.police.mode === 'chase'
        && Math.hypot(slot.car.x - car.x, slot.car.y - car.y) < reach);
    }, REACH_M);
    if (chaser) {
      await page.screenshot({ path: `${OUT}/${tag}-${width}x${height}-chase-a.png` });
      await page.waitForTimeout(FLASH_GAP);
      await page.screenshot({ path: `${OUT}/${tag}-${width}x${height}-chase-b.png` });
      console.log(`chase: in reach after ${(waited / 2).toFixed(1)} s`);
      break;
    }
    await page.waitForTimeout(500);
  }
  console.log(errors.length ? 'page errors: ' + errors.slice(0, 3).join(' | ') : 'page errors: none');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
