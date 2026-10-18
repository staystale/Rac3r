// hud.js — HUD, touch overlay and the dev readout.
//
// THE FOUR CORNERS HAVE OWNERS (CLAUDE.md §4) and no two systems share a lane:
//   top-left      car selector chip (collapsed by default; expands DOWNWARD into five rows)
//   top-centre    RESET and CLEAR MARKS (the button row)
//   top-right     speed, gear, tacho + shift light   (the silent twin of the engine note)
//   bottom-left   thumb stick (touch) / key hints (pc)
//   bottom-right  throttle / brake / handbrake pedals (touch)
//   left edge     dev readout, ?dev=1 only, below the chip — nothing else may live there
//   under the top-left buttons   the MINIMAP (hud/minimap.js), when on; it gives way to the car
//                 list and the tune panel, which open over the same place
//
// HUD LIST (?hudmenu=0 = off): the pause menu's HUD > turns each display piece on or off (the
// minimap, the progress bar, the lap timer, the speedo, the tyre / damage diagram). Controls are
// never in it: a hidden control would be a control the player cannot find.
//
// Buttons are DATA so hit-testing and drawing read the same geometry. Two copies of
// a rect is how a button ends up visually somewhere its tap is not.

import { layoutHud, hitHud, setHudMph, setHudTempF, setHudTyreHud } from './hud/layout.js';
import { drawHudTrackTemp } from './hud/tracktemp.js';
import {
  drawHudTune,
  drawHudLights,
  drawHudNotice,
  drawHudCamera,
  drawHudFlag,
} from './hud/overlays.js';
import {
  drawHudCarChip,
  drawHudTuneChip,
  drawHudAids,
  drawHudIndicators,
  drawHudButtonRow,
  drawHudConeTally,
  drawHudSpeedo,
  drawHudTyreDiagram,
} from './hud/gauges.js';
import { drawHudLapTimer } from './hud/laps.js';
import { drawHudPedals, drawHudDevReadout, drawHudFps } from './hud/controls.js';
import { drawHudMinimap } from './hud/minimap.js';

// the pieces hud.js itself hides on the player's choice (the minimap and the progress bar live in
// hud/minimap.js, the tyre diagram is state.tyreHud), and where each choice is remembered
const HIDEABLE = ['lapTimer', 'speedo'];
const pieceKey = (pieceId) => 'rac3r.hud.' + pieceId;

/**
 * Loads the HUD's per-device choices (the tyre HUD, the speed units); storage can throw in private
 * windows, so every access is guarded.
 * @param {object} state the HUD state (tyreHud, mph)
 */
function loadHudChoices(state) {
  try {
    state.tyreHud = localStorage.getItem('carsim.tyreHud') === '1';
  } catch { /* no storage: stays off */ }
  try {
    state.mph = localStorage.getItem('carsim.units') === 'mph';
  } catch { /* no storage: km/h */ }
  try {
    state.tempF = state.unitsMenu && localStorage.getItem('carsim.tempUnits') === 'F';
  } catch { /* no storage: C */ }
  // the HUD list's choices count only where the list is (not with ?hudmenu=0)
  if (!state.hudMenu) return;
  for (const pieceId of HIDEABLE) {
    try {
      if (localStorage.getItem(pieceKey(pieceId)) === '0') state.hidden.add(pieceId);
    } catch { /* no storage: shown */ }
  }
}

/**
 * Shows or hides a HUD piece (HIDEABLE) and remembers it on the device.
 * @param {object} state the HUD state (hidden)
 * @param {string} pieceId the piece
 * @param {boolean} shown shown or not
 */
function setPieceShown(state, pieceId, shown) {
  if (shown) state.hidden.delete(pieceId);
  else state.hidden.add(pieceId);
  try {
    localStorage.setItem(pieceKey(pieceId), shown ? '1' : '0');
  } catch { /* no storage: this session only */ }
}

/**
 * Whether the tyre / damage diagram is drawn: the tyre HUD is on, OR the car is damaged
 * (requirement: use that for damage too). With the HUD list OFF means off (?tyreoff=0: damaged
 * shows it again) (owner: "No, OFF means off"); the damage still shows on the car itself.
 * @param {object} state the HUD state (tyreHud, hudMenu, tyreOff)
 * @param {object} car the player's car (dmg, punct)
 * @returns {boolean} drawn
 */
function showsCarDiagram(state, car) {
  if (state.tyreHud) return true;
  if (state.hudMenu && state.tyreOff) return false;
  return !!(car.dmg && car.dmg.some((amount) => amount >= 0.05)
    || (car.punct && car.punct.some(Boolean)));
}

