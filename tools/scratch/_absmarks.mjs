// _absmarks.mjs - ROOT FIX in the page: Thruston, a hard stop from 100 km/h on the main straight
// with ABS on (?wheelspin=1 vs plain), photographed after; page errors; then 15 s of a 4-AI race on
// the autopilot for errors. node tools/scratch/_absmarks.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&wheelspin=1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    let errors = 0;
    page.on('pageerror', (error) => { errors++; console.log('PAGE ERROR ' + error.message); });
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${q}`);
    await page.evaluate(() => window.__game.launch('lab', 'hatch-rwd', { ai: 0 }));
    await page.mouse.click(400, 200);
    await page.waitForTimeout(1500);
    // the Lab's tarmac quarter (SE), heading east, at 100 km/h
    await page.evaluate(async () => {
      const { reset } = await import('/src/vehicle.ts');
      const c = window.__game.car; reset(c, 40, 120, 0); c.absOn = true;
      c.vx = 27.8; c.gear = 5; c.rpm = 4000;
    });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(800);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(2500);
    await page.keyboard.up('ArrowDown');
    const res = await page.evaluate(() => ({ v: Math.hypot(window.__game.car.vx, window.__game.car.vy).toFixed(1), pulses: window.__game.car.absPulses || 0 }));
    await page.screenshot({ path: `tools/scratch/_absmarks${q ? '-on' : '-off'}.png` });
    await page.evaluate(() => window.__game.launch('thruston', 'hatch-rwd', { ai: 4 }));
    await page.waitForTimeout(15000);
    const ai = await page.evaluate(() => window.__game.ai.map((e) => Math.round(Math.hypot(e.car.vx, e.car.vy) * 3.6)).join('/'));
    console.log(q || 'plain', 'after stop v', res.v, 'ABS releases', res.pulses, '| AI km/h', ai, '| page errors', errors);
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
