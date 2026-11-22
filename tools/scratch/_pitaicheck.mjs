// _pitaicheck.mjs - ?pitstops step 2 in the real game (deterministic, the browser): (1) THE LIMITER
// DRIVEN - your car put on the pit lane at 30 m/s with the throttle held flat: its speed each
// second for 4 s (the limit 60 km/h); (2) THE AI'S STOPS - an F1 race VS AI over LAPS laps at a
// venue with a pit lane (the compulsory stop: a dry F1 race), your car on the demo driver: per AI
// car the stops made (the lap, the s it stood in its box), the missed-stop penalty at the end, the
// game's put-backs (a jump of 15 m+ in one frame); the finish order with the penalties.
// node tools/scratch/_pitaicheck.mjs [level] [ai] [laps] [seed]
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel, installDriver } from '../lib/determinism.mjs';

const [level = 'brands-snatch', aiArg = '5', lapsArg = '4', seedArg = '1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  const page = await openPage(browser, server.url, level, errors, '&pitstops=1');
  await page.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); window.__rt.step(10); });
  await page.evaluate((value) => window.__rt.seed(value), +seedArg);
  await page.evaluate(launchLevel, [level, { car: 'track-rwd', ai: +aiArg, laps: +lapsArg, pits: true }]);
  await page.evaluate(() => window.__rt.step(60 * 8));
  // (1) the limiter, driven
  const speeds = await page.evaluate(async () => {
    const game = window.__game, pits = game.level.pits;
    const geo = await import('/src/world/venuegeo.ts');
    const len = geo.lineLength(pits.pts), mid = geo.pointAlong(pits.pts, len * 0.1),
      ahead = geo.pointAlong(pits.pts, len * 0.1 + 1);
    const heading = Math.atan2(ahead.y - mid.y, ahead.x - mid.x);
    const keep = game.input.update;
    Object.assign(game.car, { x: mid.x, y: mid.y, heading, vx: 30 * Math.cos(heading),
      vy: 30 * Math.sin(heading), yawRate: 0 });
    game.car._p = null;
    game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
    const out = [];
    for (let s = 0; s < 4; s++) {
      window.__rt.step(60);
      out.push([Math.hypot(game.car.vx, game.car.vy) * 3.6, !!game.pitLimiter]);
    }
    game.input.update = keep;
    game.reset();
    return out;
  });
  console.log(`${level}: the limiter, throttle flat from 108 km/h on the pit lane: `
    + speeds.map(([kmh, light], i) => `${i + 1} s ${kmh.toFixed(0)} km/h${light ? '' : ' (off the lane)'}`).join(', '));
  // (2) the AI's stops
  await page.evaluate(installDriver);
  await page.evaluate(() => {
    window.__pits = new Map();
    window.__pitTick = () => {
      const game = window.__game;
      for (const entry of game.ai) {
        const car = entry.car, pit = entry.drv.state.pit;
        let rec = window.__pits.get(car);
        if (!rec) { rec = { stops: [], in: false, from: 0, putBacks: 0, x: car.x, y: car.y }; window.__pits.set(car, rec); }
        if (Math.hypot(car.x - rec.x, car.y - rec.y) > 15) rec.putBacks++;
        rec.x = car.x; rec.y = car.y;
        const t = game.flow ? game.flow.t : 0;
        const inBox = pit && pit.phase === 'stopped';
        if (inBox && !rec.in) rec.from = t;
        if (!inBox && rec.in) rec.stops.push({ lap: Math.floor((car._prog || 0) / game.level.subtrack.totalDist) + 1, s: t - rec.from });
        rec.in = inBox;
      }
    };
  });
  let done = false;
  for (let chunk = 0; chunk < 60 && !done; chunk++) {
    done = await page.evaluate(() => {
      for (let f = 0; f < 600; f++) { window.__rt.step(1); window.__pitTick(); }
      return !!window.__game.flow && window.__game.flow.state === 'done';
    });
  }
  const out = await page.evaluate(() => {
    const game = window.__game;
    const rows = game.ai.map((entry, i) => {
      const rec = window.__pits.get(entry.car) || { stops: [], putBacks: 0 };
      return { i: i + 1, box: entry.car._pitBox, skill: entry.drv.traits.skill, stops: rec.stops,
        pen: entry.car._pitPen || 0, putBacks: rec.putBacks };
    });
    const results = (game.flow?.results || []).map((row) => `${row.pos}. #${row.num}${row.player ? ' (you)' : ''}`
      + ` ${row.total.toFixed(1)} s${row.penalty ? ' (+' + row.penalty + ' s)' : ''}`);
    return { rows, results, state: game.flow?.state };
  });
  for (const row of out.rows) {
    console.log(`  AI ${row.i} (box ${row.box}, skill ${row.skill.toFixed(2)}): stops ${row.stops.length ? row.stops.map((stop) => `lap ${stop.lap}, ${stop.s.toFixed(1)} s in the box`).join('; ') : 'none'} | penalty ${row.pen} s | put-backs ${row.putBacks}`);
  }
  console.log(`  race ${out.state}; results: ${out.results.join(' | ')}`);
  console.log(`  page errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
