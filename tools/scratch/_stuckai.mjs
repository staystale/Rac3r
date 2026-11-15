// _stuckai.mjs - BUG 8 (?stuckreset=1): HOW AND WHERE AI RACERS AND HIGHWAY TRAFFIC GET STUCK.
// The real game in a browser, fully deterministic (tools/lib/determinism.mjs, nothing drawn), the
// player on the demo driver. Every frame, for every racing AI after its green and before its
// finish: its progress along the race (circuit / stage: _prog; the endless road: _hwf.s). A car
// that has not gained 3 m of progress for 5 s or more is an EPISODE, logged with what it was doing
// (speed, rolled, metres off the road, a car close in front, the game's own stuck clock, the
// driver's drive-out tries) and how it ended: put back by the game (which rule: the 3 s stuck
// reset, the drive-out give-up, the highway off-road one, the roll, the injury, a cut), drove on,
// or still stuck when the run ended. Every put-back is logged too (where to: metres along the race
// from where it was, the nearest car to the spot). Highway TRAFFIC: a car standing (< 1 m/s) for
// 5 s or more, not stopped on purpose (broken down, at a pump, a police car waiting), logged with
// wrecked / rolled / on screen / metres from you, and how it ended (drove on, recycled, parked).
// RUNS=id,id ... (default all), SECONDS=180, SEED=1, [RAC3R_QUERY=stuckreset=1], OUT=<file.json>
// node tools/scratch/_stuckai.mjs
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, installDriver, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  thruston: ['thruston', { ai: 19, laps: 30 }],
  brands: ['brands-snatch', { ai: 19, laps: 30 }],
  knobhill: ['knobhill-circuit', { ai: 19, laps: 30 }],
  spa: ['spa', { ai: 12, laps: 30 }],
  naffcar: ['naffcar', { ai: 19, laps: 30 }],
  grass: ['grass-track', { ai: 12, laps: 30 }],
  knobhillrx: ['knobhill', { ai: 19, rx: true, laps: 30 }],
  holyjeez: ['holyjeez', { ai: 12, rx: true, laps: 30 }],
  xgayms: ['xgayms', { ai: 12, rx: true, laps: 30 }],
  stagegen: ['gen-forest-medium-mixed-1001', { ai: 5 }],
  sahara: ['stage-sahara-sandpants', { ai: 5 }],
  hwrace: ['highway', { ai: 5, traffic: 1.5, road: 'motorway' }],
  hwtwisty: ['highway', { ai: 5, traffic: 1.5, road: 'twisty' }],
  hwfree: ['highway', { ai: 0, traffic: 1.5, road: 'motorway' }],
  hwfreetwisty: ['highway', { ai: 0, traffic: 1.5, road: 'twisty' }],
  freedrive: ['thruston', { ai: 0 }],
  lab: ['lab', { ai: 0 }],
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SECONDS = Number(process.env.SECONDS || 180);
const SEED = Number(process.env.SEED || 1);
const CAR = process.env.CAR || 'hatch-rwd';
const OUT = process.env.OUT || '';
const CHUNK = 600;
const SKIP = '&skip=world,ground,car' + extraQuery();

/** Page side: load the game's modules the tracker reads. */
async function installTracker() {
  const [world, order, session, state] = await Promise.all([
    import('/src/world/state.ts'), import('/src/game/order.ts'), import('/src/game/session.ts'),
    import('/src/world/tyrewall.ts'),
  ]);
  window.__stk = { world, order, session, tyre: state, t: 0, ai: new Map(), tr: new Map(),
    episodes: [], resets: [], traffic: [], aiCount: 0 };
}

