// _laybyshot.mjs - THE LAY-BYS ON EACH SIDE (owner 11-09: "They should be on oncoming side of the
// roads that need them too so it's even and real"; ?farlaybys=1): on each road the car is put
// beside the next lay-bys ahead (tarmac zones off the road) - its side, how far off the road
// edge it reaches, and a phone-size photo of each; how many each side in the first 2 km.
// [ROADS=dual,walled,canyon] [QUERY=farlaybys=1] node tools/scratch/_laybyshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const roads = (process.env.ROADS || 'dual,walled,canyon').split(',');
const query = process.env.QUERY ?? 'farlaybys=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  for (const road of roads) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
    await page.mouse.click(195, 422);
    await page.waitForTimeout(800);
    await page.evaluate((kind) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: kind }),
      road);
    await page.waitForTimeout(2500);
    // the tarmac zones laid so far (the lay-bys), nearest first, ahead of the car
    const bays = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      return game.level.zones.filter((zone) => zone.surface?.id === 'tarmac' && zone._s != null
        && zone._s > (game.level._hw.q?.s ?? 0) + 30).sort((a, b) => a._s - b._s)
        .map((zone) => ({ x: zone.x, y: zone.y, s: zone._s }));
    });
    const sides = { left: 0, right: 0 }, lines = [];
    for (const [n, bay] of bays.entries()) {
      // the car on the spot, a moment for its road frame, then in the nearest lane beside it
      await page.evaluate((spot) => Object.assign(window.__game.car, { x: spot.x, y: spot.y,
        vx: 0, vy: 0 }), bay);
      await page.waitForTimeout(200);
      const got = await page.evaluate(() => {
        const game = window.__game, hw = game.level._hw, q = hw.q, car = game.car;
        if (!q) return null;
        const side = Math.sign(q.off), off = q.off, edge = hw.geo.hw;
        const to = side * (edge - 2), by = to - off;
        Object.assign(car, { x: car.x - q.dy * by, y: car.y + q.dx * by,
          heading: Math.atan2(q.dy, q.dx), vx: 0, vy: 0 });
        return { side, past: +(Math.abs(off) - edge).toFixed(1), s: Math.round(q.s) };
      });
      if (!got) continue;
      sides[got.side < 0 ? 'left' : 'right']++;
      if (lines.length < 4) {
        await page.waitForTimeout(400);
        const path = `tools/scratch/_layby-${road}-${n}.png`;
        await page.screenshot({ path });
        lines.push(`  @${got.s} m ${got.side < 0 ? 'our side' : 'FAR SIDE'}: its middle`
          + ` ${got.past} m past the edge  ${path}`);
      }
    }
    console.log(`${road}: lay-bys ahead in the window - ours ${sides.left}, the far side's`
      + ` ${sides.right}\n${lines.join('\n')}`);
    await page.close();
  }
  console.log(errors.length ? 'ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'errors none');
} finally { await browser.close(); server.stop(); }
