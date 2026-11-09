// _roadpick.mjs - THE ENDLESS ROADS PICKED IN THE LEVEL SELECTOR (?hwpick=1; owner 11-09: "So you
// choose the asthetic type and then the road type"): (1) phone shots of the menu - TEST MODE >
// ENDLESS ROADS (the sceneries), Deaf Valley's roads, the setup - and the LAUNCH from it; (2) each
// scenery with each road (ROADS, SCENERIES) on the autopilot: a phone-size photo at each road
// distance in SHOTS, and there the ground, the road's lanes each way, the central barrier's
// kinds near the car, the gantries laid so far, the frame rate; page errors.
// [SCENERIES=countryside,canyon] [ROADS=motorway,...] [SHOTS=500,1400] [MENU=1] node _roadpick.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const sceneries = (process.env.SCENERIES || 'countryside,canyon').split(',');
const roads = (process.env.ROADS || 'motorway,interstate,dual,walled,twisty').split(',');
const shots = (process.env.SHOTS || '500,1400').split(',').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  if (process.env.MENU !== '0') {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(server.url + '/?touch=1&menu=1&guide=0&hwpick=1');
    await page.waitForSelector('#menu button', { timeout: 30000 });
    await page.waitForTimeout(1500);
    // a tap, again until the next screen's button shows (a tap as the menu builds can be lost)
    const tap = async (text, next) => {
      for (let tries = 0; tries < 4; tries++) {
        await page.locator('#menu button', { hasText: text }).first().click({ force: true })
          .catch(() => {});
        if (!next) { await page.waitForTimeout(800); return; }
        const shown = await page.locator('#menu button', { hasText: next }).first()
          .waitFor({ timeout: 6000 }).then(() => true, () => false);
        if (shown) { await page.waitForTimeout(500); return; }
      }
      throw new Error('no ' + next + ' after ' + text);
    };
    const shot = (name) => page.screenshot({ path: `tools/scratch/_roadpick-${name}.png` });
    await tap('TEST MODE', 'ENDLESS ROADS'); await tap('ENDLESS ROADS', 'DEAF VALLEY');
    await shot('scenery');
    await tap('DEAF VALLEY', 'SINGLE LANE'); await shot('roads');
    await tap('SINGLE LANE', 'LAUNCH'); await shot('setup');
    await tap('LAUNCH');
    await page.waitForTimeout(5000);
    const got = await page.evaluate(() => ({ road: window.__game.level.roadType,
      scenery: window.__game.level.scenery, theme: window.__game.level._cfg.theme ?? 'none' }));
    await shot('launched');
    console.log('menu: launched', JSON.stringify(got));
    await ctx.close();
  }
  for (const scenery of sceneries) for (const road of roads) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
      + '&hwpick=1');
    await page.mouse.click(195, 422);
    await page.waitForTimeout(800);
    await page.evaluate(([kind, view]) => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, road: kind, scenery: view }), [road, scenery]);
    for (const target of shots) {
      for (let waited = 0; waited < 90; waited += 0.25) {
        const dist = await page.evaluate(() => window.__game.level._hw?.q?.s ?? 0);
        if (dist >= target) break;
        await page.waitForTimeout(250);
      }
      const res = await page.evaluate(() => {
        const game = window.__game, level = game.level, car = game.car, geo = level._hw.geo;
        return { dist: Math.round(level._hw.q?.s ?? 0), road: level.roadType,
          ground: level.base?.id, ours: geo.own.length, theirs: geo.oncoming.length,
          median: [...new Set(level.barriers.filter((bar) => bar.pts.some(([x, y]) =>
            Math.hypot(x - car.x, y - car.y) < 60) && bar._s != null).map((bar) => bar.kind))]
            .join('/') || '-',
          gantries: level.props.filter((prop) => prop.kind === 'gantry').length,
          fps: game.fps ? Math.round(game.fps) : undefined };
      });
      await page.screenshot({ path: `tools/scratch/_roadpick-${scenery}-${road}-${target}.png` });
      console.log(`${scenery} ${road} @${target}: ${JSON.stringify(res)}`);
    }
    await page.close();
  }
  console.log(errors.length ? 'ERRORS ' + [...new Set(errors)].slice(0, 4).join(' | ')
    : 'errors none');
} finally { await browser.close(); server.stop(); }
