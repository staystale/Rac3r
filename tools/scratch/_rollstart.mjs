// _rollstart.mjs - A3 / A4 (owner: "the cars weave sometimes oddly / crash before the race even
// starts / start off set including the player"; "they wiggle near the start / finish" on the
// oval and stock car): the real game, VS AI x5 through the launch path, sampled every 0.1 s from
// launch to 25 s after the green. Per car: the side-to-side swing (sign flips of the sideways
// speed across the road, with the swing size), the closest box gap to another car, contact, and
// how far each car is from its own column before the green.
// node tools/scratch/_rollstart.mjs [levels,comma] [runs] [extra query, e.g. formation=1]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const levels = (process.argv[2] || 'naffcar,stock-car').split(',');
const runs = +(process.argv[3] || 2);
// s sampled after the green (env AFTER; A4 wants several laps)
const AFTER_S = +(process.env.AFTER || 25);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, srv.url + '/?pc=1&guide=0&menu=0&noaudio=1'
    + (process.argv[4] ? '&' + process.argv[4] : ''));
  // the no-menu mode waits for a tap
  await page.mouse.click(400, 200);
  await page.waitForTimeout(2500);
  for (const levelId of levels) {
    for (let run = 0; run < runs; run++) {
      const result = await page.evaluate(sampleRun, [levelId, AFTER_S]);
      report(levelId, run, result);
    }
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally {
  await browser.close();
  srv.stop();
}

/**
 * Page side: launch the level with 5 AI and sample every car until 25 s after the green.
 * @param {[string, number]} args the level and the s to sample after the green
 * @returns {Promise<object>} the samples
 */
async function sampleRun([levelId, afterS]) {
  const game = window.__game, lab = await import('/src/lab.js');
  game.launch(levelId, game.car.spec.id, { ai: 5, diff: 2 });
  await new Promise((done) => setTimeout(done, 300));
  const sub = lab.LEVEL.subtrack, cars = () => [game.car, ...game.ai.map((entry) => entry.car)];
  const pose = (car) => {
    const near = lab.querySubtrack(sub, car.x, car.y), point = sub.pts[near.seg ?? 0];
    const off = point ? (car.x - point.x) * point.nx + (car.y - point.y) * point.ny : 0;
    const across = point ? car.vx * point.nx + car.vy * point.ny : 0;
    return { d: near.trackDist, off, across, speed: Math.hypot(car.vx, car.vy),
      hurt: Object.values(car.dmg || {}).reduce((sum, value) => sum + (+value || 0), 0) };
  };
  const gap = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist,
      uy = dy / dist;
    const ext = (car) => Math.abs(Math.cos(car.heading) * ux + Math.sin(car.heading) * uy)
      * car.spec.len / 2 + Math.abs(-Math.sin(car.heading) * ux + Math.cos(car.heading) * uy)
      * car.spec.wid / 2;
    return dist - ext(a) - ext(b);
  };
  const samples = [];
  let greenAt = null;
  const slots = cars().map((car) => car._slot ?? game.ai.length);
  for (let tick = 0; tick < 300 + afterS * 10; tick++) {
    await new Promise((done) => setTimeout(done, 100));
    const all = cars();
    if (greenAt === null && game.start.green) greenAt = game.start.t;
    let minGap = Infinity, pair = '';
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const value = gap(all[i], all[j]);
      if (value < minGap) {
        minGap = value;
        pair = i + '-' + j;
      }
    }
    samples.push({ t: game.start.t, green: game.start.green, minGap, pair,
      cars: all.map(pose) });
    if (greenAt !== null && game.start.t > greenAt + afterS) break;
  }
  return { greenAt, slots, rolling: !!game.start.rolling, total: sub.totalDist,
    halfWidth: sub.width / 2, samples };
}

/**
 * Prints one run: before the green and after it, per car.
 * @param {string} levelId the level
 * @param {number} run the run's number
 * @param {object} result the page's samples
 */
