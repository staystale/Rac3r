// _rollshed.mjs - what a roll's hits take off a car (damage.ts hitRoll: world/debris.ts rollParts,
// physics/openwheel.ts rollRipWheels): per car, 200 rolls of side, roof, side, wheels hits at a
// 10 rad/s spin on a fresh car - how often each part and each wheel came off.
// node tools/scratch/_rollshed.mjs [cars]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const cars = (process.argv[2] || 'track-rwd,hatch-fwd').split(',');
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.waitForTimeout(1500);
  for (const carId of cars) {
    const res = await page.evaluate(async (id) => {
      const veh = await import('/src/vehicle.ts'), damage = await import('/src/damage.ts');
      const counts = {}, wheels = [0, 0, 0, 0];
      for (let n = 0; n < 200; n++) {
        const car = veh.makeCar(id);
        damage.damageInit(car);
        for (const [kind, side] of [['side', 1], ['roof', 1], ['side', -1], ['wheels', 1]])
          damage.hitRoll(car, kind, side, 10);
        for (const entry of (car.partLost || '').split(',').filter(Boolean))
          counts[entry.split(':')[0]] = (counts[entry.split(':')[0]] || 0) + 1;
        car.wheelOff.forEach((off, i) => { if (off) wheels[i]++; });
      }
      return { parts: counts, wheelsOff: wheels };
    }, carId);
    console.log(carId, JSON.stringify(res));
  }
} finally { await browser.close(); server.stop(); }
