// barriers.ts - the BARRIERS section (barriers, solid props, clamps). Moved verbatim out of
// lab.js.
import { LEVEL } from "./state.ts";
import { activeLamps, resetLamps, type Lamp } from "./lamps.ts";
import { driveOverPost, hitLamp } from "./lampdamage.ts";
import { solidsNear } from "./solidgrid.ts";
import { isSolidWrecked, noteMarshalSolid, smashHut } from "./marshalbox.ts";
import { solidBox } from "./treetrunks.ts";
import { noteHit } from "../physics/punctures.ts";
import { isNarrow, notePost } from "../physics/posthit.ts";
import {
  edgeCorner, hasOpenWheels, noteWheelBump, wheelBox, wheelEdge, wheelReach,
} from "../physics/openwheel.ts";
import { CORNER_OF_WHEEL } from "./wheels.ts";
import {
  ARMCO_E, applyRailHit, dents, isTornAfter, railContact, straightenRails,
} from "./armcodent.ts";
import type {
  Barrier, BarrierKind, BarrierSeg, CarBody, Point, Prop, Solid, Subtrack,
} from "./types.ts";

// =============================================================================================
// BARRIERS (requirement: use aerial photos of tracks on race days for pit layouts and perimeter
// decorations — if you need to make things like ARMCO or FENCES, do). LEVEL.barriers: [{ kind, pts:
// [[x, y],...] }], polylines in metres.
//   armco    steel double rail on posts — solid
// wall concrete — solid pitwall concrete, red / white / blue painted (Thruxton photos) — solid
// fence catch fence, posts + mesh — solid building an invisible solid outline (props draw the
// building)
//   line     painted line (pit lane edge) — NOT solid
// Solid ones collide with the car's four corners (push out, bounce, scrape) on the same step as
// obstacleClamp; what is drawn is exactly what you hit (user rule: visuals accurate to their
// effects).
export const BARRIER_HALF: Record<BarrierKind, number> = { armco: 0.3, wall: 0.45, pitwall: 0.5,
    fence: 0.15, building: 0.1, line: 0 };
const BARRIER_E = 0.3;           // restitution off a barrier (obstacles use 0.35)
// share of the along-the-wall speed kept per contact step... (scrape)
const BARRIER_SCRAPE = 0.85;
// polyline offset from the subtrack centreline, startDist -> endDist (wrapping past the line),
// `step` metres apart; offset may be a function of the distance (pit-lane entry / exit ramps). + =
// the +normal side. INTERPOLATED point + SMOOTHED normal for paths offset from the track
// (photographed: the pit lane's edges wobbled). onTrack snaps to the sample before dist
// and uses that sample's own direction; at a 17 m offset the sample-to-sample jitter in direction
// became metres of sideways wobble. Here: position lerped between samples, normal averaged over +-4
// samples (~12 m).
export function smoothOnTrack(sub: Subtrack, dist: number, off: number): { x: number; y: number } {
  const pts = sub.pts, count = pts.length;
  dist = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let low = 0, high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (pts[mid].dist <= dist) low = mid; else high = mid - 1;
  }
  const before = pts[low], after = pts[(low + 1) % count], seg = (after.dist > before.dist
      ? after.dist : sub.totalDist) - before.dist, frac = seg > 0 ? (dist - before.dist) / seg : 0;
  let nx = 0, ny = 0;
  for (let near = -4; near <= 4; near++) {
    const sample = pts[(low + near + count) % count];
    nx += sample.nx;
    ny += sample.ny;
  }
  const norm = Math.hypot(nx, ny) || 1;
  return { x: before.x + (after.x - before.x) * frac + (nx / norm) * off,
      y: before.y + (after.y - before.y) * frac + (ny / norm) * off };
}
export function alongTrack(
  sub: Subtrack, startDist: number, endDist: number,
  offset: number | ((t: number, len: number) => number), step = 4,
): Point[] {
  const total = sub.totalDist, pts: Point[] = [];
  let len = endDist - startDist;
  if (len < 0) len += total;
  for (let along = 0; along <= len + 1e-6; along += step) {
    const dist = (startDist + Math.min(along, len)) % total;
    const off = typeof offset === 'function' ? offset(along, len) : offset;
    const point = smoothOnTrack(sub, dist, off);
    pts.push([+point.x.toFixed(2), +point.y.toFixed(2)]);
  }
  return pts;
}
/**
 * Builds a barrier's segments again after its points changed (an armco dent or tear).
 * @param barrier the barrier
 */
