// barriers.ts - the BARRIERS section (barriers, solid props, clamps). Moved verbatim out of
// lab.js.
import { LEVEL } from "./state.ts";
import type { Barrier, BarrierKind, CarBody, Point, Prop, Solid, Subtrack } from "./types.ts";

// =============================================================================================
// BARRIERS (2026-10-03; user: "use aerial photos of tracks on race days for pit layouts and
// perimeter decorations — if you
// need to make things like ARMCO or FENCES, do"). LEVEL.barriers: [{ kind, pts: [[x, y], ...] }],
// polylines in metres.
//   armco    steel double rail on posts — solid
// wall concrete — solid pitwall concrete, red / white / blue painted (Thruxton photos) — solid
// fence catch fence, posts + mesh — solid building an invisible solid outline (props draw the
// building)
//   line     painted line (pit lane edge) — NOT solid
// Solid ones collide with the car's four corners (push out, bounce, scrape) on the same step as
// obstacleClamp; what is drawn
// is exactly what you hit (user rule: visuals accurate to their effects).
export const BARRIER_HALF: Record<BarrierKind, number> = { armco: 0.3, wall: 0.45, pitwall: 0.5,
    fence: 0.15, building: 0.1, line: 0 };
const BARRIER_E = 0.3;           // restitution off a barrier (obstacles use 0.35)
// share of the along-the-wall speed kept per contact step... (scrape)
const BARRIER_SCRAPE = 0.85;
// polyline offset from the subtrack centreline, startDist -> endDist (wrapping past the line),
// `step` metres apart; offset may be a
// function of the distance (pit-lane entry / exit ramps). + = the +normal side.
// INTERPOLATED point + SMOOTHED normal for paths offset from the track (2026-10-04, photographed:
// the pit lane's edges wobbled).
// onTrack snaps to the sample before dist and uses that sample's own direction; at a 17 m
// offset the sample-to-sample jitter in
// direction became metres of sideways wobble. Here: position lerped between samples, normal
// averaged over +-4 samples (~12 m).
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
      if (lenSq < 1e-6) continue;
      barrier._segs.push({ ax: startX, ay: startY, dx, dy, l2: lenSq,
          minX: Math.min(startX, endX) - 4, maxX: Math.max(startX, endX) + 4,
          minY: Math.min(startY, endY) - 4, maxY: Math.max(startY, endY) + 4 });
    }
  }
}
// SOLID PROPS (2026-10-04; user: "make sure trees, planes etc are collidable objects").
// LEVEL.solids [{ x, y, w, h, rot }] — rotated
// boxes, tested against the car's box with the separating-axis test. barrierClamp only checks the
// car's 4 CORNERS against
// segments, so a tree trunk or a wing tip narrower than the car could slip between two corners;
// SAT cannot miss it.
// Response = the barrier rules (restitution BARRIER_E, scrape BARRIER_SCRAPE, yaw x0.6, shake).
// solidsFromProps builds the boxes
// from what is drawn, so "move that tree" moves its collision too.
export function solidsFromProps(props: Prop[]): Solid[] {
  const out: Solid[] = [];
  const box = (prop: Prop, offX: number, offY: number, width: number, height: number): void => {
    const cosRot = Math.cos(prop.rot || 0), sinRot = Math.sin(prop.rot || 0);
    out.push({ x: prop.x + cosRot * offX - sinRot * offY, y: prop.y + sinRot * offX
        + cosRot * offY, w: width, h: height, rot: prop.rot || 0, kind: prop.kind });
  };
  for (const prop of props) {
    switch (prop.kind) {
      // always have w and h
      case 'hangar': case 'grandstand': box(prop, 0, 0, prop.w!, prop.h!); break;
      case 'tower': box(prop, 0, 0, prop.size || 9, prop.size || 9); break;
      case 'truck': box(prop, 0, 0, 14, 2.5); break;
      // fuselage, wing, tailplane
      case 'plane': box(prop, 0.3, 0, 7, 1); box(prop, 1.0, 0, 1.4, 9); box(prop, -2.8, 0, 0.8,
          3.2); break;
      case 'marshal': box(prop, 0, 0, 2.4, 2); break;
      case 'board': box(prop, 0, 0, 18, 1.2); break;
      case 'windsock': box(prop, 0, 0, 0.5, 0.5); break;
      // a TREE stops you at its trunk + lower branches (half the canopy); you can clip the outer
      // leaves
      case 'tree': box(prop, 0, 0, (prop.s || 4) * 0.5, (prop.s || 4) * 0.5); break;
      // the two legs
      case 'gantry': box(prop, -(prop.wid || 26) / 2, 0, 1.2, 1.8); box(prop, (prop.wid || 26)
          / 2, 0, 1.2, 1.8); break;
      // stair towers
      case 'footbridge': box(prop, -(prop.wid || 27) / 2, 0, 1.6, 3.0); box(prop, (prop.wid || 27)
          / 2, 0, 1.6, 3.0); break;
      // highway BRIDGES (highway.js extras): the two ABUTMENTS (4 m blocks) at the ends of the
      // span, out on the grass; the deck is overhead
      case 'bridge': box(prop, -(prop.wid || 30) / 2 - 2, 0, 4, prop.carries === 'foot' ? 3.8
          : 8); box(prop, (prop.wid || 30) / 2 + 2, 0, 4, prop.carries === 'foot' ? 3.8
          : 8); break;
      case 'gate': box(prop, 0, 0, 6.8, 0.6); break;
      case 'block': box(prop, 0, 0, prop.w!, prop.h!); break;   // always have w and h
      case 'sculpture': box(prop, 0, 0, 2.2, 2.2); break;
      case 'bale': box(prop, 0, 0, 1.6, 1.6); break;
      case 'rock': box(prop, 0, 0, (prop.s || 3) * 0.7, (prop.s || 3) * 0.7); break;
      // (field sheep / cows are LOOSE OBJECTS since S-C, 2026-10-07 - cones.js: pushable, a sheep
      // pops into fluff, a cow tips; not solid props)
      // (chevron boards and flag poles are NOT solid since 2026-10-04: flimsy signs on stakes that
      // a car flattens — as solid walls they
      // tore a rally car's front wheels off and rolled it at a Killder corner exit, photographed)
    }
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
export function solidClamp(car: CarBody): void {
  const list = LEVEL.solids;
  if (!list || !list.length) return;
  const spec = car.spec, halfLen = spec.len * 0.48, halfWid = spec.wid * 0.48,
      carRadius = Math.hypot(halfLen, halfWid);
  const cosHead = Math.cos(car.heading), sinHead = Math.sin(car.heading);
  for (const solid of list) {
    const dx = car.x - solid.x, dy = car.y - solid.y;
    if (dx * dx + dy * dy > (carRadius + solid.r!) ** 2) continue;
    const cosRot = Math.cos(solid.rot), sinRot = Math.sin(solid.rot), halfW = solid.w / 2,
        halfH = solid.h / 2;
    // SAT on the 4 axes: overlap = sum of projected half-extents - |centre distance on the axis|
    let best = Infinity, pushX = 0, pushY = 0;
    // no allocation per call (memory diet, task 104: k-loop instead of an array of axis arrays)
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
    if (best <= 0) continue;
    car.x += pushX * best;
    car.y += pushY * best;
    const normalSpeed = car.vx * pushX + car.vy * pushY;
    if (normalSpeed < 0) {
      const tangX = -pushY, tangY = pushX, tangSpeed = car.vx * tangX + car.vy * tangY;
      const vn2 = -normalSpeed * BARRIER_E, vt2 = tangSpeed * BARRIER_SCRAPE;
      car.vx = pushX * vn2 + tangX * vt2;
      car.vy = pushY * vn2 + tangY * vt2;
      car.yawRate *= 0.6;
      car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(normalSpeed) * 0.12);
    }
  }
}
export function barrierClamp(car: CarBody): void {
  const list = LEVEL.barriers;
  if (!list || !list.length) return;
  const spec = car.spec, cosHead = Math.cos(car.heading), sinHead = Math.sin(car.heading);
  const halfLen = spec.len * 0.48, halfWid = spec.wid * 0.48;
  for (const barrier of list) {
    const half = BARRIER_HALF[barrier.kind];
    if (!half || !barrier._segs) continue;
    for (const seg of barrier._segs) {
      if (car.x < seg.minX - spec.len || car.x > seg.maxX + spec.len
          || car.y < seg.minY - spec.len || car.y > seg.maxY + spec.len) continue;
      // no allocation per call (memory diet, task 104: corners by idx)
      for (let idx = 0; idx < 4; idx++) {
        const fore = idx < 2 ? halfLen : -halfLen, lateral = (idx % 2 === 0) ? halfWid : -halfWid;
        const cornerX = car.x + cosHead * fore - sinHead * lateral, cornerY = car.y
            + sinHead * fore + cosHead * lateral;
        let frac = ((cornerX - seg.ax) * seg.dx + (cornerY - seg.ay) * seg.dy) / seg.l2;
        frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
        const nearX = seg.ax + seg.dx * frac, nearY = seg.ay + seg.dy * frac;
        let nx = cornerX - nearX, ny = cornerY - nearY;
        const dist = Math.hypot(nx, ny);
        if (dist >= half) continue;
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
        const push = half - dist * side;
        car.x += nx * push;
        car.y += ny * push;
        const normalSpeed = car.vx * nx + car.vy * ny;
        if (normalSpeed < 0) {
          const tangX = -ny, tangY = nx, tangSpeed = car.vx * tangX + car.vy * tangY;
          const vn2 = -normalSpeed * BARRIER_E, vt2 = tangSpeed * BARRIER_SCRAPE;
          car.vx = nx * vn2 + tangX * vt2;
          car.vy = ny * vn2 + tangY * vt2;
          car.yawRate *= 0.6;
          car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(normalSpeed) * 0.12);
        }
      }
    }
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
