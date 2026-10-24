// _laneshuffle.mjs - A12 (owner: highway traffic "glitches sometimes? changes lane / shuffles into
// lane"): the real game, the highway with traffic, your car on autopilot (plus 3 AI racers), every
// traffic car sampled every 0.1 s. Counts, per minute and for cars ON SCREEN: lane-change ABORTS
// (trafficAcross.ts abortCross: the target lane flips back to where it came from), SIDEWAYS
// REVERSALS (its offset across the road moving one way then the other, by more than 0.3 m), and
// JUMPS when a car changes between carried (kinematic) and driven (physics). Each reversal is
// put down to an abort, a lane change, the lean away from you, or none of those.
// node tools/scratch/_laneshuffle.mjs [seconds] [traffic 0..1.5] [extra query]   (CLEAN=1: leave
// hit / wrecked cars out)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const seconds = +(process.argv[2] || 90), density = +(process.argv[3] || 1);
const extra = process.argv[4] ? '&' + process.argv[4] : '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${extra}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(2000);
  const samples = await page.evaluate(sample, [seconds, density]);
  report(samples, seconds);
} finally {
  await browser.close();
  server.stop();
}

/**
 * Page side: launch the highway with traffic and 3 AI, drive with the autopilot, and sample
 * every traffic car every 0.1 s.
 * @param {[number, number]} args seconds to sample, traffic density
 * @returns {Promise<object[][]>} per tick, per car: id, off, lane, laneT, phys, onScreen
 */
async function sample([secs, trafficDensity]) {
  const game = window.__game, { shared } = await import('/src/game/state.js');
  const { onScreen } = await import('/src/game/session.js');
  game.launch('highway', 'saloon-rwd', { ai: 3, diff: 2, traffic: trafficDensity });
  shared.settings.autopilot = true;
  await new Promise((done) => setTimeout(done, 9000));
  const ids = new WeakMap();
  let next = 0;
  const ticks = [];
  for (let tick = 0; tick < secs * 10; tick++) {
    await new Promise((done) => setTimeout(done, 100));
    ticks.push(game.traffic.list.map((slot) => {
      if (!ids.has(slot)) ids.set(slot, next++);
      return { id: ids.get(slot), off: slot.off, lane: slot.lane, laneT: slot.laneT, s: slot.s,
        x: slot.car.x, y: slot.car.y, speed: Math.hypot(slot.car.vx, slot.car.vy),
        hurt: !!slot.wreck || !!(slot.car.dmg && slot.car.dmg.some((part) => part > 0.02)),
        phys: slot.phys, bias: slot.bias, seen: onScreen(slot.car.x, slot.car.y) };
    }));
  }
  return ticks;
}

/**
 * Prints the counts.
 * @param {object[][]} ticks the samples
 * @param {number} secs how long
 */
function report(ticks, secs) {
  const last = new Map();
  let aborts = 0, reversals = 0, jumps = 0, pops = 0, appears = 0, changes = 0, tickNo = 0;
  const details = [];
  const cause = { abort: 0, laneChange: 0, lean: 0, none: 0 };
  for (const tick of ticks) {
    tickNo++;
    for (const now of tick) {
      const before = last.get(now.id);
      // a hit or wrecked car (CLEAN=1 leaves them out: crashes are not the glitch)
      if (process.env.CLEAN && now.hurt) {
        last.delete(now.id);
        continue;
      }
      if (!before && now.seen && tickNo > 1) {
        appears++;
        details.push(`t ${(tickNo / 10).toFixed(1)} car ${now.id} APPEARS on screen`);
      }
      if (before && now.seen && now.laneT !== now.lane && before.laneT === before.lane) changes++;
      if (before && now.seen && Math.abs(now.off - before.off) > 0.6) {
        pops++;
        details.push(`t ${(tickNo / 10).toFixed(1)} car ${now.id} POP ${before.off.toFixed(2)} ->`
          + ` ${now.off.toFixed(2)} m (lane ${before.lane}->${now.lane}, target ${now.laneT},`
          + ` phys ${before.phys}->${now.phys}; moved ${Math.hypot(now.x - before.x,
            now.y - before.y).toFixed(1)} m in the world at ${now.speed.toFixed(1)} m/s,`
          + ` road s ${before.s.toFixed(0)}->${now.s.toFixed(0)})`);
      }
      if (before && now.seen) {
        const step = now.off - before.off;
        // an abort: the target swaps with the lane (abortCross swaps them)
        const isAbort = before.laneT !== before.lane && now.lane === before.laneT
          && now.laneT === before.lane;
        if (isAbort) aborts++;
        if (now.phys !== before.phys && Math.abs(step) > 0.5) jumps++;
        const dir = Math.abs(step) > 0.03 ? Math.sign(step) : 0;
        if (dir && before.dir && dir !== before.dir && Math.abs(now.off - before.turnOff) > 0.3) {
          reversals++;
          const crossing = now.laneT !== now.lane || before.laneT !== before.lane;
          const why = isAbort || before.abortT > 0 ? 'abort' : crossing ? 'laneChange'
            : Math.abs(now.bias) > 0.05 ? 'lean' : 'none';
          cause[why]++;
          details.push(`t ${(tickNo / 10).toFixed(1)} car ${now.id} REVERSES at ${now.off.toFixed(2)} m`
            + ` (swing ${Math.abs(now.off - before.turnOff).toFixed(2)}, ${why}, lane ${now.lane}`
            + ` target ${now.laneT}, bias ${now.bias.toFixed(2)}, phys ${now.phys})`);
        }
        now.dir = dir || before.dir;
        now.turnOff = dir && dir !== before.dir ? before.off : before.turnOff;
        now.abortT = isAbort ? 10 : (before.abortT || 0) - 1;
      } else {
        now.dir = 0;
        now.turnOff = now.off;
        now.abortT = 0;
      }
      last.set(now.id, now);
    }
  }
  const perMin = (count) => (count / (secs / 60)).toFixed(1);
  console.log(`${secs} s of highway, traffic on screen: aborts ${aborts} (${perMin(aborts)}/min),`
    + ` sideways reversals ${reversals} (${perMin(reversals)}/min), carried<->driven jumps`
    + ` ${jumps}`);
  console.log(`reversals by cause: ${JSON.stringify(cause)}; lane changes started on screen`
    + ` ${changes}; sideways pops > 0.6 m in 0.1 s ${pops}; cars appearing on screen ${appears}`);
  for (const line of details.slice(0, 40)) console.log('  ' + line);
}
