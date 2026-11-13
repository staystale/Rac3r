// render/props/venueprops.ts - the props a venue adds (world/venuescenery.ts): a TUNNEL PORTAL
// where a road or path dives under the track (concrete side walls, the ramp darkening into the
// mouth, a lintel over it) and a PARKED CAR in the car parks. Drawn in the props' frame: x along
// the prop's rot, metres times ppm.
import { COL } from '../../world/colours.ts';
import { FIX } from '../../core/fixes.ts';
import { LEVEL } from '../../world/state.ts';
import { PORTAL_LINTEL_M, PORTAL_WALL_M, VENUE_DECK, rampsOf } from '../../world/crossinggeo.ts';
import type { Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

// the ramp's shades, from the road at the open end to the dark at the mouth
const RAMP_SHADES = ['#3b3e45', '#2f3238', '#24262b', '#191a1e', '#0f1013'];
// (?cutroad=1) on the race road down a crossover's cut, the same darkening laid OVER the road
// instead of painted in its place: the opaque shades hid the road's own texture, wear and lines
// down the whole open cut (the cut is the ramp: 8 m of a 9 m portal), and the first, #3b3e45,
// stood lighter than race tarmac (#2d303a) - a step where the road met it. Black at these
// shares takes race tarmac from its own colour at the open end to the old shades' darkest
// (#0f1013, a third of it) at the mouth. The floor beside the road, to the walls, keeps the
// opaque shades (under it lies the venue's own ground: a stadium's grass).
const RAMP_DARKEN = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.17)', 'rgba(0,0,0,0.33)', 'rgba(0,0,0,0.5)',
  'rgba(0,0,0,0.67)'];
// m: a portal wall's thickness, the lintel's depth (world/crossinggeo.ts: the solids read them)
const WALL_M = PORTAL_WALL_M, LINTEL_M = PORTAL_LINTEL_M;
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
  if (FIX.cutroad && prop.track && LEVEL.subtrack) {
    drawRampOverRoad(paint, -halfL, band, halfW, Math.min(halfW, LEVEL.subtrack.width / 2));
  } else {
    RAMP_SHADES.forEach((shade, i) =>
      paint(-halfL + i * band, -halfW, band + 0.05, prop.h!, shade));
  }
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
 * A race road's ramp down a crossover's cut (?cutroad=1): the road's own surface darkened toward
 * the mouth, the floor beside it to the walls in the opaque shades.
 * @param paint fills a box in the portal's frame (x, y, length, width, colour), m
 * @param from the ramp's open end, m along
 * @param band each shade's length, m
 * @param halfWidth half the cut's width between the walls, m
 * @param roadHalf half the road's width, m
 */
