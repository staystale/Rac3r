// _flagrun.mjs - THE OWNER'S 11-21 BUG 3 (scratch, diagnosis): races one after another IN ONE PAGE
// through the real menus (TEST MODE -> CIRCUITS -> the track -> VS AI -> LAUNCH, then the results'
// RESTART or TRACK SELECT), your car on the autopilot. From the moment you cross the line, a photo
// every 0.2 s for 2.4 s, each with the share of the middle band in near-white cloth pixels (the
// flag's white squares), the flow's state, the results menu up or not, and the HUD's flag record.
// node tools/scratch/_flagrun.mjs <dir> <plan> [extra query]
//   plan: track names in order, '+' = RESTART the last one, e.g. "Thruston,+,Castle Kum"
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/flagrun', planArg = 'Thruston,+,Castle Kum', query = '']
  = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 844, height: 390 },
  deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

/**
 * Taps a menu button once it has slid in.
 * @param text its text (a string or a RegExp)
 */
async function tap(text) {
  const button = page.locator('#menu button', { hasText: text }).first();
  await button.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(900);
  await button.tap({ timeout: 8000 });
}

/**
 * The share of the screen's middle band in near-white, near-grey pixels (the flag's white cloth).
 * @param buffer a PNG screenshot
 * @returns the share, 0-1
 */
async function whiteShare(buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + base64;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const top = Math.round(image.height * 0.25), rows = Math.round(image.height * 0.5);
    const data = ctx.getImageData(0, top, image.width, rows).data;
    let white = 0;
    for (let i = 0; i < data.length; i += 4) {
      const low = Math.min(data[i], data[i + 1], data[i + 2]);
      if (low > 200 && Math.max(data[i], data[i + 1], data[i + 2]) - low < 12) white++;
    }
    return white / (data.length / 4);
  }, buffer.toString('base64'));
}

/** What the race flow says now. */
const flowNow = () => page.evaluate(() => {
  const flow = window.__game.flow, menu = document.getElementById('menu');
  const menuUp = !!menu && getComputedStyle(menu).display !== 'none'
    && menu.querySelectorAll('button').length > 0;
  if (!flow) return { none: true, menuUp };
  const me = flow.entries.find((entry) => entry.player);
  return { state: flow.state, flags: flow.flags.length, myPlace: flow.myPlace ?? null,
    home: flow.entries.filter((entry) => entry.finish != null).length,
    cars: flow.entries.length, laps: flow.laps, myLap: me ? me.lapDone : null,
    t: Math.round(flow.t), menuUp };
});

/**
 * One race to its finish: wait for your flag (or the end), then the photo burst.
 * @param label the photos' name
 * @returns the race's record
 */
async function watchFinish(label) {
  let before = await flowNow();
  // (the race's flow is made as it launches: wait for it, then for your flag or the end)
  for (let waited = 0; waited < 60 && (before.none || before.state === 'done'); waited += 0.5) {
    await page.waitForTimeout(500);
    before = await flowNow();
  }
  for (let waited = 0; waited < 900; waited += 0.25) {
    if (before.flags > 0 || before.state === 'done') break;
    await page.waitForTimeout(250);
    before = await flowNow();
  }
  const burst = [];
  for (let i = 0; i < 12; i++) {
    const at = Date.now();
    const shot = `${OUT}/${label}-${String(i).padStart(2, '0')}.png`;
    const buffer = await page.screenshot({ path: shot });
    const now = await flowNow();
    burst.push(`${(i * 0.2).toFixed(1)}s white ${(100 * await whiteShare(buffer)).toFixed(1)}%`
      + ` ${now.state}${now.menuUp ? ' MENU' : ''}`);
    await page.waitForTimeout(Math.max(0, 200 - (Date.now() - at)));
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${label}-results.png` });
  const after = await flowNow();
  return { label, atCross: before, after, burst };
}

/**
 * From the title menu or a results table to a track's race: CIRCUITS, the track, VS AI, LAUNCH.
 * @param track the track card's name
 * @param fromResults the results table is up (TRACK SELECT) rather than the title menu
 */
async function launchTrack(track, fromResults) {
  if (fromResults) await tap('TRACK SELECT');
  else await tap('TEST MODE');
  await tap(/^CIRCUITS/);
  await tap(track);
  await tap('VS AI');
  await tap('LAUNCH');
}

try {
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1&autopilot=1`
    + `${query ? '&' + query : ''}`);
  await page.waitForTimeout(3000);
  let race = 0;
  for (const step of planArg.split(',')) {
    race++;
    if (step === '+') await tap('RESTART');
    else await launchTrack(step, race > 1);
    const record = await watchFinish(`race${race}`);
    console.log(`race ${race} (${step === '+' ? 'RESTART' : step}):`,
      JSON.stringify(record.atCross), '->', JSON.stringify(record.after));
    console.log('  ' + record.burst.join(' | '));
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 5).join(' | ') : 'errors none');
} finally {
  await context.close();
  await browser.close();
  server.stop();
}
