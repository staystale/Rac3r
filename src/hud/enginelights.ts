// hud/enginelights.ts - the SPEEDO WARNING LIGHTS (car systems C4; mockup approved): engine
// temperature and oil pressure, in the speed panel above the units (no new HUD corner, no written
// banner). Dim when all is well, amber when warm (105 C), flashing red when hot (115 C), low on
// oil, or seized. Every car has both. The states come from physics/engineheat.ts engineLights.
import { COL } from '../world/colours.ts';
import { engineLights, type EngineCar } from '../physics/engineheat.ts';

// a dim light: there, but off
const DIM = 'rgba(255,255,255,0.2)';
// ms of each half of the red flash (wall clock, rule 5)
const FLASH_MS = 260;

/**
 * The colour of a light in a state, or null while a red light is in the off half of its flash.
 * @param state 0 dim, 1 amber, 2 flashing red
 * @param nowMs the wall clock, ms
 * @returns a colour
 */
function lightColour(state: number, nowMs: number): string {
  if (state === 1) return COL.warn;
  if (state === 2) return Math.floor(nowMs / FLASH_MS) % 2 ? DIM : COL.danger;
  return DIM;
}

/**
 * A thermometer in a coolant wave, 9 x 10 px from its top-left.
 * @param ctx the HUD canvas
 * @param x left, css px
 * @param y top, css px
 */
function drawThermometer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillRect(x + 3, y, 2, 6);
  ctx.fillRect(x + 5, y + 1, 2, 1);
  ctx.fillRect(x + 5, y + 3, 2, 1);
  ctx.fillRect(x + 2, y + 6, 4, 3);
  ctx.fillRect(x, y + 9, 2, 1);
  ctx.fillRect(x + 3, y + 9, 2, 1);
  ctx.fillRect(x + 6, y + 9, 2, 1);
}

/**
 * An oil can with a drip, 12 x 10 px from its top-left.
 * @param ctx the HUD canvas
 * @param x left, css px
 * @param y top, css px
 */
function drawOilCan(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillRect(x, y + 4, 8, 4);
  ctx.fillRect(x + 2, y + 2, 3, 2);
  ctx.fillRect(x + 1, y + 1, 5, 1);
  ctx.fillRect(x + 8, y + 4, 2, 1);
  ctx.fillRect(x + 10, y + 3, 2, 1);
  ctx.fillRect(x + 11, y + 6, 1, 2);
}

/**
 * Draws the two lights in the speed panel, if the engine systems are on.
 * @param ctx the HUD canvas
 * @param speedRect the speed panel, css px
 * @param car the car
 */
export function drawEngineLights(ctx: CanvasRenderingContext2D,
    speedRect: { x: number; y: number }, car: EngineCar): void {
  const lights = engineLights(car);
  if (!lights) return;
  const nowMs = performance.now();
  const left = speedRect.x + 62, top = speedRect.y + 6;
  ctx.fillStyle = lightColour(lights.temp, nowMs);
  drawThermometer(ctx, left, top);
  ctx.fillStyle = lightColour(lights.oil, nowMs);
  drawOilCan(ctx, left + 12, top);
}
