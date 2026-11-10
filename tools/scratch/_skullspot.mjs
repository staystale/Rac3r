// _skullspot.mjs - DEAF VALLEY'S SKULL ON A PHONE (?desertjunk=1): the car set still on the road
// 6 m from the first skull ahead near the verge (within 12 m of the road's edge), a phone shot, the
// skull's screen spot printed and a close crop round it (2x the phone's px) to see it is there.
// [ROAD=twisty] node tools/scratch/_skullspot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'twisty';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2 });
  const page = await context.newPage();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&desertjunk=1`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'canyon', traffic: 0 }), ROAD);
  await page.waitForTimeout(1500);
  const got = await page.evaluate(async () => {
    const game = window.__game, level = game.level, pts = level._hw.pts, hw = level._hw.geo.hw;
    for (let hop = 0; hop < 40; hop++) {
      const carS = level._hw.q?.s ?? 0;
      let best = null;
      for (const prop of level.props.filter((item) => item.kind === 'skull')) {
        let near = null, nd = Infinity;
        for (const pt of pts) {
          const dd = (pt.x - prop.x) ** 2 + (pt.y - prop.y) ** 2;
          if (dd < nd) { nd = dd; near = pt; }
        }
        if (Math.sqrt(nd) - hw < 12 && near.s > carS + 10 && (!best || near.s < best.pt.s))
          best = { prop, pt: near, off: Math.sqrt(nd) - hw };
      }
      if (best) {
        const idx = pts.indexOf(best.pt), next = pts[idx + 1];
        // (6 m from it toward the road, the camera snapped to the car)
        const toward = Math.atan2(best.pt.y - best.prop.y, best.pt.x - best.prop.x);
        Object.assign(game.car, { x: best.prop.x + Math.cos(toward) * 6, y: best.prop.y
          + Math.sin(toward) * 6, vx: 0, vy: 0, yawRate: 0, heading: Math.atan2(next.y
          - best.pt.y, next.x - best.pt.x) });
        game.renderer.snap(game.car);
        await new Promise((done) => setTimeout(done, 1200));
        const ren = game.renderer;
        return { off: +best.off.toFixed(1), sx: ren.toScreenX(best.prop.x),
          sy: ren.toScreenY(best.prop.y), ppm: ren.PPM };
      }
      const ahead = pts.find((pt) => pt.s > carS + 400) || pts[pts.length - 1];
      Object.assign(game.car, { x: ahead.x, y: ahead.y, vx: 0, vy: 0 });
      await new Promise((done) => setTimeout(done, 400));
    }
    return null;
  });
  console.log('skull', JSON.stringify(got));
  await page.screenshot({ path: 'tools/scratch/_skullspot.png' });
  if (got) await page.screenshot({ path: 'tools/scratch/_skullspot-near.png', clip: {
    x: Math.max(0, got.sx - 40), y: Math.max(0, got.sy - 40), width: 80, height: 80 } });
} finally {
  await browser.close();
  server.stop();
}
