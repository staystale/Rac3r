// hud/keepclear.ts - the HUD pieces the player's car must never be drawn under: the
// rectangles of every piece the HUD draws now, for the camera (render/hudclear.ts). The same
// tests as the drawing: a chip only on a car with that aid, a hidden panel takes no room, the
// pedals only with touch controls. Not listed: the steering stick (it sits under the thumb) and
// the passing notices and flag (drawn over the middle on purpose, for a moment).
import { isFpsShown } from './fpstoggle.ts';
import { LEVEL } from '../world/state.ts';
import { layoutHud } from './layout.ts';
import { minimapBox } from './minimap.ts';
import type { HudGame, HudState } from './hudtypes.ts';
import type { HudRect } from './widgets.ts';

// the list handed out each frame (reused: no allocation per frame for the list itself)
const KEEPOUT: HudRect[] = [];

/**
 * The pieces' bound with no room taken: a hidden panel, a narrow screen's missing volume button.
 * @param rect the piece
 * @returns true when it takes room
 */
const takesRoom = (rect: HudRect) => rect.w > 0 && rect.h > 0;

/**
 * Every HUD rectangle drawn on this screen now, css px.
 * @param state the shared HUD state
 * @param game the game (its car's aids, the heat, the cones, touch or keys)
 * @param width the screen's width, css px
 * @param height the screen's height, css px
 * @returns the rectangles (the same list each call, refilled)
 */
export function hudKeepout(state: HudState, game: HudGame, width: number, height: number) {
  const rects = layoutHud(state, width, height), aids = game.car.spec.aids;
  KEEPOUT.length = 0;
  const pieces = [rects.restart, rects.reset, rects.vol, rects.help, rects.indL, rects.lights,
    rects.indR, rects.speed, rects.lap, rects.trackTemp];
  for (const rect of pieces) if (takesRoom(rect)) KEEPOUT.push(rect);
  if (aids && aids.abs) KEEPOUT.push(rects.absChip);
  if (aids && aids.tcs) KEEPOUT.push(rects.tcsChip);
  if (isFpsShown(game.testMode) && game.fps) KEEPOUT.push(rects.fps);
  if (LEVEL.coneCount && game.cones.knocked > 0) KEEPOUT.push(rects.tally);
  if (game.heat) KEEPOUT.push(rects.heat);
  const map = minimapBox(rects);
  if (map) KEEPOUT.push(map);
  if (game.input.isTouch()) {
    for (const pedal of game.input.pedalHits(width, height)) {
      KEEPOUT.push({ x: pedal.x - pedal.r, y: pedal.y - pedal.r, w: pedal.r * 2,
        h: pedal.r * 2 });
    }
  }
  return KEEPOUT;
}
