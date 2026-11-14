// _nightcost.mjs - WHAT THE NIGHT LAYER ASKS FOR IN EACH FLY-IN FRAME (scratch): as _flycost.mjs
// (the real game at phone size, a race launched as the menu launches it, ?loadscreen=1), at night
// (&night=NIGHT), and per frame of the fly-in once shown: the gap, our drawing JS, the zoom, and
// what was drawn into the night's light map - the canopy squares traced (rect), the pictures drawn
// (drawImage: pools, glows, beams), the fills. OFF=canopies drops the rects (the canopy path is
// empty), OFF=images drops the light map's drawImage calls: what a part costs incl. the raster.
// SOFT=1 launches the browser with the 2D canvas rasterised on the CPU (the laptop's GPU hides it).
// [NIGHT=0.94] [AI=20] [VIEW=440x738] [DPR=3] [OFF=canopies|images] [SOFT=1] [CPU=1]
//   node tools/scratch/_nightcost.mjs [level] [extra query, e.g. smoothfly=1&nightfly=1]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'spa', extra = ''] = process.argv.slice(2);
const NIGHT = process.env.NIGHT ?? '0.94', AI = Number(process.env.AI ?? 20);
const CPU = Number(process.env.CPU || 1), OFF = process.env.OFF || '';
const [viewW, viewH] = (process.env.VIEW || '440x738').split('x').map(Number);
const DPR = Number(process.env.DPR || 3);
// the tiles' hand-over zoom (render/camera.ts FLY_HANDOVER)
const HANDOVER = 0.28;
const POLL_MS = 50;

/**
 * Waits until a page-side test holds (or gives up after limitMs).
 * @param {import('playwright').Page} page the page
 * @param {string} test a page-side expression
 * @param {number} limitMs the most to wait
 * @returns {Promise<boolean>} whether it held
 */
async function waitFor(page, test, limitMs) {
  const began = Date.now();
  while (Date.now() - began < limitMs) {
    if (await page.evaluate(test)) return true;
    await page.waitForTimeout(POLL_MS);
  }
  return false;
}

/**
 * Page side: counts the calls made on the light map (the canvas filled whole in 'copy' each
 * frame), and drops a part when asked.
 * @param {string} off the part to drop: canopies, images or ''
 */
function installCounters(off) {
  const proto = CanvasRenderingContext2D.prototype, maps = new WeakSet();
  const counts = { rect: 0, drawImage: 0, fill: 0, fillRect: 0, stroke: 0 };
  window.__nightCounts = counts;
  const wrap = (name, isDropped) => {
    const real = proto[name];
    proto[name] = function wrapped(...args) {
      if (name === 'fillRect' && this.globalCompositeOperation === 'copy' && args[0] === 0
        && args[1] === 0 && args[2] === this.canvas.width) maps.add(this.canvas);
      if (maps.has(this.canvas)) {
        counts[name]++;
        if (isDropped) return undefined;
      }
      return real.apply(this, args);
    };
  };
  wrap('rect', off === 'canopies');
  wrap('drawImage', off === 'images');
  wrap('fill', false);
  wrap('fillRect', false);
  wrap('stroke', false);
}

/**
 * Page side: logs every frame from now (gap, our drawing ms, zoom, flying, the screen up, the
 * light map's calls).
 * @param {number} zoomOnePpm px a metre at zoom 1
 */
