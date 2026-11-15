// _resetback.mjs - BUG 4, RESETS (?resetback=1): every reset of yours in every mode, set up where
// the old rule could put you AHEAD of where you were, or onto a car, or clear the police.
//   back      circuits, RX, stages: on the road at d0, then 30 m back down the run-off, 9 m out,
//             RESET - ahead of where the car was (its nearest road point) is a FAIL
//   blocked   the same reset's spot taken by an AI car (put there in the same step): landing on
//             it, or ahead of that spot, is a FAIL
//   joker     RX: on the joker lane, then 25 m back down it and 5 m off it, RESET (back) / with
//             an AI on the spot (blocked)
//   start     stages: on the road 1 m past the start line, RESET - ahead is a FAIL
//   crumb     the Lab (no road, no other car): coasting at 20 m/s, RESET goes back to where the
//             car was ~2 s before (metres back along its way)
//   cut       a circuit race: a big cut put back where the car left the road, an AI on that spot
//   hw-*      the endless roads: the wrong-way guard (the car 40 m back down the road), the
//             off-road guard (90 m out, 20 m back), R from 150 m out and 30 m back; R and the
//             wrong-way guard with an AI racer on the spot; R with a chasing police car near
//             (the police car cleared away is a FAIL)
// Each line: OK / FAIL, the metres the reset put the car ahead (+) or behind (-) of where it was
// (or of the taken spot), and any car it landed on. Exit 1 on any FAIL.
// [CASES=circuit,free,rx,stage,lamb,hw-motorway,hw-twisty,hw-canyon] [RAC3R_QUERY=resetback=1]
// node tools/scratch/_resetback.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const ALL = {
  free: ['thruston', { ai: 0 }, ['back']],
  circuit: ['thruston', { ai: 3 }, ['back', 'blocked', 'cut']],
  rx: ['knobhill', { ai: 3, rx: true }, ['back', 'blocked', 'joker']],
  stage: ['gen-forest-medium-mixed-1001', { ai: 2 }, ['back', 'blocked', 'start']],
  lamb: ['sweaty-lamb', { ai: 2 }, ['back', 'blocked', 'start']],
  lab: ['lab', { ai: 0 }, ['crumb']],
  'hw-motorway': ['highway', { ai: 2, traffic: 1, road: 'motorway' }, ['hw']],
  'hw-twisty': ['highway', { ai: 2, traffic: 1, road: 'twisty' }, ['hw']],
  'hw-canyon': ['highway', { ai: 2, traffic: 1, road: 'dual', scenery: 'canyon' }, ['hw']],
};
const CASES = (process.env.CASES || Object.keys(ALL).join(',')).split(',');
// m a reset may land ahead and still count as in line (a road point's own rounding)
const TOLERANCE_M = 0.5;
// SHOTS=<folder>: a photo just after each blocked reset and the police one; VIEW=390x844 the size
const SHOTS = process.env.SHOTS || '';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
let caseName = '';

/** A photo of the game now, when SHOTS is set. */
async function shot(page, label) {
  if (!SHOTS) return;
  await page.waitForTimeout(150);
  const name = `_resetback-${caseName}-${label}-${VIEW_W}x${VIEW_H}.png`;
  await page.screenshot({ path: `${SHOTS}/${name}` });
}

