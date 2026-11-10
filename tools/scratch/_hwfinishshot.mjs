// _hwfinishshot.mjs - THE HIGHWAY'S FINISH IN THE GAME (?hwfinish=1): (1) phone shots of the
// setup's FINISH rows (390x844 and 844x390), SOLO and VS AI with 5 KM picked, and the LAUNCH from
// it; (2) a SOLO 5 KM run on the autopilot - the rolling start behind the lights, the HUD's TO GO,
// then the finish moved to 300 m ahead (so the run is short): the chequered line on the road, the
// flag, the results; (3) a VS AI 3 MIN race with the clock cut to 8 s: TIME LEFT, the flag, the
// results. Shots _hwfinishshot-<step>.png; what each ended with, and page errors, printed.
// node tools/scratch/_hwfinishshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
const wait = async (page, test, secs) => {
  for (let waited = 0; waited < secs; waited += 0.25) {
    if (await page.evaluate(test)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(server.url + '/?touch=1&menu=1&guide=0&hwfinish=1');
    await page.waitForSelector('#menu button', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const tap = async (text, next) => {
      for (let tries = 0; tries < 4; tries++) {
        await page.locator('#menu button', { hasText: text }).first().click({ force: true })
          .catch(() => {});
        if (!next) { await page.waitForTimeout(600); return; }
        const shown = await page.locator('#menu button', { hasText: next }).first()
          .waitFor({ timeout: 6000 }).then(() => true, () => false);
        if (shown) { await page.waitForTimeout(500); return; }
      }
      throw new Error('no ' + next + ' after ' + text);
    };
    const shot = async (name) => {
      await page.locator('#menu div', { hasText: /^FINISH$/ }).first().scrollIntoViewIfNeeded()
        .catch(() => {});
      await page.screenshot({ path: `tools/scratch/_hwfinishshot-${name}-${width}x${height}.png` });
    };
    await tap('TEST MODE', 'ENDLESS ROADS'); await tap('ENDLESS ROADS', 'COUNTRYSIDE');
    await tap('COUNTRYSIDE', 'MOTORWAY'); await tap('MOTORWAY', 'LAUNCH');
    await tap('SOLO'); await tap('5 KM'); await shot('setup-solo');
    await tap('VS AI'); await shot('setup-vsai');
    const line = await page.evaluate(() => [...document.querySelectorAll('#menu .sub')]
      .map((el) => el.textContent).filter((txt) => /WINS|FINISH|CLOCK|GET AWAY/.test(txt)));
    console.log(`${width}x${height} setup lines:`, JSON.stringify(line));
    if (width === 390) {
      await tap('SOLO');
      await tap('LAUNCH');
      await page.waitForTimeout(3000);
      const got = await page.evaluate(() => ({ finish: window.__game.flow?.finish,
        lights: window.__game.start?.on }));
      console.log('menu launch, solo 5 KM:', JSON.stringify(got));
    }
    await ctx.close();
  }
  // ---- (2) solo 5 KM on the autopilot, the finish brought near
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
      + '&hwfinish=1');
    await page.mouse.click(195, 422);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, road: 'motorway', scenery: 'countryside', finish: 'km5' }));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-solo-lights.png' });
    await wait(page, () => window.__game.flow?.t > 4, 20);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-solo-togo.png' });
    const near = await page.evaluate(() => {
      const fin = window.__game.flow.finish, sRef = fin.s - fin.m;
      fin.m = Math.round((window.__game.hwDist || 0) + 300);
      fin.s = sRef + fin.m;
      return { to: fin.m, at: window.__game.hwDist };
    });
    console.log('solo: the finish moved to', JSON.stringify(near));
    await wait(page, () => (window.__game.flow.finish.m - (window.__game.hwDist || 0)) < 40, 40);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-solo-line.png' });
    await wait(page, () => window.__game.flow.state === 'done', 30);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-solo-flag.png' });
    const end = await page.evaluate(() => ({ why: window.__game.flow.endWhy,
      t: window.__game.flow.t, rows: window.__game.flow.results.map((row) => [row.pos,
        row.player, row.done, Math.round(row.dist)]),
      lines: window.__game.level.paint.filter((mark) => mark.kind === 'chequered').length }));
    console.log('solo end:', JSON.stringify(end));
    await page.close();
  }
  // ---- (3) VS AI 3 MIN, the clock cut short; the results through the menu
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(server.url + '/?touch=1&menu=1&guide=0&hwfinish=1&autopilot=1&noaudio=1');
    await page.waitForSelector('#menu button', { timeout: 30000 });
    await page.waitForTimeout(1500);
    // the real way in: the menu, VS AI, 3 MIN, LAUNCH
    for (const [text, next] of [['TEST MODE', 'ENDLESS ROADS'], ['ENDLESS ROADS', 'COUNTRYSIDE'],
      ['COUNTRYSIDE', 'MOTORWAY'], ['MOTORWAY', 'LAUNCH'], ['VS AI', '3 MIN'], ['3 MIN', null],
      ['LAUNCH', null]]) {
      for (let tries = 0; tries < 4; tries++) {
        await page.locator('#menu button', { hasText: text }).first().click({ force: true })
          .catch(() => {});
        if (!next) break;
        if (await page.locator('#menu button', { hasText: next }).first().waitFor({
          timeout: 6000 }).then(() => true, () => false)) break;
      }
      await page.waitForTimeout(500);
    }
    await wait(page, () => window.__game.flow?.t > 3, 30);
    console.log('VS AI launched:', JSON.stringify(await page.evaluate(() => ({
      finish: window.__game.flow.finish, ai: window.__game.ai.length }))));
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-ai-timeleft.png' });
    await page.evaluate(() => { window.__game.flow.finish.t = window.__game.flow.t + 6; });
    await wait(page, () => window.__game.flow.state === 'done', 30);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-ai-flag.png' });
    const end = await page.evaluate(() => ({ why: window.__game.flow.endWhy,
      place: window.__game.flow.myPlace, rows: window.__game.flow.results.map((row) =>
        [row.pos, row.player ? 'YOU' : row.num, Math.round(row.dist)]) }));
    console.log('VS AI end:', JSON.stringify(end));
    await page.waitForTimeout(5500);
    await page.screenshot({ path: 'tools/scratch/_hwfinishshot-ai-results.png' });
    const table = await page.evaluate(() => document.querySelector('#menu')?.innerText
      .split('\n').filter(Boolean).slice(0, 14).join(' | '));
    console.log('VS AI results:', table);
    await ctx.close();
  }
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
