// _menurace.mjs - K2 + K8 (owner 11-01): the menu race. A saved profile with the F1 active in a
// livery; the menu opened (?menu=1); the camera car's id, then its corners wrecked: does it reset
// and mend? Off / on ?menucar=1&menureset=1.
// node tools/scratch/_menurace.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&menucar=1&menureset=1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await page.addInitScript(() => localStorage.setItem('carsim.profile.v1', JSON.stringify(
      { active: 'track-rwd', livery: { 'track-rwd': { num: 27 } } })));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=1&rules=0&noaudio=1${q}`);
    await page.waitForTimeout(6000);
    const res = await page.evaluate(async () => {
      const g = window.__game, car = g.car;
      const id = car.spec.id;
      const { tooInjured } = await import('/src/damage.ts');
      car.dmg = [1, 1, 1, 1];
      const injured = tooInjured(car);
      await new Promise((r) => setTimeout(r, 6000));
      return { carId: id, injured, dmgAfter: g.car.dmg.map((d) => +d.toFixed(2)),
        resets: g.car._dmgResets || 0 };
    });
    console.log((q || '(off)').padEnd(24), JSON.stringify(res));
    await page.screenshot({ path: `tools/scratch/_menurace${q ? '-on' : '-off'}.png` });
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
