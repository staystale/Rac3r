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
  DECK_ROAD_HI, DECK_ROAD_LO, PORTAL_LINTEL_M, VENUE_DECK, acrossOf, alongOf, crossingOf, rampsOf,
} from "./crossinggeo.ts";
import { trainAt } from "./trains.ts";
import { worldSeconds } from "./worldclock.ts";
import { LEVEL } from "./state.ts";
import { lineLength } from "./venuegeo.ts";
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
    if (way.train) meetTrain(car, way.train);
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
    // (a bent tunnel: on only through its mouth, not anywhere across the bend's span)
    const isOutside = way.mouth !== undefined ? Math.abs(across) >= way.mouth
      : across <= way.minAcross || across >= way.maxAcross;
    if (isOutside) continue;
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
 * A drivable road bridge's crossing (a venue's, a highway's): from one ramp's foot to the other's,
 * the deck's road between.
 * @param prop the bridge (rot along its road, wid its span, appL its ramps)
 * @returns the crossing
 */
export function bridgeCrossing(prop: Prop): Crossing {
  const dirX = Math.cos(prop.rot || 0), dirY = Math.sin(prop.rot || 0);
  const half = (prop.wid || 30) / 2 + VENUE_DECK.abutment, [rampA, rampB] = rampsOf(prop);
  return makeCrossing('bridge', [prop.x - dirX * (half + rampA), prop.y - dirY * (half + rampA)],
    [prop.x + dirX * (half + rampB), prop.y + dirY * (half + rampB)],
    [DECK_ROAD_LO, DECK_ROAD_HI], 0);
}

/**
 * A line offset to one side along its own normals (a bent tunnel's wall).
 * @param path the line
 * @param offset m to its left (+ along (-dirY, dirX))
 * @returns the points
 */
function offsetPath(path: Point[], offset: number): Point[] {
  return path.map(([x, y], i) => {
    const [fromX, fromY] = path[Math.max(0, i - 1)], [toX, toY] = path[Math.min(path.length - 1,
      i + 1)];
    const len = Math.hypot(toX - fromX, toY - fromY) || 1;
    return [x - (toY - fromY) / len * offset, y + (toX - fromX) / len * offset] as Point;
  });
}

/**
 * A race-road tunnel whose road bends under the ground (Moanaco's; a crossover's underpass, its S
 * under the bridge): the way runs straight from the road's centre at one end to the other's (its
 * dip and deck by that line), but its walls follow the road (first.path) - its across bounds span
 * the whole bend, a car comes on only through a mouth, and what is hidden is what lies under the
 * cover's slats (first.slats: seen between), else the whole stretch between the lintels.
 * @param first the first portal (its path the road's centre end to end)
 * @param second the portal at the other end
 * @returns the crossing
 */
function bentTunnel(first: Prop, second: Prop): Crossing {
  const path = first.path!, half = first.h! / 2, start = path[0], end = path[path.length - 1];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const dirX = (end[0] - start[0]) / length, dirY = (end[1] - start[1]) / length;
  const left = offsetPath(path, half), right = offsetPath(path, -half);
  const walls: Barrier[] = [offsetPath(path, half + WALL_HALF_M),
    offsetPath(path, -half - WALL_HALF_M)].map((pts) => ({ kind: 'wall', pts }));
  prepBarriers({ barriers: walls });
  const acrosses = [...left, ...right].map(([x, y]) => (y - start[1]) * dirX
    - (x - start[0]) * dirY);
  // the mouths: the road's half width measured along the end line (the road meets it askew)
  const skew = (portal: Prop) => Math.abs(Math.cos((portal.rot || 0) - Math.atan2(dirY, dirX)));
  const mouth = half / Math.max(0.5, Math.min(skew(first), skew(second)));
  // the open cuts, road m from each end to its lintel (path points PATH_STEP apart along the road)
  const step = lineLength(path) / (path.length - 1), cutPts = Math.round((first.w!
    - PORTAL_LINTEL_M) / step);
  const along = ([x, y]: Point) => (x - start[0]) * dirX + (y - start[1]) * dirY;
  const cut = Math.min(along(path[cutPts]), length - along(path[path.length - 1 - cutPts]));
  return { kind: 'tunnel', ax: start[0], ay: start[1], dirX, dirY, length,
    minAcross: Math.min(...acrosses), maxAcross: Math.max(...acrosses), cut,
    rise: -Math.min(RISE_MAX_M, RISE_SHARE * length), walls, track: true, mouth,
    ...(first.slats ? { hidden: first.slats } : {}) };
}

