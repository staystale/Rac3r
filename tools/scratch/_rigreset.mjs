// _rigreset.mjs - ?trailer: THE RIG'S RESET (the R key) in the real game - on a circuit mid-race
// (Thruston, 3 AI, the rig driven a while) and on the Lab, each straight after driving and after a
// jack-knife (the trailer folded 70 deg about its pin); 'bend': the rig put down still at
// the lap's tightest bend, 5 m off the line on its outside (by the barrier); 'pinfree': its pin
// broken first. 0.6 s after the reset: the hitch angle, the
// pin's gap, whether the trailer touches a barrier or a solid (a still copy put through the
// world's clamps) or another car's body, the tractor's move; a photo each.
// node tools/scratch/_rigreset.mjs <dir> [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/rigreset', extra = ''] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const CASES = (process.env.CASES || 'thruston:3:drive,thruston:3:fold,lab:0:drive,lab:0:fold,'
  + 'thruston:3:bend,thruston:3:pinfree').split(',').map((one) => one.split(':'))
  .map(([level, ai, how]) => [level, +ai, how]);
const server = await startServer();
const browser = await launchBrowser();

/**
 * One case: drive, maybe fold, press R, read the rig.
 * @param level the level
 * @param ai the AI
 * @param how 'drive' or 'fold'
 * @returns its line
 */
async function runCase(level, ai, how) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&trailer=1${extra}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  await page.evaluate(async ([id, count]) => {
    const game = window.__game;
    game.launch(id, 'scanyah-r450', { ai: count, laps: 3,
      weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 2500));
    // (driven: the autodriver round the lap, else full throttle and a gentle left)
    const sub = game.level.subtrack;
    const driver = sub ? (await import('/src/ai/autodrive.ts')).createAutoDriver(sub) : null;
    game.input.update = () => (driver ? { ...driver.drive(game.car), reverse: 0, shiftUp: false,
      shiftDown: false } : { steer: -0.15, throttle: 0.7, brake: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
  }, [level, ai]);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(14000);
  const before = await page.evaluate(async (which) => {
    const game = window.__game, car = game.car, trailer = car.trailer;
    const fold = which === 'fold';
    if (which === 'pinfree' && trailer) trailer.pinFree = true;
    if (which === 'bend' && game.level.subtrack) {
      const sub = game.level.subtrack, pts = sub.pts, count = pts.length;
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
      const at = pts[tight], next = pts[(tight + 4) % count];
      const prev = pts[(tight - 4 + count) % count];
      // (the outside of the bend: away from the turn's centre)
      const cross = (at.x - prev.x) * (next.y - at.y) - (at.y - prev.y) * (next.x - at.x);
      const spot = onTrack(sub, at.dist, cross > 0 ? -5 : 5, {});
      reset(car, spot.x, spot.y, spot.rot);
      await new Promise((done) => setTimeout(done, 1200));
    }
    if (fold && trailer) {
      const pinX = trailer.x + Math.cos(trailer.heading) * trailer.spec.lf,
        pinY = trailer.y + Math.sin(trailer.heading) * trailer.spec.lf;
      trailer.heading += 70 * Math.PI / 180;
      trailer.x = pinX - Math.cos(trailer.heading) * trailer.spec.lf;
      trailer.y = pinY - Math.sin(trailer.heading) * trailer.spec.lf;
      await new Promise((done) => setTimeout(done, 300));
    }
    return { x: car.x, y: car.y, kph: Math.hypot(car.vx, car.vy) * 3.6 };
  }, how);
  await page.keyboard.press('r');
  await page.waitForTimeout(600);
  const after = await page.evaluate(async () => {
    const game = window.__game, car = game.car, trailer = car.trailer;
    if (!trailer) return { none: true };
    const { solidClamp, barrierClamp } = await import('/src/world/barriers.ts');
    const probe = { ...trailer, vx: 0, vy: 0, spec: { ...trailer.spec } };
    solidClamp(probe);
    barrierClamp(probe);
    const touches = Math.hypot(probe.x - trailer.x, probe.y - trailer.y) > 0.01;
    // (another car's body within the trailer's box, grown 0.3 m: its corners and middle)
    const cosH = Math.cos(trailer.heading), sinH = Math.sin(trailer.heading);
    const inside = (px, py) => {
      const dx = px - trailer.x, dy = py - trailer.y;
      return Math.abs(dx * cosH + dy * sinH) < trailer.spec.len / 2 + 0.3
        && Math.abs(-dx * sinH + dy * cosH) < trailer.spec.wid / 2 + 0.3;
    };
    const onCar = game.ai.some(({ car: other }) => {
      const oc = Math.cos(other.heading), os = Math.sin(other.heading);
      const hl = other.spec.len / 2, hw = other.spec.wid / 2;
      return [[0, 0], [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]].some(([al, ac]) =>
        inside(other.x + oc * al - os * ac, other.y + os * al + oc * ac));
    });
    const hitch = Math.atan2(Math.sin(trailer.heading - car.heading),
      Math.cos(trailer.heading - car.heading)) * 180 / Math.PI;
    return { hitch, gap: (trailer.pinGap || 0) * 100, touches, onCar, pinFree: !!trailer.pinFree,
      x: car.x, y: car.y, kph: Math.hypot(car.vx, car.vy) * 3.6 };
  });
  await page.screenshot({ path: `${OUT}/${level}-${how}.png` });
  await page.close();
  if (after.none) return `${level} ${how}: NO TRAILER`;
  return `${level} ${how}: before ${before.kph.toFixed(0)} km/h; after the reset hitch `
    + `${after.hitch.toFixed(1)} deg, pin gap ${after.gap.toFixed(2)} cm, pin ${after.pinFree
      ? 'BROKEN' : 'held'}, trailer ${after.touches ? 'TOUCHES a barrier / solid' : 'clear'}, `
    + `${after.onCar ? 'ON A CAR' : 'on no car'}, tractor moved `
    + `${Math.hypot(after.x - before.x, after.y - before.y).toFixed(1)} m, `
    + `${after.kph.toFixed(0)} km/h` + (errors.length ? ' ERRORS ' + errors[0] : '');
}

try {
  for (const [level, ai, how] of CASES) console.log(await runCase(level, ai, how));
} finally {
  await browser.close();
  server.stop();
}
