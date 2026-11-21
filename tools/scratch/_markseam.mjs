// _markseam.mjs - ?marksage (marktiles.ts): do the tiles show a seam? On a big level, paused, a
// 120 m skid laid across the car's path (it crosses tile edges), photographed off and on at the
// game's zoom and zoomed out; prints how many pixels differ between the two photos in the world
// (the HUD's corners left out) and saves both. node tools/scratch/_markseam.mjs <dir> [level]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/markseam', level = 'spa'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const shots = {};

/**
 * One switch: the skid, then a photo at each zoom.
 * @param query the switch
 */
async function shoot(query) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const game = window.__game, marks = game.marks, car = game.car;
    game.paused = true;
    marks.clear();
    marks.follow(car.x, car.y);
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    for (let along = -60; along <= 60; along += 0.1) {
      for (const side of [-3, 3]) {
        marks.stamp([{ key: 'seam' + side, x: car.x + cos * along - sin * side,
          y: car.y + sin * along + cos * side, slip: 8, width: 0.2, heat: 95 }]);
      }
    }
  });
  for (const zoom of [1, 0.4]) {
    await page.evaluate((value) => {
      window.__game.renderer.debugZoom(value);
      window.__game.renderer.snap(window.__game.car);
    }, zoom);
    await page.waitForTimeout(1200);
    const name = `${query ? 'on' : 'off'}-zoom${zoom}`;
    shots[name] = await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  await page.close();
}

try {
  await shoot('');
  await shoot('&marksage=1');
  const page = await browser.newPage();
  for (const zoom of [1, 0.4]) {
    const differ = await page.evaluate(async ([one, two]) => {
      const read = async (base64) => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.getContext('2d').getImageData(0, 0, image.width, image.height);
      };
      const first = await read(one), second = await read(two);
      let count = 0;
      for (let y = 80; y < first.height - 80; y++) {
        for (let x = 150; x < first.width - 150; x++) {
          const i = (y * first.width + x) * 4;
          if (Math.abs(first.data[i] - second.data[i]) + Math.abs(first.data[i + 1]
            - second.data[i + 1]) + Math.abs(first.data[i + 2] - second.data[i + 2]) > 12) count++;
        }
      }
      return count;
    }, [shots[`off-zoom${zoom}`].toString('base64'), shots[`on-zoom${zoom}`].toString('base64')]);
    console.log(`${level} zoom ${zoom}: pixels differing off / on (the world, HUD corners out):`
      + ` ${differ}`);
  }
} finally {
  await browser.close();
  server.stop();
}
