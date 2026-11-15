// _jokerrowshots.mjs - photographs the rallycross lap panel in every joker state (?jokerrow=1 on
// and off), portrait and landscape: the race's fields are held by getters so the sim cannot move
// them between frames. Writes <OUT>/<on|off>-<W>x<H>-<state>.png (the whole screen) and
// -crop.png (the top-right column). Also prints the layout's top-right rects and any page errors.
// CHECK_PORT=8092 JOKERROW_OUT=<dir> node tools/scratch/_jokerrowshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.env.JOKERROW_OUT || 'tools/scratch/_jokerrow';
const LEVEL_ID = process.env.JOKERROW_LEVEL || 'knobhill';
mkdirSync(OUT, { recursive: true });
// each state: the race's fields, the player's (lane, fresh take), the AI count it needs
const STATES = [
  ['todo', {}],
  ['near', { near: true }],
  ['inlane', { inLane: true }],
  ['taken', { joker: true, jokers: 1, fresh: true }],
  ['done', { joker: true, jokers: 1 }],
  ['extra', { joker: true, jokers: 2 }],
  ['fin-done', { done: true, joker: true, jokers: 1, penalty: 0 }],
  ['fin-nojoker', { done: true, jokers: 0, penalty: 30 }],
  ['fin-extra', { done: true, joker: true, jokers: 2, penalty: 30 }],
  ['solo-taken', { joker: true, jokers: 1, fresh: true, solo: true }],
];

/**
 * Holds the race's and the player's joker fields by getters (page side).
 * @param {object} state the state's fields
 */
async function holdState(page, state) {
  await page.evaluate(async (fields) => {
    const game = window.__game, race = game.race;
    const hold = (obj, key, value) => Object.defineProperty(obj, key,
      { get: () => value, set() {}, configurable: true });
    hold(race, 'started', true);
    hold(race, 'done', !!fields.done);
    hold(race, 'joker', !!fields.joker);
    hold(race, 'jokers', fields.jokers || 0);
    hold(race, 'penalty', fields.penalty || 0);
    hold(race, 't', 83.4);
    hold(race, 'total', 83.4 + (fields.penalty || 0));
    hold(game, 'position', 2);
    hold(game, 'inJokerLane', !!fields.inLane);
    Object.defineProperty(game, 'jokerAt', { get: () => (fields.fresh ? performance.now() : 0),
      set() {}, configurable: true });
    // the turn-off's distance round the track, as hud/laps.ts works it out
    const { LEVEL } = await import('/src/world/state.ts');
    const { querySubtrack } = await import('/src/world/tyrewall.ts');
    const dists = LEVEL.joker.arrows.filter(Boolean)
      .map((arrow) => querySubtrack(LEVEL.subtrack, arrow.x, arrow.y).trackDist);
    const turn = Math.min(...dists);
    hold(game, 'trackD', fields.near ? turn - 60 : turn + 200);
  }, state);
}

/**
 * The room on the lap panel's second row: each joker line's width (its font, hud/laps.ts) against
 * the 104 px between the panel's insets, less the position's width (P2/4, 11 px 800) and a gap.
 * @returns one line of widths, css px
 */
function measureRow(page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    const width = (text, size, weight) => {
      ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      return ctx.measureText(text).width;
    };
    const pos = width('P2/4', 11, 800), room = 120 - 16;
    const lines = [['JOKER TO DO', 9, 800], ['JOKER  ›››', 10.5, 800], ['IN JOKER ›', 10.5, 800],
      ['JOKER TAKEN ✓', 10.5, 800], ['JOKER DONE ✓', 9, 800], ['JOKER x2: +30 s', 9, 800],
      ['JOKER DONE', 9, 700], ['+30 s NO JOKER', 9, 700], ['+30 s EXTRA JOKER', 9, 700]];
    return `row 2: room ${room}, P2/4 ${pos.toFixed(1)}; ` + lines.map(([text, size, weight]) =>
      `${text} ${width(text, size, weight).toFixed(1)} (gap ${(room - pos
        - width(text, size, weight)).toFixed(1)})`).join('; ');
  });
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const on of [false, true]) {
    for (const [width, height] of [[844, 390], [390, 844]]) {
      for (const [name, state] of STATES) {
        if (process.env.JOKERROW_ONLY && !process.env.JOKERROW_ONLY.split(',').includes(name)) {
          continue;
        }
        const context = await browser.newContext({ viewport: { width, height },
          deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&bundle=0`
          + (on ? '&jokerrow=1' : ''));
        await page.touchscreen.tap(width / 2, height / 2);
        await page.waitForTimeout(300);
        await page.evaluate(([id, solo]) => window.__game.launch(id, 'rx-super',
          { ai: solo ? 0 : 3, diff: 2, rx: true, laps: 3 }), [LEVEL_ID, !!state.solo]);
        await page.waitForTimeout(10000);
        await holdState(page, state);
        await page.waitForTimeout(400);
        const tag = `${on ? 'on' : 'off'}-${width}x${height}-${name}`;
        await page.screenshot({ path: `${OUT}/${tag}.png` });
        await page.screenshot({ path: `${OUT}/${tag}-crop.png`,
          clip: { x: width - 270, y: 0, width: 270, height: 200 } });
        const rects = await page.evaluate(() => {
          const lay = window.__game.hudLayout ? window.__game.hudLayout() : null;
          return lay ? ['speed', 'lap', 'trackTemp', 'fps', 'tally', 'absChip']
            .map((key) => `${key} ${lay[key].x},${lay[key].y} ${lay[key].w}x${lay[key].h}`)
            .join(' | ') : 'no hud.layout';
        });
        console.log(tag, rects, errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
        if (name === 'todo' && !on) console.log(await measureRow(page));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.stop();
}
