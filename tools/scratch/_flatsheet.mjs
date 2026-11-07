// _flatsheet.mjs - every car's crash parts as thrown (render/cars.ts carPart): a closed car's
// lying flat on its face (render/carparts.ts flatPart), an open car's cut from its sprite - the
// car, then its front bumper, rear bumper, front wing, door, x3: tools/scratch/_flatsheet.png
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
    const fixes = await import('/src/core/fixes.ts'); fixes.FIX.partsoff = 1;
    const r = window.__game.renderer, rowH = 70, sheet = document.createElement('canvas');
    sheet.width = 900; sheet.height = cars.ROSTER.length * rowH;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#5a6a5a'; ctx.fillRect(0, 0, 900, sheet.height);
    ctx.imageSmoothingEnabled = false;
    cars.ROSTER.forEach((row, i) => {
      const spec = rc.drawnSpec(cars.applyLivery(veh.makeCar(row.id).spec, null)), sprite = r.pixelCar(spec);
      const y = i * rowH + 6;
      ctx.drawImage(sprite.c, 4, y, sprite.c.width * 1.4, sprite.c.height * 1.4);
      let x = 150;
      for (const [kind, corner] of [['bumper', 0], ['bumper', 2], ['wing', 0], ['panel', 0]]) {
        const part = cp.isBare(spec) ? cp.cutPart(sprite, cp.partRegion(spec, sprite, kind, corner), i + corner)
          : cp.flatPart(spec, kind, corner, i * 7 + corner + 1);
        const scale = Math.min(3, 60 / part.height);
        ctx.drawImage(part, x, y, part.width * scale, part.height * scale);
        x += part.width * scale + 14;
      }
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(row.name, 740, y + 30);
    });
    return sheet.toDataURL('image/png');
  });
  writeFileSync('tools/scratch/_flatsheet.png', Buffer.from(url.split(',')[1], 'base64'));
} finally { await browser.close(); server.stop(); }
