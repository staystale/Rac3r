// _hwdodgeshot.mjs - BUG 10 (?hwdodge=1) PHOTOS: a highway race on the twisty single lane with traffic,
// drawn, your car on ?autopilot. Watches for a racer on screen that is over the road's middle line
// while its driver keeps it to its side for an oncoming car (drv.state.keepMax set), and photographs
// it then and 1 s later (back in its lane). Up to 3 pairs; gives up after 150 s.
// SHOTS=<folder> VIEW=844x390 [RAC3R_QUERY=hwdodge=1] node tools/scratch/_hwdodgeshot.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const SHOTS = process.env.SHOTS || 'hwdodgeshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);

/** Page side: a racer on screen over the middle line and kept to its side, or null. */
async function findCase() {
  const { onScreen } = await import('/src/game/session.ts');
  const game = window.__game, geo = game.level._hw.geo;
  for (const entry of game.ai) {
    const car = entry.car, state = entry.drv.state;
    if (!Number.isFinite(state.keepMax) || !car._hwf || !onScreen(car.x, car.y)) continue;
    const over = car._hwf.off - (geo.oppL - car.spec.wid / 2);
    const other = state.oncomingCar;
    if (over > 0.3 && other && other._hwf) {
      return { num: car.num, over: +over.toFixed(1), ahead: +(other._hwf.s - car._hwf.s).toFixed(0) };
    }
  }
  return null;
}

mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
    + `&autopilot=1${extraQuery()}`);
  await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 5, traffic: 1.5, road: 'twisty' }));
  let pairs = 0;
  for (let tries = 0; tries < 1500 && pairs < 3; tries++) {
    await page.waitForTimeout(100);
    const found = await page.evaluate(findCase);
    if (!found) continue;
    const name = `${SHOTS}/hwdodge-${pairs + 1}-${VIEW_W}x${VIEW_H}`;
    await page.screenshot({ path: `${name}-a.png` });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${name}-b.png` });
    console.log(`${name}: racer #${found.num} ${found.over} m over the middle, the oncoming car`
      + ` ${found.ahead} m ahead`);
    pairs++;
    await page.waitForTimeout(4000);
  }
  if (!pairs) console.log('no case found in 150 s');
} finally {
  await browser.close();
  server.stop();
}
