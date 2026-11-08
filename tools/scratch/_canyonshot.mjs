// _canyonshot.mjs - DEAF VALLEY (?canyon=1, highway/canyon.ts) in the game on the autopilot: photos
// at phone size as it drives the canyon and out into the open desert, the road distance and speed
// at each, the walls' and cacti's counts, the frame rate, page errors.
// [VIEW=390x844] node tools/scratch/_canyonshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&canyon=1&autopilot=1`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('deaf-valley', 'hatch-rwd', { ai: 0 }));
  // (the first canyon opens into the desert 900 m in: about 24-30 s on the autopilot)
  let waited = 0;
  for (const at of [3, 14, 24, 30]) {
    await page.waitForTimeout((at - waited) * 1000);
    waited = at;
    const res = await page.evaluate(() => {
      const game = window.__game, level = game.level;
      return { dist: Math.round(level._hw?.far ?? level._hw?.best ?? 0),
        kmh: Math.round(Math.hypot(game.car.vx, game.car.vy) * 3.6),
        walls: level.barriers.filter((bar) => bar.kind === 'rock').length,
        cacti: level.props.filter((prop) => prop.kind === 'cactus').length,
        notice: game.notice?.text || '' };
    });
    await page.screenshot({ path: `tools/scratch/_canyon-${at}s-${width}x${height}.png` });
    console.log(`${at}s`, JSON.stringify(res));
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
