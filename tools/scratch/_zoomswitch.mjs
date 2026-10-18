// _zoomswitch.mjs - a slow zoom glide over the ground only (car still at the start, cars / props /
// hud skipped), one zoom change a frame like the spring. Per frame: GPU uploads and mipmap builds,
// draw ms, and how much the picture changed against the previous frame scaled about the centre
// by the zoom ratio (% of pixels in the middle box whose colour moved by more than TOL). A smooth
// zoom keeps that % low and steady; a switch of drawing method shows as a spike.
// node tools/scratch/_zoomswitch.mjs [--only castle-cum] [--from 0.62] [--to 0.38] [--frames 120]
//   [--query "&x=1"]
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, onlyList, SETTLE_MS } from '../lib/determinism.mjs';

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const CPU_RASTER_ARGS = [
  '--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];

function glide([from, to, frames]) {
  const game = window.__game, renderer = game.renderer, TOL = 40;
  const screen = document.getElementById('c'), ground = document.getElementById('glground');
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = screen.width; canvas.height = screen.height;
    return [canvas, canvas.getContext('2d', { willReadFrequently: true })];
  };
  const [pic, picCtx] = make(), [prev, prevCtx] = make(), [warp, warpCtx] = make();
  const rows = [];
  let lastZoom = from;
  renderer.debugZoom(from);
  window.__rt.step(60);
  const grab = (target) => {
    target.clearRect(0, 0, pic.width, pic.height);
    if (ground) target.drawImage(ground, 0, 0);
    target.drawImage(screen, 0, 0);
  };
  grab(prevCtx);
  for (let frame = 1; frame <= frames; frame++) {
    const zoom = from * Math.pow(to / from, frame / frames);
    renderer.debugZoom(zoom);
    const before = { ...(renderer.gpuCounts || {}) };
    const t0 = performance.now();
    window.__rt.step(1);
    const ms = performance.now() - t0;
    const after = renderer.gpuCounts || {};
    grab(picCtx);
    // the previous picture scaled about the centre by the zoom ratio
    const ratio = zoom / lastZoom, w = pic.width, h = pic.height;
    warpCtx.clearRect(0, 0, w, h);
    warpCtx.imageSmoothingEnabled = true;
    warpCtx.drawImage(prev, w / 2 - (w / 2) * ratio, h / 2 - (h / 2) * ratio, w * ratio, h * ratio);
    const box = [Math.round(w * 0.3), Math.round(h * 0.3), Math.round(w * 0.4), Math.round(h * 0.4)];
    const now = picCtx.getImageData(...box).data, was = warpCtx.getImageData(...box).data;
    let changed = 0, lum = 0, lumWas = 0;
    for (let i = 0; i < now.length; i += 4) {
      const diff = Math.abs(now[i] - was[i]) + Math.abs(now[i + 1] - was[i + 1])
        + Math.abs(now[i + 2] - was[i + 2]);
      if (diff > TOL) changed++;
      lum += now[i] + now[i + 1] + now[i + 2];
      lumWas += was[i] + was[i + 1] + was[i + 2];
    }
    const pixels = now.length / 4;
    rows.push({ zoom, ms, uploads: after.uploads - before.uploads,
      mipmaps: after.mipmaps - before.mipmaps, changed: 100 * changed / pixels,
      bright: (lum - lumWas) / pixels / 3 });
    prevCtx.clearRect(0, 0, w, h);
    prevCtx.drawImage(pic, 0, 0);
    lastZoom = zoom;
  }
  return { rows, devPerMetre: renderer.PPM * renderer.dpr, cssPpm: renderer.PPM };
}

async function runLevel(browser, base, id) {
  const errors = [];
  const page = await openPage(browser, base, id, errors,
    '&skip=world,car,hud' + extraQuery() + option('--query', ''));
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate(launchLevel, [id, { ai: 0 }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => window.__rt.step(180));
  const { rows } = await page.evaluate(glide,
    [+option('--from', '0.62'), +option('--to', '0.38'), +option('--frames', '120')]);
  await page.context().close();
  if (errors.length) console.log(`${id}: page error: ${errors[0]}`);
  console.log(`${id}: zoom glide, ${rows.length} frames`);
  for (const r of rows) {
    const flag = r.changed > 8 || r.mipmaps > 0 ? '  <--' : '';
    console.log(`  zoom ${r.zoom.toFixed(4)}  changed ${r.changed.toFixed(1).padStart(5)} %  `
      + `bright ${r.bright.toFixed(1).padStart(5)}  mipmaps ${r.mipmaps}  uploads ${r.uploads}  `
      + `${r.ms.toFixed(1)} ms${flag}`);
  }
}

const server = await startServer();
let browser;
try {
  browser = await launchBrowser({ args: CPU_RASTER_ARGS });
  for (const id of onlyList() || ['castle-cum']) await runLevel(browser, server.url, id);
} finally {
  await browser?.close();
  server.stop();
}
