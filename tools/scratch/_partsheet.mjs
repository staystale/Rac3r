// _partsheet.mjs - every car's crash parts as the game cuts them (render/carparts.ts): the car,
// then its front bumper, rear bumper, front wing (left), door panel (left) - x4, one row a car:
// tools/scratch/_partsheet.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  await page.waitForTimeout(1500);
  const url = await page.evaluate(async () => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const cp = await import('/src/render/carparts.ts'), rc = await import('/src/render/cars.ts');
    const r = window.__game.renderer, S = 3, rowH = 60, sheet = document.createElement('canvas');
    sheet.width = 1100; sheet.height = cars.ROSTER.length * rowH;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#5a6a5a'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.imageSmoothingEnabled = false;
    cars.ROSTER.forEach((row, i) => {
      const spec = rc.drawnSpec(cars.applyLivery(veh.makeCar(row.id).spec, null)), sprite = r.pixelCar(spec);
      const y = i * rowH + 4;
      ctx.drawImage(sprite.c, 4, y, sprite.c.width * 1.6, sprite.c.height * 1.6);
      let x = 190;
      for (const [kind, corner] of [['bumper', 0], ['bumper', 2], ['wing', 0], ['panel', 0]]) {
        const part = cp.cutPart(sprite, cp.partRegion(spec, sprite, kind, corner), i * 7 + corner + 1);
        ctx.drawImage(part, x, y, part.width * S, part.height * S);
        x += part.width * S + 16;
      }
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(row.name, 1100 - 180, y + 30);
    });
    return sheet.toDataURL('image/png');
  });
  writeFileSync('tools/scratch/_partsheet.png', Buffer.from(url.split(',')[1], 'base64'));
} finally { await browser.close(); server.stop(); }
