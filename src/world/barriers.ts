// barriers.ts - the BARRIERS section (barriers, solid props, clamps). Moved verbatim out of lab.js.
import { LEVEL } from "./state.ts";
import type { Barrier, BarrierKind, CarBody, Point, Prop, Solid, Subtrack } from "./types.ts";

// =============================================================================================
// BARRIERS (2026-10-03; user: "use aerial photos of tracks on race days for pit layouts and perimeter decorations — if you
// need to make things like ARMCO or FENCES, do"). LEVEL.barriers: [{ kind, pts: [[x, y], ...] }], polylines in metres.
//   armco    steel double rail on posts — solid
//   wall     concrete — solid          pitwall  concrete, red / white / blue painted (Thruxton photos) — solid
//   fence    catch fence, posts + mesh — solid        building  an invisible solid outline (props draw the building)
//   line     painted line (pit lane edge) — NOT solid
// Solid ones collide with the car's four corners (push out, bounce, scrape) on the same step as obstacleClamp; what is drawn
// is exactly what you hit (user rule: visuals accurate to their effects).
export const BARRIER_HALF: Record<BarrierKind, number> = { armco: 0.3, wall: 0.45, pitwall: 0.5, fence: 0.15, building: 0.1, line: 0 };
const BARRIER_E = 0.3;           // restitution off a barrier (obstacles use 0.35)
const BARRIER_SCRAPE = 0.85;     // share of the along-the-wall speed kept per contact step... (scrape)
// polyline offset from the subtrack centreline, d0 -> d1 (wrapping past the line), `step` metres apart; offset may be a
// function of the distance (pit-lane entry / exit ramps). + = the +normal side.
// INTERPOLATED point + SMOOTHED normal for paths offset from the track (2026-10-04, photographed: the pit lane's edges wobbled).
// onTrack snaps to the sample before d and uses that sample's own direction; at a 17 m offset the sample-to-sample jitter in
// direction became metres of sideways wobble. Here: position lerped between samples, normal averaged over +-4 samples (~12 m).
export function smoothOnTrack(sub: Subtrack, d: number, off: number): { x: number; y: number } {
  const pts = sub.pts, n = pts.length; d = ((d % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].dist <= d) lo = m; else hi = m - 1; }
  const a = pts[lo], b = pts[(lo + 1) % n], seg = (b.dist > a.dist ? b.dist : sub.totalDist) - a.dist, t = seg > 0 ? (d - a.dist) / seg : 0;
  let nx = 0, ny = 0; for (let k = -4; k <= 4; k++) { const q = pts[(lo + k + n) % n]; nx += q.nx; ny += q.ny; } const L = Math.hypot(nx, ny) || 1;
  return { x: a.x + (b.x - a.x) * t + (nx / L) * off, y: a.y + (b.y - a.y) * t + (ny / L) * off };
}
export function alongTrack(
  sub: Subtrack, d0: number, d1: number,
  offset: number | ((t: number, len: number) => number), step = 4,
): Point[] {
  const total = sub.totalDist, pts: Point[] = [];
  let len = d1 - d0; if (len < 0) len += total;
  for (let t = 0; t <= len + 1e-6; t += step) {
    const d = (d0 + Math.min(t, len)) % total;
    const off = typeof offset === 'function' ? offset(t, len) : offset;
    const p = smoothOnTrack(sub, d, off);
    pts.push([+p.x.toFixed(2), +p.y.toFixed(2)]);
  }
  return pts;
}
export function prepBarriersOf(level: { barriers?: Barrier[] }): void { prepBarriers(level); }
export function prepBarriers(level: { barriers?: Barrier[] }): void {
  for (const b of level.barriers || []) {
    if (b._segs) continue;
    b._segs = [];
    for (let i = 0; i < b.pts.length - 1; i++) {
      const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) continue;
      b._segs.push({ ax, ay, dx, dy, l2, minX: Math.min(ax, bx) - 4, maxX: Math.max(ax, bx) + 4, minY: Math.min(ay, by) - 4, maxY: Math.max(ay, by) + 4 });
    }
  }
}
// SOLID PROPS (2026-10-04; user: "make sure trees, planes etc are collidable objects"). LEVEL.solids [{ x, y, w, h, rot }] — rotated
// boxes, tested against the car's box with the separating-axis test. barrierClamp only checks the car's 4 CORNERS against
// segments, so a tree trunk or a wing tip narrower than the car could slip between two corners; SAT cannot miss it.
// Response = the barrier rules (restitution BARRIER_E, scrape BARRIER_SCRAPE, yaw x0.6, shake). solidsFromProps builds the boxes
// from what is drawn, so "move that tree" moves its collision too.
export function solidsFromProps(props: Prop[]): Solid[] {
  const out: Solid[] = [];
  const box = (pr: Prop, ox: number, oy: number, w: number, h: number): void => { const c = Math.cos(pr.rot || 0), s = Math.sin(pr.rot || 0); out.push({ x: pr.x + c * ox - s * oy, y: pr.y + s * ox + c * oy, w, h, rot: pr.rot || 0, kind: pr.kind }); };
  for (const pr of props) {
    switch (pr.kind) {
      case 'hangar': case 'grandstand': box(pr, 0, 0, pr.w!, pr.h!); break;   // always have w and h
      case 'tower': box(pr, 0, 0, pr.size || 9, pr.size || 9); break;
      case 'truck': box(pr, 0, 0, 14, 2.5); break;
      case 'plane': box(pr, 0.3, 0, 7, 1); box(pr, 1.0, 0, 1.4, 9); box(pr, -2.8, 0, 0.8, 3.2); break;   // fuselage, wing, tailplane
      case 'marshal': box(pr, 0, 0, 2.4, 2); break;
      case 'board': box(pr, 0, 0, 18, 1.2); break;
      case 'windsock': box(pr, 0, 0, 0.5, 0.5); break;
      // a TREE stops you at its trunk + lower branches (half the canopy); you can clip the outer leaves
      case 'tree': box(pr, 0, 0, (pr.s || 4) * 0.5, (pr.s || 4) * 0.5); break;
      case 'gantry': box(pr, -(pr.wid || 26) / 2, 0, 1.2, 1.8); box(pr, (pr.wid || 26) / 2, 0, 1.2, 1.8); break;   // the two legs
      case 'footbridge': box(pr, -(pr.wid || 27) / 2, 0, 1.6, 3.0); box(pr, (pr.wid || 27) / 2, 0, 1.6, 3.0); break;   // stair towers
      // highway BRIDGES (highway.js extras): the two ABUTMENTS (4 m blocks) at the ends of the span, out on the grass; the deck is overhead
      case 'bridge': box(pr, -(pr.wid || 30) / 2 - 2, 0, 4, pr.carries === 'foot' ? 3.8 : 8); box(pr, (pr.wid || 30) / 2 + 2, 0, 4, pr.carries === 'foot' ? 3.8 : 8); break;
      case 'gate': box(pr, 0, 0, 6.8, 0.6); break;
      case 'block': box(pr, 0, 0, pr.w!, pr.h!); break;   // always have w and h
      case 'sculpture': box(pr, 0, 0, 2.2, 2.2); break;
      case 'bale': box(pr, 0, 0, 1.6, 1.6); break;
      case 'rock': box(pr, 0, 0, (pr.s || 3) * 0.7, (pr.s || 3) * 0.7); break;
      // (field sheep / cows are LOOSE OBJECTS since S-C, 2026-10-07 - cones.js: pushable, a sheep pops into fluff, a cow tips; not solid props)
      // (chevron boards and flag poles are NOT solid since 2026-10-04: flimsy signs on stakes that a car flattens — as solid walls they
      // tore a rally car's front wheels off and rolled it at a Killder corner exit, photographed)
    }
  }
  for (const b of out) b.r = Math.hypot(b.w, b.h) / 2;
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
  const s = car.spec, hl = s.len * 0.48, hw = s.wid * 0.48, cr = Math.hypot(hl, hw);
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  for (const b of list) {
    const dx = car.x - b.x, dy = car.y - b.y;
    if (dx * dx + dy * dy > (cr + b.r!) ** 2) continue;
    const bc = Math.cos(b.rot), bs = Math.sin(b.rot), bw = b.w / 2, bh = b.h / 2;
    // SAT on the 4 axes: overlap = sum of projected half-extents - |centre distance on the axis|
    let best = Infinity, ax = 0, ay = 0;
    // no allocation per call (memory diet, task 104: k-loop instead of an array of axis arrays)
    for (let idx = 0; idx < 4; idx++) {
      const ux = pickAxis(idx, c, -sn, bc, -bs);
      const uy = pickAxis(idx, sn, c, bs, bc);
      const rc = hl * Math.abs(c * ux + sn * uy) + hw * Math.abs(-sn * ux + c * uy);
      const rb = bw * Math.abs(bc * ux + bs * uy) + bh * Math.abs(-bs * ux + bc * uy);
      const dist = dx * ux + dy * uy, ov = rc + rb - Math.abs(dist);
      if (ov <= 0) { best = -1; break; }
      if (ov < best) { best = ov; const sg = dist >= 0 ? 1 : -1; ax = ux * sg; ay = uy * sg; }
    }
    if (best <= 0) continue;
    car.x += ax * best; car.y += ay * best;
    const vn = car.vx * ax + car.vy * ay;
    if (vn < 0) {
      const tx = -ay, ty = ax, vt = car.vx * tx + car.vy * ty;
      const vn2 = -vn * BARRIER_E, vt2 = vt * BARRIER_SCRAPE;
      car.vx = ax * vn2 + tx * vt2; car.vy = ay * vn2 + ty * vt2;
      car.yawRate *= 0.6;
      car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(vn) * 0.12);
    }
  }
}
export function barrierClamp(car: CarBody): void {
  const list = LEVEL.barriers;
  if (!list || !list.length) return;
  const s = car.spec, c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const hl = s.len * 0.48, hw = s.wid * 0.48;
  for (const b of list) {
    const half = BARRIER_HALF[b.kind];
    if (!half || !b._segs) continue;
    for (const g of b._segs) {
      if (car.x < g.minX - s.len || car.x > g.maxX + s.len || car.y < g.minY - s.len || car.y > g.maxY + s.len) continue;
      // no allocation per call (memory diet, task 104: corners by idx)
      for (let idx = 0; idx < 4; idx++) {
        const u = idx < 2 ? hl : -hl, v = (idx % 2 === 0) ? hw : -hw;
        const px = car.x + c * u - sn * v, py = car.y + sn * u + c * v;
        let t = ((px - g.ax) * g.dx + (py - g.ay) * g.dy) / g.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = g.ax + g.dx * t, qy = g.ay + g.dy * t;
        let nx = px - qx, ny = py - qy; const d = Math.hypot(nx, ny);
        if (d >= half) continue;
        if (d < 1e-6) { nx = -g.dy; ny = g.dx; } const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        // which side the car is on: the side its CENTRE is on (a corner may have poked through)
        const side = Math.sign((car.x - qx) * nx + (car.y - qy) * ny) || 1; nx *= side; ny *= side;
        const push = half - d * side;
        car.x += nx * push; car.y += ny * push;
        const vn = car.vx * nx + car.vy * ny;
        if (vn < 0) {
          const tx = -ny, ty = nx, vt = car.vx * tx + car.vy * ty;
          const vn2 = -vn * BARRIER_E, vt2 = vt * BARRIER_SCRAPE;
          car.vx = nx * vn2 + tx * vt2; car.vy = ny * vn2 + ty * vt2;
          car.yawRate *= 0.6;
          car.shake = Math.min(1.0, (car.shake || 0) + Math.abs(vn) * 0.12);
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
  { kind: 'lane', x: -120, y: 240, w: 200, h: 11, tone: 0.35 },   // drag strip along the south edge
  // SUSPENSION TEST ZONE mark-out: the whole zone, then one box per lane
  // tones 0.55-0.8: the first cut at 0.30 was invisible against the lab grid (photographed)
  // top edge at y 166: at 161 it ran into the mud / sand test panels north of the zone (photographed)
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
  // SUSPENSION TEST ZONE labels, painted on the floor at the WEST end of each lane (you enter from the west)
  { x: -118, y: 172, label: 'SUSPENSION TEST' },
  { x: -242, y: 172, label: 'WHOOPS' },
  { x: -242, y: 187, label: 'DIPS' },
  { x: -242, y: 203, label: 'WASHBOARD' },
  { x: -36, y: 166, label: 'BOWL' },
];

// Cones. Loose clusters, a slalom, and a gate — something to aim at and knock over later (Step 6).
// r is the base radius in metres (a real traffic cone base is ~0.18 m).
