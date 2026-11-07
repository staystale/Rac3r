// _lostsheet.mjs - cars with parts lost (render/carparts.ts withoutParts) beside themselves whole:
// the front bumper, a front wing and a rear door panel gone. tools/scratch/_lostsheet.png
// node tools/scratch/_lostsheet.mjs [query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';
const [query = 'partsoff=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&${query}`);
  await page.waitForTimeout(1500);
  const url = await page.evaluate(async () => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const cp = await import('/src/render/carparts.ts'), rc = await import('/src/render/cars.ts');
    const r = window.__game.renderer, ids = ['hatch-fwd', 'muscle-rwd', 'lambo-awd', 'track-rwd', 'grass-special'];
    const sheet = document.createElement('canvas'); sheet.width = 900; sheet.height = ids.length * 90;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#5a6a5a'; ctx.fillRect(0, 0, 900, sheet.height);
    ctx.imageSmoothingEnabled = false;
    ids.forEach((id, i) => {
      const spec = rc.drawnSpec(cars.applyLivery(veh.makeCar(id).spec, null)), sprite = r.pixelCar(spec);
      const lost = cp.withoutParts(spec, sprite, 'bumper:0,wing:1,panel:2');
      ctx.drawImage(sprite.c, 10, i * 90 + 8, sprite.c.width * 3, sprite.c.height * 3);
      ctx.drawImage(lost.c, 360, i * 90 + 8, lost.c.width * 3, lost.c.height * 3);
    });
    return sheet.toDataURL('image/png');
  });
  writeFileSync('tools/scratch/_lostsheet.png', Buffer.from(url.split(',')[1], 'base64'));
} finally { await browser.close(); server.stop(); }
