// _hwleads.mjs - THE OWNER'S 11-21 ITEM 7 (measure only): "the AI waits behind traffic and the
// police / speeders dodge it better". The real game, deterministic, nothing drawn, your car on
// ?autopilot, a highway race with 5 AI and traffic. Per run: the RACERS' and the SPEEDERS' (traffic
// cars with the racing driver at the wheel: ai/trafficSpeeder.ts) seconds HELD BEHIND TRAFFIC per
// km (the driver's follow cap on, the nearest car ahead within 40 m and 2.5 m across a traffic car),
// their seconds braking / lifting for it, their mean speed; and LEAD (a): the cars each racer is
// handed that drive the OTHER way (across the central reservation) - frames with any, and the most.
// LEAD (b): AGG=<0..1> sets every racer's aggression (the speeders run 0.9: clear 2.3 - 0.4 agg,
// follow gap (6.5 - 2.5 agg) x ...: ai/driverTraffic.ts carsStep); NOROAD=1 hands the racers no
// road (they then read the cars by their heading, as the speeders do).
// ROAD=motorway SEEDS=1,2 SECONDS=180 node tools/scratch/_hwleads.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ROAD = process.env.ROAD || 'motorway';
const SEEDS = (process.env.SEEDS || '1,2').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 180), CHUNK = 600;
const AGG = process.env.AGG == null ? null : Number(process.env.AGG);
const NOROAD = !!process.env.NOROAD;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame. */
function tickLeads(settings) {
  const lead = window.__lead, game = window.__game;
  lead.t += 1 / 60;
  const traffic = game.traffic.cars;
  const drivers = [...game.ai.map((entry) => ({ car: entry.car, drv: entry.drv, who: 'racer' })),
    ...game.traffic.list.filter((slot) => slot.racer && !slot.parked)
      .map((slot) => ({ car: slot.car, drv: slot.racer, who: 'speeder' }))];
  for (const one of drivers) {
    const drv = one.drv;
    if (!drv.__wrapped) {
      const drive = drv.drive;
      drv.drive = (car, dt, ctxOf) => {
        const read = () => {
          const ctx = typeof ctxOf === 'function' ? ctxOf() : ctxOf;
          if (one.who !== 'racer') return ctx;
          if (settings.noRoad) delete ctx.road;
          // (lead a: the cars it is handed going the other way)
          const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
          const across = (ctx.cars || []).filter((other) => other.vx * cos + other.vy * sin < -5
            && Math.hypot(other.x - car.x, other.y - car.y) < 150).length;
          lead.acrossFrames += across > 0 ? 1 : 0;
          lead.acrossMax = Math.max(lead.acrossMax, across);
          lead.readFrames++;
          return ctx;
        };
        return (drv.__want = drive(car, dt, typeof ctxOf === 'function' ? read : read()));
      };
      if (settings.agg != null && one.who === 'racer') drv.traits.aggression = settings.agg;
      drv.__wrapped = true;
    }
    if (lead.t < 15) continue;
    const car = one.car, speed = Math.hypot(car.vx, car.vy), tally = lead[one.who];
    tally.s += 1 / 60;
    tally.m += speed / 60;
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    let near = null, nearFwd = Infinity;
    for (const other of [game.car, ...game.ai.map((entry) => entry.car), ...traffic]) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const fwd = dx * cos + dy * sin, across = -dx * sin + dy * cos;
      if (fwd > 0 && fwd < 40 && Math.abs(across) < 2.5 && fwd < nearFwd) {
        near = other;
        nearFwd = fwd;
      }
    }
    const isTraffic = near && traffic.includes(near);
    if (drv.state.follow && isTraffic) tally.held += 1 / 60;
    const want = drv.__want;
    if (isTraffic && want && (want.brake > 0.15 || want.throttle < 0.3)) tally.braked += 1 / 60;
  }
}

/** Page side: step frames. */
function stepLeads([count, settings]) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__leadTick(settings);
  }
}

/** One run. */
async function runOne(browser, base, seed) {
  const errors = [];
  const page = await openPage(browser, base, 'highway', errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), seed);
  await page.evaluate(launchLevel, ['highway', { car: 'hatch-rwd', ai: 5, traffic: 1.5,
    road: ROAD }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(`window.__lead = { t: 0, acrossFrames: 0, acrossMax: 0, readFrames: 0,
    racer: { s: 0, m: 0, held: 0, braked: 0 }, speeder: { s: 0, m: 0, held: 0, braked: 0 } };
    window.__leadTick = ${tickLeads.toString()};`);
  const settings = { agg: AGG, noRoad: NOROAD };
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepLeads, [Math.min(CHUNK, SECONDS * 60 - done), settings]);
  }
  const out = await page.evaluate(() => window.__lead);
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

/** One driver kind's line. */
function tallyLine(name, tally) {
  const km = tally.m / 1000;
  if (tally.s < 1) return `${name}: none`;
  return `${name} ${tally.s.toFixed(0)} car-s ${km.toFixed(1)} km ${(km * 3600 / tally.s)
    .toFixed(0)} km/h, held behind traffic ${(tally.held / Math.max(0.1, km)).toFixed(1)} s/km`
    + ` (${(100 * tally.held / tally.s).toFixed(1)} %), braking / lifting for it ${(tally.braked
      / Math.max(0.1, km)).toFixed(1)} s/km`;
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const seed of SEEDS) {
    const out = await runOne(browser, server.url, seed);
    console.log(`${ROAD} seed ${seed}${AGG == null ? '' : ' AGG ' + AGG}${NOROAD ? ' NOROAD' : ''}`
      + `: ${tallyLine('racers', out.racer)} | ${tallyLine('speeders', out.speeder)} | lead (a):`
      + ` other-way cars handed to racers in ${out.acrossFrames} of ${out.readFrames} reads (most`
      + ` ${out.acrossMax})${out.errors.length ? ' | ERR ' + out.errors[0] : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}
