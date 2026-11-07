// _carsheet.mjs - every car's pixel sprite (with wheels), drawn by the game's own garage painter,
// nose up, scaled x SCALE, with its name, on one sheet (owner 11-07, item 4: "reworking any cars
// that don't look like their real counter part"). node tools/scratch/_carsheet.mjs [out.png] [scale]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';

const [out = 'tools/scratch/_carsheet.png', scaleArg = '4'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  await page.waitForTimeout(1500);
  const url = await page.evaluate(async (scale) => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const r = window.__game.renderer, cols = 7, cellW = 45 * scale + 30, cellH = 80 * scale + 50;
    const sheet = document.createElement('canvas');
    sheet.width = cols * cellW; sheet.height = Math.ceil(cars.ROSTER.length / cols) * cellH;
    const sctx = sheet.getContext('2d');
    sctx.fillStyle = '#5a7a4a'; sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.imageSmoothingEnabled = false;
    cars.ROSTER.forEach((row, i) => {
      const spec = cars.applyLivery(veh.makeCar(row.id).spec, null);
      const pic = r.pixelCarWithWheels(spec), canvas = pic.c || pic.canvas || pic;
      const cx = (i % cols) * cellW + cellW / 2, cy = Math.floor(i / cols) * cellH + cellH / 2 - 10;
      sctx.save(); sctx.translate(cx, cy); sctx.rotate(-Math.PI / 2);
      sctx.drawImage(canvas, -canvas.width * scale / 2, -canvas.height * scale / 2,
        canvas.width * scale, canvas.height * scale);
      sctx.restore();
      sctx.fillStyle = '#fff'; sctx.font = '13px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(row.name, cx, Math.floor(i / cols) * cellH + cellH - 14);
      sctx.fillStyle = '#d8e6c8'; sctx.font = '11px sans-serif';
      sctx.fillText(row.id + ' (' + row.kind + ')', cx, Math.floor(i / cols) * cellH + cellH - 2);
    });
    return sheet.toDataURL('image/png');
  }, +scaleArg);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('saved ' + out + (errors.length ? ' | PAGE ERRORS ' + errors.slice(0, 2).join(' | ') : ''));
} finally { await browser.close(); server.stop(); }
