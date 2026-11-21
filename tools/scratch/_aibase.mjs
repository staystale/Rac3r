// _aibase.mjs - THE OWNER'S FOUR AI TESTS (11-21, TODO 2 item 9), measure only: the real game,
// deterministic (seeded), nothing drawn, your car on ?autopilot, a full field. Per run:
// (a) PACE - every racer's complete laps (after its first): the mean and the best; the highway: km/h.
// (b) CRASHES - every racer-on-racer touch (bodies touching, no margin; a pair touching again after
//     0.5 s apart is a new one) with its closing speed; touches within 3 s and 60 m of an incident's
//     last touch join it. An incident's SIZE: the cars in it and its hardest closing speed - SMALL
//     (2 cars, under 30 km/h), BIG (3-4 cars or 30 km/h+), PILE-UP (5+ cars). Racer-traffic touches
//     counted apart.
// (c) BRAKE / LIFT MID-STRAIGHT - every racer frame with the brake over 0.15 or the throttle under
//     0.3 above 15 m/s, after the first 12 s, where the road is straight (radius over 150 m from 60 m
//     behind to 60 m ahead on the level's line), with its CAUSE from the driver: STOPCAR (braking
//     for a stopped car), FOLLOW-RACER / FOLLOW-TRAFFIC / FOLLOW-PLAYER (held to a car ahead: the
//     nearest car ahead within 40 m and 2.5 m across), ATTACK / COVER (racecraft), MISTAKE, OFF (off
//     the road), UNDER (front sliding), LINE (none of these: the speed plan itself - the bug class).
// (d) CLOSE RUNNING - pair-seconds two racers ran within 1 m of each other without touching (both
//     over 15 m/s), against pair-seconds touching.
// (e) FOLLOWING (owner 11-21: no panic, adjust, follow, pressure the car ahead): seconds a racer
//     ran 3-25 m behind a racer, CLOSE BEHIND (under 6 m nose to tail), and OVER-BRAKES (a new
//     press over 0.6 while the leader brakes under 0.3) - followBase.
// RUNS=brands,moanaco,thruston,spa,croughedrx,motorway (default all) SEEDS=1,2 SECONDS=240
// OUT=<file.json>; a switch under test through RAC3R_QUERY. node tools/scratch/_aibase.mjs
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
  moanaco: { level: 'moanaco', opts: { ai: 19, laps: 30 } },
  thruston: { level: 'thruston', opts: { ai: 19, laps: 30 } },
  spa: { level: 'spa', opts: { ai: 19, laps: 30 } },
  croughedrx: { level: 'croughedrx', opts: { ai: 19, rx: true, laps: 30 } },
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SEEDS = (process.env.SEEDS || '1,2').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 240), OUT = process.env.OUT || '', CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side, once: the level's own module (the same instance the game runs) and the counters. */
async function setupBase() {
  window.__L = await import('/src/lab.ts');
  window.__base = { t: 0, m: 0, hits: [], trafficHits: 0, touching: new Map(), laps: new Map(),
    lapTimes: [], brakes: {}, brakeBins: {}, touchPairS: 0, closePairS: 0, straight: new Map(),
    followS: 0, closeBehindS: 0, overBrakes: 0 };
}

/** Page side: whether two bodies overlap, each grown by a margin (m), on the first's axes. */
function overlapBase(car, other, margin) {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const dx = other.x - car.x, dy = other.y - car.y, turn = other.heading - car.heading;
  const along = dx * cos + dy * sin, across = -dx * sin + dy * cos;
  const reachAlong = other.spec.len / 2 * Math.abs(Math.cos(turn))
    + other.spec.wid / 2 * Math.abs(Math.sin(turn));
  const reachAcross = other.spec.len / 2 * Math.abs(Math.sin(turn))
    + other.spec.wid / 2 * Math.abs(Math.cos(turn));
  return Math.abs(along) < car.spec.len / 2 + reachAlong + margin
    && Math.abs(across) < car.spec.wid / 2 + reachAcross + margin;
}

