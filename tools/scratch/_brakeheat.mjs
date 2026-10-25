// _brakeheat.mjs - the hot brake glow's heat (render/brakeglow.ts, ?brakeglow=1) for a stand-in
// car, in the browser on the wall clock: (A) five full stops from 45 m/s (3 s each) with 7 s at
// 30 m/s between; (B) five 2 s handbrake turns at 25 m/s, 5 s apart. Prints each cycle's peak
// front / rear glow (0: not glowing).
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await gotoGame(page, `${server.url}/?menu=0&guide=0&brakeglow=1`);
  console.log(await page.evaluate(async () => {
    const glow = await import('/src/render/brakeglow.ts');
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const run = async (cycles, onS, offS, during, between) => {
      const car = { vx: 0, vy: 0, brakeLight: 0, handbrakeOn: 0, heading: 0,
        spec: { lf: 1.2, lr: 1.3, wid: 1.7, trackWidth: 1.5 } };
      const peaks = [];
      for (let cycle = 0; cycle < cycles; cycle++) {
        let front = 0, rear = 0;
        const start = performance.now();
        while (performance.now() - start < (onS + offS) * 1000) {
          const t = (performance.now() - start) / 1000;
          Object.assign(car, t < onS ? during(t / onS) : between);
          for (const wheel of glow.hotBrakes(car)) {
            if (wheel.along > 0) front = Math.max(front, wheel.level);
            else rear = Math.max(rear, wheel.level);
          }
          await frame();
        }
        peaks.push(`${front.toFixed(2)}/${rear.toFixed(2)}`);
      }
      return peaks.join('  ');
    };
    const stops = await run(5, 3, 7, (share) => ({ vx: 45 * (1 - share), brakeLight: 1,
      handbrakeOn: 0 }), { vx: 30, brakeLight: 0, handbrakeOn: 0 });
    const hand = await run(5, 2, 5, () => ({ vx: 25, brakeLight: 0, handbrakeOn: 1 }),
      { vx: 25, brakeLight: 0, handbrakeOn: 0 });
    return `hard stops, peak front/rear per stop: ${stops}\n`
      + `handbrake turns, peak front/rear per turn: ${hand}`;
  }));
} finally {
  await browser.close();
  server.stop();
}
