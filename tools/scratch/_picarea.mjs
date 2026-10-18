// _picarea.mjs - how many pixels the car pictures cost a frame (sharp cars: each car painted into
// its own picture, then drawn turned onto the screen): the pictures' total area and the screen
// area their drawImage covers, averaged over 120 frames of the highway on the autopilot, by day
// and at night (all lights on), dry and in rain. Phone size 440x732 dpr 3.
// node tools/scratch/_picarea.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const extra = process.argv[2] ? '&' + process.argv[2] : '';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const query of ['night=0', 'night=0.9', 'night=0.9&rain=0.6']) {
    const context = await browser.newContext({ viewport: { width: 440, height: 732 },
      deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?menu=0&guide=0&rules=0&level=highway&autopilot=1&${query}${extra}`);
    await page.waitForTimeout(1500);
    await page.touchscreen.tap(220, 366);
    await page.waitForTimeout(14000);
    const result = await page.evaluate(async () => {
      const screen = document.getElementById('c');
      const stats = { frames: 0, picArea: 0, drawArea: 0, pics: 0 };
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function patched(image, ...args) {
        if (this.canvas === screen && image instanceof HTMLCanvasElement && image !== screen
          && image.width < 2000) {
          stats.pics++;
          stats.picArea += image.width * image.height;
          const [dw, dh] = args.length >= 8 ? [args[6], args[7]] : args.length >= 4
            ? [args[2], args[3]] : [image.width, image.height];
          const t = this.getTransform();
          stats.drawArea += Math.abs(dw * dh * (t.a * t.d - t.b * t.c));
        }
        return original.call(this, image, ...args);
      };
      for (let i = 0; i < 120; i++) await new Promise((done) => requestAnimationFrame(done));
      CanvasRenderingContext2D.prototype.drawImage = original;
      stats.frames = 120;
      return stats;
    });
    const perFrame = (value) => Math.round(value / result.frames / 1000) + 'k';
    console.log(`${query.padEnd(20)} pictures/frame ${(result.pics / 120).toFixed(1)}`
      + `  picture px ${perFrame(result.picArea)}  screen px covered ${perFrame(result.drawArea)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