/** Page side: the helpers every case uses, on window.__rb. */
async function installHelpers() {
  const tyrewall = await import('/src/world/tyrewall.ts');
  const joker = await import('/src/world/joker.ts');
  const highway = await import('/src/highway.ts');
  const police = await import('/src/game/police.ts');
  const game = window.__game;
  const nearest = (x, y) => {
    const sub = game.level.subtrack;
    let best = sub.pts[0], bestD = Infinity;
    for (const point of sub.pts) {
      const dist = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (dist < bestD) { bestD = dist; best = point; }
    }
    return { dist: best.dist, off: (x - best.x) * best.nx + (y - best.y) * best.ny };
  };
  const lapAhead = (from, onto) => {
    const total = game.level.subtrack.totalDist;
    return ((onto - from) % total + total * 1.5) % total - total / 2;
  };
  const put = (car, x, y, heading) => {
    Object.assign(car, { x, y, heading, vx: 0, vy: 0, yawRate: 0, _p: null, prevWheels: null });
  };
  const putOn = (car, dist, off) => {
    const pose = tyrewall.onTrack(game.level.subtrack, dist, off, {});
    put(car, pose.x, pose.y, pose.rot);
  };
  // the cars the player's body overlaps (oriented boxes, the bodies' own size)
  const overlaps = (car, others) => others.filter((other) => {
    const axes = [car.heading, car.heading + Math.PI / 2, other.heading,
      other.heading + Math.PI / 2];
    return axes.every((angle) => {
      const ax = Math.cos(angle), ay = Math.sin(angle);
      const reach = (body) => body.spec.len / 2 * Math.abs(Math.cos(body.heading) * ax
        + Math.sin(body.heading) * ay) + body.spec.wid / 2 * Math.abs(-Math.sin(body.heading)
        * ax + Math.cos(body.heading) * ay);
      return Math.abs((other.x - car.x) * ax + (other.y - car.y) * ay)
        < reach(car) + reach(other);
    });
  }).length;
  const others = () => [...game.ai.map((entry) => entry.car), ...game.traffic.cars];
  // every put-back of yours snaps the camera to the car: counted, to know one has happened
  const renderer = game.renderer, snap = renderer.snap;
  window.__rbSnaps = 0;
  renderer.snap = (car) => {
    if (car === game.car) window.__rbSnaps++;
    return snap.call(renderer, car);
  };
  window.__rb = { nearest, lapAhead, put, putOn, overlaps, others, tyrewall, joker, highway,
    police };
}

/** Waits ms of real time. */
const wait = (page, ms) => page.waitForTimeout(ms);

/**
 * A circuit / stage case: on the road at d0, then off it where the case says, RESET.
 * @returns {Promise<string>} the line
 */
async function lapCase(page, kind, frac) {
  const sub = await page.evaluate(() => ({ total: window.__game.level.subtrack.totalDist,
    width: window.__game.level.subtrack.width }));
  const d0 = kind === 'start' ? 1 : sub.total * frac, side = frac > 0.5 ? -1 : 1;
  const offAt = kind === 'back' ? [d0 - 30, side * (sub.width / 2 + 9)]
    : kind === 'blocked' ? [d0 + 6, side * (sub.width / 2 + 9)] : null;
  const setUp = async () => {
    await page.evaluate(([dist, off]) => window.__rb.putOn(window.__game.car, dist, off),
      [d0, side * 2]);
    await wait(page, 250);
  };
  await setUp();
  let taken = null;
  if (kind === 'blocked') {
    // where the reset goes with nothing there, then an AI car put on that spot
    taken = await page.evaluate(([dist, off]) => {
      const rb = window.__rb, game = window.__game;
      rb.putOn(game.car, dist, off);
      game.reset();
      return { x: game.car.x, y: game.car.y, heading: game.car.heading,
        dist: rb.nearest(game.car.x, game.car.y).dist };
    }, offAt);
    await setUp();
  }
  const res = await page.evaluate(([where, spot]) => {
    const rb = window.__rb, game = window.__game, car = game.car;
    if (where) rb.putOn(car, where[0], where[1]);
    if (spot) {
      if (!game.ai.length) return null;
      rb.put(game.ai[0].car, spot.x, spot.y, spot.heading);
    }
    const here = rb.nearest(car.x, car.y);
    game.reset();
    const after = rb.nearest(car.x, car.y);
    return { ahead: rb.lapAhead(spot ? spot.dist : here.dist, after.dist),
      landed: rb.overlaps(car, rb.others()) };
  }, [offAt, taken]);
  if (!res) return `  ${kind.padEnd(8)} at ${Math.round(d0)} m: no AI car to block with`;
  if (kind === 'blocked' && frac < 0.5) await shot(page, 'blocked');
  const isOk = res.ahead <= TOLERANCE_M && res.landed === 0;
  return `${isOk ? 'OK  ' : 'FAIL'} ${kind.padEnd(8)} at ${String(Math.round(d0)).padStart(5)} m:`
    + ` ${res.ahead > 0 ? '+' : ''}${res.ahead.toFixed(1)} m ${spot(kind)},`
    + ` on ${res.landed} car(s)`;
}

/** What a case's metres are measured from. */
const spot = (kind) => (kind === 'blocked' || kind === 'cut' ? 'from the taken spot'
  : 'from where it was');

/**
 * RX: on the joker lane, then back down it and off it, RESET (with an AI on the spot: blocked).
 * @returns {Promise<string[]>} the lines
 */
