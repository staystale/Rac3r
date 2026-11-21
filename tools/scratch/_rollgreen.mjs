// _rollgreen.mjs - THE ROLLING START AT THE GREEN (the owner's 11-21 item 10, read only): the real
// game, seeded, nothing drawn, your car on ?autopilot, a rolling start. AT THE GREEN, each racer's
// own START PHASE (ai/driverLane.ts: from its first move over 2 m/s, goT, it keeps its grid lane and
// eases onto the line over START_BLEND s - startK 1 .. 0) - how long before the green it began and
// how much was left; its speed. AFTER THE GREEN, over 10 s: each racer's RELEASE (s from the green
// to 1 m/s over its green speed), the field's SPREAD along the road (front to back, m) at 0 / 2 / 5 /
// 10 s, its speeds' spread (m/s, the standard deviation), lane changes (2 m+ across from where it
// was at the green), order changes, touches and incidents (touches within 3 s / 60 m; pile-ups:
// 5+ cars) - over AFTER s (15). RUNS=naffcar,stockcar,dieatona,motorway
// SEEDS=1,2,3,4; a switch through RAC3R_QUERY. node tools/scratch/_rollgreen.mjs
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  naffcar: { level: 'naffcar', opts: { ai: 19, laps: 30 } },
  stockcar: { level: 'stock-car', opts: { ai: 19, laps: 30 } },
  dieatona: { level: 'dieatona', opts: { ai: 19, laps: 30 } },
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SEEDS = (process.env.SEEDS || '1,2,3,4').split(',').map(Number);
const OUT = process.env.OUT || '', CHUNK = 60, LIMIT_S = 120;
const AFTER_S = Number(process.env.AFTER || 15), MARKS = [0, 2, 5, 10, 15];
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();
// s the start phase lasts (ai/driverLane.ts START_BLEND - read here, not changed)
const START_BLEND = 9;

/** Page side: one frame - the green caught, then 10 s of the field after it. */
function tickRoll() {
  const roll = window.__roll, game = window.__game, L = window.__L;
  roll.t += 1 / 60;
  const racers = game.ai;
  for (const entry of racers) {
    if (entry.drv.__wrapped) continue;
    const drive = entry.drv.drive;
    entry.drv.drive = (...args) => (entry.__want = drive(...args));
    entry.drv.__wrapped = true;
  }
  const along = (car) => {
    if (car._hwf) return car._hwf.s;
    const sub = L.LEVEL.subtrack, query = L.querySubtrack(sub, car.x, car.y);
    return Number.isFinite(query.trackDist) ? query.trackDist : NaN;
  };
  const across = (car) => (car._hwf ? car._hwf.off : L.querySubtrack(L.LEVEL.subtrack, car.x,
    car.y).dist ?? 0);
  if (roll.greenT == null) {
    if (!game.start.green) return;
    roll.greenT = roll.t;
    roll.atGreen = racers.map((entry) => {
      const state = entry.drv.state;
      const sinceGo = state.goT == null ? null : state.t - state.goT;
      return { sinceGo, startK: sinceGo == null ? 1 : Math.max(0, 1 - sinceGo / roll.blend),
        speed: Math.hypot(entry.car.vx, entry.car.vy), lat: across(entry.car), release: null };
    });
    roll.touching = new Set();
  }
  const since = roll.t - roll.greenT;
  if (since > roll.after + 0.1) return;
  racers.forEach((entry, i) => {
    const rec = roll.atGreen[i];
    // (its release: 1 m/s over its speed at the green - the controls applied are the formation's
    // until then, not the driver's own)
    if (rec.release == null && Math.hypot(entry.car.vx, entry.car.vy) > rec.speed + 1) {
      rec.release = since;
    }
    if (Math.abs(across(entry.car) - rec.lat) > 2) rec.moved = true;
  });
  for (const mark of roll.marks) {
    if (roll.snaps[mark] || since < mark) continue;
    const places = racers.map((entry) => along(entry.car)).filter(Number.isFinite);
    const total = L.LEVEL.subtrack?.totalDist ?? Infinity, lead = places[0];
    // (ahead / behind the first racer, wrapped round the lap)
    const rel = places.map((place) => {
      let delta = place - lead;
      if (Number.isFinite(total)) delta = ((delta % total) + 1.5 * total) % total - total / 2;
      return delta;
    });
    const speeds = racers.map((entry) => Math.hypot(entry.car.vx, entry.car.vy));
    const meanV = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    roll.snaps[mark] = { spread: Math.max(...rel) - Math.min(...rel), speedSd: Math.sqrt(speeds
      .reduce((sum, speed) => sum + (speed - meanV) ** 2, 0) / speeds.length),
      order: rel.map((value, i) => [value, i]).sort((one, two) => two[0] - one[0])
        .map((pair) => pair[1]).join(',') };
  }
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i].car, two = racers[j].car, key = i * 100 + j;
      if (Math.abs(one.x - two.x) > 12 || Math.abs(one.y - two.y) > 12
        || !window.__rollOverlap(one, two)) {
        roll.touching.delete(key);
        continue;
      }
      if (!roll.touching.has(key)) {
        roll.touches++;
        roll.hits.push({ t: since, x: one.x, y: one.y, a: i, b: j,
          closing: Math.hypot(one.vx - two.vx, one.vy - two.vy) });
      }
      roll.touching.add(key);
    }
  }
}

