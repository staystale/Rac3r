// _itchshots.mjs <outdir> - screenshots for the itch.io page: the real game at 1280x720 css
// (x1.5 = 1920x1080 png), the HUD hidden (?skip=hud), every car driven by the AI (?autopilot=1),
// a fixed light / weather per scene; the menu shot shows the title over the race behind it.
// node tools/scratch/_itchshots.mjs ../GamesStudio/ready-to-play/rac3r-page-2026-10-24
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const outDir = process.argv[2] || 'shots/itch';
mkdirSync(outDir, { recursive: true });
// name, level, car, AI count, extra link settings, seconds driven before the photo
const SCENES = [
  ['2-castle-cum-night', 'castle-cum', 'hatch-rwd', 5, '&night=0.85', 14],
  ['3-knobhill-rain', 'knobhill', 'wrz-awd', 5, '&rain=0.7&night=0', 12],
  ['4-snow-stage', 'stage-brrrmeatballen', 'wrz-awd', 0, '&night=0', 10],
  ['5-highway', 'highway', 'saloon-rwd', 3, '&traffic=1.2&night=0', 12],
  ['6-oval-pack', 'naffcar', 'track-rwd', 5, '&night=0', 9],
  ['7-desert-stage', 'stage-sahara-sandpants', 'hatch-rwd', 0, '&night=0', 10],
  ['8-grass-track', 'grass-track', 'hatch-rwd', 5, '&night=0', 12],
];
const server = await startServer();
const browser = await launchBrowser();
const view = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 };
try {
  {
    const page = await (await browser.newContext(view)).newPage();
    await gotoGame(page, `${server.url}/?pc=1&menu=1&guide=0&night=0&ai=4`);
    await page.waitForTimeout(9000);
    await page.screenshot({ path: join(outDir, '1-menu.png') });
    console.log('1-menu');
    await page.context().close();
  }
  for (const [name, level, car, ai, extra, seconds] of SCENES) {
    const page = await (await browser.newContext(view)).newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await gotoGame(page, `${server.url}/?pc=1&menu=0&guide=0&rules=0&skip=hud&autopilot=1${extra}`);
    // the boot screen waits for a first tap
    await page.mouse.click(640, 360);
    await page.waitForTimeout(800);
    await page.evaluate(([id, carId, count]) => window.__game.launch(id, carId, { ai: count }),
      [level, car, ai]);
    await page.waitForTimeout(seconds * 1000);
    await page.screenshot({ path: join(outDir, `${name}.png`) });
    console.log(name, errors.length ? errors[0] : '');
    await page.context().close();
  }
} finally {
  await browser.close();
  server.stop();
}
