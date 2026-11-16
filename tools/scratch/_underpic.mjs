// _underpic.mjs - ?underskin: the UNDERSIDE PICTURE a rolled car is painted from (render/carprofile.ts
// paintUnderProfile), whole and with its front-left torn off by a big hit (strut, wishbone, a driven
// wheel's shaft, the track rod) and its rear-right by a small one (the strut), x8, side by side.
// node tools/scratch/_underpic.mjs <out.png> [cars] [extra query]
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/_underpic.png', carsArg = 'hatch-fwd,saloon-rwd,wrz-awd',
  query = 'underskin=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
  await page.waitForTimeout(1500);
  const url = await page.evaluate(async (ids) => {
    const { paintUnderProfile } = await import('/src/render/carprofile.ts');
    const { drawnSpec } = await import('/src/render/cars.ts');
    const { makeCar } = await import('/src/vehicle.ts');
    const { wheelBits } = await import('/src/world/debris.ts');
    const SCALE = 8, pics = [];
    for (const id of ids) {
      const car = makeCar(id), spec = drawnSpec(car.spec);
      const torn = { wheelOff: [true, false, false, true], suspOff: [0, 0, 0, 0], spec: car.spec };
      wheelBits(torn, 0, Math.random, 0.8);
      wheelBits(torn, 3, Math.random, 0.4);
      const widthPx = Math.round(car.spec.wid * 17.3);
      pics.push(paintUnderProfile(spec, widthPx), paintUnderProfile(spec, widthPx, torn));
    }
    const width = Math.max(...pics.map((pic) => pic.img.width)) * SCALE;
    const sheet = document.createElement('canvas');
    sheet.width = width * 2 + 8;
    sheet.height = pics.filter((_, i) => i % 2 === 0).reduce((sum, pic) => sum + pic.img.height
      * SCALE + 8, 0);
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#888'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.imageSmoothingEnabled = false;
    let top = 0;
    pics.forEach((pic, i) => {
      const tmp = document.createElement('canvas');
      tmp.width = pic.img.width; tmp.height = pic.img.height;
      tmp.getContext('2d').putImageData(pic.img, 0, 0);
      ctx.drawImage(tmp, (i % 2) * (width + 8), top, pic.img.width * SCALE, pic.img.height * SCALE);
      if (i % 2) top += pic.img.height * SCALE + 8;
    });
    return sheet.toDataURL();
  }, carsArg.split(','));
  writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', OUT);
} finally { await browser.close(); server.stop(); }
