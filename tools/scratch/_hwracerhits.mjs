// _hwracerhits.mjs - BUG 10 TRACE (measure only): RACER-ON-RACER HITS on the highway, one record per
// pair touch (bodies touching, no margin; a new touch after 0.5 s apart). The real game, deterministic,
// nothing drawn, your car on ?autopilot, a highway race with 5 AI and traffic (as _hwdodge.mjs). For
// each hit, both racers' road frames (s along, off across, v along) at the hit and 1.0 / 0.5 / 0.2 s
// before, their brake lights, their drivers' dodge targets, the road's turn over the next 40 m, and
// what the racer behind (A) read of the one ahead (B) 1 s before - inside its heading box, inside the
// road box (?hwdodge=1's) - and the nearest other car ahead of each within 60 m (what it went round).
// KIND: REAR (B ahead by a length or more and lapping across 0.5 s before), SIDE (alongside then),
// MERGE (apart across and ahead, then one moved over). MOVER: who moved across more in the last 0.5 s.
// RUNS=dual (default) | twisty | ..., SECONDS=180, SEED=1, OUT=<file.json>
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  twisty: { ai: 5, traffic: 1.5, road: 'twisty' },
  twisty1: { ai: 5, traffic: 1, road: 'twisty' },
  motorway: { ai: 5, traffic: 1.5, road: 'motorway' },
  dual: { ai: 5, traffic: 1.5, road: 'dual', scenery: 'canyon' },
};
const RUN_IDS = (process.env.RUNS || 'dual').split(',');
const SECONDS = Number(process.env.SECONDS || 180), SEED = Number(process.env.SEED || 1);
const OUT = process.env.OUT || '', CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: the tracker's state. */
async function installTracker() {
  const world = await import('/src/world/state.ts');
  const road = await import('/src/highway/road.ts');
  window.__rh = { world, road, t: 0, frame: 0, hits: [], touching: new Map(), ring: [], km: 0,
    onc: [], lastTouch: new Map(), oncTouch: new Map() };
}

/** Page side: one frame. */
function tickTracker() {
  const rh = window.__rh, game = window.__game, level = rh.world.LEVEL;
  rh.t += 1 / 60;
  rh.frame++;
  const racers = game.ai;
  for (const entry of racers) rh.km += Math.hypot(entry.car.vx, entry.car.vy) / 60 / 1000;
  // every 0.1 s: each racer's place, the last 1.5 s kept
  if (rh.frame % 6 === 0) {
    const snap = new Map();
    for (const entry of racers) {
      const car = entry.car, frame = car._hwf, state = entry.drv.state;
      if (!frame) continue;
      snap.set(entry, { s: frame.s, off: frame.off, v: frame.v, brake: car.brakeLight || 0,
        dodge: state.dodge ?? 0, gap: state.gapBase ?? null, x: car.x, y: car.y, h: car.heading,
        vx: car.vx, vy: car.vy, kept: Number.isFinite(state.keepMax),
        judging: state.oncomingCar || null });
    }
    rh.ring.push({ t: rh.t, snap });
    if (rh.ring.length > 25) rh.ring.shift();
  }
  window.__rhOncoming(level);
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i], two = racers[j];
      if (!one.car._hwf || !two.car._hwf) continue;
      if (Math.abs(one.car.x - two.car.x) > 12 || Math.abs(one.car.y - two.car.y) > 12) continue;
      const touch = window.__rhTouches(one.car, two.car);
      const key = one.car.num * 100 + two.car.num, was = rh.touching.get(key);
      if (touch && (!was || rh.t - was > 0.5)) rh.hits.push(window.__rhRecord(one, two, level));
      if (touch) rh.touching.set(key, rh.t);
    }
  }
}