async function jokerCase(page) {
  const lines = [];
  for (const blocked of [false, true]) {
    const setUp = () => page.evaluate(async () => {
      const rb = window.__rb, game = window.__game, lane = rb.joker.jokerLane(game.level);
      let len = 0;
      for (let i = 0; i + 1 < lane.pts.length; i++) len += Math.hypot(lane.pts[i + 1][0]
        - lane.pts[i][0], lane.pts[i + 1][1] - lane.pts[i][1]);
      const pose = rb.joker.lanePose(lane, len * 0.7);
      rb.put(game.car, pose.x, pose.y, pose.heading);
      return len;
    });
    const len = await setUp();
    await wait(page, 300);
    const backOff = ([along]) => {
      const rb = window.__rb, game = window.__game, lane = rb.joker.jokerLane(game.level);
      const pose = rb.joker.lanePose(lane, along);
      rb.put(game.car, pose.x - pose.ty * 5, pose.y + pose.tx * 5, pose.heading);
      return lane;
    };
    let taken = null;
    if (blocked) {
      taken = await page.evaluate(([along, body]) => {
        const lane = new Function('return ' + body)()([along]), game = window.__game;
        game.reset();
        return { x: game.car.x, y: game.car.y, heading: game.car.heading,
          along: window.__rb.joker.laneSpot(lane, game.car.x, game.car.y).along };
      }, [len * 0.7 - 25, backOff.toString()]);
      await setUp();
      await wait(page, 300);
    }
    const res = await page.evaluate(([along, body, spotTaken]) => {
      const rb = window.__rb, game = window.__game;
      const lane = new Function('return ' + body)()([along]);
      if (spotTaken) rb.put(game.ai[0].car, spotTaken.x, spotTaken.y, spotTaken.heading);
      const here = rb.joker.laneSpot(lane, game.car.x, game.car.y).along;
      const wasOn = !!game.lastOnJoker;
      game.reset();
      const after = rb.joker.laneSpot(lane, game.car.x, game.car.y).along;
      return { ahead: after - (spotTaken ? spotTaken.along : here), wasOn,
        landed: rb.overlaps(game.car, rb.others()) };
    }, [len * 0.7 - 25, backOff.toString(), taken]);
    if (blocked) await shot(page, 'joker');
    const isOk = res.ahead <= TOLERANCE_M && res.landed === 0 && res.wasOn;
    lines.push(`${isOk ? 'OK  ' : 'FAIL'} joker${blocked ? '-blk' : '    '} `
      + `${res.ahead > 0 ? '+' : ''}${res.ahead.toFixed(1)} m along the lane `
      + `${blocked ? 'from the taken spot' : 'from where it was'}, on ${res.landed} car(s)`
      + (res.wasOn ? '' : ' (never on the lane)'));
  }
  return lines;
}

/**
 * A circuit race: a big cut (off the road, then back on it 80 m on) put back where the car left
 * the road, with an AI car on that spot.
 * @returns {Promise<string>} the line
 */
async function cutCase(page) {
  const sub = await page.evaluate(() => window.__game.level.subtrack.totalDist);
  const d0 = sub * 0.4;
  await page.evaluate((dist) => window.__rb.putOn(window.__game.car, dist, 0), d0);
  await wait(page, 300);
  await page.evaluate((dist) => {
    const sub2 = window.__game.level.subtrack;
    window.__rb.putOn(window.__game.car, dist + 4, sub2.width / 2 + 25);
  }, d0);
  await wait(page, 200);
  const res = await page.evaluate((dist) => {
    const rb = window.__rb, game = window.__game, car = game.car, cut = car._cut;
    if (!cut) return null;
    const leftAt = rb.tyrewall.onTrack(game.level.subtrack, cut.q, 0, {});
    rb.put(game.ai[0].car, leftAt.x, leftAt.y, leftAt.rot);
    rb.putOn(car, dist + 90, 0);
    return { q: cut.q };
  }, d0);
  if (!res) return 'FAIL cut      no cut started';
  await wait(page, 150);
  const after = await page.evaluate((cutQ) => {
    const rb = window.__rb, game = window.__game;
    return { ahead: rb.lapAhead(cutQ, rb.nearest(game.car.x, game.car.y).dist),
      landed: rb.overlaps(game.car, rb.others()), why: game.notice?.text ?? '-' };
  }, res.q);
  const isOk = after.ahead <= TOLERANCE_M && after.landed === 0;
  return `${isOk ? 'OK  ' : 'FAIL'} cut      ${after.ahead > 0 ? '+' : ''}`
    + `${after.ahead.toFixed(1)} m from the taken spot, on ${after.landed} car(s), "${after.why}"`;
}

