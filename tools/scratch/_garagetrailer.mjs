// _garagetrailer.mjs - ?trailer: the garage's TRAILER row for the Scanyah (menu/garage.ts), through
// the real menus: TEST MODE -> TEST GROUNDS -> the Lab -> GARAGE, the row photographed as it is and
// after a tap (WITHOUT), then LAUNCH: whether the tractor is towing; then the row back to the
// curtainsider and LAUNCH again. At 844x390 and 390x844. node tools/scratch/_garagetrailer.mjs <dir>
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/garagetrailer'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();

/**
 * One size: the garage row, a launch without, a launch with.
 * @param width CSS px
 * @param height CSS px
 */
async function runSize(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('carsim.profile.v1', JSON.stringify({ active: 'scanyah-r450',
        lastLevel: 'lab' }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  const tap = async (text) => {
    const button = page.locator('#menu button', { hasText: text }).first();
    await button.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(900);
    await button.tap({ timeout: 8000 });
  };
  const tag = `${width}x${height}`, results = [];
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1&trailer=1`);
  await page.waitForTimeout(3000);
  await tap('TEST MODE');
  await tap(/^TEST GROUNDS/);
  await tap('OG Lab');
  for (const want of ['WITHOUT', 'CURTAINSIDER']) {
    await tap('GARAGE');
    await page.waitForTimeout(800);
    for (let tries = 0; tries < 3; tries++) {
      const row = await page.locator('#menu button', { hasText: /^TRAILER/ }).first().textContent();
      if (row.includes(want)) break;
      await tap(/^TRAILER/);
      // (a menu button acts after its press blink)
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: `${OUT}/garage-${want.toLowerCase()}-${tag}.png` });
    const rowText = await page.locator('#menu button', { hasText: /^TRAILER/ }).first()
      .textContent();
    await tap(/^SELECT/);
    await tap('LAUNCH');
    await page.waitForTimeout(3000);
    const towing = await page.evaluate(() => {
      const car = window.__game.car;
      return { car: car.spec.id, trailer: car.trailer ? 'hitched' : String(car.trailer) };
    });
    await page.screenshot({ path: `${OUT}/launch-${want.toLowerCase()}-${tag}.png` });
    results.push(`${rowText} -> ${JSON.stringify(towing)}`);
    // back to the setup: pause, TRACK SELECT, the Lab again
    const pause = await page.evaluate(() => window.__game.hudLayout().help);
    await page.touchscreen.tap(pause.x + pause.w / 2, pause.y + pause.h / 2);
    await tap('TRACK SELECT');
    await tap(/^TEST GROUNDS/);
    await tap('OG Lab');
  }
  console.log(tag, results.join(' | '), errors.length ? 'ERRORS ' + errors.join(' | ')
    : 'errors none');
  await context.close();
}

try {
  for (const [width, height] of [[844, 390], [390, 844]]) await runSize(width, height);
} finally {
  await browser.close();
  server.stop();
}