function rebuildSegs(barrier: Barrier): void {
  barrier._segs = undefined;
  barrier._rbb = undefined;
  prepBarriers({ barriers: [barrier] });
}
/**
 * The barrier as an armco rail that dents (world/armcodent.ts), or null.
 * @param barrier the barrier
 * @returns the rail or null
 */
const railOf = (barrier: Barrier): Barrier | null => (dents(barrier) ? barrier : null);
/**
 * Dents a rail with this step's hit, if any, and builds its segments again when it changed.
 * @param rail the rail, or null
 */
function settleRail(rail: Barrier | null): void {
  if (rail && applyRailHit(rail)) rebuildSegs(rail);
}
/**
 * RESTART (game/session.js doRestart): every lamp stands again, lit, every wooden hut with them
 * (world/lamps.ts), and every dented or torn armco rail is straight again.
 */
export function resetTrackside(): void {
  resetLamps();
  for (const barrier of straightenRails()) rebuildSegs(barrier);
}
export function prepBarriersOf(level: { barriers?: Barrier[] }): void {
  prepBarriers(level);
}
export function prepBarriers(level: { barriers?: Barrier[] }): void {
  for (const barrier of level.barriers || []) {
    if (barrier._segs) continue;
    barrier._segs = [];
    for (let i = 0; i < barrier.pts.length - 1; i++) {
      const [startX, startY] = barrier.pts[i], [endX, endY] = barrier.pts[i + 1];
      const dx = endX - startX, dy = endY - startY, lenSq = dx * dx + dy * dy;
      // a stretch an armco rail is torn open on is not there (world/armcodent.ts)
      if (lenSq < 1e-6 || isTornAfter(barrier.pts[i])) continue;
      barrier._segs.push({ ax: startX, ay: startY, dx, dy, l2: lenSq,
          minX: Math.min(startX, endX) - 4, maxX: Math.max(startX, endX) + 4,
          minY: Math.min(startY, endY) - 4, maxY: Math.max(startY, endY) + 4, i0: i });
    }
  }
}
// SOLID PROPS (requirement: make sure trees, planes etc are collidable objects).
// LEVEL.solids [{ x, y, w, h, rot }] — rotated boxes, tested against the car's box with the
// separating-axis test. barrierClamp only checks the car's 4 CORNERS against segments, so a tree
// trunk or a wing tip narrower than the car could slip between two corners; SAT cannot miss it.
// Response = the barrier rules (restitution BARRIER_E, scrape BARRIER_SCRAPE, yaw x0.6, shake).
// solidsFromProps builds the boxes from what is drawn, so "move that tree" moves its collision too.
/**
 * Push one rotated solid box (a part of a prop) onto the solids list.
 * @param out the solids list being built
 * @param prop the prop the box belongs to (position, rotation, kind)
 * @param offX box centre offset along the prop's x axis (metres)
 * @param offY box centre offset along the prop's y axis (metres)
 * @param width box width (metres)
 * @param height box height (metres)
 */
function pushPropBox(
  out: Solid[], prop: Prop, offX: number, offY: number, width: number, height: number,
): void {
  const cosRot = Math.cos(prop.rot || 0), sinRot = Math.sin(prop.rot || 0);
  out.push({ x: prop.x + cosRot * offX - sinRot * offY, y: prop.y + sinRot * offX
      + cosRot * offY, w: width, h: height, rot: prop.rot || 0, kind: prop.kind });
}
/**
 * Solid boxes of the big structure props (hangar, grandstand, tower, truck, plane, marshal,
 * board, windsock).
 * @param out the solids list being built
 * @param prop the prop
 * @returns true when the prop kind was handled here
 */