/**
 * The Lab: coasting, then RESET; how far back along its way the car was put.
 * @returns {Promise<string>} the line
 */
async function crumbCase(page) {
  const from = await page.evaluate(() => {
    const car = window.__game.car;
    Object.assign(car, { vx: 20 * Math.cos(car.heading), vy: 20 * Math.sin(car.heading) });
    return { x: car.x, y: car.y, heading: car.heading };
  });
  await wait(page, 3000);
  const res = await page.evaluate((start) => {
    const game = window.__game, car = game.car, ax = Math.cos(start.heading);
    const ay = Math.sin(start.heading), along = (x, y) => (x - start.x) * ax + (y - start.y) * ay;
    const was = along(car.x, car.y);
    game.reset();
    return { ahead: along(car.x, car.y) - was, landed: window.__rb.overlaps(car,
      window.__rb.others()) };
  }, from);
  const isOk = res.ahead <= TOLERANCE_M && res.landed === 0;
  return `${isOk ? 'OK  ' : 'FAIL'} crumb    ${res.ahead > 0 ? '+' : ''}${res.ahead.toFixed(1)} m`
    + ` along its way from where it was, on ${res.landed} car(s)`;
}

/** Page side: the car's road frame now. */
function roadNow() {
  const game = window.__game, frame = game.level._hw.q;
  return frame ? { s: frame.s, off: frame.off } : null;
}

/**
 * Waits for the autopilot to carry the car past a road distance.
 * @returns {Promise<boolean>} got there
 */
async function driveTo(page, dist) {
  for (let tries = 0; tries < 120; tries++) {
    const here = await page.evaluate(roadNow);
    if (here && here.s > dist) return true;
    await wait(page, 500);
  }
  return false;
}

/**
 * One endless-road put-back: move the car, then R or let the guard fire; how far ahead of the
 * car it was put. Blocked: an AI racer first put on the spot the reset would take (R: a first
 * reset from the same place; the guard: its spot worked out and the road's state put back).
 * @returns {Promise<object>} the numbers
 */
async function hwPutBack(page, kind, blocked) {
  const moved = await page.evaluate(([how, isBlocked]) => {
    const rb = window.__rb, game = window.__game, level = game.level, frame = level._hw.q;
    const out = level._hw.geo.hw, lane = level._hw.geo.centres[0];
    const [back, off] = how === 'wrongway' ? [40, lane] : how === 'guard-off' ? [20, -(out + 90)]
      : how === 'R-far' ? [30, -(out + 150)] : [0, lane];
    const carS = frame.s - back, pose = rb.highway.roadPose(level, carS, off);
    const putCar = () => {
      rb.put(game.car, pose.x, pose.y, pose.h);
      game.car.vx = Math.cos(pose.h) * 20;
      game.car.vy = Math.sin(pose.h) * 20;
    };
    putCar();
    game.notice = null;
    window.__rbSnapsWere = window.__rbSnaps;
    let taken = null;
    if (isBlocked && how.startsWith('R')) {
      game.reset();
      taken = { x: game.car.x, y: game.car.y, heading: game.car.heading };
      putCar();
    } else if (isBlocked) {
      const state = level._hw, keep = ['best', 'ci', 'q', 'backT', 'offT', 'warn', 'tookExit',
        'outPrev', 'inV'].map((key) => [key, state[key]]);
      const isNew = new URLSearchParams(location.search).get('resetback') === '1';
      const spot = isNew ? rb.highway.highwayRespawn(level, carS)
        : rb.highway.highwayRespawn(level);
      for (const [key, value] of keep) state[key] = value;
      taken = { x: spot.x, y: spot.y, heading: spot.h };
    }
    if (taken) rb.put(game.ai[0].car, taken.x, taken.y, taken.heading);
    // (the probe's own put-back not counted)
    window.__rbSnapsWere = window.__rbSnaps;
    if (how.startsWith('R')) {
      game.reset();
      return { carS, taken };
    }
    return { carS, taken };
  }, [kind, blocked]);
  let res = null;
  for (let tries = 0; tries < 30 && !res; tries++) {
    await wait(page, 100);
    res = await page.evaluate(() => {
      const rb = window.__rb, game = window.__game, frame = game.level._hw.q;
      if (!frame || window.__rbSnaps === window.__rbSnapsWere) return null;
      return { s: frame.s, why: game.notice?.text ?? '-', x: game.car.x, y: game.car.y,
        landed: rb.overlaps(game.car, rb.others()) };
    });
  }
  return { ...moved, ...res };
}

