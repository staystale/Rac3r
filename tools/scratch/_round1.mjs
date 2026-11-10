// _round1.mjs - THE OWNER'S LIST, ROUND 1 (11-10) in the live game at phone size, each with its
// switch: HUDON (a fresh device, the RICH difficulty: the minimap and the tyre / damage diagram on
// by themselves - a shot), RESETHAZARD (a reset on Snotterton: the hazard lights' timer, a shot at
// once and after 3.5 s), BUSHFLAT (a shot of Killder's bushes with the switch and
// without). Page errors printed.
// node tools/scratch/_round1.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
const open = async (query) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  return { page, context };
};
try {
  // HUDON: RICH (mode 3), a fresh device
  {
    const { page, context } = await open('&hudon=1');
    await page.evaluate(() => window.__game.launch('snotterton', 'hatch-rwd', { ai: 0, diff: 3 }));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tools/scratch/_round1-hudon.png' });
    console.log('hudon: shot (RICH, fresh device)');
    await context.close();
  }
  // RESETHAZARD
  {
    const { page, context } = await open('&resethazard=1');
    await page.evaluate(() => window.__game.launch('snotterton', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(3000);
    const left = await page.evaluate(() => {
      window.__game.reset();
      return Math.round((window.__game.car.hazardUntil || 0) - performance.now());
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tools/scratch/_round1-hazard.png' });
    await page.waitForTimeout(3200);
    const after = await page.evaluate(() => Math.round((window.__game.car.hazardUntil || 0)
      - performance.now()));
    console.log(`resethazard: ${left} ms of hazards after the reset; ${after} ms left 3.6 s on`);
    await context.close();
  }
  // BUSHFLAT
  for (const query of ['', '&bushflat=1']) {
    const { page, context } = await open(query);
    await page.evaluate(() => window.__game.launch('killder', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `tools/scratch/_round1-bush${query ? '-flat' : ''}.png` });
    await context.close();
  }
  console.log('bushflat: shots with and without');
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
