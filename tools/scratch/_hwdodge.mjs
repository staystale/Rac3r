// _hwdodge.mjs - BUG 10 (measure only): WHAT THE HIGHWAY RACING AI HITS. The real game, deterministic,
// nothing drawn, your car on ?autopilot, a highway race with traffic. Every frame each racing AI is
// tested against every other car (you, the other racers, every traffic car) for its body touching
// (no margin); a new touch after 0.5 s apart is a HIT, logged with what was hit - ONCOMING traffic
// (the other way), SAME-WAY traffic, a WRECK or a car standing (under 1 m/s), a POLICE car, a
// SPEEDER (traffic racing), YOU or another RACER - the closing speed, where the racer was across
// the road (in the other way's lanes?), and what it knew 0.5-1 s before: the other car's place in
// the racer's own frame (m ahead, m across) and whether that was inside the window its driver reads
// cars in (ai/driverTraffic.ts carsStep: |across| <= 8 m, ahead <= 8 + closing x 2.6-3.8 s by
// skill), 2.5-3 s before (early) and 0.5-1 s before, and whether it braked or moved across. NEAR: an oncoming car passing within 2.5 m
// of a racer's middle at over 15 m/s closing, no touch. Per run the racers' km, for rates.
// RUNS=twisty,motorway,dual (default), SECONDS=180, SEED=1, OUT=<file.json>
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  twisty: { ai: 5, traffic: 1.5, road: 'twisty' },
  twisty1: { ai: 5, traffic: 1, road: 'twisty' },
  motorway: { ai: 5, traffic: 1.5, road: 'motorway' },
  dual: { ai: 5, traffic: 1.5, road: 'dual', scenery: 'canyon' },
};
const RUN_IDS = (process.env.RUNS || 'twisty,motorway,dual').split(',');
const SECONDS = Number(process.env.SECONDS || 180), SEED = Number(process.env.SEED || 1);
const OUT = process.env.OUT || '', CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: the tracker's state and helpers. */
async function installTracker() {
  const world = await import('/src/world/state.ts');
  window.__hd = { world, t: 0, hits: [], near: [], touching: new Map(), snaps: [], km: 0, racerS: 0, oncomingS: 0,
    passed: new Map() };
}

