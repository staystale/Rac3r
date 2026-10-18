// _pauseclock.mjs - photographs ?pauseclock=1: the pause menu's alarm clock beside MUTE, by day
// (spring day 3, 13:05) and at night (22:40), at 390x844 and 844x390; prints page errors and what
// the clock shows. The time is set through the clock's saved key before load (the page's modules
// are not the ones a page.evaluate import reaches). Photos in the temp folder.
// node tools/scratch/_pauseclock.mjs
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const DAY_S = 86400, SPRING_DAY_3 = (7 + 2) * DAY_S;
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of (process.argv[2] ? [[390, 844]] : [[390, 844], [844, 390]])) {
    for (const [name, hour] of [['day', 13 + 5 / 60], ['night', 22 + 40 / 60]]) {
      const context = await browser.newContext({ viewport: { width, height },
        deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await context.addInitScript((seconds) => {
        localStorage.setItem('carsim.clock.v1', String(seconds));
      }, Math.round(SPRING_DAY_3 + hour * 3600));
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&pauseclock=1`);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 2, weather: { mode: 'dry', season: 1, seed: 4 } }));
      await page.waitForTimeout(2500);
      await page.keyboard.press('p');
      await page.waitForTimeout(700);
      const shows = await page.evaluate(() => {
        const clock = document.querySelector('#menu .pclock');
        const menuText = (document.querySelector('#menu')?.innerText || '').slice(0, 80);
        if (!clock) {
          return 'NO CLOCK paused=' + window.__game.paused + ' mode=' + window.__game.mode
            + ' menu=' + menuText.split('\n').join(' ');
        }
        return clock.getAttribute('aria-label') + ' | ' + clock.className + ' | '
          + clock.querySelector('.side').textContent;
      });
      const base = `pauseclock-${width}x${height}-${name}`;
      await page.screenshot({ path: join(tmpdir(), base + '.png') });
      await page.screenshot({ path: join(tmpdir(), base + '-close.png'),
        clip: { x: 0, y: 0, width: Math.min(width, 360), height: Math.min(height, 330) } });
      console.log(base, shows);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
