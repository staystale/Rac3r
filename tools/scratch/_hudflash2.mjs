// _hudflash2.mjs - owner 11-02: the HUD flashes on the TEST link only, "after damage off road".
// Castle Cum, hatch on the grass, damaged (corners / a wheel off / a rim), driven 4 s; every
// frame the HUD regions' mean brightness is read after the game drew (setTimeout 0 after rAF);
// counts frames whose region jumps >12 against both neighbours (a flash). Plain vs round.
// node tools/scratch/_hudflash2.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROUND = '&heavywet=1&menureset=1&markage=1&treenight=1&hwsnow=1&wheelgone=1&menucar=1&ainumbers=1';
const HURTS = { wheel: 'wheel' };
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const hurt of Object.keys(HURTS)) for (const q of ['', ROUND]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ' + m.text().slice(0, 200)); });
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${q}`);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
    await page.mouse.click(400, 200);
    await page.waitForTimeout(1500);
    await page.evaluate(async (hurt) => {
      const g = window.__game, { reset } = await import('/src/vehicle.ts');
      for (let d = 4; d < 60; d += 1) {
        const x = g.car.x - Math.sin(g.car.heading) * d, y = g.car.y + Math.cos(g.car.heading) * d;
        reset(g.car, x, y, g.car.heading);
        await new Promise((r) => setTimeout(r, 30));
        if (/grass/.test(g.car.surface.id)) break;
      }
      const c = g.car;
      for (let k = 0; k < 4; k++) c.dmg[k] = 0.55;
      if (hurt === 'wheel') c.wheelOff[2] = true;
      if (hurt === 'rim') { c.tyreP[1] = 0; c.onRim[1] = true; }
    }, hurt);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowLeft');
    const res = await page.evaluate(() => new Promise((done) => {
      const cv = document.getElementById('c'), ctx = cv.getContext('2d');
      const sx = cv.width / innerWidth, sy = cv.height / innerHeight;
      const regions = { top: [0, 0, 844, 50], speedo: [710, 0, 134, 140], aids: [700, 140, 144, 60],
        minimap: [0, 50, 140, 140], damage: [0, 190, 160, 200], whole: [0, 0, 844, 390] };
      const rows = [];
      const t0 = performance.now();
      const sample = () => {
        const row = {};
        for (const [name, [x, y, w, h]] of Object.entries(regions)) {
          const d = ctx.getImageData(x * sx, y * sy, w * sx, h * sy).data;
          let sum = 0; for (let i = 0; i < d.length; i += 16) sum += d[i] + d[i + 1] + d[i + 2];
          row[name] = sum / (d.length / 16) / 3;
        }
        rows.push(row);
        if (performance.now() - t0 < 4000) requestAnimationFrame(() => setTimeout(sample, 0));
        else {
          const out = { frames: rows.length };
          for (const name of Object.keys(regions)) {
            let flashes = 0, maxJump = 0;
            for (let k = 1; k < rows.length - 1; k++) {
              const a = rows[k][name] - rows[k - 1][name], b = rows[k][name] - rows[k + 1][name];
              maxJump = Math.max(maxJump, Math.abs(a));
              if (Math.abs(a) > 12 && Math.abs(b) > 12 && Math.sign(a) === Math.sign(b)) flashes++;
            }
            out[name] = flashes + '/' + maxJump.toFixed(0);
          }
          done(out);
        }
      };
      requestAnimationFrame(() => setTimeout(sample, 0));
    }));
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft');
    const surf = await page.evaluate(() => window.__game.car.surface.id);
    console.log(hurt.padEnd(6), (q ? 'round' : 'plain').padEnd(6), surf, JSON.stringify(res));
    await page.screenshot({ path: `tools/scratch/_hudflash2-${hurt}-${q ? 'round' : 'plain'}.png` });
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
