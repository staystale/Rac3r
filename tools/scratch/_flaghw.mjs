// _flaghw.mjs - ?flagfix on the highway (hud/overlays.ts drawHudFlag): two solo 5 KM runs IN ONE
// PAGE on the autopilot, each with its finish moved 300 m ahead (as _hwfinishshot.mjs), and a
// photo every 0.2 s for 2.4 s from the line: the share of the screen's middle band in near-white
// cloth pixels (the flag's white squares). node tools/scratch/_flaghw.mjs <dir> [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/flaghw', query = ''] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];

/**
 * Waits for a page condition.
 * @param page the page
 * @param test the condition (run in the page)
 * @param seconds at most
 * @returns whether it came true
 */
async function waitFor(page, test, seconds) {
  for (let waited = 0; waited < seconds; waited += 0.25) {
    if (await page.evaluate(test)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/**
 * The share of the screen's middle band in near-white, near-grey pixels.
 * @param page the page
 * @param buffer a PNG
 * @returns 0-1
 */
async function whiteShare(page, buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + base64;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const top = Math.round(image.height * 0.25), rows = Math.round(image.height * 0.5);
    const data = ctx.getImageData(0, top, image.width, rows).data;
    let white = 0;
    for (let i = 0; i < data.length; i += 4) {
      const low = Math.min(data[i], data[i + 1], data[i + 2]);
      if (low > 200 && Math.max(data[i], data[i + 1], data[i + 2]) - low < 12) white++;
    }
    return white / (data.length / 4);
  }, buffer.toString('base64'));
}

try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `${query ? '&' + query : ''}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(800);
  for (const run of [1, 2]) {
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, road: 'motorway', scenery: 'countryside', finish: 'km5' }));
    await page.waitForTimeout(2500);
    await waitFor(page, () => window.__game.flow && window.__game.flow.t > 4, 30);
    await page.evaluate(() => {
      const fin = window.__game.flow.finish, sRef = fin.s - fin.m;
      fin.m = Math.round((window.__game.hwDist || 0) + 300);
      fin.s = sRef + fin.m;
    });
    await waitFor(page, () => window.__game.flow.flags.length > 0
      || window.__game.flow.state === 'done', 60);
    const burst = [];
    for (let i = 0; i < 12; i++) {
      const at = Date.now();
      const shot = `${OUT}/hw${run}-${String(i).padStart(2, '0')}.png`;
      burst.push((100 * await whiteShare(page, await page.screenshot({ path: shot })))
        .toFixed(1) + '%');
      await page.waitForTimeout(Math.max(0, 200 - (Date.now() - at)));
    }
    const flow = await page.evaluate(() => ({ state: window.__game.flow.state,
      flags: window.__game.flow.flags.length, why: window.__game.flow.endWhy }));
    console.log(`highway run ${run}: ${JSON.stringify(flow)};`,
      `white each 0.2 s: ${burst.join(' ')}`);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 5).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