/**
 * The HUD's state at start-up, before the device's choices are loaded.
 * @param {{hudMenu?: boolean, tyreOff?: boolean, unitsMenu?: boolean}} options createHud's
 * @returns {object} the state
 */
function newHudState(options) {
  return {
    hudMenu: !!options.hudMenu,
    tyreOff: !!options.tyreOff,
    hidden: new Set(),      // HIDEABLE pieces the player turned off (with the HUD list only)
    expanded: false,        // car list
    tuneOpen: false,        // debug/tuning panel — only one of the two is ever open
    shiftFlash: 0,
    gearFlash: 0,
    lastGear: 1,
    aidFlash: { abs: 0, tcs: 0 },
    // the replay / pause chip: '?' replays the guide; with menus on it is the PAUSE chip ('II'),
    // and How to play lives in there
    helpLabel: '?',   // a shift should be VISIBLE even on the automatic box (user)
    // OPTIONAL TYRE / DAMAGE HUD (requirement: hud should be optional, turn on and off). Off by
    // default — the car itself shows only realistic feedback (faint cold marks, marbles, smoke).
    // Remembered per device; storage can throw in private windows, so every access is guarded.
    // carDiagram: whether it is drawn this frame (showsCarDiagram)
    tyreHud: false,
    carDiagram: false,
    // SPEED UNITS (requirement: tapping the speed / kph should change it to mph), remembered on the
    // device
    mph: false,
    // TEMPERATURE UNITS (?hudunits=1, the HUD list): the tyre numbers and the track gauge in °F
    tempF: false,
    unitsMenu: !!options.unitsMenu,
    flagSeen: 0, flagAt: 0, flagTxt: '',
    drawLightsLater: null,
  };
}

/**
 * Builds the HUD.
 * @param {{hudMenu?: boolean, tyreOff?: boolean, unitsMenu?: boolean}} [options] hudMenu: the
 *   pause menu's HUD list; tyreOff: the tyre / damage diagram OFF stays off when damaged
 *   (?tyreoff=0 = pops up); unitsMenu: the units rows and track gauge (?hudunits=1)
 * @returns {object} draw, hit, layout and the HUD's choices
 */
export function createHud(options = {}) {
  const state = newHudState(options);
  loadHudChoices(state);
  const setTyreHud = (enabled) => setHudTyreHud(state, enabled);
  const layout = (width, height) => layoutHud(state, width, height);
  const hit = (point, width, height, car) => hitHud(state, point, width, height, car);

  function draw(ctx, game, width, height, wallDt) {
    state.carDiagram = showsCarDiagram(state, game.car);
    try {
      state.drawLightsLater = () => {
        drawHudLights(ctx, game, width, height);
        drawHudNotice(ctx, game, width, height);
        drawHudCamera(ctx, game, width, height);
        drawHudFlag(state, ctx, game, width, height);
      };
    } catch {}
    const rects = layout(width, height);
    const car = game.car;
    const spec = car.spec;

    drawHudCarChip(ctx, state, rects, spec);
    drawHudTuneChip(ctx, state, rects);
    drawHudAids(ctx, state, rects, car, spec, wallDt);
    drawHudIndicators(ctx, rects, car);
    if (state.tuneOpen) drawHudTune(ctx, state, rects, car);
    drawHudButtonRow(ctx, state, game, rects);
    drawHudConeTally(ctx, state, game, rects);
    if (!state.hidden.has('speedo')) drawHudSpeedo(ctx, state, rects, car, spec, wallDt);
    drawHudTyreDiagram(ctx, state, rects, car, spec);
    if (!state.hidden.has('lapTimer')) drawHudLapTimer(ctx, game, rects);
    drawHudTrackTemp(ctx, state, rects);
    drawHudMinimap(ctx, state, rects, game, wallDt);
    drawHudPedals(ctx, game, width, height);
    drawHudDevReadout(ctx, state, game, car, height);
    drawHudFps(ctx, game, rects);
    if (state.drawLightsLater) {
      state.drawLightsLater();
      state.drawLightsLater = null;
    }
  }

  return {
    draw, hit, layout,
    get tyreHud() { return state.tyreHud; }, setTyreHud,
    get mph() { return state.mph; }, setMph: (mph) => setHudMph(state, mph),
    get tempF() { return state.tempF; }, setTempF: (fahrenheit) => setHudTempF(state, fahrenheit),
    pieceShown: (pieceId) => !state.hidden.has(pieceId),
    setPieceShown: (pieceId, shown) => setPieceShown(state, pieceId, shown),
    get expanded() { return state.expanded; },
    setHelpLabel(labelText) { state.helpLabel = labelText; },
    get tuneOpen() { return state.tuneOpen; },
    close() {
      state.expanded = false;
      state.tuneOpen = false;
    },
  };
}
