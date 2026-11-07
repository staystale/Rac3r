// _bitsheet.mjs - ?bigparts: every car's bad-crash bits as thrown (render/cars.ts carPart: the
// bonnet / boot / spoiler cut from its sprite, the exhaust, mirror, wishbone, strut and engine drawn
// for it), and the car with its bonnet, rear piece and a mirror gone. tools/scratch/_bitsheet.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { writeFileSync } from 'node:fs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&bigparts=1&partsoff=1`);
  await page.waitForTimeout(1500);
  const url = await page.evaluate(async () => {
    const cars = await import('/src/cars.ts'), veh = await import('/src/vehicle.ts');
    const cp = await import('/src/render/carparts.ts'), rc = await import('/src/render/cars.ts');
    const cb = await import('/src/carbits.ts');
    const r = window.__game.renderer, rowH = 62, sheet = document.createElement('canvas');
    sheet.width = 1250; sheet.height = cars.ROSTER.length * rowH;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#5a6a5a'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.imageSmoothingEnabled = false;
    cars.ROSTER.forEach((row, i) => {
      const bits = cb.bitsOf(row.id), base = rc.drawnSpec(cars.applyLivery(veh.makeCar(row.id).spec, null));
      const sprite = r.pixelCar(base), y = i * rowH + 4;
      ctx.drawImage(sprite.c, 4, y, sprite.c.width * 1.3, sprite.c.height * 1.3);
      const gone = ['mirror:0'];
      if (bits.front === 'bonnet') gone.push('bonnet:0');
      if (bits.rear !== 'none') gone.push(bits.rear + ':2');
      const shownSpec = gone.some((g) => g.startsWith('spoiler')) ? { ...base, noWing: true } : base;
      const lost = cp.withoutParts(shownSpec, r.pixelCar(shownSpec), gone.join(','));
      ctx.drawImage(lost.c, 140, y, lost.c.width * 1.3, lost.c.height * 1.3);
      let x = 290;
      const kinds = [...(bits.front === 'bonnet' ? ['bonnet'] : []), ...(bits.rear !== 'none' ? [bits.rear] : []),
        'exhaust', 'mirror', 'wishbone', 'strut', 'engine'];
      for (const kind of kinds) {
        const part = cp.drawnBit(base, kind, i + 3) ?? cp.cutPart(sprite, cp.partRegion(base, sprite, kind, kind === 'bonnet' ? 0 : 2), i + 3);
        const scale = Math.min(3, 54 / part.height, 120 / part.width);
        ctx.drawImage(part, x, y, part.width * scale, part.height * scale);
        x += part.width * scale + 12;
      }
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
      ctx.fillText(row.name + ' - ' + bits.cyl + (bits.layout === 'v' ? 'V' : bits.layout === 'flat' ? ' flat' : ' inline') + ', ' + bits.pipes + ' pipe', 1030, y + 28);
    });
    return sheet.toDataURL('image/png');
  });
  writeFileSync('tools/scratch/_bitsheet.png', Buffer.from(url.split(',')[1], 'base64'));
} finally { await browser.close(); server.stop(); }
