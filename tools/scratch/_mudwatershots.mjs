// _mudwatershots.mjs - ?mudwater=1 in the real game: the car parked beside a level's mud, a hot
// dry spell held (track 120 C: six times the 20 C pace, a stress test of the repaints), the frame
// times over the drying (median / 99th / max, and frames over 25 ms) against the same run with
// the switch off, photos at 844x390 as it dries and one at 390x844; page errors printed.
// node tools/scratch/_mudwatershots.mjs [level]   (default sandbox; the car parks in its biggest mud)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const level = process.argv[2] || 'sandbox';
const HOLD_C = 120, SECONDS = 100;
const server = await startServer();
const browser = await launchBrowser();

async function holdAndTime(page, seconds) {
  return page.evaluate(async ([holdC, runS]) => {
    const weather = await import('/src/world/weather.ts');
    const times = [];
    let last = performance.now();
    const end = last + runS * 1000;
    await new Promise((done) => {
      const tick = (now) => {
        weather.WEATHER.trackC = holdC;
        weather.WEATHER.rain = 0;
        weather.setWetness(0);
        times.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
    return times;
  }, [HOLD_C, seconds]);
}

const summary = (times) => {
  const sorted = [...times].sort((first, second) => first - second);
  const pick = (share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
  return `${times.length} frames, median ${pick(0.5).toFixed(1)} 99th ${pick(0.99).toFixed(1)}`
    + ` max ${sorted[sorted.length - 1].toFixed(1)} ms, over 25 ms: `
    + `${times.filter((ms) => ms > 25).length}`;
};

try {
  for (const on of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const notes = [];
    page.on('pageerror', (error) => notes.push('ERROR ' + error));
    page.on('console', (message) => {
      if (message.type() !== 'log') notes.push(message.type() + ' ' + message.text());
    });
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&level=${level}`
      + (on ? '&mudwater=1' : ''));
    await page.touchscreen.tap(422, 195);
    await page.waitForTimeout(500);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
    await page.waitForTimeout(4000);
    const placed = await page.evaluate(async () => {
      const mud = await import('/src/world/levelmud.ts');
      const wear = await import('/src/world/wear.ts');
      const game = window.__game;
      // the densest spot of the level's own mud (most mud squares within 10 m), the car 8 m left
      const points = [];
      for (const box of mud.levelMudPieces().map((piece) => piece.box)) {
        for (let px = box.x0; px < box.x1; px += 2) {
          for (let py = box.y0; py < box.y1; py += 2) {
            const id = wear.groundSurfaceAt(px, py).id;
            if (id === 'mud' || id === 'thickMud') points.push([px, py]);
          }
        }
      }
      let best = points[0], bestCount = -1;
      for (const [px, py] of points) {
        let count = 0;
        for (const [qx, qy] of points) if ((qx - px) ** 2 + (qy - py) ** 2 < 100) count++;
        if (count > bestCount) { bestCount = count; best = [px, py]; }
      }
      const x = best[0] - 8, y = best[1];
      const box = { x0: best[0], x1: best[0] + bestCount, y0: 0, y1: 0 };
      game.car.x = x; game.car.y = y; game.car.vx = game.car.vy = 0;
      game.renderer.snap(game.car);
      return `car at ${x.toFixed(0)},${y.toFixed(0)} on ${wear.groundSurfaceAt(x, y).id}`
        + ` (${box.x1 - box.x0} mud points within 10 m of ${best.join(',')})`;
    });
    console.log(`${on ? 'ON ' : 'OFF'} ${placed}`);
    const all = [];
    for (let shot = 0; shot <= 4; shot++) {
      const file = join(tmpdir(), `mudwater-${on ? 'on' : 'off'}-${shot * 25}s.png`);
      await page.screenshot({ path: file });
      if (on) console.log('  photo', file);
      if (shot < 4) all.push(...await holdAndTime(page, SECONDS / 4));
    }
    console.log(`${on ? 'ON ' : 'OFF'}: ${summary(all)}`);
    if (on) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(800);
      const file = join(tmpdir(), 'mudwater-on-portrait.png');
      await page.screenshot({ path: file });
      console.log('  photo', file);
    }
    console.log(notes.length ? notes.slice(0, 6).join('\n') : '  no page errors or warnings');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
