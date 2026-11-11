// _junctionshot.mjs - A MOTORWAY JUNCTION IN THE REAL GAME (?junctions=1): the autopilot drives the
// road (ROAD, SCENERY) until a junction bridge is within 400 m ahead, then the car is stopped on the
// near roundabout and photographed close and zoomed out (ZOOMS), then on the off-slip's start.
// [ROAD=motorway] [SCENERY=countryside] [VIEW=390x844] [ZOOMS=1,0.45] node tools/scratch/_junctionshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const ROAD = process.env.ROAD || 'motorway', SCENERY = process.env.SCENERY || 'countryside';
const zooms = (process.env.ZOOMS || '1,0.45').split(',');
const tag = `${SCENERY}-${ROAD}-${width}x${height}`;
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  for (const zoom of zooms) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
      + `&junctions=1&zoom=${zoom}${process.env.Q || ''}`);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(800);
    await page.evaluate(([road, scenery]) => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, road, scenery, traffic: 0 }), [ROAD, SCENERY]);
    let found = null;
    for (let waited = 0; waited < 300 && !found; waited += 0.5) {
      found = await page.evaluate(() => {
        const game = window.__game, car = game.car;
        const bridge = game.level.props.find((prop) => prop.rings && Math.hypot(prop.x - car.x,
          prop.y - car.y) < 400);
        return bridge ? { x: bridge.x, y: bridge.y, rot: bridge.rot, wid: bridge.wid } : null;
      });
      if (!found) await page.waitForTimeout(500);
    }
    if (!found) throw new Error('no junction reached');
    // the near ring: on the bridge's road past its left ramp (highway/ringgeo.ts)
    await page.evaluate((bridge) => {
      const game = window.__game, car = game.car;
      game.setAutopilot(false);
      const out = bridge.wid / 2 + 1.6 + 14 + 12.5 + 12;
      car.x = bridge.x - Math.cos(bridge.rot) * (out - 9);
      car.y = bridge.y - Math.sin(bridge.rot) * (out - 9);
      car.heading = bridge.rot;
      car.vx = car.vy = car.yawRate = 0;
      car.crossing = -1;
      car.crossX = car.x;
      car.crossY = car.y;
    }, found);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tools/scratch/_junction-ring-z${zoom}-${tag}.png` });
    page.close();
  }
  console.log(`${tag}: photos taken; errors ${errors.length ? errors.join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
