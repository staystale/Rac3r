// hud/laps.js — the lap/stage/joker/race timer panel for each game mode.
// Pure moves out of hud.js (task 173).

import { LEVEL } from '../world/state.ts';
import { COL } from '../world/colours.ts';
import { fmtTime, drawHudPanel, drawHudLabel } from './widgets.js';

/**
 * HIGHWAY TO HULL lap panel: how far you have got, and your best.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} lapRect the lap panel rectangle
 * @returns {void}
 */
export function drawHudLapEndless(ctx, game, lapRect) {
  drawHudLabel(ctx, 'DISTANCE', lapRect.x + 8, lapRect.y + 13,
    { size: 11, weight: 700, col: COL.live });
  drawHudLabel(ctx, ((game.hwDist || 0) / 1000).toFixed(2) + ' KM', lapRect.x + lapRect.w - 8,
    lapRect.y + 13, { size: 11, weight: 700, align: 'right', col: COL.hudText });
  // in a VS AI race the second line is the gap to the car ahead (or your lead over the one
  // behind) instead of your best
  const flow = game.flow, player = flow && flow.highway && game.car._hwf;
  if (player && game.ai && game.ai.length) {
    const gaps = game.ai.map((rival) => (rival.car._hwf ? rival.car._hwf.s - player.s
      : -Infinity)), ahead = gaps.filter((gap) => gap > 0),
      behind = gaps.filter((gap) => gap <= 0 && isFinite(gap));
    const txt = ahead.length ? 'AHEAD +' + Math.round(Math.min(...ahead)) + ' M'
      : behind.length ? 'LEAD ' + Math.round(-Math.max(...behind)) + ' M' : '';
    drawHudLabel(ctx, txt, lapRect.x + 8, lapRect.y + 26,
      { size: 9, weight: 700, col: ahead.length ? COL.inkSoft : COL.live });
  } else drawHudLabel(ctx, 'BEST ' + ((game.hwBest || 0) / 1000).toFixed(2) + ' KM', lapRect.x + 8,
    lapRect.y + 26, { size: 9, weight: 600, col: COL.inkSoft });
}

/**
 * RALLY STAGE lap panel: READY -> STAGE (running clock) -> FINISH; BEST under.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} stage the stage state
 * @param {object} lapRect the lap panel rectangle
 * @returns {void}
 */
export function drawHudLapStage(ctx, stage, lapRect) {
  const run = stage.state === 'running', done = stage.state === 'done';
  drawHudLabel(ctx, done ? 'FINISH' : 'STAGE', lapRect.x + 8, lapRect.y + 13,
    { size: 11, weight: 700, col: COL.live });
  drawHudLabel(ctx, fmtTime(done ? stage.last : run ? stage.t : 0), lapRect.x + lapRect.w - 8,
    lapRect.y + 13, { size: 11, weight: done ? 700 : 600, align: 'right', col: COL.hudText });
  const newBest = done && stage.best === stage.last;
  drawHudLabel(ctx, newBest ? 'NEW BEST' : stage.best != null ? `BEST ${fmtTime(stage.best)}`
    : stage.state === 'ready' ? 'CROSS THE LINE' : 'BEST --:--.--', lapRect.x + 8, lapRect.y
    + 26, { size: 9, weight: newBest ? 700 : 600, col: newBest ? COL.live : COL.inkSoft });
}

/**
 * RX RACE lap panel: the same panel, no new HUD lane (CLAUDE.md §4).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} race the race state
 * @param {object} lapRect the lap panel rectangle
 * @param {number} lapNum the lap number
 * @returns {void}
 */
export function drawHudLapJoker(ctx, game, race, lapRect, lapNum) {
  if (race.done) drawHudLapJokerDone(ctx, race, lapRect);
  else drawHudLapJokerLive(ctx, game, race, lapRect, lapNum);
}

/**
 * Joker race lap panel once finished: FINISH, total time and the joker verdict.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} race the race state
 * @param {object} lapRect the lap panel rectangle
 * @returns {void}
 */
function drawHudLapJokerDone(ctx, race, lapRect) {
  drawHudLabel(ctx, 'FINISH', lapRect.x + 8, lapRect.y + 13,
    { size: 11, weight: 700, col: COL.live });
  drawHudLabel(ctx, fmtTime(race.total), lapRect.x + lapRect.w - 8, lapRect.y + 13,
    { size: 11, weight: 700, align: 'right', col: COL.hudText });
  drawHudLabel(ctx, !race.penalty ? 'JOKER DONE' : race.jokers === 0
    ? `+${race.penalty} s NO JOKER` : `+${race.penalty} s EXTRA JOKER`, lapRect.x + 8,
    lapRect.y + 26, { size: 9, weight: 700, col: race.penalty ? COL.danger : COL.live });
}

/**
 * Whether the car is approaching the joker turn-off without it done (arrow within 140).
 * @param {object} game the game
 * @param {object} race the race state
 * @returns {*} truthy when the joker turn-off is near
 */
function jokerIsNear(game, race) {
  const jokerArrow = LEVEL.joker && LEVEL.joker.arrows
    && LEVEL.joker.arrows.find((x) => x.d != null), trackDist = game.trackD;
  const near = race.started && !race.joker && jokerArrow && trackDist != null
    && (((jokerArrow.d - trackDist) % LEVEL.subtrack.totalDist)
    + LEVEL.subtrack.totalDist) % LEVEL.subtrack.totalDist < 140;
  return near;
}

