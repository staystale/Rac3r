// _piticons.mjs - the PIT STOP menu's icons (owner's art, Desktop/G/owner-art/pitstop, not in the
// repo): each cut out WITH its glow - the dark ground keyed to transparent by its distance from the
// corner colour, the glow kept as a fade - cropped to what is left and sized to SIZE px (the menu
// draws it at half: crisp at the phone's 2-3x). Writes assets/pit/<name>.png.
// node tools/scratch/_piticons.mjs [source folder]
import fs from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';
const from = process.argv[2] || 'C:/Users/Admin/Desktop/G/owner-art/pitstop';
const SIZE = 96;
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  for (const name of ['tyre', 'fuel', 'repair']) {
    const data = 'data:image/jpeg;base64,' + fs.readFileSync(`${from}/icon-${name}.jpg`).toString('base64');
    const png = await page.evaluate(async ([src, size]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const work = document.createElement('canvas');
      work.width = img.width; work.height = img.height;
      const ctx = work.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pix = ctx.getImageData(0, 0, work.width, work.height), d = pix.data;
      // the ground: the mean of the four corners
      const at = (x, y) => (y * work.width + x) * 4;
      const corners = [at(2, 2), at(work.width - 3, 2), at(2, work.height - 3), at(work.width - 3, work.height - 3)];
      const ground = [0, 1, 2].map((c) => corners.reduce((all, i) => all + d[i + c], 0) / 4);
      let x0 = work.width, y0 = work.height, x1 = 0, y1 = 0;
      for (let y = 0; y < work.height; y++) for (let x = 0; x < work.width; x++) {
        const i = at(x, y);
        const far = Math.hypot(d[i] - ground[0], d[i + 1] - ground[1], d[i + 2] - ground[2]);
        // (within 10 of the ground: gone; a glow fades in over 10 .. 70)
        const alpha = Math.max(0, Math.min(1, (far - 10) / 60));
        d[i + 3] = Math.round(alpha * 255);
        if (alpha > 0.05) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      ctx.putImageData(pix, 0, 0);
      const side = Math.max(x1 - x0, y1 - y0) + 1;
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(work, x0 - (side - (x1 - x0 + 1)) / 2, y0 - (side - (y1 - y0 + 1)) / 2, side, side, 0, 0, size, size);
      return out.toDataURL('image/png');
    }, [data, SIZE]);
    fs.writeFileSync(`assets/pit/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`assets/pit/${name}.png`);
  }
} finally { await browser.close(); }
