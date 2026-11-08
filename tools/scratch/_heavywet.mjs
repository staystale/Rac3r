// _heavywet.mjs - K1 (owner 11-01): wet trails only in a puddle or heavy rain. Castle Kum on the
// autopilot, the track soaked (wetness 1) under no rain / light 0.45 / heavy 1: the share of wheel
// samples laying the wet trail on damp ground (not a puddle) and in puddles. Off / on ?heavywet=1.
// node tools/scratch/_heavywet.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&heavywet=1']) {
    for (const rain of [0, 0.45, 1]) {
      const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
      page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=60${q}`);
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
      await page.mouse.click(420, 200);
      const res = await page.evaluate(async (rainNow) => {
        const w = await import('/src/world/weather.ts');
        const { MARK_WET } = await import('/src/world/surfaces.ts');
        const set = () => { w.setWetness(1); w.setRain(rainNow); };
        set();
        await new Promise((r) => setTimeout(r, 4000));
        const g = window.__game;
        let dampWet = 0, damp = 0, puddleWet = 0, puddle = 0;
        for (let i = 0; i < 150; i++) {
          set();
          await new Promise((r) => setTimeout(r, 100));
          const wheels = g.marks.wheelsOf(g.car), under = g.car.wheelSurf || [];
          wheels.forEach((wheel, k) => {
            const s = under[[1, 0, 3, 2][k]] || g.car.surface;
            if (s.id === 'puddle' || s.id === 'wet') { puddle++; if (wheel.mark === MARK_WET) puddleWet++; }
            else if (s.wetK > 0.3 && s.hard) { damp++; if (wheel.mark === MARK_WET) dampWet++; }
          });
        }
        return { rainNow: +w.WEATHER.rain.toFixed(2), damp, dampTrail: damp ? +(dampWet / damp).toFixed(2) : null,
          puddle, puddleTrail: puddle ? +(puddleWet / puddle).toFixed(2) : null };
      }, rain);
      console.log((q || '(off)').padEnd(13), 'rain', rain, JSON.stringify(res));
      await page.close();
    }
  }
} finally { await browser.close(); server.stop(); }
