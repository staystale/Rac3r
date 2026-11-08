// _hudflash.mjs - owner 11-02: "UI / HUD flashes like crazy when driving off the track". Castle Kum,
// the hatch put on the grass beside the track and driven (throttle + steer) 4 s; the screen
// grabbed ~20 times: per HUD region, how many grabs differ from the one before. Plain vs the round.
// node tools/scratch/_hudflash.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROUND = '&heavywet=1&menureset=1&markage=1&treenight=1&hwsnow=1&wheelgone=1&menucar=1&ainumbers=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', ROUND]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${q}`);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const g = window.__game, { reset } = await import('/src/vehicle.ts');
      const { surfaceAt } = await import('/src/world/wear.ts').catch(() => ({}));
      // walk out from the car sideways until the ground is grass
      for (let d = 4; d < 60; d += 1) {
        const x = g.car.x - Math.sin(g.car.heading) * d, y = g.car.y + Math.cos(g.car.heading) * d;
        reset(g.car, x, y, g.car.heading);
        await new Promise((r) => setTimeout(r, 30));
        if (/grass/.test(g.car.surface.id)) break;
      }
    });
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowLeft');
    const grabs = [];
    for (let i = 0; i < 24; i++) {
      grabs.push(await page.screenshot({ type: 'png' }));
      await page.waitForTimeout(120);
    }
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft');
    const surf = await page.evaluate(() => window.__game.car.surface.id);
    const res = await page.evaluate(async (pngs) => {
      const regions = { top: [0, 0, 844, 50], speedo: [710, 0, 134, 140], aids: [715, 145, 120, 45],
        minimap: [0, 50, 140, 140], damage: [0, 190, 140, 140] };
      const imgs = [];
      for (const b64 of pngs) { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); imgs.push(im); }
      const c = document.createElement('canvas'); c.width = 844; c.height = 390; const ctx = c.getContext('2d');
      const data = imgs.map((im) => { ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, 844, 390).data; });
      const out = {};
      for (const [name, [x, y, w, h]] of Object.entries(regions)) {
        let changes = 0;
        for (let k = 1; k < data.length; k++) {
          let diff = 0;
          for (let yy = y; yy < y + h; yy += 2) for (let xx = x; xx < x + w; xx += 2) {
            const i = (yy * 844 + xx) * 4; diff += Math.abs(data[k][i] - data[k - 1][i]);
          }
          if (diff / (w * h / 4) > 6) changes++;
        }
        out[name] = changes;
      }
      return out;
    }, grabs.map((b) => b.toString('base64')));
    console.log((q ? 'round' : 'plain').padEnd(6), surf, JSON.stringify(res));
    await page.screenshot({ path: `tools/scratch/_hudflash-${q ? 'round' : 'plain'}.png` });
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
