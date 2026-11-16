// _tripshots.mjs - THE TRAFFIC'S TRIPS IN THE REAL GAME (TODO 3a2 item 15): you stopped
// beside a way off / on, one traffic car sent on that trip (as a won roll would), photographed as
// it goes. WHAT=exit - a short / long slip (motorway seed 18); WHAT=junction - a junction's
// off-slip and roundabout (seed 12); WHAT=join - a junction's on-slip, the give-way and the merge
// (seed 12). Photos: tools/scratch/_trips/<what>-<n>-<view>.png
// WHAT=exit|junction|join [VIEW=844x390] [ZOOM=0.5] [SEED=..] node tools/scratch/_tripshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const WHAT = process.env.WHAT || 'exit', ZOOM = process.env.ZOOM || '0.5';
const SEED = +(process.env.SEED || (WHAT === 'exit' ? 18 : 12));
const OUT = 'tools/scratch/_trips';
// MOVING=1: you driven on by the autopilot at 50 km/h (no placing by hand), the car sent from
// just behind you as the way comes within NEAR_M ahead
const MOVING = !!process.env.MOVING, NEAR_M = MOVING ? [60, 110] : [200, 450];
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
let shots = 0;
const shot = async (page, note) => {
  const path = `${OUT}/${WHAT}-${++shots}-${width}x${height}.png`;
  await page.screenshot({ path });
  console.log('photo', path, note);
};
const until = async (page, test, seconds, arg) => {
  for (let waited = 0; waited < seconds * 5; waited++) {
    const found = await page.evaluate(test, arg);
    if (found) return found;
    await page.waitForTimeout(200);
  }
  return null;
};

/** You stopped at (s, off) on the road, the traffic cleared round you; one car sent on a trip. */
async function sendCar(page, isPlacing) {
  return page.evaluate(async ([what, placing]) => {
    const game = window.__game, level = game.level, car = game.car;
    const { roadPose } = await import('/src/highway.ts');
    const { waysOf, rampsOf } = await import('/src/ai/trafficTrips.ts');
    const { makePath } = await import('/src/ai/trafficPath.ts');
    const here = level._hw.q.s, geo = level._hw.geo;
    const exits = waysOf(level).exits.filter((each) => each.s > here + 40
      && (what === 'exit' ? each.stopShort > 0 : each.stopShort === 0));
    const ramp = rampsOf(level).find((each) => each.endS > here + 40 && each.startV < 10);
    const target = placing ? (window.__tripTarget = what === 'join' ? ramp : exits[0])
      : window.__tripTarget ?? (what === 'join' ? ramp : exits[0]);
    if (!target) return null;
    if (placing) {
      // (you on the hard shoulder past the slip's start, or on the grass out past a junction's
      // slips, clear of the car's way: a camera; the traffic round you cleared)
      game.setAutopilot(false);
      const at = what === 'join' ? target.endS - 40 : target.s + (what === 'junction' ? 70 : -5);
      const you = roadPose(level, at, what === 'exit' ? -geo.hw - 10 : -geo.hw - 30);
      Object.assign(car, { x: you.x, y: you.y, heading: you.h, vx: 0, vy: 0, yawRate: 0 });
      game.traffic.clearAround(you.x, you.y, 200);
      return 'placed';
    }
    const slot = game.traffic.list.find((each) => !each.parked && !each.police && !each.broke
      && (each.dir ?? 1) > 0 && !each.trip);
    if (!slot) return 'no car';
    if (what === 'join') {
      const [startX, startY] = target.pts[0], [nextX, nextY] = target.pts[1];
      const heading = Math.atan2(nextY - startY, nextX - startX);
      Object.assign(slot.car, { x: startX, y: startY, heading, vx: Math.cos(heading) * 8,
        vy: Math.sin(heading) * 8, yawRate: 0 });
      Object.assign(slot, { vAl: 8, lane: 0, laneT: 0, laneOff: geo.own[0], kOff: null,
        trip: { kind: 'join', at: target.endS, path: makePath(target.pts, 12, 8),
          committed: false } });
    } else {
      // (MOVING: from 30 m behind you - it comes past you to the slip)
      const from = window.__moving ? here - 30 : target.s - 160;
      const start = roadPose(level, from, geo.own[0]);
      Object.assign(slot.car, { x: start.x, y: start.y, heading: start.h,
        vx: Math.cos(start.h) * 25, vy: Math.sin(start.h) * 25, yawRate: 0 });
      Object.assign(slot, { s: from, off: geo.own[0], vAl: 25, lane: 0, laneT: 0,
        laneOff: geo.own[0], kOff: null, slipAt: target.s,
        trip: { kind: 'exit', at: target.s, exit: target } });
    }
    window.__tripSlot = slot;
    return { at: Math.round(what === 'join' ? target.endS : target.s), you: Math.round(here) };
  }, [WHAT, isPlacing]);
}

