// _cabglass.mjs - ?cabglass: the lorries', vans' and buses' side windows on a REAL roll
// (roll.ts startRoll, as a side impact starts one, the car sliding sideways at SLIDE_MS) on Deaf
// Valley's road at the game's own zoom: each vehicle rolled until it lies on its side (phase
// 'side'), the game paused there and photographed; tries again (a fresh launch) when it lands on
// its wheels or roof. Photos tools/scratch/cabglass/<id>-<view>-<day|night>-<on|off>.png (device
// scale 2), and -close.png: the same frame clipped round the car.
// [VIEW=844x390] [NIGHT=1] [IDS=a,b] node tools/scratch/_cabglass.mjs [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const extra = process.argv[2] ?? '&cabglass=1';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const isNight = !!process.env.NIGHT;
const IDS = (process.env.IDS || 'scanyah-r450,transfit-van,transfit-lwb,transfit-custom,'
  + 'transfit-swb,effing-tt,tractor,skool-bus,routemonster').split(',');
const SLIDE_MS = 9, TRIES = 6;
const OUT = 'tools/scratch/cabglass';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`
    + `${isNight ? '&night=0.8' : ''}${extra}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(1000);
  for (const id of IDS) {
    let landed = 'none';
    for (let tryNo = 1; tryNo <= TRIES && landed !== 'side'; tryNo++) {
      await page.evaluate((carId) => window.__game.launch('highway', carId, { ai: 0, traffic: 0,
        road: 'motorway', scenery: 'canyon', weather: { mode: 'dry', season: 2, seed: 4 } }), id);
      await page.waitForTimeout(1500);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(500);
      landed = await page.evaluate(async ([slide, dir]) => {
        const game = window.__game, car = game.car;
        const { startRoll } = await import('/src/roll.ts');
        const { shared } = await import('/src/game/state.ts');
        // sliding sideways, the roll started as a side impact starts it
        car.vx = -Math.sin(car.heading) * slide * dir;
        car.vy = Math.cos(car.heading) * slide * dir;
        startRoll(car, dir, slide);
        for (let waited = 0; waited < 12000; waited += 50) {
          await new Promise((done) => setTimeout(done, 50));
          const phase = car.roll?.phase ?? 'none';
          if (phase !== 'rolling') {
            if (phase === 'side') shared.paused = true;
            return phase;
          }
        }
        return 'still rolling';
      }, [SLIDE_MS, tryNo % 2 ? 1 : -1]);
    }
    if (landed === 'side') {
      await page.waitForTimeout(400);
      const name = `${OUT}/${id}-${width}x${height}-${isNight ? 'night' : 'day'}`
        + `-${extra.includes('cabglass') ? 'on' : 'off'}`;
      await page.screenshot({ path: `${name}.png` });
      const spot = await page.evaluate(() => {
        const game = window.__game, view = game.renderer;
        return { x: view.toScreenX(game.car.x), y: view.toScreenY(game.car.y) };
      });
      const half = 90;
      await page.screenshot({ path: `${name}-close.png`, clip: {
        x: Math.max(0, Math.min(width - 2 * half, spot.x - half)),
        y: Math.max(0, Math.min(height - 2 * half, spot.y - half)), width: 2 * half,
        height: 2 * half } });
      await page.evaluate(async () => {
        const { shared } = await import('/src/game/state.ts');
        shared.paused = false;
      });
    }
    console.log(`${id}: ${landed === 'side' ? 'on its side - photographed' : 'never on its side ('
      + landed + ')'}`);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
