// _hillmenu.mjs - SPIKES PEAK in its own HILL CLIMBS category (?spikespeak; menu/tracks.ts,
// world/levels/category.ts): the real menu by taps - TEST MODE's types (HILL CLIMBS listed),
// HILL CLIMBS (Spikes Peak), its setup solo and VS AI (no LAPS row) - photos of each; ALL TRACKS
// checked for no Spikes Peak; the built level's ghost direction. RAC3R_QUERY carries switches.
// [VIEW=390x844] node tools/scratch/_hillmenu.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height }, isMobile: true,
    hasTouch: true })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tap = async (text) => {
    await page.waitForTimeout(600);
    const button = page.locator('#menu button', { hasText: text }).first();
    await button.waitFor({ state: 'visible', timeout: 15000 });
    await button.tap({ timeout: 15000 });
  };
  const shot = (what) => page.screenshot({ path: `tools/scratch/_hillmenu-${what}-${width}x${height}.png` });
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1` + extraQuery());
  await page.waitForFunction(() => window.__game.mode === 'menu', null, { polling: 250,
    timeout: 20000 });
  await page.waitForTimeout(1000);
  await tap('TEST MODE');
  await page.waitForTimeout(500);
  await shot('types');
  const types = await page.evaluate(() => [...document.querySelectorAll('#menu button.cat')]
    .map((button) => button.textContent.trim().slice(0, 30)));
  await tap('ALL TRACKS');
  await page.waitForTimeout(500);
  const inAll = await page.evaluate(() => document.querySelector('#menu').textContent
    .includes('Spikes Peak'));
  await tap('◀ TYPES');
  await tap('HILL CLIMBS');
  await page.waitForTimeout(500);
  await shot('list');
  await tap('Spikes Peak');
  await page.waitForTimeout(500);
  await shot('setup-solo');
  await tap('VS AI');
  await page.waitForTimeout(500);
  await shot('setup-vsai');
  const laps = await page.evaluate(() => [...document.querySelectorAll('#menu .row')]
    .filter((row) => row.offsetParent && /\bLAPS?$/.test(row.textContent.replace(/[−+]/g, '')
      .trim())).length);
  const ghostDir = await page.evaluate(async () => {
    const { LEVELS } = await import('/src/world/levels/index.ts');
    const { buildLevel } = await import('/src/world/load.ts');
    const level = LEVELS.find((each) => each.id === 'spikes-peak');
    return level ? buildLevel(level).ghostDir : 'NO LEVEL';
  });
  console.log(JSON.stringify({ types, spikesInAllTracks: inAll, lapsRows: laps, ghostDir }));
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
