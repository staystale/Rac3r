// _hjgrid.mjs - HOLY JEEZ'S GRID WITH A FULL FIELD (scratch): the race launched as the game
// launches it (?holyjeez=1, VS AI n, rallycross), held at the lights; every car's place against
// the start lane (m past its edge, 0 = on it) and the nearest tree trunk, and a photo of the grid
// from above at phone size into OUT (default shots/holyjeez). node tools/scratch/_hjgrid.mjs [ai n]
// [seed] (env VIEW, ZOOM)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [aiArg = '20', seedArg = '1'] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/holyjeez', ZOOM = +(process.env.ZOOM || 0.22);
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&menu=0&noaudio=1&level=holyjeez`
    + `&holyjeez=1&seed=${seedArg}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((count) => window.__game.launch('holyjeez', 'rx-super',
    { ai: count, diff: 2, laps: 4, rx: true }), +aiArg);
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(() => {
    const game = window.__game, level = game.level;
    const lane = level.lanes.find((one) => Math.hypot(one.pts.at(-1)[0] - level.subtrack.pts[0].x,
      one.pts.at(-1)[1] - level.subtrack.pts[0].y) < 20);
    const toLine = (pts, x, y) => {
      let best = Infinity;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
        const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        best = Math.min(best, Math.hypot(ax + along * dx - x, ay + along * dy - y));
      }
      return best;
    };
    const trees = level.props.filter((prop) => prop.kind === 'tree');
    const cars = [game.car, ...game.ai.map((entry) => entry.car)];
    return cars.map((car, slot) => ({ who: slot ? `AI ${slot}` : 'YOU', x: car.x, y: car.y,
      pastLane: Math.max(0, toLine(lane.pts, car.x, car.y) - lane.width / 2),
      tree: Math.min(...trees.map((tree) => Math.hypot(tree.x - car.x, tree.y - car.y))) }));
  });
  for (const row of rows) console.log(`${row.who.padEnd(5)} (${row.x.toFixed(0)},${row.y.toFixed(0)})`
    + ` past the lane's edge ${row.pastLane.toFixed(1)} m, nearest tree ${row.tree.toFixed(1)} m`);
  const off = rows.filter((row) => row.pastLane > 1);
  console.log(`${off.length} of ${rows.length} cars more than 1 m past the start lane's edge`);
  const back = rows.reduce((far, row) => (row.pastLane >= far.pastLane ? row : far), rows[0]);
  await page.evaluate(([x, y, zoom]) => {
    const game = window.__game;
    game.renderer.debugZoom(zoom);
    game.car.x = x;
    game.car.y = y;
  }, [(rows[0].x + back.x) / 2, (rows[0].y + back.y) / 2, ZOOM]).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/grid-${aiArg}-${viewW}x${viewH}.png` });
  console.log(errors.length ? `ERRORS ${errors.slice(0, 3).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
