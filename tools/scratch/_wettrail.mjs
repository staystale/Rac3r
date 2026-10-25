// _wettrail.mjs - WET TRAILS ON DRY TARMAC (owner): the autopilot round a wet circuit
// (?rain=X); every 0.1 s each wheel's mark (marks.js wheelsOf) is checked against the ground
// under THAT wheel (wear.ts groundAt): 'false' = a wet trail where the wheel's own ground is not
// wet, 'missed' = wet ground under the wheel and no trail.
// node tools/scratch/_wettrail.mjs [level] [rain] [seconds]
// node tools/scratch/_wettrail.mjs puddle   - dry weather, the Lab's sample puddle: the car rolled
//   across it with one side through it, every frame: wet trails laid where the wheel is on DRY
//   ground (no water, not damp) = false trails
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'castle-cum', rain = process.argv[3] || '0.5';
const seconds = +(process.argv[4] || 40);
const server = await startServer();
if (process.argv[2] === 'puddle') {
  const browser = await launchBrowser();
  try {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
    await page.mouse.click(422, 195);
    const res = await page.evaluate(async () => {
      const game = window.__game, { LEVEL } = await import('/src/world/state.ts');
      const wear = await import('/src/world/wear.ts'), surf = await import('/src/world/surfaces.ts');
      game.launch('lab', 'hatch-rwd', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
      await new Promise((done) => setTimeout(done, 1500));
      const puddles = (LEVEL.covers || []).filter((cover) => cover.cover === 'wet');
      const out = { puddles: puddles.length, runs: [] };
      for (const puddle of puddles) for (const side of [-1, 1]) {
        const car = game.car, half = (puddle.h || puddle.w) / 2;
        // across the puddle along +x, the car's centre line off its middle so one side is in it
        car.heading = 0; car.x = puddle.x - (puddle.w / 2 + 10); car.y = puddle.y + side * half;
        car.vx = 10; car.vy = 0; car.yawRate = 0;
        let frames = 0, laid = 0, falseTrail = 0;
        const start = performance.now();
        while (performance.now() - start < 3000) {
          await new Promise((done) => requestAnimationFrame(done));
          frames++;
          for (const wheel of game.marks.wheelsOf(car)) {
            if (wheel.mark !== surf.MARK_WET) continue;
            laid++;
            const ground = wear.groundAt(wheel.x, wheel.y).surface;
            if (ground.mark !== surf.MARK_WET && !ground.wetK) falseTrail++;
          }
        }
        out.runs.push({ side, frames, laid, falseTrail });
      }
      return out;
    });
    console.log('puddle: ' + JSON.stringify(res));
  } finally { await browser.close(); server.stop(); }
  process.exit(0);
}
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&rain=${rain}`);
  await page.mouse.click(422, 195);
  const res = await page.evaluate(async ([id, secs]) => {
    const game = window.__game;
    const wear = await import('/src/world/wear.ts'), surf = await import('/src/world/surfaces.ts');
    game.launch(id, 'hatch-rwd', { ai: 0 });
    await new Promise((done) => setTimeout(done, 6000));
    let wheels = 0, wetGround = 0, falseTrail = 0, missed = 0;
    const start = performance.now();
    while (performance.now() - start < secs * 1000) {
      await new Promise((done) => setTimeout(done, 100));
      if (Math.hypot(game.car.vx, game.car.vy) < 3) continue;
      for (const wheel of game.marks.wheelsOf(game.car)) {
        const own = wear.groundAt(wheel.x, wheel.y).surface.mark === surf.MARK_WET;
        const laid = wheel.mark === surf.MARK_WET;
        wheels++;
        if (own) wetGround++;
        if (laid && !own) falseTrail++;
        if (own && !laid) missed++;
      }
    }
    return { wheels, wetGround, falseTrail, missed };
  }, [level, seconds]);
  console.log(`${level} rain ${rain}: ${res.wheels} wheel samples, wet ground under ${res.wetGround};`
    + ` false trails ${res.falseTrail}, missed ${res.missed}`);
} finally {
  await browser.close();
  server.stop();
}
