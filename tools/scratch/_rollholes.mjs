// _rollholes.mjs - the rolled body's pictures (render/rollbody.ts) of EVERY car (CAR_IDS) at all 12
// roll angles, in the stock paint, a light blue paint and damaged: counts the SEE-THROUGH pixels
// (clear pixels with no clear path out to the picture's edge) per car and angle, and writes one
// sheet per look (each picture x3 on magenta, so a hole shows) to OUT (default tools/scratch).
// node tools/scratch/_rollholes.mjs [extra query]   (CHECK_PORT picks the server's port)
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const query = process.argv[2] || 'x=1', OUT = process.env.OUT || 'tools/scratch';
const server = await startServer();
const browser = await launchBrowser();

/** In the page: every car's 12 pictures per look, the holes counted, the sheet as a PNG. */
async function measure(lookName) {
  const { CAR_IDS, spec: specOf, applyLivery } = await import('/src/cars.ts');
  const { drawnSpec } = await import('/src/render/cars.ts');
  const { createCarSprite } = await import('/src/render/carsprite.ts');
  const { drawRolledBody, newBodyFrame } = await import('/src/render/rollbody.ts');
  const painter = createCarSprite(), WIDE = 128, SIZE = 80, ZOOM = 2;
  const sheet = document.createElement('canvas');
  sheet.width = 12 * WIDE * ZOOM; sheet.height = CAR_IDS.length * SIZE * ZOOM;
  const sheetCtx = sheet.getContext('2d');
  sheetCtx.fillStyle = '#ff00ff'; sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
  sheetCtx.imageSmoothingEnabled = false;
  const holesOf = (img) => {
    const { width, height, data } = img, out = new Uint8Array(width * height), queue = [];
    const clear = (i) => data[i * 4 + 3] < 255;
    for (let x = 0; x < width; x++) queue.push(x, x + (height - 1) * width);
    for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
    while (queue.length) {
      const i = queue.pop();
      if (out[i] || !clear(i)) continue;
      out[i] = 1;
      const x = i % width;
      if (x > 0) queue.push(i - 1);
      if (x < width - 1) queue.push(i + 1);
      if (i >= width) queue.push(i - width);
      if (i < width * (height - 1)) queue.push(i + width);
    }
    let holes = 0;
    for (let i = 0; i < width * height; i++) if (clear(i) && !out[i]) holes++;
    return holes;
  };
  const rows = [];
  CAR_IDS.forEach((id, carRow) => {
    const base = applyLivery({ ...specOf(id) }, lookName === 'blue' ? { paint: '#8fc8f0' } : null);
    const spec = drawnSpec(base), sprite = painter.pixelCar(spec), holes = [];
    for (let k = 0; k < 12; k++) {
      const car = { x: 0, y: 0, vx: 0, vy: 0, heading: 0, num: 1, spec,
        roll: { phase: 'side', phi: k * Math.PI / 6 || 1e-6, w: 0 } };
      if (lookName === 'hurt') Object.assign(car, { dmg: [0.7, 0.2, 0.3, 0.1],
        crushL: [0.5, 0.1, 0.1, 0], crushS: [0.4, 0, 0.3, 0], roofDmg: 0.5,
        wheelOff: [false, false, false, true], partLost: 'panel:0,wing:2' });
      const canvas = document.createElement('canvas');
      canvas.width = WIDE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.translate(WIDE / 2, SIZE / 2);
      newBodyFrame();
      drawRolledBody(ctx, car, spec, [sprite, sprite], 4000);
      holes.push(holesOf(ctx.getImageData(0, 0, WIDE, SIZE)));
      sheetCtx.drawImage(canvas, k * WIDE * ZOOM, carRow * SIZE * ZOOM, WIDE * ZOOM, SIZE * ZOOM);
    }
    rows.push({ id, holes });
  });
  return { rows, png: sheet.toDataURL('image/png') };
}

try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
  await page.waitForTimeout(1500);
  for (const look of ['stock', 'blue', 'hurt']) {
    const { rows, png } = await page.evaluate(measure, look);
    writeFileSync(`${OUT}/_rollholes-${look}.png`, Buffer.from(png.split(',')[1], 'base64'));
    let total = 0;
    console.log(`\n${look}: see-through pixels per angle (0, 30, ... 330 degrees)`);
    for (const row of rows) {
      total += row.holes.reduce((sum, count) => sum + count, 0);
      console.log(`${row.id.padEnd(14)} ${row.holes.map((n) => String(n).padStart(3)).join(' ')}`);
    }
    console.log(`${look} total ${total}`);
  }
  console.log(errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