function addStructureSolids(out: Solid[], prop: Prop): boolean {
  const box = (offX: number, offY: number, width: number, height: number): void =>
    pushPropBox(out, prop, offX, offY, width, height);
  switch (prop.kind) {
    // always have w and h
    case 'hangar': case 'grandstand': box(0, 0, prop.w!, prop.h!); return true;
    case 'tower': box(0, 0, prop.size || 9, prop.size || 9); return true;
    case 'truck': box(0, 0, 14, 2.5); return true;
    // fuselage, wing, tailplane
    case 'plane': box(0.3, 0, 7, 1); box(1.0, 0, 1.4, 9); box(-2.8, 0, 0.8,
        3.2); return true;
    case 'marshal':
      box(0, 0, 2.4, 2);
      // the hut's box knows its hut (world/marshalbox.ts: smashed, it stops being solid)
      noteMarshalSolid(out[out.length - 1], prop);
      return true;
    case 'board': box(0, 0, 18, 1.2); return true;
    case 'windsock': box(0, 0, 0.5, 0.5); return true;
    default: return false;
  }
}
/**
 * Solid boxes of the trackside furniture props (tree, gantry, footbridge, bridge).
 * @param out the solids list being built
 * @param prop the prop
 * @returns true when the prop kind was handled here
 */
function addFurnitureSolids(out: Solid[], prop: Prop): boolean {
  const box = (offX: number, offY: number, width: number, height: number): void =>
    pushPropBox(out, prop, offX, offY, width, height);
  switch (prop.kind) {
    // a TREE stops you at its trunk + lower branches (half the canopy); you can clip the outer
    // leaves
    case 'tree': box(0, 0, (prop.s || 4) * 0.5, (prop.s || 4) * 0.5); return true;
    // the two legs
    case 'gantry': box(-(prop.wid || 26) / 2, 0, 1.2, 1.8); box((prop.wid || 26)
        / 2, 0, 1.2, 1.8); return true;
    // stair towers
    case 'footbridge': box(-(prop.wid || 27) / 2, 0, 1.6, 3.0); box((prop.wid || 27)
        / 2, 0, 1.6, 3.0); return true;
    // highway BRIDGES (highway.js extras): the two ABUTMENTS (4 m blocks) at the ends of the
    // span, out on the grass; the deck is overhead
    case 'bridge': box(-(prop.wid || 30) / 2 - 2, 0, 4, prop.carries === 'foot' ? 3.8
        : 8); box((prop.wid || 30) / 2 + 2, 0, 4, prop.carries === 'foot' ? 3.8
        : 8); return true;
    default: return false;
  }
}
/**
 * Solid boxes of the small props (gate, block, sculpture, bale, rock).
 * @param out the solids list being built
 * @param prop the prop
 * @returns true when the prop kind was handled here
 */
