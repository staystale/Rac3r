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
// Buttons are DATA so hit-testing and drawing read the same geometry. Two copies of
// a rect is how a button ends up visually somewhere its tap is not.

import { layoutHud, hitHud, setHudTyreHud } from './hud/layout.js';
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
}

export function createHud() {
  const state = {
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
    // carDiagram: the tyre HUD is on, OR the car is damaged (requirement: use that for damage too)
    tyreHud: false,
    carDiagram: false,
    // SPEED UNITS (requirement: tapping the speed / kph should change it to mph), remembered on the
    // device
    mph: false,
    flagSeen: 0, flagAt: 0, flagTxt: '',
    drawLightsLater: null,
  };
  loadHudChoices(state);
  const setTyreHud = (enabled) => setHudTyreHud(state, enabled);
  const layout = (width, height) => layoutHud(state, width, height);
  const hit = (point, width, height, car) => hitHud(state, point, width, height, car);

  function draw(ctx, game, width, height, wallDt) {
    state.carDiagram = state.tyreHud
      || !!(game.car.dmg && game.car.dmg.some((amount) => amount >= 0.05)
      || (game.car.punct && game.car.punct.some(Boolean)));
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
    drawHudSpeedo(ctx, state, rects, car, spec, wallDt);
    drawHudTyreDiagram(ctx, state, rects, car, spec);
    drawHudLapTimer(ctx, game, rects);
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
    get expanded() { return state.expanded; },
    setHelpLabel(labelText) { state.helpLabel = labelText; },
    get tuneOpen() { return state.tuneOpen; },
    close() {
      state.expanded = false;
      state.tuneOpen = false;
    },
  };
}
