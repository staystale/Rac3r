// _fpshud.mjs - ?fpshud (hud/fpstoggle.ts): the menu (TEST MODE, OVALS, Naffcar, LAUNCH), the
// race, then the pause menu's HUD list with its FPS row tapped OFF and ON again: photos of the list
// and of the race with the FPS panel gone and back, at 844x390 and 390x844.
// node tools/scratch/_fpshud.mjs <dir> [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/fpshud', query = 'fpshud=1'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();

/**
 * One phone size: launch a race, then the FPS row off and on through the HUD list.
 * @param width the viewport width, CSS px
 * @param height the viewport height, CSS px
 */
async function shootSize(width, height) {
  const context = await browser.newContext({ viewport: { width, height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem('carsim.hud.fps'));
  const tap = async (text) => {
    // (each panel slides in: wait for the button, then a beat, before the tap)
    const button = page.locator('#menu button', { hasText: text }).first();
    try {
      await button.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(900);
      await button.tap({ timeout: 8000 });
    } catch (error) {
      await page.screenshot({ path: `${OUT}/stuck-${width}x${height}.png` });
      throw error;
    }
  };
  const fpsShown = () => page.evaluate(async () => (await import('/src/hud/fpstoggle.ts'))
    .isFpsShown(window.__game.testMode));
  const rowText = () => page.evaluate(() => [...document.querySelectorAll('#menu button')]
    .map((button) => button.textContent).filter((text) => /^FPS/.test(text)).join(''));
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1&${query}`);
  await page.waitForTimeout(3500);
  // the menu as the owner taps it: TEST MODE, OVALS, the track, its setup's LAUNCH
  await tap('TEST MODE'); await tap('OVALS'); await tap('Naffcar'); await tap('▶');
  // (the ▶ may itself be the setup's LAUNCH ▶)
  await page.waitForTimeout(1500);
  const launch = page.locator('#menu button', { hasText: 'LAUNCH' });
  if (await launch.count() && await launch.first().isVisible()) await tap('LAUNCH');
  await page.waitForTimeout(6000);
  const tag = `${width}x${height}`;
  await page.screenshot({ path: `${OUT}/race-default-${tag}.png` });
  const steps = [{ when: 'default', testMode: await page.evaluate(() => !!window.__game.testMode),
    shown: await fpsShown() }];
  for (const turn of ['off', 'on']) {
    const pause = await page.evaluate(() => window.__game.hudLayout().help);
    await page.touchscreen.tap(pause.x + pause.w / 2, pause.y + pause.h / 2);
    await page.waitForTimeout(800);
    await tap('HUD');
    await page.waitForTimeout(600);
    const before = await rowText();
    await tap(/^FPS/);
    await page.waitForTimeout(400);
    const after = await rowText();
    await page.screenshot({ path: `${OUT}/hudlist-${turn}-${tag}.png` });
    await tap('RESUME');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/race-fps-${turn}-${tag}.png` });
    const stored = await page.evaluate(() => localStorage.getItem('carsim.hud.fps'));
    steps.push({ when: turn, row: `${before} -> ${after}`, stored, shown: await fpsShown() });
  }
  console.log(tag, JSON.stringify(steps), errors.length ? 'ERRORS ' + errors.join(' | ')
    : 'errors none');
  await context.close();
}

try {
  for (const [width, height] of [[844, 390], [390, 844]]) await shootSize(width, height);
} finally {
  await browser.close();
  server.stop();
}