function report(levelId, run, result) {
  const { samples, greenAt, slots } = result;
  console.log(`\n${levelId} run ${run}: rolling ${result.rolling}, green at ${greenAt?.toFixed(1)}`
    + ` s, half width ${result.halfWidth} m, slots ${slots.join(',')} (car 0 = YOU)`);
  for (const [label, keep] of [['BEFORE GREEN', (s) => !s.green],
    ['0-25 s AFTER', (s) => s.green]]) {
    const part = samples.filter(keep);
    if (!part.length) continue;
    const closest = part.reduce((best, s) => (s.minGap < best.minGap ? s : best));
    console.log(`  ${label}: ${part.length} samples, closest pair ${closest.pair}`
      + ` ${closest.minGap.toFixed(2)} m at t ${closest.t.toFixed(1)}`);
    const count = part[0].cars.length;
    for (let car = 0; car < count; car++) {
      let flips = 0, swing = 0, lastSign = 0, lastFlipOff = part[0].cars[car].off;
      const offs = part.map((s) => s.cars[car].off);
      for (const s of part) {
        const across = s.cars[car].across, sign = Math.abs(across) > 0.3 ? Math.sign(across) : 0;
        if (sign && lastSign && sign !== lastSign) {
          flips++;
          swing = Math.max(swing, Math.abs(s.cars[car].off - lastFlipOff));
          lastFlipOff = s.cars[car].off;
        }
        if (sign) lastSign = sign;
      }
      const hurt = part[part.length - 1].cars[car].hurt - part[0].cars[car].hurt;
      console.log(`    car ${car}${car ? '' : ' YOU'}: off ${Math.min(...offs).toFixed(1)}`
        + `..${Math.max(...offs).toFixed(1)} m, weave flips ${flips} (biggest swing`
        + ` ${swing.toFixed(1)} m), damage +${hurt.toFixed(2)}`);
    }
  }
  lineZoneReport(result);
}

/**
 * A4: each pass of each car through the start / finish zone (LINE_ZONE m either side of the line)
 * after the green, against the same zone round the far side of the lap (half a lap on): the mean
 * sideways swing a pass (the offset's range) and the mean sideways-speed flips a pass (the first
 * lap left out: the pack leaving the formation).
 * @param {object} result the page's samples
 */
function lineZoneReport(result) {
  const LINE_ZONE = 80, { total } = result;
  const after = result.samples.filter((s) => s.green && s.t > result.greenAt + 30);
  if (!after.length) return;
  for (const [label, centre] of [['START / FINISH', 0], ['FAR SIDE', total / 2]]) {
    const swings = [], flips = [];
    for (let car = 0; car < after[0].cars.length; car++) {
      let pass = null;
      for (const s of after) {
        let along = s.cars[car].d - centre;
        along -= Math.round(along / total) * total;
        if (Math.abs(along) < LINE_ZONE) {
          pass ??= { offs: [], flips: 0, lastSign: 0 };
          pass.offs.push(s.cars[car].off);
          const across = s.cars[car].across;
          const sign = Math.abs(across) > 0.3 ? Math.sign(across) : 0;
          if (sign && pass.lastSign && sign !== pass.lastSign) pass.flips++;
          if (sign) pass.lastSign = sign;
        } else if (pass) {
          swings.push(Math.max(...pass.offs) - Math.min(...pass.offs));
          flips.push(pass.flips);
          pass = null;
        }
      }
    }
    const mean = (list) => (list.reduce((sum, value) => sum + value, 0) / (list.length || 1));
    console.log(`  ${label} (+-${LINE_ZONE} m, laps 2+): ${swings.length} passes, swing mean`
      + ` ${mean(swings).toFixed(1)} m (max ${Math.max(0, ...swings).toFixed(1)}), flips mean`
      + ` ${mean(flips).toFixed(2)}`);
  }
}
