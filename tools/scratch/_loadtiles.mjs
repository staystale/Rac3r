// _loadtiles.mjs - THE GROUND AFTER THE LOADING BAR (scratch): a race started as the menu starts it
// (__game.launch, behind the loading screen), at a given screen size; each frame from the tap
// logged - the screen up, the fly-in, ground tiles painted, GPU uploads, the zoom, the frame gap.
// Prints what was painted behind the bar, then each frame after it while tiles are still being
// painted or uploaded, and the totals; SHOTS=<dir> also photographs the screen every ~100 ms for
// 1.6 s after the bar.
// [W=844] [H=390] [DPR=3] [MOBILE=1] [CPU=1] [AI=0] [SHOTS=dir] node tools/scratch/_loadtiles.mjs
//   <level> [extra query, e.g. loadahead=1]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'stadeprance', extra = ''] = process.argv.slice(2);
const W = +(process.env.W || 844), H = +(process.env.H || 390), DPR = +(process.env.DPR || 3);
const MOBILE = (process.env.MOBILE ?? (W < H || W <= 932 ? '1' : '0')) === '1';
const CPU = +(process.env.CPU || 1), AI = +(process.env.AI || 0), SHOTS = process.env.SHOTS || '';
// s the run waits for the fly-in to end
const LIMIT_S = 40;

/**
 * Page side: a frame log from now on.
 * @returns {void}
 */
function installFrameLog() {
  const game = window.__game, log = [];
  window.__frameLog = log;
  const screenUp = () => {
    const el = document.getElementById('loadscreen');
    return !!el && !el.classList.contains('gone') && !el.classList.contains('fading');
  };
  const counts = () => {
    const gpu = game.renderer.gpuCounts || { uploads: 0, mipmaps: 0 };
    return [game.renderer.groundRenders, gpu.uploads];
  };
  let prev = counts();
  const tick = (now) => {
    const here = counts();
    log.push({ wall: performance.now(), now, screen: screenUp(), flying: game.renderer.flying,
      tiles: here[0] - prev[0], uploads: here[1] - prev[1], ppm: game.renderer.PPM,
      cached: game.renderer.tileCount });
    prev = here;
    if (log.length < 20000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: W, height: H },
    deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await gotoGame(page, `${server.url}/?guide=0&menu=0&rules=0&noaudio=1${MOBILE ? '&touch=1' : ''}`
    + (extra ? '&' + extra : ''));
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(4000 * CPU);
  await page.evaluate(installFrameLog);
  const began = await page.evaluate(([level, ai]) => {
    const at = performance.now();
    window.__game.launch(level, 'hatch-rwd', { ai });
    return at;
  }, [levelId, AI]);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.waitForFunction(() => {
      const el = document.getElementById('loadscreen');
      return el && (el.classList.contains('gone') || el.classList.contains('fading'));
    }, null, { polling: 20, timeout: LIMIT_S * 1000 });
    for (let shot = 0; shot <= 16; shot++) {
      await page.screenshot({ path: `${SHOTS}/${levelId}-${W}x${H}-${String(shot * 100)
        .padStart(4, '0')}ms.png` });
      await page.waitForTimeout(Math.max(0, 100 - 40));
    }
  }
  await page.waitForFunction((at) => {
    const log = window.__frameLog;
    const after = log.filter((frame) => frame.wall > at);
    const flewAt = after.findIndex((frame) => frame.flying);
    return flewAt >= 0 && after.slice(flewAt).some((frame) => !frame.flying && !frame.screen);
  }, began, { polling: 100, timeout: LIMIT_S * 1000 }).catch(() => console.log('(fly-in not over)'));
  await page.waitForTimeout(500);
  const frames = (await page.evaluate(() => window.__frameLog)).filter((frame) => frame.wall >= began);
  report(frames, began);
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}

/**
 * Prints the run.
 * @param {object[]} frames the frames from the tap
 * @param {number} began the tap, page ms
 */
function report(frames, began) {
  const firstAfter = frames.findIndex((frame) => !frame.screen && frame.wall > began + 50);
  const behind = frames.slice(0, Math.max(0, firstAfter));
  const after = firstAfter >= 0 ? frames.slice(firstAfter) : [];
  const sum = (list, key) => list.reduce((total, frame) => total + frame[key], 0);
  const gap = (i) => (i > 0 ? frames[i].wall - frames[i - 1].wall : 0);
  console.log(`${levelId} at ${W}x${H} dpr ${DPR}${MOBILE ? ' (phone)' : ' (PC)'}, CPU x${CPU}`
    + `${extra ? ', ' + extra : ''}`);
  console.log(`  behind the bar: ${behind.length} frames, ${sum(behind, 'tiles')} tiles painted, `
    + `${sum(behind, 'uploads')} uploads; the bar gone ${firstAfter >= 0
      ? Math.round(frames[firstAfter].wall - began) : '-'} ms after the tap`);
  const busy = after.map((frame, i) => ({ ...frame, i, gap: gap(firstAfter + i) }))
    .filter((frame) => frame.tiles || frame.uploads);
  const lastBusy = busy.length ? busy[busy.length - 1] : null;
  console.log(`  after the bar: ${busy.length} frames painting or uploading, ${sum(after, 'tiles')} `
    + `tiles, ${sum(after, 'uploads')} uploads; the last at frame ${lastBusy ? lastBusy.i : '-'} `
    + `(${lastBusy ? Math.round(lastBusy.wall - frames[firstAfter].wall) : '-'} ms after the bar); `
    + `most in a frame: ${Math.max(0, ...after.map((frame) => frame.tiles))} tiles, `
    + `${Math.max(0, ...after.map((frame) => frame.uploads))} uploads`);
  const flyFrames = after.filter((frame) => frame.flying);
  const gaps = after.map((frame, i) => gap(firstAfter + i)).slice(1);
  console.log(`  the fly-in: ${flyFrames.length} frames, frame gap median `
    + `${(gaps.sort((a, b) => a - b)[gaps.length >> 1] || 0).toFixed(1)} ms, worst `
    + `${Math.max(0, ...gaps).toFixed(1)} ms, the first frame after the bar `
    + `${after[1] ? (after[1].wall - after[0].wall).toFixed(1) : '-'} ms`);
  console.log('  frames after the bar (frame: tiles/uploads @ css px a metre), first 24 busy:');
  console.log('   ', busy.slice(0, 24).map((frame) => `${frame.i}:${frame.tiles}/${frame.uploads}`
    + `@${frame.ppm.toFixed(1)}`).join(' '));
}
