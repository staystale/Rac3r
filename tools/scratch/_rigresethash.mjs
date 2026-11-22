// _rigresethash.mjs - THE RIG'S RESET, DETERMINISTIC (a pass's proof: old with ?trailreset == new
// plain): the real game seeded on its fake clock, nothing drawn, the Scanyah and its trailer on
// each circuit; the rig put down still 5 m outside the lap's tightest bend, RESET pressed, one
// frame stepped; the tractor's and the trailer's place and heading, printed to the last digit, and
// one hash of them all. The switches through RAC3R_QUERY.
// [LEVELS=thruston,brands-snatch,knobhill,moanaco] node tools/scratch/_rigresethash.mjs
import { createHash } from 'node:crypto';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const LEVELS = (process.env.LEVELS || 'thruston,brands-snatch,knobhill,moanaco').split(',');
const SKIP = '&skip=world,ground,car' + extraQuery();

/** Page side: the rig 5 m outside the tightest bend, still; then RESET. */
async function putAndReset() {
  const game = window.__game, car = game.car, sub = game.level.subtrack;
  const pts = sub.pts, count = pts.length;
  let tight = 0, least = Infinity;
  for (let i = 0; i < count; i++) {
    const a = pts[(i - 4 + count) % count], b = pts[i], c = pts[(i + 4) % count];
    const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(c.y - b.y, c.x - b.x)
      - Math.atan2(b.y - a.y, b.x - a.x)), Math.cos(Math.atan2(c.y - b.y, c.x - b.x)
      - Math.atan2(b.y - a.y, b.x - a.x))));
    const radius = Math.hypot(c.x - a.x, c.y - a.y)
      / Math.max(1e-6, 2 * Math.sin(turn / 2 || 1e-6));
    if (radius < least) { least = radius; tight = i; }
  }
  const { onTrack } = await import('/src/world/tyrewall.ts');
  const { reset } = await import('/src/vehicle.ts');
  const at = pts[tight], next = pts[(tight + 4) % count], prev = pts[(tight - 4 + count) % count];
  const cross = (at.x - prev.x) * (next.y - at.y) - (at.y - prev.y) * (next.x - at.x);
  const spot = onTrack(sub, at.dist, cross > 0 ? -5 : 5, {});
  reset(car, spot.x, spot.y, spot.rot);
  game.reset();
  return least;
}

/** Page side: the rig now. */
function readRig() {
  const car = window.__game.car, trailer = car.trailer;
  const pose = (body) => (body ? [body.x, body.y, body.heading] : null);
  return { tractor: pose(car), trailer: pose(trailer) };
}

const server = await startServer();
const browser = await launchBrowser();
const all = createHash('sha256');
try {
  for (const level of LEVELS) {
    const errors = [];
    const page = await openPage(browser, server.url, level, errors, SKIP);
    await page.evaluate(() => window.__rt.seed(1));
    await page.evaluate(launchLevel, [level, { car: 'scanyah-r450', ai: 0 }]);
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(() => window.__rt.step(60));
    const radius = await page.evaluate(`(${putAndReset.toString()})()`);
    await page.evaluate(() => window.__rt.step(1));
    const rig = await page.evaluate(`(${readRig.toString()})()`);
    const line = JSON.stringify(rig);
    all.update(level + line);
    console.log(`${level} (bend ${radius.toFixed(1)} m): ${line}`
      + (errors.length ? ' ERR ' + errors[0] : ''));
    await page.close();
  }
  console.log('rigresethash: ' + all.digest('hex').slice(0, 16));
} finally {
  await browser.close();
  server.stop();
}