function addSmallSolids(out: Solid[], prop: Prop): boolean {
  const box = (offX: number, offY: number, width: number, height: number): void =>
    pushPropBox(out, prop, offX, offY, width, height);
  switch (prop.kind) {
    case 'gate': box(0, 0, 6.8, 0.6); return true;
    case 'block': box(0, 0, prop.w!, prop.h!); return true;   // always have w and h
    case 'sculpture': box(0, 0, 2.2, 2.2); return true;
    case 'bale': box(0, 0, 1.6, 1.6); return true;
    case 'rock': box(0, 0, (prop.s || 3) * 0.7, (prop.s || 3) * 0.7); return true;
    // (field sheep / cows are LOOSE OBJECTS since S-C, - cones.js: pushable, a sheep
    // pops into fluff, a cow tips; not solid props)
    // (chevron boards and flag poles are NOT solid since: flimsy signs on stakes that
    // a car flattens — as solid walls they
    // tore a rally car's front wheels off and rolled it at a Killder corner exit, photographed)
    default: return false;
  }
}
export function solidsFromProps(props: Prop[]): Solid[] {
  const out: Solid[] = [];
  for (const prop of props) {
    if (addStructureSolids(out, prop)) continue;
    if (addFurnitureSolids(out, prop)) continue;
    addSmallSolids(out, prop);
  }
  for (const solid of out) solid.r = Math.hypot(solid.w, solid.h) / 2;
  return out;
}
// the idx-th of four numbers (no array per call)
function pickAxis(
  idx: number, first: number, second: number, third: number, fourth: number,
): number {
  return idx === 0 ? first : idx === 1 ? second : idx === 2 ? third : fourth;
}
/**
 * Bounce the car off a surface: restitution BARRIER_E along the normal, BARRIER_SCRAPE along the
 * wall, yaw damping and shake. Only acts when the car moves into the surface.
 * @param car the car body (velocity, yawRate, shake are changed)
 * @param nx surface normal x (unit, pointing at the car)
 * @param ny surface normal y
 * @param elastic the bounce (an armco rail's is softer: world/armcodent.ts)
 */
function bounceOffNormal(car: CarBody, nx: number, ny: number, elastic = BARRIER_E): void {
  const normalSpeed = car.vx * nx + car.vy * ny;
  if (normalSpeed < 0) {
    const tangX = -ny, tangY = nx, tangSpeed = car.vx * tangX + car.vy * tangY;
    const vn2 = -normalSpeed * elastic, vt2 = tangSpeed * BARRIER_SCRAPE;
    car.vx = nx * vn2 + tangX * vt2;
    car.vy = ny * vn2 + tangY * vt2;
    car.yawRate *= 0.6;
    car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(normalSpeed) * 0.12);
  }
}
/** Result of the separating-axis test between the car and a solid box. */
interface SatResult {
  best: number;      // smallest overlap; <= 0 when the boxes do not touch
  pushX: number;     // unit push direction x
  pushY: number;     // unit push direction y
}
/**
 * Separating-axis test of the car box against one solid box on the 4 axes.
 * @param car the car body
 * @param solid the solid box
 * @param halfLen car half length
 * @param halfWid car half width
 * @param cosHead cos of the car heading
 * @param sinHead sin of the car heading
 * @param centre the box's centre when it is not the car's (an open wheel: physics/openwheel.ts)
 * @returns the smallest overlap and the push direction (best = -1 when separated)
 */
function satAgainstSolid(
  car: CarBody, solid: Solid, halfLen: number, halfWid: number, cosHead: number, sinHead: number,
  centre: Point2 = car,
): SatResult {
  const dx = centre.x - solid.x, dy = centre.y - solid.y;
  const cosRot = Math.cos(solid.rot), sinRot = Math.sin(solid.rot), halfW = solid.w / 2,
      halfH = solid.h / 2;
  // SAT on the 4 axes: overlap = sum of projected half-extents - |centre distance on the axis|
  let best = Infinity, pushX = 0, pushY = 0;
  // no allocation per call (memory diet: k-loop instead of an array of axis arrays)
  for (let idx = 0; idx < 4; idx++) {
    const axisX = pickAxis(idx, cosHead, -sinHead, cosRot, -sinRot);
    const axisY = pickAxis(idx, sinHead, cosHead, sinRot, cosRot);
    const carExtent = halfLen * Math.abs(cosHead * axisX + sinHead * axisY)
        + halfWid * Math.abs(-sinHead * axisX + cosHead * axisY);
    const boxExtent = halfW * Math.abs(cosRot * axisX + sinRot * axisY)
        + halfH * Math.abs(-sinRot * axisX + cosRot * axisY);
    const dist = dx * axisX + dy * axisY, overlap = carExtent + boxExtent - Math.abs(dist);
    if (overlap <= 0) {
      best = -1;
      break;
    }
    if (overlap < best) {
      best = overlap;
      const sign = dist >= 0 ? 1 : -1;
      pushX = axisX * sign;
      pushY = axisY * sign;
    }
  }
  return { best, pushX, pushY };
}
export function solidClamp(car: CarBody): void {
  const spec = car.spec, halfLen = spec.len * 0.48, halfWid = spec.wid * 0.48;
  // the solids and posts near the car (world/solidgrid.ts), or all of them for a long body
  const open = hasOpenWheels(car);
  const found = solidsNear(car.x, car.y, open ? wheelReach(car) : Math.hypot(halfLen, halfWid));
  const list = found ? found.solids : LEVEL.solids, lamps = found ? found.lamps : activeLamps();
  if ((!list || !list.length) && !lamps.length) return;
  // a tree: its trunk only (world/treetrunks.ts)
  if (list) for (const solid of list) clampSolid(car, solidBox(solid), halfLen, halfWid, open);
  // the lamp posts: a hit may lean, dim or snap them; a fallen post is driven over
  for (const lamp of lamps) {
    if (lamp.down) driveOverPost(car, lamp);
    else clampSolid(car, lamp.solid, halfLen, halfWid, open, lamp);
  }
}
/**
 * The car's body, then its open wheels, against one solid box; the hit is noted.
 * @param car the car
 * @param solid the solid box
 * @param halfLen the car's half length for clamping, m
 * @param halfWid the car's half width for clamping, m
 * @param open whether its wheels are exposed (physics/openwheel.ts)
 * @param lamp the lamp the solid is a post of, if it is one
 */