/** Page side: the road straight at a lap distance (radius over 150 m from 60 m back to 60 m on). */
function straightBase(sub, dist) {
  const L = window.__L, cache = window.__base.straight, key = Math.round(dist / 5);
  if (!L.LEVEL.endless && cache.has(key)) return cache.get(key);
  const total = sub.totalDist, count = sub.pts.length;
  const at = (where) => sub.pts[Math.floor((((where % total) + total) % total) / total * count)];
  const radius = (where) => {
    const [one, two, three] = [at(where - 6), at(where), at(where + 6)];
    const ax = two.x - one.x, ay = two.y - one.y, bx = three.x - two.x, by = three.y - two.y;
    const cross = Math.abs(ax * by - ay * bx);
    return cross < 1e-6 ? Infinity : Math.hypot(ax, ay) * Math.hypot(bx, by)
      * Math.hypot(three.x - one.x, three.y - one.y) / (2 * cross);
  };
  let straight = true;
  for (let off = -60; off <= 60 && straight; off += 10) straight = radius(dist + off) > 150;
  if (!L.LEVEL.endless) cache.set(key, straight);
  return straight;
}

/** Page side: why a racer is braking or lifting now. */
function causeBase(entry, everyone) {
  const state = entry.drv.state, car = entry.car;
  if (state.stopCar) return 'STOPCAR';
  if (state.atk) return 'ATTACK';
  if (state.cover) return 'COVER';
  if (state.mist) return 'MISTAKE';
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  let near = null, nearFwd = Infinity;
  for (const other of everyone) {
    if (other.car === car) continue;
    const dx = other.car.x - car.x, dy = other.car.y - car.y;
    const fwd = dx * cos + dy * sin, across = -dx * sin + dy * cos;
    if (fwd > 0 && fwd < 40 && Math.abs(across) < 2.5 && fwd < nearFwd) {
      near = other;
      nearFwd = fwd;
    }
  }
  if (state.follow) return near ? 'FOLLOW-' + near.kind : 'FOLLOW-NONE';
  const sub = window.__L.LEVEL.subtrack, query = window.__L.querySubtrack(sub, car.x, car.y);
  if (Number.isFinite(query.dist) && query.dist > sub.width / 2 + 0.5) return 'OFF';
  if (Math.abs(car.t?.slipF || 0) > 0.14) return 'UNDER';
  return near ? 'NEAR-' + near.kind : 'LINE';
}

/**
 * Page side, the owner's FOLLOWER test (11-21: "cars behind don't panic and over-brake - adjust,
 * follow and put pressure on the car in front"): a racer with a racer 3-25 m ahead within 2.5 m
 * across is FOLLOWING it - its seconds, its seconds CLOSE BEHIND (nose within 6 m of the leader's
 * tail), and its OVER-BRAKES: a new press of its brake over 0.6 while the leader's brake is under
 * 0.3 (the leader not braking hard), one per 1 s.
 * @param entry the racer
 * @param racers every racer
 * @param want its controls this step
 */
function followBase(entry, racers, want) {
  const base = window.__base, car = entry.car, cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  let leader = null, gap = Infinity;
  for (const other of racers) {
    if (other === entry) continue;
    const dx = other.car.x - car.x, dy = other.car.y - car.y;
    const fwd = dx * cos + dy * sin, across = -dx * sin + dy * cos;
    if (fwd > 3 && fwd < 25 && Math.abs(across) < 2.5 && fwd < gap) {
      leader = other;
      gap = fwd;
    }
  }
  const was = entry.__hard;
  entry.__hard = !!leader && want.brake > 0.6;
  if (!leader) return;
  base.followS += 1 / 60;
  if (gap - (car.spec.len + leader.car.spec.len) / 2 < 6) base.closeBehindS += 1 / 60;
  if (entry.__hard && !was && (leader.car.brakeLight || 0) < 0.3
    && base.t - (entry.__overT ?? -9) > 1) {
    entry.__overT = base.t;
    base.overBrakes++;
  }
}

