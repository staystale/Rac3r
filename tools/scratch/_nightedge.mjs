// _nightedge.mjs - ?night=1: is the dark laid to every edge of the screen? Drives Castle Cum
// (autopilot) and, over 40 frames, reads the screen canvas's alpha in the outermost device px
// column / row of each side vs 20 px in (the dark layer is the only full-screen fill there).
// Prints the frames where an edge had less darkness than the inside.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&night=1&autopilot=1`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
  await page.waitForTimeout(9000);
  const result = await page.evaluate(async () => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const width = canvas.width, height = canvas.height, bad = [];
    const alphaAt = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
    for (let frame = 0; frame < 40; frame++) {
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
      const midY = height >> 1, midX = width >> 1;
      const sides = { left: [alphaAt(0, midY), alphaAt(20, midY)],
        right: [alphaAt(width - 1, midY), alphaAt(width - 21, midY)],
        top: [alphaAt(midX + 200, 0), alphaAt(midX + 200, 20)],
        bottom: [alphaAt(midX + 200, height - 1), alphaAt(midX + 200, height - 21)] };
      for (const [side, [edge, inside]] of Object.entries(sides))
        if (edge + 20 < inside) bad.push(`f${frame} ${side} ${edge}/${inside}`);
    }
    return { width, height, bad };
  });
  console.log(`${result.width}x${result.height}: ${result.bad.length} short edges`,
    result.bad.slice(0, 12).join(' | '));
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