/** The sent car's state for the log (and the wait tests). */
const stateOf = (page) => page.evaluate(() => {
  const slot = window.__tripSlot, trip = slot.trip;
  return { along: trip?.path ? Math.round(trip.path.along) : null,
    total: trip?.path ? Math.round(trip.path.total) : null, merge: !!trip?.merge, done: !trip,
    v: +slot.vAl.toFixed(1), ind: slot.car.indicator, phys: slot.phys, parked: slot.parked,
    s: Math.round(slot.s), off: +slot.off.toFixed(1), wreck: slot.wreck, broke: !!slot.broke,
    lane: slot.lane, laneT: slot.laneT, you: Math.round(window.__game.level._hw.q.s),
    scr: [Math.round(window.__game.renderer.toScreenX(slot.car.x)),
      Math.round(window.__game.renderer.toScreenY(slot.car.y)), window.__game.renderer.W,
      window.__game.renderer.H],
    dmg: (slot.car.dmg || []).map((part) => +part.toFixed(2)).join('/'),
    ahead: window.__game.traffic.list.filter((each) => each !== slot && !each.parked
      && each.s - slot.s > 0 && each.s - slot.s < 60 && Math.abs(each.off - slot.off) < 3)
      .map((each) => `${Math.round(each.s - slot.s)}m off${each.off.toFixed(1)}`
        + ` v${each.vAl.toFixed(1)}${each.broke ? ' broke' : ''}${each.police ? ' pol' : ''}`
        + `${each.wreck ? ' wreck' : ''}${each.trip ? ' ' + each.trip.kind : ''}`).join(', ') };
});

try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`
    + `&autopilot=${MOVING ? process.env.AUTO || 50 : 1}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(async (seed) => {
    const { LEVELS } = await import('/src/lab.ts');
    LEVELS.find((level) => level.id === 'highway').seed = seed;
    window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: 'motorway',
      scenery: 'countryside', traffic: 0.6 });
  }, SEED);
  await page.waitForTimeout(3000);
  // (the autopilot on until the way is in reach ahead)
  const near = await until(page, async ([what, near]) => {
    const game = window.__game, level = game.level, here = level._hw.q?.s ?? 0;
    const { waysOf, rampsOf } = await import('/src/ai/trafficTrips.ts');
    const ways = what === 'join' ? rampsOf(level).filter((each) => each.startV < 10)
      : waysOf(level).exits.filter((each) => (what === 'exit' ? each.stopShort > 0
        : each.stopShort === 0));
    const way = ways.find((each) => (each.endS ?? each.s) - here > near[0]
      && (each.endS ?? each.s) - here < near[1]);
    if (!way) return null;
    window.__tripTarget = way;
    return way.endS ?? way.s;
  }, 400, [WHAT, NEAR_M]);
  console.log(WHAT, 'seed', SEED, 'way at', near);
  if (process.env.LOOK) {
    // (only a look at the way, driven past by the autopilot: no car sent)
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), +ZOOM);
    await until(page, (dist) => window.__game.level._hw.q.s > dist - 20, 60, near);
    await shot(page, 'look');
    throw new Error('look only');
  }
  await page.evaluate(([zoom, moving]) => {
    window.__game.renderer.debugZoom(zoom);
    window.__moving = moving;
  }, [+ZOOM, MOVING && !process.env.STOPAT]);
  if (process.env.STOPAT) {
    // (STOPAT: driven on to STOPAT m past the way - the on-ramp's end for a join - and stopped
    // there in the lane, the ground round you drawn as you came; the car sent from behind)
    await until(page, (dist) => window.__game.level._hw.q.s > dist, 120, near + +process.env.STOPAT);
    await page.evaluate(() => window.__game.setAutopilot(false));
    await page.waitForTimeout(1500);
    await page.evaluate(async (isOutside) => {
      const game = window.__game, car = game.car, level = game.level;
      // (OUTSIDE=1: you moved across to the outside lane, out of the nearside lane's way)
      if (isOutside) {
        const { roadPose } = await import('/src/highway.ts');
        const lanes = level._hw.geo.own, pose = roadPose(level, level._hw.q.s,
          lanes[lanes.length - 1]);
        Object.assign(car, { x: pose.x, y: pose.y, heading: pose.h, vx: 0, vy: 0, yawRate: 0 });
      }
      game.traffic.clearAround(car.x, car.y, 220);
    }, !!process.env.OUTSIDE);
    await page.keyboard.down('Space');
    await page.waitForTimeout(2500);
  } else if (!MOVING) {
    await sendCar(page, true);
    await page.keyboard.down('Space');
    await page.waitForTimeout(2500);
  }
  const sent = await sendCar(page, false);
  console.log('sent:', JSON.stringify(sent));
  // (no heat on you - moved by hand, you are no one's suspect: no chase, no one moving over)
  await page.evaluate(() => {
    window.__calm = setInterval(() => {
      const game = window.__game, heat = game.traffic.police().heats.get(game.car);
      if (heat && heat.stars) {
        heat.stars = 0;
        heat.offences.length = 0;
        game.traffic.clearPolice(game.car);
      }
    }, 50);
  });
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), +ZOOM);
  if (!MOVING) await page.keyboard.down('Space');
  const marks = WHAT === 'join' ? [(state) => state.along != null && state.along > 40,
    (state) => state.along != null && state.total - state.along < 20, (state) => state.merge,
    (state) => state.done]
    : (WHAT === 'junction' ? [15, 110, 165] : [15, 70, 140]).map((at) => (state) =>
      state.along != null && state.along > at);
  for (const mark of marks) {
    let state = null;
    for (let waited = 0; waited < 150; waited++) {
      state = await stateOf(page);
      if (process.env.DEBUG && waited % 5 === 0) console.log(JSON.stringify(state));
      if (mark(state) || state.parked) break;
      await page.waitForTimeout(100);
    }
    await shot(page, JSON.stringify(state));
  }
  await page.keyboard.up('Space');
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
