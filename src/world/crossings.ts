// world/crossings.ts - DRIVABLE BRIDGES AND TUNNELS (the venue's road bridges over
// the track and its tunnels under it). A crossing (world/types.ts Crossing) is a straight way
// between two ends - a bridge from one ramp's foot to the other's, a tunnel from one portal's open
// end to the other's. A car comes onto it only by crossing an end into it; then, until it leaves
// by an end, it meets only the crossing's walls (not the track's barriers, solids or fence), drives
// on its deck (world/crossinggeo.ts: tarmac, no hills, no wear), touches no car on another level
// (contact.ts), leaves no marks or smoke, counts no lap (game/order.ts), and is drawn over the
// bridge or hidden in the tunnel (render/screen.ts). A car on the ground meets the ends as solid
// (world/barriers.ts): a ramp's walls and abutment, a portal's walls and lintel - so the only way
// on is up the ramp or down into the cut.
import { barrierClamp, clampToBarriers, prepBarriers, solidClamp } from "./barriers.ts";
import { dragTangled } from "./armcodent.ts";
import {
  DECK_ROAD_HI, DECK_ROAD_LO, PORTAL_LINTEL_M, VENUE_DECK, acrossOf, alongOf, crossingOf,
} from "./crossinggeo.ts";
import { LEVEL } from "./state.ts";
import { fenceClamp, obstacleClamp } from "./obstacles.ts";
import { steepClamp, landingClamp } from "../physics/steepground.ts";
import type { Barrier, CarBody, Crossing, Point, Prop } from "./types.ts";

// m: a crossing's walls are 'wall' barriers (half thickness 0.45, world/barriers.ts BARRIER_HALF)
const WALL_HALF_M = 0.45;
// a way's rise at its middle (a bridge up, a tunnel down): this share of its length, at most
// RISE_MAX_M - gentle enough that a car goes light at a bridge's top, never flies (the crest
// rule): MEASURED at Brands (1.0 / 1.3 m up, 1.4 m down) no air to 90 km/h; at 120 a 0.44 s hop
// off the short bridge only (4 % flew from 90)
const RISE_SHARE = 0.025, RISE_MAX_M = 2.5;

/**
 * Steps which level a car is on (an end crossed into a crossing puts it on; an end crossed out
 * puts it back on the ground), then holds it against that level: a crossing's walls, or the
 * ground's fence, obstacles, barriers and solids. Every car's physics step calls it before
 * applyGround (world/wear.ts). A car tangled in a torn catch fence is dragged (world/armcodent.ts).
 * @param car the car body
 * @param dt the step, s
 */
export function clampWorld(car: CarBody, dt: number): void {
  dragTangled(car, dt);
  stepLevel(car);
  const way = crossingOf(car);
  if (way) {
    clampToBarriers(car, way.walls);
    return;
  }
  fenceClamp(car);
  obstacleClamp(car);
  barrierClamp(car);
  solidClamp(car);
  // ground too steep to drive, and a hard landing (physics/steepground.ts: Deaf Valley's gorges)
  steepClamp(car);
  landingClamp(car);
}

/**
 * The car's level for this step: off its crossing when its centre is past an end, onto a
 * crossing when its centre came in over an end between the walls.
 * @param car the car body
 */
function stepLevel(car: CarBody): void {
  const list = LEVEL.crossings;
  if (!list || !list.length) return;
  const fromX = car.crossX ?? car.x, fromY = car.crossY ?? car.y;
  car.crossX = car.x;
  car.crossY = car.y;
  const index = car.crossing ?? -1;
  if (index >= 0) {
    const way = list[index];
    if (!way || !isBetweenEnds(way, car.x, car.y)) car.crossing = -1;
    return;
  }
  for (let i = 0; i < list.length; i++) {
    const way = list[i], across = acrossOf(way, car.x, car.y);
    if (across <= way.minAcross || across >= way.maxAcross) continue;
    if (isBetweenEnds(way, car.x, car.y) && !isBetweenEnds(way, fromX, fromY)) car.crossing = i;
  }
}