function installLog(zoomOnePpm) {
  const game = window.__game, renderer = game.renderer, frame = renderer.frame;
  const log = [], counts = window.__nightCounts;
  window.__flyLog = log;
  let drawMs = 0;
  renderer.frame = (...args) => {
    for (const key of Object.keys(counts)) counts[key] = 0;
    const began = performance.now();
    const out = frame(...args);
    drawMs = performance.now() - began;
    return out;
  };
  let last = performance.now();
  const tick = (now) => {
    const el = document.getElementById('loadscreen');
    const screen = !!el && !el.classList.contains('gone');
    log.push({ gap: now - last, drawMs, zoom: renderer.PPM / zoomOnePpm, flying: renderer.flying,
      screen, ...counts });
    drawMs = 0;
    last = now;
    if (log.length < 3000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * The median of a list of numbers.
 * @param {number[]} values the numbers
 * @returns {number} the median
 */
const median = (values) => [...values].sort((one, two) => one - two)[values.length >> 1];

/**
 * Prints a set of frames' summary.
 * @param {string} label the set
 * @param {object[]} frames the frames
 */
function summarise(label, frames) {
  if (!frames.length) {
    console.log(`  ${label}: none`);
    return;
  }
  const gaps = frames.map((frame) => frame.gap);
  const pick = (key) => frames.map((frame) => frame[key]);
  console.log(`  ${label}: ${frames.length} frames; gap median ${Math.round(median(gaps))}, worst`
    + ` ${Math.round(Math.max(...gaps))}; our JS median ${median(pick('drawMs')).toFixed(1)};`
    + ` light map a frame (median / most): rects ${median(pick('rect'))} / ${Math.max(...pick('rect'))},`
    + ` pictures ${median(pick('drawImage'))} / ${Math.max(...pick('drawImage'))},`
    + ` fills ${median(pick('fill'))}, strokes ${median(pick('stroke'))}`);
}

const server = await startServer();
const browser = await launchBrowser(process.env.SOFT === '1'
  ? { args: ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'] } : {});
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.addInitScript(installCounters, OFF);
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=1`
    + `&night=${NIGHT}` + (extra ? '&' + extra : ''));
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await waitFor(page, '!window.__game.renderer.flying', 30000);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const zoomOnePpm = await page.evaluate(() => {
    const renderer = window.__game.renderer;
    renderer.debugZoom(1);
    const ppm = renderer.PPM;
    renderer.debugZoom(null);
    return ppm;
  });
  await page.evaluate(installLog, zoomOnePpm);
  await page.evaluate(([level, count]) => window.__game.launch(level, 'hatch-rwd', { ai: count }),
    [levelId, AI]);
  await waitFor(page, "window.__game.renderer.flying && (document.getElementById('loadscreen')"
    + " || { classList: { contains: () => true } }).classList.contains('gone')", 120000);
  await waitFor(page, '!window.__game.renderer.flying', 120000);
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__flyLog);
  const flyStats = await page.evaluate(() => window.__game.renderer.flyStats);
  const shown = log.filter((frame) => frame.flying && !frame.screen);
  console.log(`${levelId} AI ${AI} x${CPU} ${viewW}x${viewH} dpr ${DPR} night ${NIGHT}`
    + `${extra ? ' ' + extra : ''}${OFF ? ' OFF=' + OFF : ''}${process.env.SOFT === '1' ? ' SOFT' : ''}:`);
  console.log(`  flyStats ${JSON.stringify(flyStats)}`);
  summarise('the fly-in, shown', shown);
  summarise('of it zoomed out (zoom < 0.28)', shown.filter((frame) => frame.zoom < HANDOVER));
  summarise('of it zoomed in', shown.filter((frame) => frame.zoom >= HANDOVER));
  const after = log.filter((frame) => !frame.flying && !frame.screen).slice(-60);
  summarise('after it (the last 60 frames)', after);
  console.log('  zoomed-out frames (gap / JS ms / rects / pictures @ zoom): ' + shown
    .filter((frame) => frame.zoom < HANDOVER).map((frame) => `${Math.round(frame.gap)}/`
      + `${frame.drawMs.toFixed(0)}/${frame.rect}/${frame.drawImage}@${frame.zoom.toFixed(3)}`)
    .join(' '));
  console.log(errors.length ? `  page errors: ${errors.slice(0, 3).join(' | ')}` : '  no page errors');
} finally {
  await browser.close();
  server.stop();
}
