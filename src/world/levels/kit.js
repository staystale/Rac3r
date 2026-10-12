import { parkMiller } from "../../core/random.ts";
import { alongTrack, smoothOnTrack } from "../barriers.js";
import { autoKerbs } from "../subtrack.ts";
import { FLOOR } from "../bounds.ts";
import { onTrack, querySubtrack } from "../tyrewall.js";
export const ss01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// TRACK KIT (2026-10-04, written for Castle Cum after doing Thruston by hand): decorate a traced circuit by DISTANCE + OFFSET
// (+ = right of travel; on a clockwise lap that is the INSIDE). Everything generated is filtered off the road, off the given
// lanes and inside the floor — the Thruston lesson: an outside offset on the inside of a left-hander lands on the track.
export function trackKit(sub, seed, lanes = []) {
  const rnd = parkMiller(seed);
  const at = (d, off) => smoothOnTrack(sub, d, off);
  const rot = (d) => onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot;
  const prop = (d, off, o) => ({ ...o, ...at(d, off), rot: rot(d) + (o.rot || 0) });
  const onLane = (x, y, pad) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false;
    const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1e-6; let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + pad; }));
  const clear = (x, y, reach) => querySubtrack(sub, x, y).dist >= sub.width / 2 + reach && Math.abs(x) < FLOOR - 6 - reach && Math.abs(y) < FLOOR - 6 - reach && !onLane(x, y, reach);
  const span = (d0, d1) => ((d1 - d0) + sub.totalDist) % sub.totalDist;
  // earth bank = humps every 4 m (at 10 m they photographed as separate blobs)
  const bank = (d0, d1, off, r, h) => { const out = []; for (let t = 0; t <= span(d0, d1); t += 4) { const p = at(d0 + t, off); if (clear(p.x, p.y, r + 2)) out.push({ kind: 'hump', x: p.x, y: p.y, r, h }); } return out; };
  const along = (d0, d1, off, step) => alongTrack(sub, d0, d1, off, step);
  return { rnd, at, rot, prop, clear, span, bank, along, onLane };
}

// RALLYCROSS DRESSING (user, 2026-10-04: "a couple more hay bales and tyres around Slidden Hill and Knobhill"): knockable HAY BALES every 2.2 m
// along the OUTSIDE of every corner (hw + 4.5), and a 2 x 3 block of TYRE STACKS on each inside apex (hw + 2.5) — kept off the road, every
// lane (joker, start, traps, paddock) and 1.6 m clear of any existing object.
export function rxDress(sub, lanes, existing, lined = []) {   // lined: [[d0, d1]] stretches with bales along BOTH sides every 4.4 m
  const hw = sub.width / 2, out = [], have = [...existing];
  const onLane = (x, y) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false; const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + 1; }));
  const free = (x, y) => querySubtrack(sub, x, y).dist > hw + 1.5 && !onLane(x, y) && Math.abs(x) < FLOOR - 5 && Math.abs(y) < FLOOR - 5 && !have.some((c) => Math.hypot(c.x - x, c.y - y) < 1.6);
  const add = (o) => { if (free(o.x, o.y)) { out.push(o); have.push(o); } };
  for (const c of autoKerbs(sub, { maxR: 60, exitR: 0, minTurn: 25, mergeGap: 10 })) {
    const outS = c.side === 'left' ? -1 : 1, mid = (c.startDist + c.endDist) / 2;
    // ONLY WHERE THERE IS NO WALL YET (user: "they should go where there isn't already Armco and tyre walls" — the first pass lined bales in
    // front of Slidden Hill's tyre walls): skip a bale with an existing tyre stack within 6 m
    for (let d = c.startDist - 6; d <= c.endDist + 10; d += 2.2) { const p = smoothOnTrack(sub, d, outS * (hw + 4.5)); if (existing.some((e) => e.kind === 'tyrestack' && Math.hypot(e.x - p.x, e.y - p.y) < 6)) continue; add({ x: p.x, y: p.y, kind: 'bale', rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
    for (const dd of [-1, 0, 1]) for (const w of [0, 1]) { const p = smoothOnTrack(sub, mid + dd * 0.95, -outS * (hw + 2.5 + w * 0.95)); add({ x: p.x, y: p.y, kind: 'tyrestack' }); }
  }
  for (const [d0, d1] of lined) for (let d = d0; d <= d1; d += 4.4) for (const sd of [-1, 1]) { const p = smoothOnTrack(sub, d, sd * (hw + 4.5)); add({ x: p.x, y: p.y, kind: "bale", rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
  return out;
}

// JOKER SEPARATION (user, 2026-10-04: "hay bales between the joker section and the normal track on both rallycross tracks — a clear barrier"):
// a line of bales in the MIDDLE of the grass strip between the joker and the main road, every 2.1 m wherever that strip is at least 2.2 m wide
// (so the joker's mouth and exit stay open).
export function jokerBales(sub, joker, existing) {
  const hw = sub.width / 2, jw = joker.width / 2, out = [], J = joker.pts;
  let acc = 0;
  for (let i = 1; i < J.length; i++) {
    const [ax, ay] = J[i - 1], [bx, by] = J[i], L = Math.hypot(bx - ax, by - ay);
    for (let t = acc; t < L; t += 2.1) {
      const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L, q = querySubtrack(sub, x, y), gap = q.dist - hw - jw;
      // clear of the main road's KERBS (2.4 m) too: bale centre >= 3.3 m off the road edge and >= 0.9 m off the joker edge (photographed on a kerb)
      if (gap < 4.2) continue;
      const c = onTrack(sub, q.trackDist, 0, {}), dx = c.x - x, dy = c.y - y, dl = Math.hypot(dx, dy) || 1, k = jw + Math.min(gap / 2, gap - 3.3);
      const p = { x: +(x + dx / dl * k).toFixed(2), y: +(y + dy / dl * k).toFixed(2), kind: 'bale', rot: Math.atan2(by - ay, bx - ax) };
      if (![...existing, ...out].some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 1.6)) out.push(p);
    }
    acc = (acc - L) % 2.1; if (acc < 0) acc += 2.1;
  }
  return out;
}