function clampSolid(car: CarBody, solid: Solid, halfLen: number, halfWid: number, open: boolean,
    lamp: Lamp | null = null): void {
  const vx0 = car.vx, vy0 = car.vy;
  clampToSolid(car, solid, halfLen, halfWid, lamp);
  // a post snapped by the body is down: the wheels go through it too
  if (open && !(lamp && lamp.down)) clampWheelsToSolid(car, solid, lamp);
  if (car.vx !== vx0 || car.vy !== vy0) noteHit(car, lamp ? 'lamp' : solid.kind);
}
/** A point, world m. */
type Point2 = { x: number; y: number };
const wheelScratch = { x: 0, y: 0, hl: 0, hw: 0, cos: 1, sin: 0 }, edgeScratch = { x: 0, y: 0 };
/**
 * An open-wheeler's exposed wheels against one solid box (physics/openwheel.ts): each wheel's
 * box clamps as the body's does; a hit into a wheel is noted for the damage.
 * @param car the car
 * @param solid the solid box
 * @param lamp the lamp it is a post of, if it is one
 */
function clampWheelsToSolid(car: CarBody, solid: Solid, lamp: Lamp | null): void {
  for (let wheel = 0; wheel < 4; wheel++) {
    const box = wheelBox(car, wheel, wheelScratch);
    if (!box) continue;
    const vx0 = car.vx, vy0 = car.vy;
    clampToSolid(car, solid, box.hl, box.hw, lamp, box);
    noteWheelBump(car, CORNER_OF_WHEEL[wheel], vx0, vy0);
  }
}
/**
 * An open-wheeler's exposed wheels against one barrier segment: each wheel's outer edge, front
 * and back of the tyre, clamps as a corner does.
 * @param car the car
 * @param seg the segment
 * @param half half the barrier's thickness, m
 * @param rail the armco rail it is part of, when it dents
 */
function clampWheelsToSeg(car: CarBody, seg: BarrierSeg, half: number, rail: Barrier | null): void {
  for (let index = 0; index < 8; index++) {
    const edge = wheelEdge(car, index, edgeScratch);
    if (!edge) continue;
    const vx0 = car.vx, vy0 = car.vy;
    clampCornerToSeg(car, seg, half, edge.x, edge.y, rail);
    noteWheelBump(car, edgeCorner(index), vx0, vy0);
  }
}
/**
 * Push the car out of one solid box and bounce it, when they overlap.
 * @param car the car body
 * @param solid the solid box
 * @param halfLen the car's half length for clamping, m
 * @param halfWid the car's half width for clamping, m
 * @param lamp the lamp the solid is a post of, if it is one
 * @param centre the box's centre when it is not the car's (an open wheel)
 */
