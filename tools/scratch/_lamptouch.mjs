// _lamptouch.mjs - which lamps the racers touch: a level raced with 5 AI and the autopilot for
// 60 s (lamps on), then every lamp that leans, dims or fell, with its distance from the track.
// node tools/scratch/_lamptouch.mjs [level]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const level = process.argv[2] || 'thruston';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?guide=0&menu=0&rules=0&autopilot=1`);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 5, laps: 3 }), level);
  await page.waitForTimeout(60000);
  const hits = await page.evaluate(async () => {
    const lamps = (await import('/src/world/lamps.ts')).activeLamps();
    const { LEVEL } = await import('/src/world/state.ts');
    const gap = (lamp) => Math.min(...LEVEL.subtrack.pts.map((p) => Math.hypot(p.x - lamp.x, p.y - lamp.y)));
    return { total: lamps.length, width: LEVEL.subtrack.width, touched: lamps
      .filter((lamp) => lamp.down || lamp.level < 1 || Math.hypot(lamp.leanX, lamp.leanY) > 0)
      .map((lamp) => ({ kind: lamp.kind, x: Math.round(lamp.x), y: Math.round(lamp.y),
        gap: gap(lamp).toFixed(1), down: lamp.down, level: lamp.level.toFixed(2) })) };
  });
  console.log(level, JSON.stringify(hits));
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
