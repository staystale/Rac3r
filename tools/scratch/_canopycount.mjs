// _canopycount.mjs - THE CANOPY CUT'S COUNTS, LEVEL BY LEVEL (scratch): each level launched at night
// with ?nightfly=1 (3 AI, the autopilot on the player car) and, per frame, the canopies the night
// layer darkened against those on its light map (renderer.flyStats.canopyCut: on the map is what it
// darkened before the cut). Prints, per level, the zoomed-out fly-in frames' medians and the race's
// most over SECONDS. One browser, the levels in turn.
// [QUERY=hw=canyon] [NIGHT=0.94] [SECONDS=4] [VIEW=440x738] node tools/scratch/_canopycount.mjs [level ...]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const NIGHT = process.env.NIGHT ?? '0.94', SECONDS = Number(process.env.SECONDS ?? 4);
const [viewW, viewH] = (process.env.VIEW || '440x738').split('x').map(Number);

/**
 * Page side: launches a level and samples the cut's counts each frame through the fly-in and for
 * some seconds after it.
 * @param {[string, number]} args the level and the seconds
 * @returns {Promise<object>} the fly-in's and the race's samples
 */
function sampleLevel([level, seconds]) {
  return new Promise((done) => {
    const game = window.__game, fly = [], race = [];
    let after = 0, from = [0, 0];
    game.launch(level, 'hatch-rwd', { ai: 3 });
    const tick = (now) => {
      const cut = game.renderer.flyStats.canopyCut, sample = [cut.traced, cut.onMap];
      if (game.renderer.flying) fly.push(sample);
      else if (fly.length) {
        if (!after) {
          from = [game.car.x, game.car.y];
          // the demo driver on the player car (the autopilot does not drive the endless road)
          import('/src/ai/autodrive.ts').then((auto) => {
            const driver = auto.createAutoDriver(game.level.subtrack);
            game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
              shiftDown: false });
          });
        }
        after ||= now;
        race.push(sample);
      }
      if (fly.length > 2000 || (after && now - after > seconds * 1000)) {
        done({ fly, race, walks: { ...cut }, moved: Math.round(Math.hypot(game.car.x - from[0],
          game.car.y - from[1])), props: game.level.props.length });
      }
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const median = (values) => [...values].sort((one, two) => one - two)[values.length >> 1] ?? 0;
const most = (values) => values.reduce((top, value) => Math.max(top, value), 0);

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&night=${NIGHT}&nightfly=1` + (process.env.QUERY ? '&' + process.env.QUERY : ''));
  const levels = process.argv.slice(2).length ? process.argv.slice(2)
    : await page.evaluate(() => window.__game.levels.map((level) => level.id));
  for (const level of levels) {
    const { fly, race, walks, moved, props } = await page.evaluate(sampleLevel, [level, SECONDS]);
    const out = fly.slice(0, Math.max(1, fly.length >> 2));
    console.log(`${level}: fly-in zoomed out darkened ${median(out.map((one) => one[0]))} of`
      + ` ${median(out.map((one) => one[1]))} on the map; race most ${most(race.map((one) => one[0]))}`
      + ` of ${most(race.map((one) => one[1]))}` + (walks.walks ? `; stretch walks ${walks.walks},`
      + ` the most ${walks.walkMostMs.toFixed(2)} ms` : '') + `; the car moved ${moved} m, ${props} props`);
  }
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
} finally {
  await browser.close();
  server.stop();
}