/** Page side: whether two bodies overlap (each on the first's axes, no margin). */
function overlapRoll(car, other) {
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

/** Page side: step frames until the green and AFTER_S s after, or the limit. */
function stepRoll(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__rollTick();
  }
  const roll = window.__roll;
  return roll.greenT != null && roll.t - roll.greenT > roll.after + 0.1;
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
  await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(async ([blend, after, marks]) => {
    window.__L = await import('/src/lab.ts');
    window.__roll = { t: 0, greenT: null, atGreen: [], snaps: {}, touches: 0, hits: [], blend,
      after, marks, rolling: !!window.__game.start.rolling };
  }, [START_BLEND, AFTER_S, MARKS]);
  await page.evaluate(`window.__rollTick = ${tickRoll.toString()};
    window.__rollOverlap = ${overlapRoll.toString()};`);
  let done = false;
  for (let frames = 0; !done && frames < LIMIT_S * 60; frames += CHUNK) {
    done = await page.evaluate(stepRoll, CHUNK);
  }
  const out = await page.evaluate(() => {
    const roll = window.__roll;
    return { rolling: roll.rolling, greenT: roll.greenT, atGreen: roll.atGreen,
      snaps: roll.snaps, touches: roll.touches, hits: roll.hits };
  });
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

/** The middle of a list, and its range. */
function midOf(list) {
  const sorted = list.filter((value) => value != null).sort((one, two) => one - two);
  if (!sorted.length) return '-';
  return `${sorted[Math.floor(sorted.length / 2)].toFixed(2)} (${sorted[0].toFixed(2)}..`
    + `${sorted[sorted.length - 1].toFixed(2)})`;
}

/** Touches grouped into incidents (within 3 s and 60 m), each with its cars and hardest closing. */
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
  return groups.map((group) => ({ cars: group.cars.size, closing: group.closing * 3.6 }));
}

/** One run's line. */
function lineOf(id, seed, out) {
  if (out.greenT == null) return `${id} seed ${seed}: NO GREEN in ${LIMIT_S} s (rolling start`
    + ` ${out.rolling})${out.errors.length ? ' | ERR ' + out.errors[0] : ''}`;
  const green = out.atGreen, snaps = out.snaps, incidents = incidentsOf(out.hits);
  const orderChanges = (from, dest) => (snaps[from] && snaps[dest]
    ? snaps[from].order.split(',').filter((car, i) => car !== snaps[dest].order.split(',')[i])
      .length : '-');
  const snap = (mark) => (snaps[mark] ? `${snaps[mark].spread.toFixed(0)} m / sd`
    + ` ${snaps[mark].speedSd.toFixed(1)} m/s` : '-');
  return `${id} seed ${seed}: green at ${out.greenT.toFixed(1)} s | AT THE GREEN: start phase`
    + ` begun ${midOf(green.map((rec) => rec.sinceGo))} s before, left (startK)`
    + ` ${midOf(green.map((rec) => rec.startK))}, speed ${midOf(green.map((rec) => rec.speed))}`
    + ` m/s | AFTER: release ${midOf(green.map((rec) => rec.release))} s; field spread / speed sd`
    + ` at 0 s ${snap(0)}, 2 s ${snap(2)}, 5 s ${snap(5)}, 10 s ${snap(10)}, 15 s ${snap(15)};`
    + ` places changed by 15 s ${orderChanges(0, 15)} of ${green.length}; lane changes`
    + ` ${green.filter((rec) => rec.moved).length}; touches ${out.touches}, incidents`
    + ` ${incidents.length} (small ${incidents.filter((inc) => inc.cars === 2 && inc.closing < 30)
      .length}, pile-ups 5+ ${incidents.filter((inc) => inc.cars >= 5).length}, most cars`
    + ` ${Math.max(0, ...incidents.map((inc) => inc.cars))})${out.errors.length ? ' | ERR '
      + out.errors[0] : ''}`;
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