/**
 * The endless road's resets, each from a fresh 300 m on.
 * @returns {Promise<string[]>} the lines
 */
async function hwCases(page) {
  const lines = [];
  let mark = 400;
  for (const how of ['wrongway', 'guard-off', 'R-far', 'R-lane', 'R-lane-blk', 'wrongway-blk']) {
    if (!(await driveTo(page, mark))) { lines.push(`FAIL ${how}: never got to ${mark} m`); break; }
    mark += 300;
    const res = await hwPutBack(page, how.replace('-blk', ''), how.endsWith('-blk'));
    if (res.s == null) { lines.push(`FAIL ${how}: no put-back seen`); continue; }
    const ahead = res.s - res.carS, taken = res.taken;
    const gap = taken ? Math.hypot(res.x - taken.x, res.y - taken.y) : 0;
    if (taken) await shot(page, how);
    const isOk = ahead <= TOLERANCE_M && res.landed === 0;
    lines.push(`${isOk ? 'OK  ' : 'FAIL'} ${how.padEnd(12)} ${ahead > 0 ? '+' : ''}`
      + `${ahead.toFixed(1)} m from where it was${taken ? ', ' + gap.toFixed(1)
        + ' m from the taken spot' : ''}, on ${res.landed} car(s), "${res.why}"`);
  }
  lines.push(await policeCase(page, mark));
  return lines;
}

/**
 * R with a chasing police car near: a speed camera's catch sends one; once it is within 25 m
 * of you, RESET; it must still be on the road afterwards.
 * @returns {Promise<string>} the line
 */
async function policeCase(page, mark) {
  if (!(await driveTo(page, mark))) return 'FAIL police: never got there';
  await page.evaluate(() => window.__rb.police.notePoliceCamera());
  for (let tries = 0; tries < 120; tries++) {
    const res = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      const near = game.traffic.list.find((slot) => !slot.parked && slot.police
        && Math.hypot(slot.car.x - car.x, slot.car.y - car.y) < 25);
      if (!near) return null;
      const dist = Math.hypot(near.car.x - car.x, near.car.y - car.y);
      game.reset();
      return { dist, kept: !near.parked && !!near.police, stars: game.heat?.stars ?? 0 };
    });
    if (res) {
      await shot(page, 'police');
      return `${res.kept ? 'OK  ' : 'FAIL'} police       a chaser ${res.dist.toFixed(1)} m away at`
        + ` the reset: ${res.kept ? 'still there' : 'CLEARED'} (stars ${res.stars})`;
    }
    await wait(page, 500);
  }
  return '  ?? police       no chaser came within 25 m in 60 s';
}

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const errors = [];
  for (const name of CASES) {
    const [level, opts, kinds] = ALL[name];
    caseName = name;
    const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
      + (kinds[0] === 'hw' ? '&autopilot=1' : '') + extraQuery());
    await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
    await wait(page, 800);
    await page.evaluate(([id, launchOpts]) => window.__game.launch(id, 'hatch-rwd', launchOpts),
      [level, opts]);
    await page.evaluate(installHelpers);
    // the race under way (a stage's own start clock for you)
    for (let tries = 0; tries < 40; tries++) {
      if (await page.evaluate(() => !window.__game.start?.on || window.__game.start.green
        || window.__game.start.t > 12)) break;
      await wait(page, 500);
    }
    await wait(page, 1500);
    const lines = [];
    for (const kind of kinds) {
      if (kind === 'hw') lines.push(...await hwCases(page));
      else if (kind === 'joker') lines.push(...await jokerCase(page));
      else if (kind === 'cut') lines.push(await cutCase(page));
      else if (kind === 'crumb') lines.push(await crumbCase(page));
      else if (kind === 'start') lines.push(await lapCase(page, 'start', 0));
      else for (const frac of [0.3, 0.55, 0.8]) lines.push(await lapCase(page, kind, frac));
    }
    if (lines.some((line) => line.startsWith('FAIL'))) failed = true;
    console.log(`${name} (${level}):\n  ${lines.join('\n  ')}`);
    await page.close();
  }
  console.log(errors.length ? 'PAGE ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'page errors none');
  if (errors.length) failed = true;
} finally {
  await browser.close();
  server.stop();
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: ALL OK');
process.exitCode = failed ? 1 : 0;
