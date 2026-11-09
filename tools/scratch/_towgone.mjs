// _towgone.mjs - a race start with the AI (Naffcar Speedway, Naffcars) after the tow cue's streaks
// went (owner 11-09): photos at phone size as the field drives off and in the pack, the player's
// dragMul (1 while parked), page errors.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('naffcar', 'naffcar', { ai: 8, laps: 3 }));
  for (const at of [4, 9, 14]) {
    await page.waitForTimeout(at === 4 ? 4000 : 5000);
    const res = await page.evaluate(() => { const car = window.__game.car;
      return { kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), dragMul: car.dragMul }; });
    await page.screenshot({ path: `tools/scratch/_towgone-${at}s.png` });
    console.log(`${at}s`, JSON.stringify(res));
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
