// hud/tracktemp.js — THE TRACK TEMPERATURE GAUGE and the temperature units (?hudunits=1; owner,
// 2026-10-18: a small gauge of the track temperature, on / off in the pause menu's HUD list like
// the rest, not shown in the harder difficulty modes as the minimap is not; °C / °F and km/h / mph
// on toggles in the menu). A slim strip in the top-right column under the lap timer: "TRACK 12°C"
// and a bar in the temperature's colour (freezing, cool, normal, warm, hot). Shown only while an
// event's weather runs (a test floor with no weather has no temperature to show).
import { COL } from '../world/colours.ts';
import { WEATHER, weatherRuns } from '../world/weather.ts';
import { drawHudLabel, drawHudPanel } from './widgets.js';
import { modeSetting, setModeSetting } from './minimap.js';

const TRACK_TEMP_KEY = 'rac3r.tracktemp.';
// C: the bands of the gauge's colour - ice forms below FREEZE_C, cool to COOL_C, normal to
// WARM_C, warm (tyres overheat sooner) to HOT_C, then hot
const FREEZE_C = 0, COOL_C = 8, WARM_C = 30, HOT_C = 45;
// C at the bar's ends
const BAR_LOW_C = -10, BAR_HIGH_C = 55;

// is it shown: main.js hands in the source (?hudunits=1, the mode's setting, not in the menu)
let shownNow = () => false;

/**
 * Hands the gauge the test of whether it shows (main.js).
 * @param {() => boolean} source true while the gauge shows
 */
export function setTrackTempSource(source) { shownNow = source; }

/**
 * Whether the gauge shows this frame (layout.js reserves its strip).
 * @returns {boolean} shown
 */
export const trackTempShown = () => shownNow() && weatherRuns();

/**
 * The gauge's setting in a difficulty mode: the minimap's defaults, locked off in REAL.
 * @param {number} mode difficulty 0..4
 * @returns {{on: boolean, locked: boolean}} on, and whether the mode allows a change
 */
export const trackTempSetting = (mode) => modeSetting(TRACK_TEMP_KEY, mode, true);

/**
 * Remembers the gauge's choice for a difficulty mode.
 * @param {number} mode difficulty 0..4
 * @param {boolean} shown shown or not
 */
export const setTrackTempSetting = (mode, shown) =>
  setModeSetting(TRACK_TEMP_KEY, mode, shown, true);

/**
 * A temperature in the player's units, rounded.
 * @param {number} celsius the temperature, C
 * @param {boolean} fahrenheit in °F
 * @returns {number} the number shown
 */
export const tempInUnits = (celsius, fahrenheit) =>
  Math.round(fahrenheit ? celsius * 9 / 5 + 32 : celsius);

/**
 * A temperature as the player reads it.
 * @param {number} celsius the temperature, C
 * @param {boolean} fahrenheit show °F
 * @returns {string} e.g. "12°C" or "54°F"
 */
export function formatTemp(celsius, fahrenheit) {
  return tempInUnits(celsius, fahrenheit) + (fahrenheit ? '°F' : '°C');
}

/**
 * The gauge's colour for a track temperature (the colour table's meanings).
 * @param {number} celsius the track temperature, C
 * @returns {string} the colour
 */
function trackTempColour(celsius) {
  if (celsius < FREEZE_C) return COL.cold;
  if (celsius < COOL_C) return COL.cool;
  if (celsius <= WARM_C) return COL.live;
  return celsius <= HOT_C ? COL.warn : COL.danger;
}

/**
 * Draws the gauge in its strip (layout.js rects.trackTemp), when it shows.
 * @param {CanvasRenderingContext2D} ctx the HUD context
 * @param {object} state the HUD state (tempF)
 * @param {object} rects the layout rectangles
 */
export function drawHudTrackTemp(ctx, state, rects) {
  const rect = rects.trackTemp;
  if (!rect || !rect.h) return;
  const celsius = WEATHER.trackC, colour = trackTempColour(celsius);
  drawHudPanel(ctx, rect, { fill: 'rgba(14,15,18,0.82)' });
  drawHudLabel(ctx, 'TRACK ' + formatTemp(celsius, state.tempF), rect.x + 8,
    rect.y + rect.h / 2, { size: 10, weight: 800, col: colour });
  const barX = rect.x + 76, barW = rect.w - 84, barY = rect.y + rect.h / 2 - 2;
  const share = Math.max(0, Math.min(1, (celsius - BAR_LOW_C) / (BAR_HIGH_C - BAR_LOW_C)));
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(barX, barY, barW, 4);
  ctx.fillStyle = colour;
  ctx.fillRect(barX, barY, Math.max(2, barW * share), 4);
}