/** Page side: one frame - pace, laps, brakes on straights, touches and close running. */
function tickBase() {
  const base = window.__base, game = window.__game, racers = game.ai, L = window.__L;
  base.t += 1 / 60;
  const sub = L.LEVEL.subtrack;
  const everyone = [{ car: game.car, kind: 'PLAYER' },
    ...racers.map((entry) => ({ car: entry.car, kind: 'RACER' })),
    ...(game.traffic ? game.traffic.cars.map((car) => ({ car, kind: 'TRAFFIC' })) : [])];
  for (const entry of racers) {
    const car = entry.car, speed = Math.hypot(car.vx, car.vy);
    base.m += speed / 60;
    // (the lap by the game's own race order - car._prog, game/order.ts progressOf - not the
    // driver's own count, which jumped at Moanaco's line: laps of 1.3 s)
    const total = sub && !L.LEVEL.endless ? sub.totalDist : 0;
    const lap = total && car._prog !== undefined ? Math.floor(car._prog / total) : 0;
    const was = base.laps.get(entry);
    if (was && lap > was.lap) {
      if (was.lap >= 1) base.lapTimes.push(base.t - was.t);
      base.laps.set(entry, { lap, t: base.t });
    } else if (!was) base.laps.set(entry, { lap, t: base.t });
    // (the driver's controls this step: its drive wrapped once)
    if (!entry.drv.__wrapped) {
      const drive = entry.drv.drive;
      entry.drv.drive = (...args) => (entry.__want = drive(...args));
      entry.drv.__wrapped = true;
    }
    const want = entry.__want;
    if (want && base.t >= 12 && speed > 15) window.__baseFollow(entry, racers, want);
    if (!want || base.t < 12 || speed < 15 || !(want.brake > 0.15 || want.throttle < 0.3)) continue;
    const query = L.querySubtrack(sub, car.x, car.y);
    if (!Number.isFinite(query.trackDist) || !straightBase(sub, query.trackDist)) continue;
    const cause = causeBase(entry, everyone);
    base.brakes[cause] = (base.brakes[cause] || 0) + 1 / 60;
    if (cause === 'LINE') {
      const bin = L.LEVEL.endless ? 'road' : String(Math.floor(query.trackDist / 50) * 50);
      base.brakeBins[bin] = (base.brakeBins[bin] || 0) + 1 / 60;
    }
  }
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i].car, two = racers[j].car;
      if (Math.abs(one.x - two.x) > 12 || Math.abs(one.y - two.y) > 12) continue;
      const touching = window.__baseOverlap(one, two, 0);
      if (!touching) {
        if (window.__baseOverlap(one, two, 1) && Math.hypot(one.vx, one.vy) > 15
          && Math.hypot(two.vx, two.vy) > 15) base.closePairS += 1 / 60;
        continue;
      }
      base.touchPairS += 1 / 60;
      const key = i * 100 + j, last = base.touching.get(key);
      if (last === undefined || base.t - last > 0.5) {
        base.hits.push({ t: base.t, x: one.x, y: one.y, a: i, b: j,
          closing: Math.hypot(one.vx - two.vx, one.vy - two.vy) });
      }
      base.touching.set(key, base.t);
    }
    if (!game.traffic) continue;
    for (const other of game.traffic.cars) {
      const one = racers[i].car;
      if (Math.abs(one.x - other.x) > 12 || Math.abs(one.y - other.y) > 12) continue;
      if (!window.__baseOverlap(one, other, 0)) continue;
      const key = 'T' + i + ':' + game.traffic.cars.indexOf(other), last = base.touching.get(key);
      if (last === undefined || base.t - last > 0.5) base.trafficHits++;
      base.touching.set(key, base.t);
    }
  }
}

/** Page side: step frames. */
function stepBase(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__baseTick();
  }
}

/** Node side: touches grouped into incidents, each with its cars and hardest closing speed. */
function incidentsOf(hits) {
  const groups = [];
  for (const hit of hits) {
    const open = groups.find((group) => hit.t - group.last.t <= 3
      && Math.hypot(hit.x - group.last.x, hit.y - group.last.y) <= 60);
    if (open) {
      open.last = hit;
      open.cars.add(hit.a).add(hit.b);
      open.closing = Math.max(open.closing, hit.closing);
    } else groups.push({ last: hit, cars: new Set([hit.a, hit.b]), closing: hit.closing });
  }
  return groups.map((group) => ({ cars: group.cars.size, closing: group.closing * 3.6,
    t: group.last.t }));
}