/** Page side: what a car is to a racer. */
function kindOf(game, other) {
  if (other === game.car) return 'you';
  if (game.ai.some((entry) => entry.car === other)) return 'racer';
  const slot = game.traffic.list.find((item) => item.car === other);
  if (!slot) return 'bridge';
  if (slot.police) return 'police';
  if (slot.wreck || Math.hypot(other.vx, other.vy) < 1) return 'standing';
  if (slot.racer) return 'speeder';
  return (slot.dir ?? 1) < 0 ? 'oncoming' : 'sameway';
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

/** Page side: a racer's view of one car: m ahead, m across, closing m/s, in its read window. */
function viewOf(entry, other) {
  const car = entry.car, cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const dx = other.x - car.x, dy = other.y - car.y;
  const fwd = dx * cos + dy * sin, lat = -dx * sin + dy * cos;
  const speed = Math.hypot(car.vx, car.vy), vAlong = other.vx * cos + other.vy * sin;
  const skill = Math.max(0, Math.min(1, entry.drv.traits.skill ?? 0.5));
  const look = 2.6 + 1.2 * skill, closing = Math.max(speed, speed - vAlong);
  const inWindow = fwd >= -60 && fwd <= 8 + closing * look && Math.abs(lat) <= 8;
  return { fwd: +fwd.toFixed(1), lat: +lat.toFixed(1), closing: +(speed - vAlong).toFixed(1),
    inWindow, brake: +(car.brakeLight || 0).toFixed(2), off: car._hwf ? +car._hwf.off.toFixed(1)
      : null };
}

/** Page side: one frame. */
function tickTracker() {
  const hd = window.__hd, game = window.__game, level = hd.world.LEVEL;
  hd.t += 1 / 60;
  const others = [game.car, ...game.ai.map((entry) => entry.car), ...game.traffic.cars];
  const geo = level._hw?.geo;
  for (const entry of game.ai) {
    const car = entry.car;
    hd.km += Math.hypot(car.vx, car.vy) / 60 / 1000;
    hd.racerS += 1 / 60;
    if (geo && car._hwf && geo.oncoming.some((centre) => Math.abs(car._hwf.off - centre) < 2)) {
      hd.oncomingS += 1 / 60;
    }
    let rel = hd.touching.get(entry);
    if (!rel) hd.touching.set(entry, rel = new Map());
    for (const other of others) {
      if (other === car || Math.abs(other.x - car.x) > 12 || Math.abs(other.y - car.y) > 12) {
        continue;
      }
      const kind = kindOf(game, other), touch = touches(car, other);
      const was = rel.get(other);
      if (touch && (!was || hd.t - was > 0.5)) {
        const early = hd.snaps.length ? hd.snaps[0].get(entry)?.get(other) : null;
        const before = hd.snaps.length > 1
          ? hd.snaps[hd.snaps.length - 2].get(entry)?.get(other) : null;
        const now = window.__hdView(entry, other);
        const oncomingLane = geo && car._hwf && geo.oncoming.length
          ? geo.oncoming.some((centre) => Math.abs(car._hwf.off - centre) < 2) : false;
        hd.hits.push({ t: +hd.t.toFixed(2), kind, closing: now.closing, off: now.off,
          inOncomingLane: oncomingLane, early: early || null, before: before || null,
          movedAcross: before && now.off != null && before.off != null
            ? +(now.off - before.off).toFixed(1) : null });
      }
      if (touch) rel.set(other, hd.t);
      if (!touch && kind === 'oncoming') {
        const dist = Math.hypot(other.x - car.x, other.y - car.y);
        const view = window.__hdView(entry, other);
        if (dist < 2.5 + (car.spec.wid + other.spec.wid) / 2 && view.closing > 15
          && Math.abs(view.fwd) < 2) {
          const key = hd.passed.get(other);
          if (!key || hd.t - key > 2) {
            hd.passed.set(other, hd.t);
            hd.near.push({ t: +hd.t.toFixed(2), lat: view.lat, closing: view.closing,
              off: view.off });
          }
        }
      }
    }
  }
  if (Math.round(hd.t * 60) % 30 === 0) {
    const snap = new Map();
    for (const entry of game.ai) {
      const views = new Map();
      for (const other of others) {
        if (other !== entry.car && Math.hypot(other.x - entry.car.x, other.y - entry.car.y) < 200) {
          views.set(other, window.__hdView(entry, other));
        }
      }
      snap.set(entry, views);
    }
    hd.snaps.push(snap);
    if (hd.snaps.length > 6) hd.snaps.shift();
  }
}

/** Page side: step frames, tracking each. */
function stepTracked(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__hdTick();
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
  await page.evaluate(`window.__hdTick = ${tickTracker.toString()};
    window.__hdView = ${viewOf.toString()}; window.kindOf = ${kindOf.toString()};
    window.touches = ${touches.toString()};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepTracked, Math.min(CHUNK, SECONDS * 60 - done));
  }
  const out = await page.evaluate(() => ({ hits: window.__hd.hits, near: window.__hd.near,
    km: window.__hd.km, oncomingShare: window.__hd.oncomingS / Math.max(1, window.__hd.racerS),
    ended: window.__game.flow?.state, why: window.__game.flow?.endWhy }));
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
    console.log(`${id}: racers ${out.km.toFixed(1)} km | hits ${out.hits.length}`
      + ` ${JSON.stringify(byKind)} | oncoming near misses ${out.near.length} | in the other way's`
      + ` lane ${(100 * out.oncomingShare).toFixed(0)} % of the time | flow`
      + ` ${out.ended} ${out.why ?? ''}${out.errors.length ? ' ERR ' + out.errors[0] : ''}`);
    for (const hit of out.hits) console.log('   HIT ' + JSON.stringify(hit));
  }
} finally {
  await browser.close();
  server.stop();
}
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
