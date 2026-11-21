// _trailershot.mjs - THE SCANYAH AND ITS TRAILER in the game (?trailer, the Lab, dry): in line at
// rest, driven round a left-hand circle (the keys held), folded to a 60 deg hitch, and at night,
// at 844x390 and 390x844 - how the trailer, its axle group's wheels and the pin read; 'parts': its
// own crash parts knocked off (a curtain each side, the rear doors, the under-run bar, a mudguard:
// world/debris.ts crashDebris with every chance taken), thrown and the trailer drawn without them,
// by day and at night ('partsnight'); 'nightlit': at night, the lights on and the brake held, then
// the hazards (the rig's rear lamps on the trailer: render/riglamps.ts). Nothing is changed.
// node tools/scratch/_trailershot.mjs  OUT=<folder>  SCENES=line,circle,fold,night,parts,partsnight
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.env.OUT || 'tools/scratch';
const SIZES = [{ name: '844x390', width: 844, height: 390 }, { name: '390x844', width: 390,
  height: 844 }];
const SCENES = (process.env.SCENES || 'line,circle,fold,night').split(',');
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const scene of SCENES) for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&trailer=1`
      + (scene.includes('night') ? '&night=0.9' : ''));
    await page.mouse.click(size.width / 2, size.height / 2);
    await page.waitForTimeout(1200);
    await page.evaluate(async (which) => {
      const game = window.__game;
      game.launch('lab', 'scanyah-r450', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
      await new Promise((done) => setTimeout(done, 1500));
      // (out on the open tarmac, clear of the start's posts: the 13.6 m trailer behind a car's
      // start spot reaches them)
      const car = game.car;
      car.x += 80; car.y += 20;
      await new Promise((done) => setTimeout(done, 300));
    }, scene);
    if (scene === 'circle') {
      // (the input held: full throttle to ~15 km/h, then half throttle and left lock)
      await page.evaluate(() => {
        const game = window.__game;
        game.input.update = () => {
          const fast = Math.hypot(game.car.vx, game.car.vy) > 4;
          return { steer: fast ? -0.5 : 0, throttle: fast ? 0.3 : 1, brake: 0, handbrake: 0,
            reverse: 0, shiftUp: false, shiftDown: false };
        };
      });
      await page.mouse.click(size.width / 2, size.height / 2);
      await page.waitForTimeout(22000);
    }
    if (scene === 'nightlit') {
      await page.evaluate(async () => {
        const game = window.__game;
        game.car.lightsOn = true;
        game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
          shiftUp: false, shiftDown: false });
        await new Promise((done) => setTimeout(done, 800));
      });
    }
    if (scene.startsWith('parts')) {
      await page.evaluate(async () => {
        const game = window.__game, trailer = game.car.trailer;
        const { crashDebris } = await import('/src/world/debris.ts');
        // (side-on at the front corners: the curtains; end-on at the back: the doors, the bar;
        // a corner hit at the back: the mudguard)
        for (const [corner, endW] of [[0, 0], [1, 0], [2, 1], [3, 1], [3, 0.5], [2, 0]]) {
          crashDebris(trailer, corner, 1, endW, () => 0);
        }
        await new Promise((done) => setTimeout(done, 1500));
      });
    }
    const info = await page.evaluate(async (which) => {
      const game = window.__game, car = game.car, trailer = car.trailer;
      if (!trailer) return 'NO TRAILER';
      if (which === 'fold') {
        const pinX = trailer.x + Math.cos(trailer.heading) * trailer.spec.lf,
          pinY = trailer.y + Math.sin(trailer.heading) * trailer.spec.lf;
        trailer.heading += 60 * Math.PI / 180;
        trailer.x = pinX - Math.cos(trailer.heading) * trailer.spec.lf;
        trailer.y = pinY - Math.sin(trailer.heading) * trailer.spec.lf;
        await new Promise((done) => setTimeout(done, 400));
      }
      const hitch = Math.atan2(Math.sin(trailer.heading - car.heading),
        Math.cos(trailer.heading - car.heading)) * 180 / Math.PI;
      if (which.startsWith('parts')) return `lost ${trailer.partLost}; on the ground ${
        game.cones.list.filter((obj) => obj.part).map((obj) => obj.kind).join(' ')}`;
      return `hitch ${hitch.toFixed(1)} deg, gap ${((trailer.pinGap || 0) * 100).toFixed(2)} cm, `
        + `${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)} km/h`;
    }, scene);
    const file = `${OUT}/_trailershot-${scene}-${size.name}.png`;
    await page.screenshot({ path: file });
    console.log(`${file}: ${info}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