/** One run. */
async function runOne(browser, base, id, seed) {
  const errors = [], run = ALL_RUNS[id];
  const page = await openPage(browser, base, run.level, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), seed);
  // (?gapcommit's sliding scale tried through the tools' dials: COMMIT_RACER / COMMIT_SPEEDER)
  await page.evaluate(([racer, speeder]) => {
    if (racer !== '') window.__AI_COMMIT_RACER = Number(racer);
    if (speeder !== '') window.__AI_COMMIT_SPEEDER = Number(speeder);
  }, [process.env.COMMIT_RACER ?? '', process.env.COMMIT_SPEEDER ?? '']);
  await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(setupBase);
  await page.evaluate(`window.__baseTick = ${tickBase.toString()};
    window.__baseOverlap = ${overlapBase.toString()};
    window.__baseFollow = ${followBase.toString()};
    var straightBase = ${straightBase.toString()}; var causeBase = ${causeBase.toString()};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepBase, Math.min(CHUNK, SECONDS * 60 - done));
  }
  const out = await page.evaluate(() => {
    const base = window.__base;
    return { hits: base.hits, m: base.m, racers: window.__game.ai.length, lapTimes: base.lapTimes,
      brakes: base.brakes, brakeBins: base.brakeBins, touchPairS: base.touchPairS,
      closePairS: base.closePairS, trafficHits: base.trafficHits, followS: base.followS,
      closeBehindS: base.closeBehindS, overBrakes: base.overBrakes };
  });
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

/** Node side: one run's line. */
function lineOf(id, seed, out) {
  const km = out.m / 1000, incidents = incidentsOf(out.hits);
  const small = incidents.filter((inc) => inc.cars === 2 && inc.closing < 30).length;
  const pile = incidents.filter((inc) => inc.cars >= 5).length;
  const big = incidents.length - small - pile;
  const laps = out.lapTimes, mean = laps.length
    ? (laps.reduce((sum, time) => sum + time, 0) / laps.length).toFixed(1) : '-';
  const best = laps.length ? Math.min(...laps).toFixed(1) : '-';
  const brakeTotal = Object.values(out.brakes).reduce((sum, secs) => sum + secs, 0);
  const brakes = Object.entries(out.brakes).sort((one, two) => two[1] - one[1])
    .map(([cause, secs]) => `${cause} ${secs.toFixed(1)}`).join(', ');
  const bins = Object.entries(out.brakeBins).sort((one, two) => two[1] - one[1]).slice(0, 4)
    .map(([bin, secs]) => `@${bin} ${secs.toFixed(1)}`).join(', ');
  return `${id} seed ${seed}: ${out.racers} racers, ${(km * 3600 / SECONDS / out.racers).toFixed(1)}`
    + ` km/h | (a) laps ${laps.length} mean ${mean} s best ${best} s | (b) touches ${out.hits.length},`
    + ` incidents ${incidents.length}: small ${small} big ${big} pile-up ${pile} (first 15 s: `
    + `${incidents.filter((inc) => inc.t < 15).length}); traffic touches ${out.trafficHits}`
    + ` | (c) mid-straight brake/lift ${brakeTotal.toFixed(1)} car-s: ${brakes || 'none'}`
    + `${bins ? ' | LINE at ' + bins : ''} | (d) close ${out.closePairS.toFixed(1)} pair-s, touching`
    + ` ${out.touchPairS.toFixed(1)} pair-s | (e) following ${out.followS.toFixed(0)} car-s, close`
    + ` behind ${out.closeBehindS.toFixed(0)} car-s, over-brakes ${out.overBrakes} (${(60
      * out.overBrakes / Math.max(1, out.followS)).toFixed(2)} a following minute)`
    + `${out.errors.length ? ' | ERR ' + out.errors[0] : ''}`;
}

const server = await startServer();
const browser = await launchBrowser();
const report = {};
try {
  for (const id of RUN_IDS) {
    for (const seed of SEEDS) {
      const out = await runOne(browser, server.url, id, seed);
      report[`${id}-${seed}`] = out;
      console.log(lineOf(id, seed, out));
      if (OUT) writeFileSync(OUT, JSON.stringify(report));
    }
  }
} finally {
  await browser.close();
  server.stop();
}
