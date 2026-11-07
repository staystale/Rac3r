// _loosewheel.mjs - ?carpaint: a wheel torn off the player's car, lying flat, shows its rim colour and
// spokes (render/wheelface.ts). Gold split rims; the shot zoomed in: tools/scratch/_loosewheel.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'carpaint=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&${query}`);
  await page.mouse.click(200, 300);
  await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => {
    const g = window.__game, cars = await import('/src/cars.ts');
    g.launch('test-track', 'hatch-rwd', {});
    await new Promise((done) => setTimeout(done, 1500));
    cars.applyLivery(g.car.spec, { paint: '#2f6fd0', rims: 'gold', spokes: 'split' });
    g.car.wheelOff[1] = true; g.car.wheelSpawn = [1];
    g.renderer.debugZoom(3.2);
    await new Promise((done) => setTimeout(done, 6000));
    const tyre = g.cones.list.filter((obj) => obj.rimCol).pop();
    if (!tyre) return { tyres: g.cones.list.filter((obj) => obj.kind === 'tyre').length, off: g.car.wheelOff, spawn: g.car.wheelSpawn };
    return tyre ? { mode: tyre.mode, rim: tyre.rimCol, spokes: tyre.spokes,
      away: Math.hypot(tyre.x - g.car.x, tyre.y - g.car.y).toFixed(1) } : null;
  });
  await page.screenshot({ path: 'tools/scratch/_loosewheel.png' });
  console.log(JSON.stringify(res), errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