/**
 * Whether a point lies between a crossing's two ends (at any distance across).
 * @param way the crossing
 * @param x world x, m
 * @param y world y, m
 * @returns true between them
 */
function isBetweenEnds(way: Crossing, x: number, y: number): boolean {
  const along = alongOf(way, x, y);
  return along >= 0 && along <= way.length;
}

/**
 * A crossing from its two ends and its walls' offsets, with the walls built.
 * @param kind bridge or tunnel
 * @param start end A
 * @param end end B
 * @param sides m across to each wall's face [least, most] (+ along (-dirY, dirX))
 * @param cut m in from each end a tunnel's open cut runs
 * @returns the crossing
 */
function makeCrossing(kind: Crossing['kind'], start: Point, end: Point, sides: Point,
  cut: number): Crossing {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const dirX = (end[0] - start[0]) / length, dirY = (end[1] - start[1]) / length;
  const [minAcross, maxAcross] = sides;
  const wall = (offset: number): Barrier => ({ kind: 'wall', pts: [
    [start[0] - dirY * offset, start[1] + dirX * offset],
    [end[0] - dirY * offset, end[1] + dirX * offset]] });
  const walls = [wall(minAcross - WALL_HALF_M), wall(maxAcross + WALL_HALF_M)];
  prepBarriers({ barriers: walls });
  const rise = Math.min(RISE_MAX_M, RISE_SHARE * length) * (kind === 'bridge' ? 1 : -1);
  return { kind, ax: start[0], ay: start[1], dirX, dirY, length, minAcross, maxAcross, cut,
    rise, walls };
}

/**
 * A venue road bridge's crossing: from one ramp's foot to the other's, the deck's road between.
 * @param prop the bridge (rot along its road, wid its span, appL its ramps)
 * @returns the crossing
 */
function bridgeCrossing(prop: Prop): Crossing {
  const dirX = Math.cos(prop.rot || 0), dirY = Math.sin(prop.rot || 0);
  const half = (prop.wid || 30) / 2 + VENUE_DECK.abutment, [rampA, rampB] = prop.appL!;
  return makeCrossing('bridge', [prop.x - dirX * (half + rampA), prop.y - dirY * (half + rampA)],
    [prop.x + dirX * (half + rampB), prop.y + dirY * (half + rampB)],
    [DECK_ROAD_LO, DECK_ROAD_HI], 0);
}

/**
 * A tunnel's crossing: from one portal's open end to the other's, between the portals' walls.
 * @param first a portal (rot down its ramp toward the track, w its length, h its width)
 * @param second the portal on the track's other side
 * @returns the crossing
 */
function tunnelCrossing(first: Prop, second: Prop): Crossing {
  const openEnd = (portal: Prop): Point => [
    portal.x - Math.cos(portal.rot || 0) * portal.w! / 2,
    portal.y - Math.sin(portal.rot || 0) * portal.w! / 2];
  const way = makeCrossing('tunnel', openEnd(first), openEnd(second),
    [-first.h! / 2, first.h! / 2], first.w! - PORTAL_LINTEL_M);
  // the race road's own underpass (a figure of eight: world/trackunder.ts)
  return first.track ? { ...way, track: true } : way;
}

/**
 * The drivable crossings of a venue (world/venue.ts): each road bridge, and each tunnel's two
 * portals (laid in pairs, world/venuescenery.ts venueTunnels; a footpath's too, at its own
 * width - its mouths open onto room to drive out: roomToDriveOut).
 * @param props the venue's props
 * @returns the crossings
 */
export function venueCrossings(props: Prop[]): Crossing[] {
  const portals = props.filter((prop) => prop.kind === 'tunnel');
  const tunnels: Crossing[] = [];
  for (let i = 0; i + 1 < portals.length; i++) {
    // a tunnel's two portals face each other across the track
    if (Math.cos((portals[i].rot || 0) - (portals[i + 1].rot || 0)) > -0.99) continue;
    tunnels.push(tunnelCrossing(portals[i], portals[i + 1]));
    i++;
  }
  return [...props.filter((prop) => prop.kind === 'bridge' && prop.look === 'venue')
    .map(bridgeCrossing), ...tunnels];
}
