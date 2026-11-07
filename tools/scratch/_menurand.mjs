// _menurand.mjs - AI R7 (owner 11-07 "2. ok"): the menu race on a random track (?menurand=1).
// Opens the menu N times (game/menuflow.ts enterMenu, as MAIN MENU does) and per visit prints the
// track, the ms the menu took to open, the camera car's and the AI's mean speed over 8 s, how
// many AI are moving, and a phone-size shot (tools/scratch/_menurand-<n>.png).
// node tools/scratch/_menurand.mjs [visits] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [visitArg = '8', query = 'menurand=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=1&rules=0&noaudio=1&${query}`);
  await page.waitForTimeout(4000);
  if (process.env.HW) await page.evaluate(() => { window.__hwOnly = true; });
  for (let visit = 0; visit < +visitArg; visit++) {
    const res = await page.evaluate(async () => {
      const g = window.__game, flow = await import('/src/game/menuflow.ts');
      const t0 = performance.now();
      if (g.mode !== 'menu' || window.__visited) flow.enterMenu();
      // (HW=1: on until the menu race is on the highway)
      for (let k = 0; window.__hwOnly && !g.level.endless && k < 40; k++) flow.enterMenu();
      window.__visited = true;
      const openMs = performance.now() - t0;
      await new Promise((done) => setTimeout(done, 1500));
      let me = 0, them = 0, n = 0;
      const moving = new Set(), frames = [];
      let last = performance.now(), on = true;
      const tickFrame = (now) => { frames.push(now - last); last = now; if (on) requestAnimationFrame(tickFrame); };
      requestAnimationFrame(tickFrame);
      for (let tick = 0; tick < 16; tick++) {
        await new Promise((done) => setTimeout(done, 500));
        me += Math.hypot(g.car.vx, g.car.vy);
        for (const entry of g.ai) {
          const v = Math.hypot(entry.car.vx, entry.car.vy);
          them += v; n++;
          if (v > 3) moving.add(entry);
        }
      }
      on = false;
      frames.sort((first, second) => first - second);
      const frameMs = frames.reduce((sum, ms) => sum + ms, 0) / Math.max(1, frames.length);
      const p95 = frames[Math.floor(frames.length * 0.95)] || 0;
      return { frameMs, p95, level: g.level.id, road: g.level.roadType || '', openMs, me: me / 16 * 3.6,
        them: them / Math.max(1, n) * 3.6, ai: g.ai.length, moving: moving.size, traffic: (g.traffic.list || g.traffic.cars || []).length };
    });
    console.log(`visit ${visit + 1}: ${(res.level + (res.road ? ' ' + res.road : '')).padEnd(24)}`
      + ` open ${res.openMs.toFixed(0)} ms | camera car ${res.me.toFixed(0)} km/h | AI`
      + ` ${res.them.toFixed(0)} km/h, ${res.moving} of ${res.ai} moving, ${res.traffic} traffic | frame ${res.frameMs.toFixed(1)} ms`
      + ` (95 % under ${res.p95.toFixed(1)})`);
    await page.screenshot({ path: `tools/scratch/_menurand-${visit + 1}.png` });
  }
  console.log(errors.length ? 'PAGE ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
