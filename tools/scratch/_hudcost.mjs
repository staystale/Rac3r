// _hudcost.mjs - the HUD text fix (TODO: "the HUD text is redrawn every frame - draw it only when
// it changes"; measure first and after): Castle Cum, VS AI x5, your car on autopilot, CPU x4 at
// 844x390 dpr 3, 15 s. Per frame: hud.draw's time, the renderer's frame time, and the HUD's
// fillText / strokeText calls. node tools/scratch/_hudcost.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const extra = process.argv[2] ? '&' + process.argv[2] : '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${extra}`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const result = await page.evaluate(async () => {
    const game = window.__game, { shared } = await import('/src/game/state.js');
    game.launch('castle-cum', game.car.spec.id, { ai: 5, diff: 2 });
    shared.settings.autopilot = true;
    await new Promise((done) => setTimeout(done, 8000));
    const hudDraw = shared.hud.draw, frame = shared.renderer.frame;
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText, stroke = proto.strokeText;
    let inHud = false, texts = 0;
    proto.fillText = function (...args) { if (inHud) texts++; return fill.apply(this, args); };
    proto.strokeText = function (...args) { if (inHud) texts++; return stroke.apply(this, args); };
    const hudMs = [], frameMs = [], textCounts = [];
    shared.hud.draw = (...args) => {
      inHud = true;
      texts = 0;
      const start = performance.now();
      hudDraw(...args);
      hudMs.push(performance.now() - start);
      textCounts.push(texts);
      inHud = false;
    };
    shared.renderer.frame = (...args) => {
      const start = performance.now();
      frame(...args);
      frameMs.push(performance.now() - start);
    };
    await new Promise((done) => setTimeout(done, 15000));
    shared.hud.draw = hudDraw;
    shared.renderer.frame = frame;
    proto.fillText = fill;
    proto.strokeText = stroke;
    const mean = (list) => list.reduce((sum, value) => sum + value, 0) / (list.length || 1);
    const sorted = [...hudMs].sort((a, b) => a - b);
    return { frames: hudMs.length, hud: mean(hudMs), hudP95: sorted[Math.floor(sorted.length * 0.95)],
      render: mean(frameMs), texts: mean(textCounts) };
  });
  console.log(`${result.frames} frames at CPU x4: hud.draw ${result.hud.toFixed(2)} ms (p95`
    + ` ${result.hudP95.toFixed(2)}), renderer.frame ${result.render.toFixed(2)} ms -> HUD`
    + ` ${(100 * result.hud / (result.hud + result.render)).toFixed(1)} % of the drawing;`
    + ` ${result.texts.toFixed(0)} text draws a frame`);
} finally {
  await browser.close();
  server.stop();
}
