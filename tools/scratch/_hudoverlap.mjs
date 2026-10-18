// _hudoverlap.mjs - with ?hudunits=1 and an event's weather (the track gauge shows), the tyre
// diagram off and on (frames drawn so the speed panel grows), do the top-right column's strips
// (speed, lap, track gauge, FPS, cone tally) overlap the ABS / TCS chips or each other? 6 sizes.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const SIZES = [[844, 390], [390, 844], [740, 360], [360, 740], [932, 430], [430, 932]];
const server = await startServer();
const browser = await launchBrowser();
const bad = [];
try {
  for (const [width, height] of SIZES) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&hudunits=1`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'snow', season: 0, seed: 4 } }));
    await page.waitForTimeout(2500);
    for (const tyreHud of [false, true]) {
      await page.evaluate((on) => window.__game.setTyreHud(on), tyreHud);
      await page.waitForTimeout(300);
      const out = await page.evaluate(() => {
        const L = window.__game.hudLayout();
        const named = [['speed', L.speed], ['lap', L.lap], ['trackTemp', L.trackTemp],
          ['fps', L.fps], ['tally', L.tally], ['abs', L.absChip], ['tcs', L.tcsChip],
          ['restart', L.restart], ['reset', L.reset], ['clear', L.clear], ['help', L.help]];
        const hit = (a, b) => a && b && a.h > 0 && b.h > 0 && a.x < b.x + b.w && b.x < a.x + a.w
          && a.y < b.y + b.h && b.y < a.y + a.h;
        const found = [];
        for (let i = 0; i < named.length; i++) {
          for (let j = i + 1; j < named.length; j++) {
            if (hit(named[i][1], named[j][1])) found.push(`${named[i][0]} x ${named[j][0]}`);
          }
        }
        return { found, gauge: L.trackTemp && L.trackTemp.h };
      });
      const tag = `${width}x${height}${tyreHud ? ' tyre HUD' : ''} (gauge ${out.gauge ? 'on' : 'off'})`;
      if (out.found.length) bad.push(`${tag}: ${out.found.join(', ')}`);
      else console.log(`${tag}: ok`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(bad.length ? 'OVERLAPS:\n  ' + bad.join('\n  ') : 'no overlaps');
