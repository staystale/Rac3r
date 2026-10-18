// _zoomlurch.mjs - does the whole picture lurch while the zoom moves? Deterministic phone page,
// demo driver, AI on. Per frame: the camera, the zoom (px per metre), the drawn car. The screen
// position of fixed world points (the screen centre and corners at the start of each pair) is
// followed from frame to frame; its second difference (jerk, CSS px) is ~0 for a smooth camera.
// Jerk spikes are listed with what the zoom did around them.
// node tools/scratch/_zoomlurch.mjs [--only castle-cum] [--frames 1800] [--query "&x=1"]
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, installDriver, onlyList, SETTLE_MS } from '../lib/determinism.mjs';

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};

function measure(frames) {
  const game = window.__game, renderer = game.renderer, rows = [];
  for (let frame = 0; frame < frames; frame++) {
    window.__rt.step(1);
    const counts = renderer.gpuCounts || {};
    rows.push({ cx: renderer.cam.x, cy: renderer.cam.y, ppm: renderer.PPM,
      carX: game.drawn.x, carY: game.drawn.y, W: renderer.W, H: renderer.H,
      kph: Math.hypot(game.car.vx, game.car.vy) * 3.6, counts: { ...counts } });
  }
  return rows;
}

function screenOf(row, x, y) {
  return [(x - row.cx) * row.ppm + row.W / 2, (y - row.cy) * row.ppm + row.H / 2];
}

function analyse(rows) {
  const out = [];
  for (let at = 2; at < rows.length; at++) {
    const [a, b, c] = [rows[at - 2], rows[at - 1], rows[at]];
    let worst = 0;
    // world points under the middle frame's centre and corners
    for (const [sx, sy] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
      const wx = b.cx + (sx - 0.5) * b.W / b.ppm, wy = b.cy + (sy - 0.5) * b.H / b.ppm;
      const pa = screenOf(a, wx, wy), pb = screenOf(b, wx, wy), pc = screenOf(c, wx, wy);
      const jerk = Math.hypot(pc[0] - 2 * pb[0] + pa[0], pc[1] - 2 * pb[1] + pa[1]);
      worst = Math.max(worst, jerk);
    }
    const carA = screenOf(a, a.carX, a.carY), carB = screenOf(b, b.carX, b.carY),
      carC = screenOf(c, c.carX, c.carY);
    const carJerk = Math.hypot(carC[0] - 2 * carB[0] + carA[0], carC[1] - 2 * carB[1] + carA[1]);
    const zoomRate = Math.log2(c.ppm / b.ppm) * 60;
    const zoomAcc = (Math.log2(c.ppm / b.ppm) - Math.log2(b.ppm / a.ppm)) * 3600;
    out.push({ at, worst, carJerk, zoomRate, zoomAcc, kph: c.kph, ppm: c.ppm });
  }
  return out;
}

const pct = (values, fraction) => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted.length ? sorted[Math.floor(fraction * (sorted.length - 1))] : NaN;
};

async function runLevel(browser, base, id) {
  const errors = [];
  const page = await openPage(browser, base, id, errors, extraQuery() + option('--query', ''));
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate(launchLevel, [id, {}]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installDriver);
  await page.evaluate(() => window.__rt.step(150));
  const rows = await page.evaluate(measure, +option('--frames', '1800'));
  await page.context().close();
  if (errors.length) console.log(`${id}: page error: ${errors[0]}`);
  const res = analyse(rows);
  const held = res.filter((r) => Math.abs(r.zoomRate) < 1e-6),
    moving = res.filter((r) => Math.abs(r.zoomRate) >= 1e-6);
  const show = (list, key) => [0.5, 0.95, 0.99, 1].map((f) => pct(list.map((r) => r[key]), f)
    .toFixed(3)).join(' ');
  console.log(`${id}: ${res.length} frames, zoom moving in ${moving.length}`);
  console.log(`  world jerk px (med p95 p99 max)  held: ${show(held, 'worst')}`
    + `   moving: ${show(moving, 'worst')}`);
  console.log(`  car jerk px                       held: ${show(held, 'carJerk')}`
    + `   moving: ${show(moving, 'carJerk')}`);
  const spikes = res.filter((r) => r.worst > 0.5).slice(0, 25);
  for (const s of spikes) {
    console.log(`   frame ${s.at}: jerk ${s.worst.toFixed(2)} px, car ${s.carJerk.toFixed(2)}, `
      + `zoom rate ${s.zoomRate.toFixed(3)} oct/s, zoom acc ${s.zoomAcc.toFixed(2)}, `
      + `${s.kph.toFixed(0)} km/h ppm ${s.ppm.toFixed(2)}`);
  }
}

const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  for (const id of onlyList() || ['castle-cum']) await runLevel(browser, server.url, id);
} finally {
  await browser?.close();
  server.stop();
}
