// _nanwear.mjs - ?stopdodge=1's guard (b): a recovery (game/sim.ts recoverCar) with a NaN tyre wear;
// prints the wear after it, without and with the switch. CHECK_PORT as the browser tools.
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const extra of ['', '&stopdodge=1']) {
    const errors = [];
    const page = await openPage(browser, server.url, 'thruston', errors, '&skip=world,ground,car' + extra);
    await page.evaluate(launchLevel, ['thruston', { ai: 0 }]);
    await page.waitForTimeout(SETTLE_MS);
    const wear = await page.evaluate(async () => {
      const sim = await import('/src/game/sim.ts');
      const car = window.__game.car;
      car.tyreWear = [Number.NaN, 0.2, 0.3, Number.NaN];
      car.tyreWearStart = [0.1, 0.2, 0.3, 0.4];
      sim.recoverCar('test');
      return car.tyreWear;
    });
    console.log(`${extra || 'plain'}: wear after the recovery ${JSON.stringify(wear)}`);
    await page.context().close();
  }
} finally {
  await browser.close();
  server.stop();
}
