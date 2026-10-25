// _bushtufts.mjs - photos of bush tufts over cars (?bushes=1): the car parked inside the biggest
// bushes of a few levels, close up, at 844x390 and 390x844; and the same bush after it is
// flattened (no tufts left).
// node tools/scratch/_bushtufts.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();

async function open(level, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&bushes=1`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(2500);
  return { context, page };
}

// parks the car in the rank-th biggest bush, the car's nose half way through it
const parkIn = (page, rank, along) => page.evaluate(([which, shift]) => {
  const state = window.__game && window.__game.level;
  return { which, shift, state: !!state };
}, [rank, along]).then(() => page.evaluate(async ([which, shift]) => {
  const st = await import('/src/world/state.ts');
  const list = [...(st.LEVEL._bushes || [])].sort((left, right) => right.w - left.w);
  const bush = list[Math.min(which, list.length - 1)];
  const car = window.__game.car;
  car.x = bush.x + shift; car.y = bush.y; car.heading = 0.3; car.vx = 0; car.vy = 0;
  car.yawRate = 0;
  window.__game.renderer.debugZoom(1.6);
  return { x: bush.x, y: bush.y, side: bush.w, art: bush.art };
}, [rank, along]));

try {
  for (const level of ['castle-cum', 'killder', 'stage-col-de-fromage']) {
    const { context, page } = await open(level, { width: 844, height: 390 });
    for (const [rank, along] of [[0, 0], [3, 1.2]]) {
      console.log(level, JSON.stringify(await parkIn(page, rank, along)));
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, `tuft-${level}-${rank}.png`) });
    }
    await context.close();
  }
  const { context, page } = await open('killder', { width: 390, height: 844 });
  await parkIn(page, 1, 0.6);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, 'tuft-killder-portrait.png') });
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