/**
 * The joker line text and colour for the lap panel.
 * @param {object} race the race state
 * @param {object} flags flags: near, flash, inLane, fresh, blink
 * @returns {Array} the text and the colour
 */
function jokerLine(race, flags) {
  const { near, flash, inLane, fresh, blink } = flags;
  const jTxt = race.jokers > 1 ? `JOKER x${race.jokers}: +${(race.jokers - 1) * 30} s`
    : fresh ? 'JOKER TAKEN ✓' : race.joker ? 'JOKER DONE ✓' : inLane ? 'IN JOKER ›' : near
    ? 'JOKER  ›››' : 'JOKER TO DO';
  const jCol = race.jokers > 1 ? COL.danger : fresh ? (blink ? '#ffffff' : COL.live)
    : race.joker || inLane ? COL.live : flash ? '#ffffff' : COL.warn || '#e8a13a';
  return [jTxt, jCol];
}

/**
 * Joker race lap panel while racing: LAP n/N, the timer and the joker line.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} race the race state
 * @param {object} lapRect the lap panel rectangle
 * @param {number} lapNum the lap number
 * @returns {void}
 */
function drawHudLapJokerLive(ctx, game, race, lapRect, lapNum) {
  drawHudLabel(ctx, `LAP ${Math.min(lapNum, race.laps)}/${race.laps}`, lapRect.x + 8, lapRect.y
    + 13, { size: 11, weight: 700, col: COL.live });
  drawHudLabel(ctx, fmtTime(race.t), lapRect.x + lapRect.w - 8, lapRect.y + 13,
    { size: 11, weight: 600, align: 'right', col: COL.hudText });
  // approaching the joker turn-off without it done: the line FLASHES "JOKER >" (the
  // approach arrow's distance, lab.js jokerApproach)
  const near = jokerIsNear(game, race);
  const flash = near && Math.floor(performance.now() / 250) % 2 === 0;
  // the line switches as it happens: TO DO -> ››› (approaching) -> IN JOKER (on the lane)
  // -> JOKER TAKEN ✓ (flashing 2 s) -> JOKER DONE
  const inLane = !race.joker && game.inJokerLane, fresh = race.joker && race.jokers === 1
    && performance.now() - (game.jokerAt || 0) < 2000;
  const blink = Math.floor(performance.now() / 200) % 2 === 0;
  const [jTxt, jCol] = jokerLine(race, { near, flash, inLane, fresh, blink });
  drawHudLabel(ctx, jTxt, lapRect.x + 8, lapRect.y + 26,
    { size: near || fresh || inLane ? 10.5 : 9, weight: 800, col: jCol });
}

/**
 * A VS AI race lap panel (raceflow.js): LAP n/N, FINISH once you are home.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} lapRect the lap panel rectangle
 * @param {number} lapNum the lap number
 * @returns {void}
 */
export function drawHudLapRace(ctx, game, lapRect, lapNum) {
  const flow = game.flow, player = flow && flow.entries.find((entry) => entry.player);
  drawHudLabel(ctx, player
    ? (player.finish != null ? 'FINISH'
    : `LAP ${Math.min(flow.laps, player.lapDone + 1)}/${flow.laps}`) : `LAP ${lapNum}`,
    lapRect.x + 8, lapRect.y + 13, { size: 11, weight: 700, col: COL.live });
  drawHudLabel(ctx,
    fmtTime(player ? (player.finish != null ? player.finish : flow.t) : game.lap.lapTime),
    lapRect.x + lapRect.w - 8, lapRect.y + 13,
    { size: 11, weight: 600, align: 'right', col: COL.hudText });
  const bestTxt = game.lap.bestTime ? `BEST ${fmtTime(game.lap.bestTime)}` : 'BEST --:--.--';
  drawHudLabel(ctx, bestTxt, lapRect.x + 8, lapRect.y + 26,
    { size: 9, weight: 600, col: COL.inkSoft });
}

/**
 * Top-right, under speed: lap counter & timer (circuit levels only).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} rects the layout rectangles
 * @returns {void}
 */
export function drawHudLapTimer(ctx, game, rects) {
  if (LEVEL.subtrack && game.lap) {
    const lapRect = rects.lap;
    drawHudPanel(ctx, lapRect);
    if (game.ai && game.ai.length
      && game.position) drawHudLabel(ctx, `P${game.position}/${game.ai.length + 1}`, lapRect.x
      + lapRect.w - 8, lapRect.y + 26,
      { size: 11, weight: 800, align: 'right', col: game.position === 1 ? '#f2c21b' : COL.live });
    const lapNum = Math.max(1, game.lap.lap || 1);
    const race = game.race, stage = game.stage;
    if (LEVEL.endless) drawHudLapEndless(ctx, game, lapRect);
    else if (LEVEL.stage && stage) drawHudLapStage(ctx, stage, lapRect);
    else if (race && race.on && LEVEL.joker) {
      drawHudLapJoker(ctx, game, race, lapRect, lapNum);
    } else drawHudLapRace(ctx, game, lapRect, lapNum);
  }
}