/** Page side: one frame of tracking (called after each stepped frame). */
function tickTracker() {
  const stk = window.__stk, game = window.__game, LEVEL = stk.world.LEVEL;
  const dt = 1 / 60;
  stk.t += dt;
  const all = [game.car, ...game.ai.map((entry) => entry.car), ...(game.traffic?.cars || [])];
  const nearAhead = (car) => {
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    let best = null;
    for (const other of all) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y, along = dx * cos + dy * sin,
        across = -dx * sin + dy * cos;
      if (along > 0 && along < 12 && Math.abs(across) < 3 && (!best || along < best.along)) {
        best = { along, speed: Math.hypot(other.vx, other.vy) };
      }
    }
    return best;
  };
  const offRoad = (car) => {
    if (LEVEL.endless) {
      const frame = car._hwf;
      return frame ? Math.abs(frame.off) - LEVEL._hw.geo.hw : NaN;
    }
    const near = stk.tyre.querySubtrack(LEVEL.subtrack, car.x, car.y);
    return near.dist - LEVEL.subtrack.width / 2;
  };
  const flowRow = (car) => game.flow?.entries?.find((row) => row.car === car);
  stk.aiCount = game.ai.length;
  for (const entry of game.ai) {
    const car = entry.car;
    let rec = stk.ai.get(entry);
    if (!rec) {
      rec = { num: stk.ai.size, anchor: null, anchorT: stk.t, ep: null, px: car.x, py: car.y,
        pvx: car.vx, pvy: car.vy, prev: {} };
      stk.ai.set(entry, rec);
    }
    const prog = LEVEL.endless ? car._hwf?.s : car._prog;
    const speed = Math.hypot(car.vx, car.vy);
    const jump = Math.hypot(car.x - rec.px - rec.pvx * dt, car.y - rec.py - rec.pvy * dt);
    if (jump > 4) {
      const prev = rec.prev;
      const kind = prev.giveUp ? 'giveUp' : prev.stuckT > 2.8 ? 'stuck3s'
        : prev.offT > 2.8 ? 'hwOff' : prev.rolled ? 'roll' : prev.hurt ? 'injury' : 'other';
      const others = all.filter((other) => other !== car);
      const nearest = Math.min(...others.map((other) => Math.hypot(other.x - car.x,
        other.y - car.y)));
      stk.resets.push({ car: rec.num, t: +stk.t.toFixed(2), kind,
        stuckFor: +(stk.t - rec.anchorT).toFixed(1),
        gain: prog != null && prev.prog != null ? +(prog - prev.prog).toFixed(1) : null,
        nearest: +nearest.toFixed(1), x: Math.round(rec.px), y: Math.round(rec.py) });
      if (rec.ep) rec.ep.end = 'reset:' + kind;
    }
    const held = LEVEL.stage ? stk.order.carHeld(car) : stk.order.startHeld();
    const row = flowRow(car), done = row && row.finish != null;
    const moving = prog != null && rec.anchor != null && prog > rec.anchor + 3;
    if (held || done || prog == null || rec.anchor == null || moving || jump > 4) {
      if (rec.ep && rec.ep.dur >= 5) stk.episodes.push(closeEpisode(rec.ep, moving
        ? 'drove' : rec.ep.end || (done ? 'finished' : 'other')));
      rec.ep = null;
      rec.anchor = prog ?? null;
      rec.anchorT = stk.t;
    } else {
      const dur = stk.t - rec.anchorT;
      if (dur > 2) {
        rec.ep ??= { car: rec.num, kind: 'ai', from: +stk.t.toFixed(2), n: 0, speed: 0,
          rolled: 0, off: 0, offMax: -99, queue: 0, stuckTMax: 0, nOut: 0, still: 0,
          x: Math.round(car.x), y: Math.round(car.y), level: LEVEL.id, back: 0 };
        const ep = rec.ep, ahead = nearAhead(car), off = offRoad(car);
        ep.dur = dur;
        ep.n++;
        ep.speed += speed;
        ep.still += speed < 1 ? 1 : 0;
        ep.rolled += car.roll ? 1 : 0;
        ep.off += off > 1 ? 1 : 0;
        ep.offMax = Math.max(ep.offMax, off);
        ep.queue += ahead && ahead.speed < 2 ? 1 : 0;
        ep.back += (car.t?.vLong ?? 0) < -0.3 ? 1 : 0;
        ep.stuckTMax = Math.max(ep.stuckTMax, entry.stuckT || 0);
        ep.nOut = Math.max(ep.nOut, entry.drv.state.nOut || 0);
      }
    }
    rec.prev = { giveUp: entry.drv.state.giveUp, stuckT: entry.stuckT, offT: entry.offT || 0,
      rolled: !!car.roll, hurt: entry.hurtWait != null, prog };
    rec.px = car.x; rec.py = car.y; rec.pvx = car.vx; rec.pvy = car.vy;
  }
  tickTraffic(stk, game, dt);
}

/** Page side: an episode's means, as a log row. */
function closeEpisode(ep, end) {
  const share = (count) => +(count / Math.max(1, ep.n)).toFixed(2);
  return { car: ep.car, kind: ep.kind, level: ep.level, from: ep.from, dur: +ep.dur.toFixed(1),
    end, speed: +(ep.speed / Math.max(1, ep.n)).toFixed(2), still: share(ep.still),
    rolled: share(ep.rolled), off: share(ep.off), offMax: +ep.offMax.toFixed(1),
    queue: share(ep.queue), back: share(ep.back), stuckTMax: +ep.stuckTMax.toFixed(2),
    nOut: ep.nOut, x: ep.x, y: ep.y, wreck: ep.wreck, seen: ep.seen != null ? share(ep.seen)
      : undefined, near: ep.near != null ? +(ep.near / Math.max(1, ep.n)).toFixed(0)
      : undefined, why: ep.why };
}

