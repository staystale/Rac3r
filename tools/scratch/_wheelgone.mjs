// _wheelgone.mjs - K7 (owner 11-01): a wheel that has come off takes nothing more. Castle Kum,
// the hatch on the autopilot: the front -y wheel knocked off, then a burst asked of that tyre and
// the run driven 20 s; a flat on the other front for comparison. Off / on ?wheelgone=1.
// node tools/scratch/_wheelgone.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&wheelgone=1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=25${q}`);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.mouse.click(420, 200);
    await page.waitForTimeout(3000);
    const res = await page.evaluate(async () => {
      const { applyBurst } = await import('/src/damage.ts');
      const car = window.__game.car;
      car.wheelOff[0] = true;                 // damage corner 0 = tyre 1 (FR, -y)
      car.burstTyre = 1; car.burstSlow = false; applyBurst(car);
      car.burstTyre = 0; car.burstSlow = false; applyBurst(car);   // corner 1: a real flat
      const wear0 = car.tyreWear ? car.tyreWear[1] : 0;
      let sparks = 0, sparksOther = 0;
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (car.rimSparks && car.rimSparks[0]) sparks++;
        if (car.rimSparks && car.rimSparks[1]) sparksOther++;
      }
      return { pGone: car.tyreP[0], leakGone: car.tyreLeak[0], rimGone: car.onRim[0],
        wearGone: +(car.tyreWear[1] - wear0).toFixed(5), sparksGone: sparks,
        pOther: +car.tyreP[1].toFixed(2), rimOther: car.onRim[1], sparksOther,
        speed: +Math.hypot(car.vx, car.vy).toFixed(1) };
    });
    console.log(q || '(off)', JSON.stringify(res));
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
