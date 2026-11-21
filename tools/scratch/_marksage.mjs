// _marksage.mjs - ?marksage (marktiles.ts): on a big level, a 20 m skid laid ahead of the car, the
// marks' window then moved 500 m away and back (what driving off and returning does), photographed
// at the game's zoom before and after; then the aged fade run on (60 s, 120 s, 160 s of marks time).
// Prints the skid's dark pixels in each photo, the tiles held and the canvas bytes; off / on.
// node tools/scratch/_marksage.mjs <dir> [level] [sizes]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/marksage', level = 'spa', sizesArg = '844x390,390x844']
  = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();

/**
 * Pixels at least 8 levels darker than in the first photo (the skid): the first call keeps its
 * photo as the base and returns 0.
 * @param page the page
 * @param buffer the PNG
 * @returns the count
 */
async function inkOf(page, buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + base64;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    if (!window.__inkBase) {
      window.__inkBase = data;
      return 0;
    }
    let dark = 0;
    const base = window.__inkBase;
    for (let i = 0; i < data.length; i += 4) {
      if (base[i] + base[i + 1] + base[i + 2] - data[i] - data[i + 1] - data[i + 2] > 24) dark++;
    }
    return dark;
  }, buffer.toString('base64'));
}

/**
 * One switch, one size: the skid, the move away and back, the fade.
 * @param query the switch
 * @param width CSS px
 * @param height CSS px
 */
async function runCase(query, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(1200);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
  await page.waitForTimeout(4000);
  const tag = `${query ? 'on' : 'off'}-${width}x${height}`;
  const shot = async (name) => {
    await page.waitForTimeout(400);
    return inkOf(page, await page.screenshot({ path: `${OUT}/${tag}-${name}.png` }));
  };
  await shot('empty');
  await page.evaluate(() => {
    const game = window.__game, marks = game.marks, car = game.car;
    game.paused = true;
    marks.clear();
    marks.follow(car.x, car.y);
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    for (let along = 4; along <= 24; along += 0.1) {
      for (const side of [-0.8, 0.8]) {
        marks.stamp([{ key: 'skid' + side, x: car.x + cos * along - sin * side,
          y: car.y + sin * along + cos * side, slip: 8, width: 0.2, heat: 95 }]);
      }
    }
  });
  const laid = await shot('laid');
  const tilesLaid = await page.evaluate(() => {
    const tiles = window.__game.marks.tiles;
    return tiles ? tiles.byKey.size : 0;
  });
  await page.evaluate(() => {
    const game = window.__game, car = game.car;
    for (let step = 0; step <= 500; step += 2) game.marks.follow(car.x + step, car.y);
    for (let step = 500; step >= 0; step -= 2) game.marks.follow(car.x + step, car.y);
  });
  const back = await shot('back');
  const faded = [];
  let fadedS = 0;
  for (const until of [60, 120, 160]) {
    await page.evaluate((seconds) => {
      for (let i = 0; i < seconds * 120; i++) window.__game.marks.fade(1 / 120);
    }, until - fadedS);
    fadedS = until;
    faded.push(`${until} s ${await shot('fade' + until)}`);
  }
  const memory = await page.evaluate(async () => {
    const { canvasBytes } = await import('/src/core/memorybudget.ts');
    const marks = window.__game.marks;
    return { layerPx: marks.canvas.width, tiles: marks.tiles ? marks.tiles.byKey.size : 0,
      canvasMB: Math.round(canvasBytes() / 1048576) };
  });
  console.log(`${level} ${tag}: skid ink laid ${laid}, after the window went 500 m and`
    + ` back ${back}; fade ${faded.join(', ')}; tiles at the skid ${tilesLaid},`
    + ` ${JSON.stringify(memory)}`, errors.length ? 'ERRORS ' + errors.join(' | ')
    : 'errors none');
  await page.close();
}

try {
  for (const size of sizesArg.split(',')) {
    const [width, height] = size.split('x').map(Number);
    for (const query of ['', '&marksage=1']) await runCase(query, width, height);
  }
} finally {
  await browser.close();
  server.stop();
}
