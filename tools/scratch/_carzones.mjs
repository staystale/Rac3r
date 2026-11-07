// _carzones.mjs - every car's sprite (with wheels) as PNG data, twice: its own livery, and the
// ZONE TEST (paint pure red, trim pure green: where each car's second colour shows today). For the
// car colours mockup (owner 11-07, item 4). node tools/scratch/_carzones.mjs [out.json] [scale]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';

const [out = 'tools/scratch/_carzones.json', scaleArg = '3'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(async (scale) => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const r = window.__game.renderer;
    const shot = (spec) => {
      const pic = r.pixelCarWithWheels(spec), src = pic.c || pic.canvas || pic;
      const canvas = document.createElement('canvas');
      canvas.width = src.height * scale; canvas.height = src.width * scale;   // nose up
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(src, -src.width * scale / 2, -src.height * scale / 2, src.width * scale,
        src.height * scale);
      return canvas.toDataURL('image/png');
    };
    return cars.ROSTER.map((row) => ({ id: row.id, name: row.name, kind: row.kind,
      paint: row.paint, trim: row.trim, rim: row.rim || '',
      own: shot(cars.applyLivery(veh.makeCar(row.id).spec, null)),
      zones: shot(cars.applyLivery(veh.makeCar(row.id).spec,
        { paint: '#e02828', trim: '#22c24a' })) }));
  }, +scaleArg);
  writeFileSync(out, JSON.stringify(rows));
  console.log('saved ' + rows.length + ' cars to ' + out);
} finally { await browser.close(); server.stop(); }
