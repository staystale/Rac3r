// world/crossinggeo.ts - A DRIVABLE BRIDGE'S OR TUNNEL'S WAY (world/types.ts Crossing, stepped by
// world/crossings.ts): where a point lies along and across it, the crossing a car is on, and its
// deck - tarmac, straight from one end's ground height to the other's: no hills, kerbs or wear (it
// is not the ground). Also the venue bridge's and portal's measures, which the drawing
// (render/props/venueprops.ts) and the solids (world/barriers.ts) both read.
import { LEVEL } from "./state.ts";
import { SURFACES } from "./surfaces.ts";
import { bumpAt } from "./terrain.ts";
import { WEATHER } from "./weather.ts";
import { dampSurface } from "./wet.ts";
import type { CarBody, Crossing, Ground, Surface } from "./types.ts";

// a venue road bridge, m: the road on the deck, the edge beams, the footway (on the deck's -y
// side), the abutments' depth past the deck's ends and their wing walls' reach past its sides, the
// ramps' retaining walls
export const VENUE_DECK = { road: 7, beam: 0.7, footway: 1.4, abutment: 1.6, wing: 2.2,
  rampWall: 0.4 };
// m across the deck from its centre line to its road's two edges (the footway's kerb, the beam)
export const DECK_ROAD_LO = -(VENUE_DECK.road + 2 * VENUE_DECK.beam + VENUE_DECK.footway) / 2
  + VENUE_DECK.beam + VENUE_DECK.footway;
export const DECK_ROAD_HI = DECK_ROAD_LO + VENUE_DECK.road;
/**
 * A drivable bridge's ramp lengths, m: a venue's appL (its ramps are its approaches), a highway
 * bridge's rampL (its approaches run on past them).
 * @param prop the bridge
 * @param prop.appL its approaches' lengths
 * @param prop.rampL its ramps' lengths, when they differ
 * @returns [the -x end's, the +x end's]
 */
export const rampsOf = (prop: { appL?: number[]; rampL?: number[] }): number[] =>
  prop.rampL || prop.appL || [9, 9];
// a tunnel portal, m: its side walls' thickness, the lintel's depth over the mouth
export const PORTAL_WALL_M = 0.6, PORTAL_LINTEL_M = 1;

/**
 * How far along a crossing's way a point lies from end A.
 * @param way the crossing
 * @param x world x, m
 * @param y world y, m
 * @returns m (0 at A, way.length at B)
 */
export const alongOf = (way: Crossing, x: number, y: number): number =>
  (x - way.ax) * way.dirX + (y - way.ay) * way.dirY;

/**
 * How far across a crossing's way a point lies from its line, + to the left of A -> B.
 * @param way the crossing
 * @param x world x, m
 * @param y world y, m
 * @returns m
 */
export const acrossOf = (way: Crossing, x: number, y: number): number =>
  (y - way.ay) * way.dirX - (x - way.ax) * way.dirY;

/**
 * The bridge or tunnel a car is on.
 * @param car the car
 * @returns the crossing, or null on the ground
 */
export function crossingOf(car: Pick<CarBody, 'crossing'>): Crossing | null {
  const index = car.crossing ?? -1;
  return index >= 0 && LEVEL.crossings ? LEVEL.crossings[index] || null : null;
}

/**
 * Whether two cars are on the same level (the ground, or the same bridge or tunnel).
 * @param first a car
 * @param second another car
 * @returns true when they can touch
 */
export const sameLevel = (first: Pick<CarBody, 'crossing'>, second: Pick<CarBody, 'crossing'>):
  boolean => (first.crossing ?? -1) === (second.crossing ?? -1);

/**
 * Whether a car is on the ground (on no bridge or in no tunnel).
 * @param car the car
 * @returns true on the ground
 */
export const onGround = (car: Pick<CarBody, 'crossing'>): boolean => (car.crossing ?? -1) < 0;

/**
 * Whether a car is under the ground: in a tunnel past its open cuts (not drawn).
 * @param car the car
 * @returns true when hidden
 */
export function isUnderground(car: Pick<CarBody, 'crossing' | 'x' | 'y'>): boolean {
  const way = crossingOf(car);
  if (!way || way.kind !== 'tunnel') return false;
  const along = alongOf(way, car.x, car.y);
  return Math.min(along, way.length - along) > way.cut;
}

// each crossing's ground height at its two ends, m (read once: the level's hills are laid by then)
const END_HEIGHTS = new WeakMap<Crossing, [number, number]>();

/**
 * A crossing's ground height at end A and at end B.
 * @param way the crossing
 * @returns [m at A, m at B]
 */
function endHeights(way: Crossing): [number, number] {
  let heights = END_HEIGHTS.get(way);
  if (!heights) {
    heights = [bumpAt(way.ax, way.ay),
      bumpAt(way.ax + way.dirX * way.length, way.ay + way.dirY * way.length)];
    END_HEIGHTS.set(way, heights);
  }
  return heights;
}

/**
 * A crossing's road surface: a bridge's deck wet as the weather, a tunnel's dry.
 * @param way the crossing
 * @returns the surface
 */
export function deckSurface(way: Crossing): Surface {
  return way.kind === 'bridge' ? dampSurface(SURFACES.tarmac, WEATHER.wetness) : SURFACES.tarmac;
}

/**
 * The ground under a point of a crossing: from one end's ground height to the other's, with the
 * way's rise (a bridge's arch, a tunnel's dip) on top.
 * @param way the crossing
 * @param x world x, m
 * @param y world y, m
 * @returns the height and the surface
 */
export function deckGround(way: Crossing, x: number, y: number): Ground {
  const [startH, endH] = endHeights(way);
  const share = Math.min(1, Math.max(0, alongOf(way, x, y) / way.length));
  // the terrain's hump / dip shape along the way (world/terrain.ts): sin^2, level at both ends
  // and at the middle - up over a bridge's ramps and deck, down into a tunnel
  const lift = way.rise * Math.sin(Math.PI * share) ** 2;
  return { h: startH + (endH - startH) * share + lift, surface: deckSurface(way) };
}

/**
 * The slope forces on a car on a crossing (world/wear.ts applySlopeForces on a plane): its
 * weight down the way's grade where it is (the ends' difference and the rise), no yaw (the grade
 * is along the way, alike under both axles near enough) and no bump steer.
 * @param car the car (slope fields are written)
 * @param way the crossing
 * @param cosH cos of the car's heading
 * @param sinH sin of the car's heading
 */
export function deckSlope(car: CarBody, way: Crossing, cosH: number, sinH: number): void {
  const [startH, endH] = endHeights(way);
  const share = Math.min(1, Math.max(0, alongOf(way, car.x, car.y) / way.length));
  // the ends' difference, and the rise's slope here (d/da of rise sin^2(pi a / L))
  const grade = (endH - startH) / way.length
    + way.rise * (Math.PI / way.length) * Math.sin(2 * Math.PI * share);
  const gradeX = grade * way.dirX, gradeY = grade * way.dirY;
  const weight = car.spec.mass * car.mods.mass * 9.81;
  car.slopeLong = -weight * (gradeX * cosH + gradeY * sinH);
  car.slopeLat = -weight * (-gradeX * sinH + gradeY * cosH);
  car.slopeYaw = 0;
}
