// _stagesetup.mjs - A RALLY STAGE HAS NO LAPS (owner 11-22: "single rally stages shouldn't have
// laps either"; menu/setup.ts isStage): the real menu with taps (TEST MODE -> category -> track ->
// VS AI) for a set rally stage (Sweaty Lamb), the generated one and a circuit (Thruston) - the LAPS
// row shown or not - then LAUNCH on Sweaty Lamb VS AI and the HUD a few seconds in (its lap panel:
// STAGE, the time, BEST; no LAP n/N). Photos tools/scratch/_stagesetup-<what>-<view>.png.
// [VIEW=390x844] node tools/scratch/_stagesetup.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const STEP_MS = 15000;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height }, isMobile: true,
    hasTouch: true })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tap = async (text) => {
    // (a press blinks before its screen opens; a new screen ignores taps for a moment)
    await page.waitForTimeout(600);
    const button = page.locator('#menu button', { hasText: text }).first();
    await button.waitFor({ state: 'visible', timeout: STEP_MS });
    await button.tap({ timeout: STEP_MS });
  };
  const open = async () => {
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1` + extraQuery());
    await page.waitForFunction(() => window.__game.mode === 'menu', null,
      { timeout: STEP_MS, polling: 250 });
    await page.waitForTimeout(1000);
  };
  await open();
  const generated = await page.evaluate(async () => {
    const { LEVELS } = await import('/src/world/levels/index.ts');
    const level = LEVELS.find((each) => each.gen && !each.fixed);
    return level ? level.name : null;
  });
  const picks = [['sweaty-lamb', 'RALLY STAGES', 'Sweaty Lamb'], ['generated', 'RALLY STAGES',
    generated], ['thruston', 'CIRCUITS', 'Thruston']];
  for (const [what, category, name] of picks) {
    if (!name) {
      console.log('setup', what, 'NOT FOUND');
      continue;
    }
    await open();
    await tap('TEST MODE');
    await tap(category);
    await tap(name);
    await tap('VS AI');
    await page.waitForTimeout(500);
    const laps = await page.evaluate(() => [...document.querySelectorAll('#menu .row')]
      .filter((row) => row.offsetParent && /\bLAPS?$/.test(row.textContent.replace(/[−+]/g, '')
        .trim())).map((row) => row.textContent.replace(/[−+]/g, '').trim()));
    await page.screenshot({ path: `tools/scratch/_stagesetup-setup-${what}-${width}x${height}.png` });
    console.log('setup', what, JSON.stringify(name), 'LAPS rows shown:', laps.length,
      JSON.stringify(laps));
  }
  // LAUNCH Sweaty Lamb VS AI from its setup: the HUD a few seconds in
  await open();
  await tap('TEST MODE');
  await tap('RALLY STAGES');
  await tap('Sweaty Lamb');
  await tap('VS AI');
  await tap('LAUNCH');
  await page.waitForFunction(() => window.__game.mode === 'session', null,
    { timeout: STEP_MS, polling: 250 });
  await page.waitForTimeout(12000);
  const flow = await page.evaluate(() => {
    const game = window.__game;
    return { level: game.level.id, laps: game.flow ? game.flow.laps : null,
      stage: game.stage ? game.stage.state : null, ai: game.ai ? game.ai.length : 0 };
  });
  await page.screenshot({ path: `tools/scratch/_stagesetup-hud-sweaty-lamb-${width}x${height}.png` });
  console.log('hud', JSON.stringify(flow), errors.length ? 'ERRORS ' + errors.slice(0, 3)
    .join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