/** Page side: racers against oncoming traffic (and any touch, for "pushed"). */
function trackOncoming(level) {
  const rh = window.__rh, game = window.__game, geo = level._hw.geo;
  const cars = [game.car, ...game.ai.map((entry) => entry.car), ...game.traffic.cars];
  for (const entry of game.ai) {
    const car = entry.car;
    for (const other of cars) {
      if (other === car || Math.abs(other.x - car.x) > 12 || Math.abs(other.y - car.y) > 12) {
        continue;
      }
      if (!window.__rhTouches(car, other)) continue;
      const slot = game.traffic.list.find((item) => item.car === other);
      const isOncoming = slot && !slot.police && (slot.dir ?? 1) < 0;
      let mine = rh.oncTouch.get(car);
      if (!mine) rh.oncTouch.set(car, mine = new Map());
      const was = mine.get(other);
      if (isOncoming && (!was || rh.t - was > 0.5) && car._hwf && other._hwf) {
        rh.onc.push(window.__rhOncRecord(entry, other, level, geo));
      }
      let list = rh.lastTouch.get(car);
      if (!list) rh.lastTouch.set(car, list = []);
      if (!was || rh.t - was > 0.5) {
        const kind = other === game.car ? 'you' : !slot ? 'racer' : slot.police ? 'police'
          : (slot.dir ?? 1) < 0 ? 'oncoming' : Math.hypot(other.vx, other.vy) < 1 ? 'standing'
            : 'sameway';
        list.push({ t: rh.t, other, kind });
        if (list.length > 8) list.shift();
      }
      mine.set(other, rh.t);
    }
  }
}

/** Page side: a car's last touch with another car than the partner, within 2 s, or null. */
function prior(car, partner) {
  const rh = window.__rh;
  const list = (rh.lastTouch.get(car) || []).filter((item) => item.other !== partner
    && rh.t - item.t < 2);
  const last = list[list.length - 1];
  return last ? { kind: last.kind, ago: +(rh.t - last.t).toFixed(2) } : null;
}

/** Page side: one head-on's record. */
function oncRecord(entry, other, level, geo) {
  const rh = window.__rh, car = entry.car, half = car.spec.wid / 2;
  const roadH = (dist) => rh.road.roadPose(level, dist, 0).h;
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const at = (secs) => {
    let best = null;
    for (const item of rh.ring) if (rh.t - item.t >= secs - 0.05) best = item;
    const snap = best?.snap.get(entry);
    if (!snap) return null;
    return { over: +(snap.off - (geo.oppL - half)).toFixed(1), kept: snap.kept,
      judgingIt: snap.judging === other, judgingAny: !!snap.judging,
      yaw: +(wrap(snap.h - roadH(snap.s)) * 180 / Math.PI).toFixed(0), v: +snap.v.toFixed(1),
      dodge: +snap.dodge.toFixed(1) };
  };
  const mine = car._hwf, theirs = other._hwf;
  const turn = wrap(roadH(mine.s + 40) - roadH(mine.s)) * 180 / Math.PI;
  const touches = (rh.lastTouch.get(car) || []).filter((item) => item.other !== other);
  const last = touches.length ? touches[touches.length - 1].t : null;
  return { t: +rh.t.toFixed(2), num: car.num, closing: +(mine.v - theirs.v).toFixed(1),
    oncV: +theirs.v.toFixed(1), racerOver: +(mine.off - (geo.oppL - half)).toFixed(1),
    oncOnOurSide: +((geo.oppL + other.spec.wid / 2) - theirs.off).toFixed(1),
    yaw: +(wrap(car.heading - roadH(mine.s)) * 180 / Math.PI).toFixed(0),
    turn40: +turn.toFixed(0), touchedAgo: last != null ? +(rh.t - last).toFixed(1) : null,
    skill: +(entry.drv.traits.skill ?? 0).toFixed(2), misjudge: +(entry.drv.state.misjudge ?? 0)
      .toFixed(2), r05: at(0.5), r1: at(1), r2: at(2) };
}

/** Page side: whether two bodies touch (each on the first's axes, no margin). */
function touches(car, other) {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const dx = other.x - car.x, dy = other.y - car.y, turn = other.heading - car.heading;
  const along = dx * cos + dy * sin, across = -dx * sin + dy * cos;
  const reachAlong = other.spec.len / 2 * Math.abs(Math.cos(turn))
    + other.spec.wid / 2 * Math.abs(Math.sin(turn));
  const reachAcross = other.spec.len / 2 * Math.abs(Math.sin(turn))
    + other.spec.wid / 2 * Math.abs(Math.cos(turn));
  return Math.abs(along) < car.spec.len / 2 + reachAlong
    && Math.abs(across) < car.spec.wid / 2 + reachAcross;
}

