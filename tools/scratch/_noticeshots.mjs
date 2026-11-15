// _noticeshots.mjs - THE POLICE NOTICE WHEN YOU SHAKE THEM OFF, PHOTOGRAPHED (scratch,
// ?wantedlost=1): the highway launched, your heat given a star with its escape clock run out, so
// the game's own police step reports the escape and sets the notice; then a photo, and the notice
// box measured as hud/overlays.ts drawHudNotice lays it (its font, its padding) against the screen's
// 12 px margins and every HUD rectangle (hud/layout.ts) - an overlap or a box past a margin is
// printed as WRONG.
// SHOTS=<folder> VIEW=844x390 [RAC3R_QUERY=wantedlost=1] node tools/scratch/_noticeshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const SHOTS = process.env.SHOTS || 'noticeshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const TAG = `${(process.env.RAC3R_QUERY || '').includes('wantedlost=1') ? 'on' : 'off'}`
  + `-${VIEW_W}x${VIEW_H}`;
// px: the HUD's margin (CLAUDE.md section 5)
const MARGIN_PX = 12;

/** Page side: your heat a star with its escape clock run out (the police step then reports it). */
async function runOutEscape() {
  const game = window.__game;
  const heatMod = await import('/src/ai/policeHeat.ts');
  const orders = game.traffic.police();
  let heat = orders.heats.get(game.car);
  if (!heat) orders.heats.set(game.car, heat = heatMod.createHeat());
  heat.stars = 1;
  heat.escapeT = 1e6;
  game.notice = null;
}

/**
 * Page side: the notice now and its box as drawHudNotice lays it, with the HUD rectangles it
 * overlaps (canvas px).
 * @returns {object} the notice, its box, the screen and the overlaps
 */
function measureNotice() {
  const game = window.__game, notice = game.notice;
  if (!notice) return { text: null };
  // (the HUD is drawn in the renderer's units: game/loop.ts hud.draw(ctx, renderer.W, renderer.H))
  const width = game.renderer.W, height = game.renderer.H;
  const ctx = document.createElement('canvas').getContext('2d');
  const fontSize = Math.round(Math.min(width, height) * 0.06), y = Math.round(height * 0.3);
  ctx.font = '800 ' + fontSize + 'px ui-sans-serif, system-ui, sans-serif';
  const boxW = ctx.measureText(notice.text).width + fontSize * 1.4;
  const scale = window.innerWidth / width;
  const box = { x: width / 2 - boxW / 2, y: y - fontSize, w: boxW, h: fontSize * 2 };
  const rects = game.hudLayout();
  const hits = Object.entries(rects).filter(([, rect]) => rect && rect.w > 0 && rect.x >= 0
    && rect.x < box.x + box.w && rect.x + rect.w > box.x && rect.y < box.y + box.h
    && rect.y + rect.h > box.y).map(([name]) => name);
  return { text: notice.text, box, scale, hits,
    margin: Math.min(box.x, width - box.x - box.w) * scale };
}

mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1` + extraQuery());
  await page.touchscreen.tap(VIEW_W / 2, VIEW_H / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', {}));
  await page.waitForTimeout(6000);
  await page.evaluate(runOutEscape);
  let seen = null;
  for (let tries = 0; tries < 30 && !seen?.text; tries++) {
    await page.waitForTimeout(100);
    seen = await page.evaluate(measureNotice);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/notice-${TAG}.png` });
  if (!seen?.text) console.log(`${TAG}: no notice came`);
  else {
    const fits = seen.margin >= MARGIN_PX && !seen.hits.length;
    console.log(`${TAG}: "${seen.text}" box ${seen.box.w.toFixed(0)} x `
      + `${seen.box.h.toFixed(0)} (renderer px; ${seen.scale.toFixed(2)} css px each), side margin ${seen.margin.toFixed(0)} px, `
      + `overlaps ${seen.hits.join(', ') || 'none'}: ${fits ? 'FITS' : 'WRONG'}`);
  }
  console.log('page errors:', errors.length ? errors.slice(0, 3).join(' / ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
