// _c10shots.mjs - C10 photo (?openwheel=1): the player's F1 (Track spec) at Castle Cum, driven at
// 60 km/h so only its left front wheel meets a lone tree's trunk; 1.5 s later, at 390x844 and
// 844x390 (dpr 3): the wheel off, the loose tyre, the bare corner. Prints the wheels and damage.
// node tools/scratch/_c10shots.mjs [query]   -> shots/look/c10-<port|land>.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const query = process.argv[2] ?? '&openwheel=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0${query}`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.launch('castle-cum', 'track-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      const { LEVEL } = await import('/src/world/state.ts');
      const g = window.__game, car = g.car;
      const tree = LEVEL.solids.find((s) => s.kind === 'tree' && LEVEL.solids.every((o) =>
        o === s || Math.hypot(o.x - s.x, o.y - s.y) > 12));
      Object.assign(car, { x: tree.x - 6, y: tree.y - 1.2, heading: 0, vx: 16.7, vy: 0, yawRate: 0 });
      g.input.update = () => ({ steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
      if (g.renderer.snap) g.renderer.snap(car);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/look/c10-${tag}.png` });
    const state = await page.evaluate(() => {
      const car = window.__game.car;
      return { wheelOff: car.wheelOff ? car.wheelOff.map(Number).join('') : '-',
        dmg: car.dmg ? car.dmg.map((d) => d.toFixed(2)).join(' ') : '-' };
    });
    console.log(tag, JSON.stringify(state), '| page errors:', errors.length ? errors.join(' / ') : 'none');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
