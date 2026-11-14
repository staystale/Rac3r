// _flycost.mjs - WHAT EACH FLY-IN FRAME COSTS, PART BY PART (scratch): the real game at phone size,
// a race launched as the menu launches it (20 AI; ?loadscreen=1 unless LOADSCREEN=0), and every
// frame of the fly-in once it shows (the loading screen gone) logged: the gap since the frame
// before (what the player sees), our JS drawing time (renderer.frame) and the zoom (px a metre /
// the zoom-1 px a metre). The frames zoomed out past the tiles' hand-over (zoom < 0.28: the
// whole-level picture) are summed apart. Run it with ?skip=props, ?skip=cones, ... to read what a
// layer costs in a frame including the browser's raster after our JS (a CPU profile cannot see
// that), or with ?smoothfly=1 for the switch. Also the canvases held (core/memorybudget.ts) before
// the launch, as the fly-in shows and after it.
// [CPU=1] [AI=20] [RX=1] [LOADSCREEN=0] [VIEW=844x390] node tools/scratch/_flycost.mjs [level]
//   [extra query, e.g. skip=props]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'spa', extra = ''] = process.argv.slice(2);
const CPU = Number(process.env.CPU || 1), AI = Number(process.env.AI || 20);
const IS_RX = process.env.RX === '1', SCREEN = process.env.LOADSCREEN === '0' ? '' : '&loadscreen=1';
const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
// the tiles' hand-over zoom (render/camera.ts FLY_HANDOVER)
const HANDOVER = 0.28;
// ms between looks at the game while waiting
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
 * Page side: logs every frame from now (gap, our drawing ms, zoom, flying, the screen up).
 * @param {number} zoomOnePpm px a metre at zoom 1
 * @returns {void}
 */
function installLog(zoomOnePpm) {
  const game = window.__game, renderer = game.renderer, frame = renderer.frame;
  const log = [];
  window.__flyLog = log;
  let drawMs = 0;
  renderer.frame = (...args) => {
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
      screen });
    drawMs = 0;
    last = now;
    if (log.length < 3000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

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
  const gaps = frames.map((frame) => frame.gap).sort((one, two) => one - two);
  const js = frames.map((frame) => frame.drawMs).sort((one, two) => one - two);
  const sum = gaps.reduce((total, gap) => total + gap, 0);
  console.log(`  ${label}: ${frames.length} frames, ${Math.round(sum)} ms; gap median`
    + ` ${Math.round(gaps[gaps.length >> 1])}, worst ${Math.round(gaps[gaps.length - 1])};`
    + ` our drawing JS median ${js[js.length >> 1].toFixed(1)}, worst ${js[js.length - 1].toFixed(1)}`);
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${SCREEN}`
    + (extra ? '&' + extra : ''));
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
  await page.evaluate(([level, count, isRx]) => window.__game.launch(level, 'hatch-rwd',
    { ai: count, rx: isRx }), [levelId, AI, IS_RX]);
  const canvasMb = () => page.evaluate(async () => (await import('/src/core/memorybudget.ts'))
    .canvasBytes() / 1048576);
  const beforeMb = await canvasMb();
  await waitFor(page, "window.__game.renderer.flying && (document.getElementById('loadscreen')"
    + " || { classList: { contains: () => true } }).classList.contains('gone')", 120000);
  const flyMb = await canvasMb();
  await waitFor(page, '!window.__game.renderer.flying', 120000);
  await page.waitForTimeout(300);
  const afterMb = await canvasMb();
  const log = await page.evaluate(() => window.__flyLog);
  const shown = log.filter((frame) => frame.flying && !frame.screen);
  console.log(`${levelId}${IS_RX ? ' RX' : ''} x${CPU} ${viewW}x${viewH}${SCREEN ? ' loadscreen'
    : ''}${extra ? ' ' + extra : ''}:`);
  console.log(`  canvases held: before the launch ${beforeMb.toFixed(1)} MB, as the fly-in shows`
    + ` ${flyMb.toFixed(1)}, after it ${afterMb.toFixed(1)}`);
  summarise('the fly-in, shown', shown);
  summarise('of it zoomed out (the picture)', shown.filter((frame) => frame.zoom < HANDOVER));
  summarise('of it zoomed in (the tiles)', shown.filter((frame) => frame.zoom >= HANDOVER));
  console.log('  frames (gap ms / our JS ms @ zoom): ' + shown.map((frame) =>
    `${Math.round(frame.gap)}/${frame.drawMs.toFixed(0)}@${frame.zoom.toFixed(2)}`).join(' '));
  console.log(errors.length ? `  page errors: ${errors.slice(0, 3).join(' | ')}` : '  no page errors');
} finally {
  await browser.close();
  server.stop();
}