/**
 * A rail bridge's crossing: from one approach's ramp foot to the other's, between
 * the deck's walls, on its ballast; its train runs on it.
 * @param prop the bridge (rot along its track, wid its span, rampL its ramps)
 * @returns the crossing
 */
export function railCrossing(prop: Prop): Crossing {
  const dirX = Math.cos(prop.rot || 0), dirY = Math.sin(prop.rot || 0);
  const half = (prop.wid || 30) / 2 + RAIL_ABUTMENT_M, [rampA, rampB] = rampsOf(prop);
  const way = makeCrossing('bridge', [prop.x - dirX * (half + rampA), prop.y - dirY * (half
    + rampA)], [prop.x + dirX * (half + rampB), prop.y + dirY * (half + rampB)],
  [-RAIL_DECK_HALF_M, RAIL_DECK_HALF_M], 0);
  return { ...way, ballast: true, train: prop };
}
// m: a rail bridge's abutments past its span (render/props/bridges.ts draws them 4 m), the half
// width of its deck between the walls (its 7 m deck less its edge beams)
const RAIL_ABUTMENT_M = 4, RAIL_DECK_HALF_M = 2.7;

/**
 * A car on a rail bridge's deck meets its train: where the train's cars overlap
 * the car's body, the car is put beside the train and carried at its speed along the track - the
 * change of speed is the impact (game/sim.ts hit: the damage), pressed on a wall it is crushed.
 * @param car the car
 * @param bridge the rail bridge
 */
function meetTrain(car: CarBody, bridge: Prop): void {
  const train = trainAt(bridge, worldSeconds() + (bridge.phase || 0));
  if (!train) return;
  const cos = Math.cos(bridge.rot || 0), sin = Math.sin(bridge.rot || 0);
  const relX = car.x - bridge.x, relY = car.y - bridge.y;
  const along = relX * cos + relY * sin, across = -relX * sin + relY * cos;
  const reach = car.spec.len / 2, side = car.spec.wid / 2 + train.halfWidth;
  if (Math.abs(across - train.across) >= side) return;
  if (!train.cars.some((start) => along + reach > start && along - reach < start + train.carM))
    return;
  // beside the train on the nearer side, moving with it along the track
  const out = train.across + Math.sign(across - train.across || 1) * (side + TRAIN_CLEAR_M);
  const alongV = car.vx * cos + car.vy * sin, acrossV = -car.vx * sin + car.vy * cos;
  const newAlong = alongV + (train.speed - alongV) * TRAIN_GRIP;
  car.x = bridge.x + along * cos - out * sin;
  car.y = bridge.y + along * sin + out * cos;
  car.vx = newAlong * cos - acrossV * sin;
  car.vy = newAlong * sin + acrossV * cos;
}
// m a car is put clear of the train's side; the share of the train's speed it takes in one meeting
const TRAIN_CLEAR_M = 0.05, TRAIN_GRIP = 0.8;

/**
 * A tunnel's crossing: from one portal's open end to the other's, between the portals' walls.
 * @param first a portal (rot down its ramp toward the track, w its length, h its width)
 * @param second the portal on the track's other side
 * @returns the crossing
 */
export function tunnelCrossing(first: Prop, second: Prop): Crossing {
  if (first.path) return bentTunnel(first, second);
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
    // a tunnel's two portals face each other across the track (a bent tunnel's: its path)
    const isFacing = Math.cos((portals[i].rot || 0) - (portals[i + 1].rot || 0)) <= -0.99;
    if (!isFacing && !portals[i].path) continue;
    tunnels.push(tunnelCrossing(portals[i], portals[i + 1]));
    i++;
  }
  return [...props.filter((prop) => prop.kind === 'bridge' && prop.look === 'venue')
    .map(bridgeCrossing), ...tunnels];
}
