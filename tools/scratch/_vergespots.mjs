// _vergespots.mjs - WHERE A RESET PUTS YOU ON DEAF VALLEY (owner 11-10: resets "seem to sometimes
// set on a road", "not many lay-bys ... hard to make progress"): the autopilot down the canyon road
// (ROAD, default twisty: no hard shoulder), a RESET every EVERY s for SECONDS; each where the car
// came down - its offset past the road's edge (on the road / half on / off it), m back from where it
// was - summed by kind. Q adds a query (&vergereset=1). (tools/scratch/_resetspots.mjs checks every
// reset's carriageway on every road.)
// [ROAD=twisty] [SECONDS=120] [EVERY=6] [SHOTS=0] [Q=] node tools/scratch/_vergespots.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'twisty', SECONDS = +(process.env.SECONDS || 120),
  EVERY = +(process.env.EVERY || 6);
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + (process.env.Q || ''));
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road,
    scenery: 'canyon', traffic: 0 }), ROAD);
  await page.waitForTimeout(2000);
  const kinds = { 'on the road': 0, 'half on': 0, 'off the road': 0, 'in a lay-by': 0 }, backs = [];
  for (let t = 0; t < SECONDS; t += EVERY) {
    await page.waitForTimeout(EVERY * 1000);
    const got = await page.evaluate(async () => {
      const game = window.__game, hw = game.level._hw.geo.hw, before = game.level._hw.q?.s ?? 0;
      game.reset();
      await new Promise((done) => setTimeout(done, 350));
      const q = game.level._hw.q;
      return { back: before - (q?.s ?? before), past: Math.abs(q?.off ?? 0) - hw };
    });
    // (past the road's edge: a lay-by's middle and the verge spot both ~1.6 m out, so a reset more
    // than 40 m back counts as a lay-by)
    const kind = got.past < -1.2 ? 'on the road' : got.past < 0.9 ? 'half on'
      : got.back > 40 ? 'in a lay-by' : 'off the road';
    kinds[kind]++;
    backs.push(got.back);
    // (SHOTS: the first few resets photographed, at 2x)
    if (backs.length <= +(process.env.SHOTS || 0)) await page.screenshot({ path:
      `tools/scratch/_vergespots-${backs.length}.png` });
  }
  backs.sort((low, high) => low - high);
  console.log(`${ROAD}${process.env.Q || ''}: ${backs.length} resets - ${JSON.stringify(kinds)};`
    + ` m back: median ${backs[backs.length >> 1].toFixed(0)}, most ${backs[backs.length - 1]
      .toFixed(0)}`);
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