/** Page side: a hit's record. */
function record(one, two, level) {
  const rh = window.__rh, game = window.__game;
  const back = (secs) => {
    let best = null;
    for (const item of rh.ring) if (rh.t - item.t >= secs - 0.05) best = item;
    return best;
  };
  const at1 = back(1.0), at05 = back(0.5), at02 = back(0.2);
  const s1 = at05?.snap.get(one), s2 = at05?.snap.get(two);
  // A = the one behind 0.5 s before (else now)
  const behindFirst = s1 && s2 ? s1.s <= s2.s : one.car._hwf.s <= two.car._hwf.s;
  const [aEnt, bEnt] = behindFirst ? [one, two] : [two, one];
  const rel = (item) => {
    const sa = item?.snap.get(aEnt), sb = item?.snap.get(bEnt);
    if (!sa || !sb) return null;
    return { ds: +(sb.s - sa.s).toFixed(1), doff: +(sb.off - sa.off).toFixed(1),
      va: +sa.v.toFixed(1), vb: +sb.v.toFixed(1), offA: +sa.off.toFixed(1),
      offB: +sb.off.toFixed(1), brA: +sa.brake.toFixed(2), brB: +sb.brake.toFixed(2),
      dodgeA: +sa.dodge.toFixed(1), dodgeB: +sb.dodge.toFixed(1) };
  };
  const now = { ds: +(bEnt.car._hwf.s - aEnt.car._hwf.s).toFixed(1),
    doff: +(bEnt.car._hwf.off - aEnt.car._hwf.off).toFixed(1),
    closing: +(aEnt.car._hwf.v - bEnt.car._hwf.v).toFixed(1),
    offA: +aEnt.car._hwf.off.toFixed(1), offB: +bEnt.car._hwf.off.toFixed(1) };
  const r05 = rel(at05), r1 = rel(at1), r02 = rel(at02);
  const len = (aEnt.car.spec.len + bEnt.car.spec.len) / 2;
  const wid = (aEnt.car.spec.wid + bEnt.car.spec.wid) / 2;
  let kind = 'SIDE';
  if (r05 && r05.ds >= len && Math.abs(r05.doff) < wid) kind = 'REAR';
  else if (r05 && r05.ds >= len) kind = 'MERGE';
  // who moved across in the last 0.5 s (road frame)
  const moveA = r05 ? +(now.offA - r05.offA).toFixed(1) : null;
  const moveB = r05 ? +(now.offB - r05.offB).toFixed(1) : null;
  const toward = (move, sign) => (move == null ? 0 : move * sign);
  const sign = Math.sign(now.doff || (r05?.doff ?? 1)) || 1;
  const mover = r05 == null ? '?' : toward(moveA, sign) > toward(moveB, -sign) + 0.2 ? 'A'
    : toward(moveB, -sign) > toward(moveA, sign) + 0.2 ? 'B' : 'both';
  // A's read of B 1 s before: by its heading box and by the road box
  let readHeading = null, readRoad = null;
  const sa1 = at1?.snap.get(aEnt), sb1 = at1?.snap.get(bEnt);
  if (sa1 && sb1) {
    const cos = Math.cos(sa1.h), sin = Math.sin(sa1.h);
    const dx = sb1.x - sa1.x, dy = sb1.y - sa1.y, fwd = dx * cos + dy * sin;
    const lat = -dx * sin + dy * cos, speed = Math.hypot(sa1.vx, sa1.vy);
    const vAlong = sb1.vx * cos + sb1.vy * sin;
    const skill = Math.max(0, Math.min(1, aEnt.drv.traits.skill ?? 0.5));
    const look = 2.6 + 1.2 * skill;
    readHeading = { fwd: +fwd.toFixed(1), lat: +lat.toFixed(1),
      inBox: fwd >= -60 && fwd <= 8 + Math.max(speed, speed - vAlong) * look && Math.abs(lat) <= 8 };
    const rfwd = sb1.s - sa1.s, rlat = sb1.off - sa1.off;
    readRoad = { fwd: +rfwd.toFixed(1), lat: +rlat.toFixed(1), inBox: rfwd >= -60
      && rfwd <= 8 + Math.max(speed, speed - sb1.v) * look && Math.abs(rlat) <= 8 };
  }
  // the nearest other car ahead of each within 60 m (what it may have gone round)
  const nearestAhead = (ent) => {
    const mine = ent.car._hwf;
    let best = null;
    const cars = [game.car, ...game.ai.map((other) => other.car), ...game.traffic.cars];
    for (const other of cars) {
      if (other === aEnt.car || other === bEnt.car || !other._hwf) continue;
      const ds = other._hwf.s - mine.s;
      if (ds < -5 || ds > 60 || Math.abs(other._hwf.off - mine.off) > 8) continue;
      if (!best || ds < best.ds) best = { ds: +ds.toFixed(1),
        doff: +(other._hwf.off - mine.off).toFixed(1), v: +other._hwf.v.toFixed(1),
        kind: other === game.car ? 'you' : game.ai.some((item) => item.car === other) ? 'racer'
          : 'traffic' };
    }
    return best;
  };
  const sNow = aEnt.car._hwf.s;
  const turn = (() => {
    const here = rh.road.roadPose(level, sNow, 0).h, ahead = rh.road.roadPose(level, sNow + 40, 0).h;
    let diff = ahead - here;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return +(diff * 180 / Math.PI).toFixed(0);
  })();
  return { t: +rh.t.toFixed(2), a: aEnt.car.num, b: bEnt.car.num, kind, mover, moveA, moveB,
    turn40: turn, now, r02, r05, r1, readHeading, readRoad,
    priorA: window.__rhPrior(aEnt.car, bEnt.car), priorB: window.__rhPrior(bEnt.car, aEnt.car),
    dvA: r02 ? +(aEnt.car._hwf.v - r02.va).toFixed(1) : null,
    dvB: r02 ? +(bEnt.car._hwf.v - r02.vb).toFixed(1) : null,
    skillA: +(aEnt.drv.traits.skill ?? 0).toFixed(2), aggA: +(aEnt.drv.traits.aggression ?? 0)
      .toFixed(2), atkA: aEnt.drv.state.atk ? aEnt.drv.state.atk.car === bEnt.car : false,
    aheadA: nearestAhead(aEnt), aheadB: nearestAhead(bEnt) };
}