function clampToSolid(car: CarBody, solid: Solid, halfLen: number, halfWid: number,
    lamp: Lamp | null = null, centre: Point2 = car): void {
  const dx = centre.x - solid.x, dy = centre.y - solid.y;
  if (dx * dx + dy * dy > (Math.hypot(halfLen, halfWid) + solid.r!) ** 2) return;
  // a smashed hut is no longer solid
  if (solid.kind === 'marshal' && isSolidWrecked(solid)) return;
  const cosHead = Math.cos(car.heading), sinHead = Math.sin(car.heading);
  const { best, pushX, pushY } =
    satAgainstSolid(car, solid, halfLen, halfWid, cosHead, sinHead, centre);
  if (best <= 0) return;
  const into = -(car.vx * pushX + car.vy * pushY);
  // a street light's post or a tree's trunk takes the damage in one spot (physics/posthit.ts)
  if (isNarrow(lamp ? lamp.kind : solid.kind)) notePost(car, solid.x, solid.y, into);
  // a lamp post: the hit leans / dims it, or snaps it and the car goes through (no bounce)
  if (lamp && hitLamp(lamp, car, into, pushX, pushY)) return;
  // a wooden marshal hut: smashed, the car goes through it (world/marshalbox.ts)
  if (solid.kind === 'marshal' && smashHut(solid, car, into, pushX, pushY)) return;
  car.x += pushX * best;
  car.y += pushY * best;
  bounceOffNormal(car, pushX, pushY);
}
/**
 * Push one car corner out of a barrier segment and bounce the car if it pokes in.
 * @param car the car body
 * @param seg the barrier segment
 * @param half half thickness of the barrier
 * @param cornerX world x of the car corner
 * @param cornerY world y of the car corner
 * @param rail the armco rail the segment is part of, when it dents (world/armcodent.ts)
 */
function clampCornerToSeg(
  car: CarBody, seg: BarrierSeg, half: number, cornerX: number, cornerY: number,
  rail: Barrier | null,
): void {
  // torn open earlier this step
  if (seg.torn) return;
  let frac = ((cornerX - seg.ax) * seg.dx + (cornerY - seg.ay) * seg.dy) / seg.l2;
  frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  const nearX = seg.ax + seg.dx * frac, nearY = seg.ay + seg.dy * frac;
  let nx = cornerX - nearX, ny = cornerY - nearY;
  const dist = Math.hypot(nx, ny);
  if (dist >= half) return;
  if (dist < 1e-6) {
    nx = -seg.dy;
    ny = seg.dx;
  }
  const normLen = Math.hypot(nx, ny);
  nx /= normLen;
  ny /= normLen;
  // which side the car is on: the side its CENTRE is on (a corner may have poked through)
  const side = Math.sign((car.x - nearX) * nx + (car.y - nearY) * ny) || 1;
  nx *= side;
  ny *= side;
  // an armco rail: the hit dents it (after the clamp), or tears it and the car goes through
  if (rail && railContact(rail, seg, frac, nx, ny, car)) return;
  const push = half - dist * side;
  car.x += nx * push;
  car.y += ny * push;
  bounceOffNormal(car, nx, ny, rail ? ARMCO_E : BARRIER_E);
}
/**
 * Clamp the car's four corners against one barrier segment.
 * @param car the car body
 * @param seg the barrier segment
 * @param half half thickness of the barrier
 * @param halfLen car half length
 * @param halfWid car half width
 * @param cosHead cos of the car heading
 * @param sinHead sin of the car heading
 * @param rail the armco rail the segment is part of, when it dents
 */
