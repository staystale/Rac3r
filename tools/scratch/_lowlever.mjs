// _lowlever.mjs - ?lowrange=1: the low-range lever in the game (the Defunder), at 844x390, 740x360
// and 390x844 (touch), in HIGH, in LOW and just refused (a pull above 10 km/h); and whether the
// lever's rect overlaps any other HUD rect (the layout's own). node tools/scratch/_lowlever.mjs <dir>
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const OUT = process.argv[2] || 'tools/scratch/lowlever';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [740, 360], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&lowrange=1`);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(1200);
    for (const state of ['hi', 'lo', 'refused']) {
      const overlaps = await page.evaluate(async (which) => {
        const game = window.__game;
        if (!game.car || !String(game.car.spec.id).startsWith('defunder')) {
          game.launch('knobhill', 'defunder-110', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
          await new Promise((done) => setTimeout(done, 2500));
        }
        game.car.lowRange = which === 'lo';
        game.car.rangeRefusedAt = which === 'refused' ? performance.now() : undefined;
        await new Promise((done) => setTimeout(done, 200));
        const rects = game.hudLayout(), lever = rects.lowLever, hits = [];
        for (const [name, rect] of Object.entries(rects)) {
          if (name === 'lowLever' || !rect || !rect.w || !rect.h || name === 'fit') continue;
          if (lever.x < rect.x + rect.w && rect.x < lever.x + lever.w && lever.y < rect.y + rect.h
            && rect.y < lever.y + lever.h) hits.push(name);
        }
        return hits.join(',') || 'none';
      }, state);
      await page.screenshot({ path: `${OUT}/lever-${width}x${height}-${state}.png` });
      console.log(`${width}x${height} ${state}: overlaps ${overlaps}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
    }
    await ctx.close();
  }
} finally { await browser.close(); server.stop(); }