/** Page side: step frames, tracking each. */
function stepTracked(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__rhTick();
  }
}

/** One run. */
async function runOne(browser, base, id) {
  const errors = [];
  const page = await openPage(browser, base, 'highway', errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, ['highway', { car: 'hatch-rwd', ...ALL_RUNS[id] }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installTracker);
  await page.evaluate(`window.__rhTick = ${tickTracker.toString()};
    window.__rhTouches = ${touches.toString()}; window.__rhRecord = ${record.toString()};
    window.__rhOncoming = ${trackOncoming.toString()}; window.__rhPrior = ${prior.toString()};
    window.__rhOncRecord = ${oncRecord
      .toString()};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepTracked, Math.min(CHUNK, SECONDS * 60 - done));
  }
  const out = await page.evaluate(() => ({ hits: window.__rh.hits, km: window.__rh.km,
    onc: window.__rh.onc }));
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

const server = await startServer();
const browser = await launchBrowser();
const report = {};
try {
  for (const id of RUN_IDS) {
    const out = await runOne(browser, server.url, id);
    report[id] = out;
    const byKind = {};
    for (const hit of out.hits) byKind[hit.kind] = (byKind[hit.kind] || 0) + 1;
    console.log(`${id} seed ${SEED}: racers ${out.km.toFixed(1)} km | racer-racer pair hits`
      + ` ${out.hits.length} (${(10 * out.hits.length / Math.max(0.1, out.km)).toFixed(1)} per 10 km)`
      + ` ${JSON.stringify(byKind)}${out.errors.length ? ' ERR ' + out.errors[0] : ''}`);
    for (const hit of out.hits) console.log('   HIT ' + JSON.stringify(hit));
    if (out.onc.length) console.log(`  head-ons with oncoming traffic ${out.onc.length}`);
    for (const hit of out.onc) console.log('   ONC ' + JSON.stringify(hit));
  }
} finally {
  await browser.close();
  server.stop();
}
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
