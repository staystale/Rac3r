// _bushslope.mjs - BUSHES ON A SLOPE (?bushflat=1, owner 11-10: "Don't apply terrain to bushes"):
// on LEVEL the bushes standing where the ground's height changes most across them (the hill
// shading's bands fall there), the camera set on the steepest, a phone shot with the switch and
// without (_bushslope-<level>[-flat].png).
// node tools/scratch/_bushslope.mjs [level]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'killder';
const server = await startServer();
const browser = await launchBrowser();
try {
  let spot = null;
  for (const query of ['', '&bushflat=1']) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2 })).newPage();
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
    await page.mouse.click(195, 422);
    await page.waitForTimeout(800);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
    await page.waitForTimeout(3000);
    spot = await page.evaluate(async (had) => {
      const game = window.__game, lv = game.level;
      const bushes = (lv.allPatches || []).filter((patch) => patch.bush);
      let best = had;
      if (!best) {
        // the bump field's height (world/terrain.ts via the game's own lookup, if exposed)
        const heightAt = game.heightAt || ((x, y) => (lv.bumps || []).reduce((sum, bump) => {
          const dist = Math.hypot(x - bump.x, y - bump.y), r = bump.r || 1;
          return sum + (dist < r ? (bump.h ?? -(bump.d || 0)) * (1 - dist / r) : 0);
        }, 0));
        let worst = -1;
        for (const bush of bushes) {
          const rise = Math.abs(heightAt(bush.x + bush.w / 2, bush.y) - heightAt(bush.x - bush.w / 2,
            bush.y)) + Math.abs(heightAt(bush.x, bush.y + bush.h / 2) - heightAt(bush.x, bush.y
            - bush.h / 2));
          if (rise > worst) { worst = rise; best = { x: bush.x, y: bush.y, rise, count: bushes.length }; }
        }
      }
      if (!best) return null;
      Object.assign(game.car, { x: best.x + 6, y: best.y + 6, vx: 0, vy: 0 });
      game.renderer.snap(game.car);
      await new Promise((done) => setTimeout(done, 1800));
      return best;
    }, spot);
    await page.screenshot({ path: `tools/scratch/_bushslope-${level}${query ? '-flat' : ''}.png` });
    await page.context().close();
  }
  console.log('bush on the steepest ground:', JSON.stringify(spot));
} finally {
  await browser.close();
  server.stop();
}