function clampCornersToSeg(
  car: CarBody, seg: BarrierSeg, half: number, halfLen: number, halfWid: number,
  cosHead: number, sinHead: number, rail: Barrier | null,
): void {
  // no allocation per call (memory diet: corners by idx)
  for (let idx = 0; idx < 4; idx++) {
    const fore = idx < 2 ? halfLen : -halfLen, lateral = (idx % 2 === 0) ? halfWid : -halfWid;
    const cornerX = car.x + cosHead * fore - sinHead * lateral, cornerY = car.y
        + sinHead * fore + cosHead * lateral;
    clampCornerToSeg(car, seg, half, cornerX, cornerY, rail);
  }
}
export function barrierClamp(car: CarBody): void {
  const list = LEVEL.barriers;
  if (!list || !list.length) return;
  const spec = car.spec, cosHead = Math.cos(car.heading), sinHead = Math.sin(car.heading);
  const halfLen = spec.len * 0.48, halfWid = spec.wid * 0.48, open = hasOpenWheels(car);
  for (const barrier of list) {
    const half = BARRIER_HALF[barrier.kind];
    if (!half || !barrier._segs) continue;
    const vx0 = car.vx, vy0 = car.vy, rail = railOf(barrier);
    for (const seg of barrier._segs) {
      if (car.x < seg.minX - spec.len || car.x > seg.maxX + spec.len
          || car.y < seg.minY - spec.len || car.y > seg.maxY + spec.len) continue;
      clampCornersToSeg(car, seg, half, halfLen, halfWid, cosHead, sinHead, rail);
      if (open) clampWheelsToSeg(car, seg, half, rail);
    }
    if (car.vx !== vx0 || car.vy !== vy0) noteHit(car, barrier.kind);
    settleRail(rail);
  }
}

// Painted floor figures — all data, all in metres. `kind` picks how render.ts draws it.
export const LAB_PAINT = [
  { kind: 'ring', x: 0, y: 0, r: 40, lw: 0.18, tone: 0.55 },      // skidpad
  { kind: 'ring', x: 0, y: 0, r: 20, lw: 0.12, tone: 0.35 },
  { kind: 'box', x: -28.3, y: 28.3, w: 6, h: 11, tone: 0.5 },     // start box, on the skidpad ring
  { kind: 'box', x: 210, y: 200, w: 60, h: 60, tone: 0.40 },      // donut pad, south-east
  // drag strip along the south edge
  { kind: 'lane', x: -120, y: 240, w: 200, h: 11, tone: 0.35 },
  // SUSPENSION TEST ZONE mark-out: the whole zone, then one box per lane
  // tones 0.55-0.8: the first cut at 0.30 was invisible against the lab grid (photographed)
  // top edge at y 166: at 161 it ran into the mud / sand test panels north of the zone
  // (photographed)
  { kind: 'box', x: -124, y: 190, w: 242, h: 48, tone: 0.8 },
  { kind: 'lane', x: -195, y: 172, w: 80, h: 10, tone: 0.55 },
  { kind: 'lane', x: -190, y: 187, w: 90, h: 10, tone: 0.55 },
  { kind: 'lane', x: -205, y: 203, w: 56, h: 10, tone: 0.55 },
];

// Distance boards down the braking straight, in metres from its start. These make a braking test
// readable without a HUD number, which is the point of painting them.
export const LAB_BOARDS = [
  { x: -25, y: 240, label: '0' },
  { x: -75, y: 240, label: '50' },
  { x: -125, y: 240, label: '100' },
  { x: -175, y: 240, label: '150' },
  // SUSPENSION TEST ZONE labels, painted on the floor at the WEST end of each lane (you enter from
  // the west)
  { x: -118, y: 172, label: 'SUSPENSION TEST' },
  { x: -242, y: 172, label: 'WHOOPS' },
  { x: -242, y: 187, label: 'DIPS' },
  { x: -242, y: 203, label: 'WASHBOARD' },
  { x: -36, y: 166, label: 'BOWL' },
];

// Cones. Loose clusters, a slalom, and a gate — something to aim at and knock over later (Step 6).
// r is the base radius in metres (a real traffic cone base is ~0.18 m).
