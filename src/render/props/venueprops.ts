// render/props/venueprops.ts - the props a venue adds (world/venuescenery.ts): a TUNNEL PORTAL
// where a road or path dives under the track (concrete side walls, the ramp darkening into the
// mouth, a lintel over it) and a PARKED CAR in the car parks. Drawn in the props' frame: x along
// the prop's rot, metres times ppm.
import type { Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

// the ramp's shades, from the road at the open end to the dark at the mouth
const RAMP_SHADES = ['#3b3e45', '#2f3238', '#24262b', '#191a1e', '#0f1013'];
// m: a portal wall's thickness, the lintel's depth
const WALL_M = 0.6, LINTEL_M = 1;
// m: a parked car's length and width
const CAR_LEN_M = 4.2, CAR_WID_M = 1.8;

/**
 * Draws a tunnel portal: its rot points down the ramp into the mouth (toward the track).
 * @param propCtx the view and painter helpers
 * @param prop the prop (w its length, h its width)
 * @param ppm pixels per metre
 */
export function drawTunnel(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, halfL = prop.w! / 2, halfW = prop.h! / 2;
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  // the ramp in bands, darker toward the mouth
  const band = (prop.w! - LINTEL_M) / RAMP_SHADES.length;
  RAMP_SHADES.forEach((shade, i) => paint(-halfL + i * band, -halfW, band + 0.05, prop.h!, shade));
  // the side walls (shadowed inner face, light top) and the lintel over the mouth
  for (const side of [-1, 1]) {
    const wallY = side < 0 ? -halfW - WALL_M : halfW;
    paint(-halfL, wallY, prop.w!, WALL_M, '#a9a7a0');
    paint(-halfL, side < 0 ? wallY + WALL_M * 0.6 : wallY, prop.w!, WALL_M * 0.4, '#8c8a83');
  }
  paint(halfL - LINTEL_M, -halfW - WALL_M, LINTEL_M, prop.h! + 2 * WALL_M, '#b5b2aa');
  paint(halfL - LINTEL_M, -halfW - WALL_M, 0.25, prop.h! + 2 * WALL_M, '#cfccc4');
}

/**
 * Draws a parked car: nose along +x.
 * @param propCtx the view and painter helpers
 * @param prop the prop (col its paint)
 * @param ppm pixels per metre
 */
export function drawParkedCar(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, halfL = CAR_LEN_M / 2, halfW = CAR_WID_M / 2;
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  paint(-halfL + 0.3, -halfW + 0.4, CAR_LEN_M, CAR_WID_M, 'rgba(10,12,16,0.35)');
  paint(-halfL, -halfW, CAR_LEN_M, CAR_WID_M, prop.col || '#8f949c');
  // windscreen, roof, rear window
  paint(0.35, -halfW + 0.2, 0.7, CAR_WID_M - 0.4, '#1f2a36');
  paint(-0.95, -halfW + 0.22, 1.3, CAR_WID_M - 0.44, 'rgba(255,255,255,0.14)');
  paint(-1.45, -halfW + 0.25, 0.5, CAR_WID_M - 0.5, '#1f2a36');
}
