// _whooshstill.mjs - whoosh lines only while the car is seen to turn (render/rollbody.ts seenSpin):
// the car held on its side with a stale roll rate of 12 rad/s (as a paused game or a held car
// leaves it) - photographed (-still.png: no lines), then really rolling (-rolling.png: lines).
// node tools/scratch/_whooshstill.mjs [car]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const carId = process.argv[2] || 'hatch-fwd';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.mouse.click(200, 300);
  await page.waitForTimeout(1200);
  await page.evaluate(async (id) => {
    const game = window.__game;
    game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 1500));
    game.renderer.debugZoom(2.6);
    const car = game.car;
    car.vx = 0; car.vy = 0; car.roll = { phase: 'side', phi: Math.PI / 2, w: 12, still: 0 };
  }, carId);
  await page.waitForTimeout(800);
  const clip = { x: 95, y: 200, width: 200, height: 200 };
  await page.screenshot({ path: `tools/scratch/_whoosh-${carId}-still.png`, clip });
  await page.evaluate(async () => {
    const car = window.__game.car, roll = await import('/src/roll.ts');
    car.roll = null; car.heading = -Math.PI / 2; car.vx = 2; car.vy = 0;
    roll.startRoll(car, 1, 14);
    car.roll.w = 14;
  });
  await page.waitForTimeout(90);
  await page.screenshot({ path: `tools/scratch/_whoosh-${carId}-rolling.png`, clip });
  console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
