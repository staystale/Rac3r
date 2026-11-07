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

// a venue road bridge: m of the road on the deck, the edge beams, the footway; how far the
// embankments run out beyond each end and how wide they spread at their foot
const DECK_ROAD_M = 7, BEAM_M = 0.7, FOOTWAY_M = 1.4, BANK_OUT_M = 9, BANK_SPREAD_M = 5;
// m: an abutment's depth along the road and its wing walls' reach out past the deck
const ABUTMENT_M = 1.6, WING_M = 2.2;
// an embankment's grass, from its foot to its crest
const BANK_SHADES = ['#5d7a3e', '#6b8a47', '#7a9a52'];

/**
 * Draws a venue's road bridge (world/venuescenery.ts, look 'venue'): grassed embankments carrying
 * the road up at both ends, concrete abutments with wing walls, the deck as a road on two edge
 * beams with a footway and white edge lines, expansion joints, its shadow on the track below.
 * Nose along +x (the road it carries); wid is the deck's span.
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawVenueBridge(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, half = (prop.wid || 30) / 2;
  const deck = DECK_ROAD_M + 2 * BEAM_M + FOOTWAY_M, top = -deck / 2;
  const paint = (x: number, y: number, width: number, height: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  // the embankments: a darker foot, a lighter crest, stepped to read as a slope; the road on top
  const road = top + BEAM_M + FOOTWAY_M;
  for (const end of [-1, 1]) {
    const from = end < 0 ? -half - ABUTMENT_M - BANK_OUT_M : half + ABUTMENT_M;
    for (let step = 0; step < BANK_SHADES.length; step++) {
      const spread = BANK_SPREAD_M * (1 - step / BANK_SHADES.length);
      paint(from, top - spread, BANK_OUT_M, deck + 2 * spread, BANK_SHADES[step]);
    }
    paint(from, road, BANK_OUT_M, DECK_ROAD_M, '#3b3e44');
  }
  // the deck's shadow on the track (the sun from the top left)
  ctx.fillStyle = 'rgba(10,12,16,0.38)';
  ctx.fillRect((-half + 1.2) * ppm, (top + 1.8) * ppm, 2 * half * ppm, deck * ppm);
  // abutments and wing walls
  for (const end of [-1, 1]) {
    const x = end < 0 ? -half - ABUTMENT_M : half;
    paint(x, top - WING_M * 0.5, ABUTMENT_M, deck + WING_M, '#a9a7a0');
    paint(x, top - WING_M * 0.5, ABUTMENT_M, 0.3, '#c9c6bd');
  }
  // the deck: edge beams, the road with its edge lines, the footway, the joints at its ends
  paint(-half, top, 2 * half, deck, '#b5b2aa');
  paint(-half, top, 2 * half, 0.25, '#d8d5cd');
  paint(-half, top + deck - 0.25, 2 * half, 0.25, '#7c7a74');
  paint(-half, top + BEAM_M, 2 * half, FOOTWAY_M, '#c4c1b9');
  paint(-half, road, 2 * half, DECK_ROAD_M, '#3b3e44');
  for (const lineY of [road + 0.35, road + DECK_ROAD_M - 0.5])
    paint(-half - ABUTMENT_M - BANK_OUT_M, lineY, 2 * (half + ABUTMENT_M + BANK_OUT_M), 0.15,
      'rgba(245,245,240,0.75)');
  for (const jointX of [-half + 0.6, half - 0.9])
    paint(jointX, road, 0.3, DECK_ROAD_M, '#25272b');
}