function drawRampOverRoad(paint: (x: number, y: number, width: number, height: number,
  col: string) => void, from: number, band: number, halfWidth: number, roadHalf: number) {
  const beside = halfWidth - roadHalf;
  RAMP_SHADES.forEach((shade, i) => {
    const x = from + i * band;
    paint(x, -halfWidth, band + 0.05, beside, shade);
    paint(x, roadHalf, band + 0.05, beside, shade);
    // (the darkened bands abut: a share laid twice would show as a line across the road)
    paint(x, -roadHalf, band, 2 * roadHalf, RAMP_DARKEN[i]);
  });
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

// a venue road bridge (world/crossinggeo.ts VENUE_DECK: the solids and the drivable deck read
// them): m of the road on the deck, the edge beams, the footway; a ramp's steps down, and its
// retaining walls' thickness
const DECK_ROAD_M = VENUE_DECK.road, BEAM_M = VENUE_DECK.beam, FOOTWAY_M = VENUE_DECK.footway,
  RAMP_STEPS = 12, RAMP_WALL_M = VENUE_DECK.rampWall;
/** A drivable bridge's concrete: walls and abutments, their lit tops, the deck, its two beams'
 * edges, the footway. */
interface Concrete { wall: string; wallTop: string; deck: string; lit: string; shade: string;
  footway: string }
// the venues' grey; Deaf Valley's sun-bleached sand (pal 'desert': owner 11-11, its bridges "to
// match the Death Valley asthetic")
const CONCRETE: Record<string, Concrete> = {
  plain: { wall: '#a9a7a0', wallTop: '#c9c6bd', deck: '#b5b2aa', lit: '#d8d5cd',
    shade: '#7c7a74', footway: '#c4c1b9' },
  desert: { wall: '#b39d7e', wallTop: '#d3c2a2', deck: '#c2ad8c', lit: '#e2d4b6',
    shade: '#8a7458', footway: '#cdb998' },
};
/**
 * A bridge's concrete.
 * @param prop the bridge
 * @returns its colours
 */
const concreteOf = (prop: Prop): Concrete => CONCRETE[prop.pal === 'desert' ? 'desert' : 'plain'];
// m: an abutment's depth along the road and its wing walls' reach out past the deck
const ABUTMENT_M = VENUE_DECK.abutment, WING_M = VENUE_DECK.wing;

/**
 * A venue bridge's abutments and wing walls, its road running on over them to its ramps.
 * @param paint fills a box in the bridge's frame (x, y, length, width, colour)
 * @param half half the deck's span, m
 * @param top the deck's -y edge, m
 * @param deck the deck's width, m
 * @param road the road's -y edge, m
 * @param look its concrete
 */
function drawAbutments(paint: (x: number, y: number, width: number, height: number,
  col: string) => void, half: number, top: number, deck: number, road: number, look: Concrete) {
  for (const end of [-1, 1]) {
    const x = end < 0 ? -half - ABUTMENT_M : half;
    paint(x, top - WING_M * 0.5, ABUTMENT_M, deck + WING_M, look.wall);
    paint(x, top - WING_M * 0.5, ABUTMENT_M, 0.3, look.wallTop);
    paint(x, road, ABUTMENT_M, DECK_ROAD_M, COL.tarmac);
  }
}

/** Fills a box in a prop's frame: x, y, length, width (m) and a colour. */
type Paint = (x: number, y: number, width: number, height: number, col: string) => void;

/**
 * Draws a venue's road bridge (world/venuescenery.ts, look 'venue'): a ramp at each end (the road
 * between concrete retaining walls), concrete abutments with wing walls, the deck as a road on two
 * edge beams with a footway and white edge lines, expansion joints, its shadow on the track below.
 * Nose along +x (the road it carries); wid is the deck's span. It is drivable (world/crossings.ts),
 * so drawn in two parts: its ramps and abutments ('base') under the cars, as ground a car drives
 * up, and its deck ('deck') over the cars beneath it.
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 * @param part its base or its deck
 */
export function drawVenueBridge(propCtx: PropCtx, prop: Prop, ppm: number, part: 'base' | 'deck') {
  const ctx = propCtx.view.ctx, half = (prop.wid || 30) / 2;
  const deck = DECK_ROAD_M + 2 * BEAM_M + FOOTWAY_M, top = -deck / 2;
  const paint: Paint = (x, y, width, height, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
  const road = top + BEAM_M + FOOTWAY_M, [rampNeg, rampPos] = rampsOf(prop);
  const lines = (from: number, till: number) => {
    for (const lineY of [road + 0.35, road + DECK_ROAD_M - 0.5])
      paint(from, lineY, till - from, 0.15, 'rgba(245,245,240,0.75)');
  };
  if (part === 'base') {
    drawRamps(ctx, paint, prop, ppm, half, road);
    drawAbutments(paint, half, top, deck, road, concreteOf(prop));
    // the edge lines up both ramps and over the abutments, to the deck's ends
    lines(-half - ABUTMENT_M - rampNeg, -half);
    lines(half, half + ABUTMENT_M + rampPos);
    return;
  }
  // the deck's shadow on the track (the sun from the top left)
  ctx.fillStyle = 'rgba(10,12,16,0.38)';
  ctx.fillRect((-half + 1.2) * ppm, (top + 1.8) * ppm, 2 * half * ppm, deck * ppm);
  // the deck: edge beams, the road with its edge lines, the footway, the joints at its ends
  const look = concreteOf(prop);
  paint(-half, top, 2 * half, deck, look.deck);
  paint(-half, top, 2 * half, 0.25, look.lit);
  paint(-half, top + deck - 0.25, 2 * half, 0.25, look.shade);
  paint(-half, top + BEAM_M, 2 * half, FOOTWAY_M, look.footway);
  paint(-half, road, 2 * half, DECK_ROAD_M, COL.tarmac);
  // the edge lines over the deck
  lines(-half, half);
  for (const jointX of [-half + 0.6, half - 0.9])
    paint(jointX, road, 0.3, DECK_ROAD_M, '#25272b');
}

/**
 * A venue bridge's ramps: the road running on from each end between concrete retaining walls that
 * step down (shorter and shorter shadows) to the ground.
 * @param ctx the canvas
 * @param paint fills a box in the bridge's frame
 * @param prop the bridge (appL its ramps' lengths)
 * @param ppm pixels per metre
 * @param half half the deck's span, m
 * @param road the road's -y edge, m
 */
function drawRamps(ctx: CanvasRenderingContext2D, paint: Paint, prop: Prop, ppm: number,
  half: number, road: number) {
  const steps = RAMP_STEPS;
  for (const end of [-1, 1]) {
    // each end's ramp as long as its approach needs (world/venuescenery.ts sets appL)
    const ramp = rampsOf(prop)[end < 0 ? 0 : 1];
    const from = end < 0 ? -half - ABUTMENT_M - ramp : half + ABUTMENT_M;
    paint(from, road, ramp, DECK_ROAD_M, COL.tarmac);
    for (let step = 0; step < steps; step++) {
      // the step nearest the deck first: its wall's shadow the longest
      const near = end < 0 ? from + ramp * (1 - (step + 1) / steps) : from + ramp * step / steps;
      const shade = 0.3 * (1 - step / steps);
      // (the shadow also shortens toward the ground: an even slope)
      const reach = 0.6 * (1 - step / steps) + 0.1;
      for (const wallY of [road - RAMP_WALL_M, road + DECK_ROAD_M]) {
        paint(near, wallY, ramp / steps, RAMP_WALL_M, concreteOf(prop).wall);
        ctx.fillStyle = `rgba(10,12,16,${shade.toFixed(2)})`;
        ctx.fillRect(near * ppm, (wallY + RAMP_WALL_M) * ppm, (ramp / steps) * ppm, reach * ppm);
      }
    }
  }
}