/** Page side: one frame of the highway traffic's tracking. */
function tickTraffic(stk, game, dt) {
  if (!game.traffic || !game.traffic.list) return;
  for (const slot of game.traffic.list) {
    let rec = stk.tr.get(slot);
    if (!rec) {
      rec = { num: stk.tr.size, still: 0, ep: null, car: slot.car, px: 0, py: 0 };
      stk.tr.set(slot, rec);
    }
    const car = slot.car;
    const gone = slot.parked || rec.car !== car || (car && Math.hypot(car.x - rec.px,
      car.y - rec.py) > 8);
    const speed = car ? Math.hypot(car.vx, car.vy) : 0;
    const why = slot.broke ? (slot.broke.at != null ? 'pump' : 'broken')
      : slot.police?.mode === 'wait' ? 'policeWait' : '';
    if (gone || speed >= 1 || slot.parked) {
      if (rec.ep && rec.ep.dur >= 5) {
        stk.traffic.push(closeEpisode(rec.ep, slot.parked ? 'parked' : gone ? 'recycled'
          : 'drove'));
      }
      rec.ep = null;
      rec.still = 0;
    } else {
      rec.still += dt;
      if (rec.still > 2) {
        rec.ep ??= { car: rec.num, kind: 'traffic', from: +stk.t.toFixed(2), n: 0, speed: 0,
          rolled: 0, off: 0, offMax: -99, queue: 0, stuckTMax: 0, nOut: 0, still: 0, back: 0,
          x: Math.round(car.x), y: Math.round(car.y), level: 'highway', wreck: false, seen: 0,
          near: 0, why };
        const ep = rec.ep;
        ep.dur = rec.still;
        ep.n++;
        ep.still++;
        ep.speed += speed;
        ep.rolled += car.roll ? 1 : 0;
        ep.wreck = ep.wreck || !!slot.wreck;
        ep.seen += stk.session.onScreen(car.x, car.y) ? 1 : 0;
        ep.near += Math.hypot(car.x - game.car.x, car.y - game.car.y);
        if (why) ep.why = why;
      }
    }
    rec.car = slot.car;
    if (car) { rec.px = car.x; rec.py = car.y; }
  }
}

/** Page side: step frames, tracking each one; returns the episodes so far. */
function stepTracked(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__stkTick();
  }
}

/** Page side: close the open episodes and hand the logs back. */
function finishTracker() {
  const stk = window.__stk;
  for (const rec of [...stk.ai.values()]) {
    if (rec.ep && rec.ep.dur >= 5) stk.episodes.push(window.__stkClose(rec.ep, 'runEnd'));
  }
  for (const rec of [...stk.tr.values()]) {
    if (rec.ep && rec.ep.dur >= 5) stk.traffic.push(window.__stkClose(rec.ep, 'runEnd'));
  }
  return { episodes: stk.episodes, resets: stk.resets, traffic: stk.traffic, ai: stk.aiCount,
    trafficSlots: stk.tr.size };
}

/**
 * One run: open the level, start the race, step SECONDS of fake time, tracked.
 * @returns {Promise<object>} the logs
 */
async function runOne(browser, base, id) {
  const [level, opts] = ALL_RUNS[id];
  const errors = [];
  const page = await openPage(browser, base, level, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [level, { car: CAR, ...opts }]);
  await page.waitForTimeout(SETTLE_MS);
  if (level !== 'lab') await page.evaluate(installDriver);
  await page.evaluate(installTracker);
  await page.evaluate(`window.__stkTick = ${tickTracker.toString()};
    window.__stkClose = window.closeEpisode = ${closeEpisode.toString()};
    window.tickTraffic = ${tickTraffic.toString()};`);
  const frames = SECONDS * 60;
  for (let done = 0; done < frames; done += CHUNK) {
    await page.evaluate(stepTracked, Math.min(CHUNK, frames - done));
  }
  const out = await page.evaluate(finishTracker);
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

const server = await startServer();
const browser = await launchBrowser();
const report = {};
try {
  for (const id of RUN_IDS) {
    const t0 = Date.now();
    const out = await runOne(browser, server.url, id);
    report[id] = out;
    const byEnd = {};
    for (const ep of out.episodes) byEnd[ep.end] = (byEnd[ep.end] || 0) + 1;
    const byKind = {};
    for (const reset of out.resets) byKind[reset.kind] = (byKind[reset.kind] || 0) + 1;
    console.log(`${id}: ${out.ai} AI, ${SECONDS} s | stuck >=5 s: ${out.episodes.length}`
      + ` ${JSON.stringify(byEnd)} | put-backs ${out.resets.length} ${JSON.stringify(byKind)}`
      + ` | traffic standing >=5 s: ${out.traffic.length} (${out.trafficSlots} slots)`
      + ` | ${((Date.now() - t0) / 1000).toFixed(0)} s${out.errors.length ? ' ERR '
        + out.errors[0] : ''}`);
    for (const ep of out.episodes) console.log('   AI  ' + JSON.stringify(ep));
    for (const ep of out.traffic) console.log('   TR  ' + JSON.stringify(ep));
  }
} finally {
  await browser.close();
  server.stop();
}
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
