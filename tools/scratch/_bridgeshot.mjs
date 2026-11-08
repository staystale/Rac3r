// _bridgeshot.mjs - phone shots of Brands Snatch's bridges (?bhbridges=1): the car parked just
// before each, the camera on it. node tools/scratch/_bridgeshot.mjs <level>
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'brands-snatch';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${process.env.Q || ""}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate((lv) => window.__game.launch(lv, 'hatch-fwd', { ai: 0 }), level);
  await page.waitForTimeout(1500); await page.mouse.click(195, 422); await page.waitForTimeout(800);
  const n = await page.evaluate(() => window.__game.level.props.filter((p) => p.kind === 'footbridge' || p.kind === 'bridge').length);
  for (let i = 0; i < n; i++) {
    const kind = await page.evaluate((k) => {
      const game = window.__game, b = game.level.props.filter((p) => p.kind === 'footbridge' || p.kind === 'bridge')[k];
      const head = b.rot - Math.PI / 2;
      Object.assign(game.car, { x: b.x - Math.cos(head) * 14, y: b.y - Math.sin(head) * 14, heading: head, vx: 0, vy: 0, yawRate: 0 });
      game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
      return b.kind + (b.label ? ' ' + b.label : '');
    }, i);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `tools/scratch/_bridge-${level}-${i}.png` });
    console.log(i, kind);
  }
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
