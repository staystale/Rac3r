// venueaudit.mjs - THE VENUE OVERLAP AUDIT (owner 11-07: "just look at all and catch silly mistakes"
// - lorries parked half in garages, Armco doubled with the catch fence, tyres on the track, pits
// over the Armco). Builds a level and checks every pair that should never meet:
//   props on props (footprints overlap), props on barriers, props on roads (lanes) or the track,
//   tyre stacks on the track, on roads or in props, barriers on the track, on roads or in props,
//   two barriers doubled (within DOUBLE_M of each other along DOUBLE_RUN_M), a barrier crossing
//   another; a tree's canopy, a lamp or a corner floodlight's ring of tyres by a road piece (the
//   track, or a race road no layout uses). Bridges, footbridges, the gantry and tunnel portals stand
//   over or by roads by design.
// node tools/venueaudit.mjs <level> [--list]
import { pathToFileURL } from 'node:url';

const [levelId = 'brands-snatch', flag] = process.argv.slice(2);
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { querySubtrack } = await imp('/src/world/tyrewall.ts');
// (a venue's level is built on first use: world/load.ts buildLevel)
const { buildLevel } = await imp('/src/world/load.ts');
const { planLamps, cornerTyres } = await imp('/src/world/lampplan.ts');
const found = LEVELS.find((entry) => entry.id === levelId);
const level = found && buildLevel(found);
if (!level) throw new Error(`no level ${levelId}`);

// m: a footprint's sample spacing; how near two barriers may run before they count as doubled,
// and over how long; props that stand over or beside roads by design
const STEP_M = 1, DOUBLE_M = 2.5, DOUBLE_RUN_M = 8;
const OVER_ROADS = new Set(['bridge', 'footbridge', 'gantry', 'tunnel']);
const SIZE = { truck: [14, 2.5], marshal: [2.4, 2], board: [18, 1.2], parkedcar: [4.2, 1.8],
  tower: [9, 9], tree: [2, 2] };
const half = level.subtrack.width / 2;

/** a prop's footprint sample points */
function footprint(prop) {
  if (prop.front && prop.back) return [...prop.front, ...prop.back];
  const [width, height] = SIZE[prop.kind] || [prop.w || 0, prop.h || 0];
  if (!width || !height) return [[prop.x, prop.y]];
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0), pts = [];
  for (let along = -width / 2; along <= width / 2 + 1e-6; along += STEP_M)
    for (let across = -height / 2; across <= height / 2 + 1e-6; across += STEP_M)
      pts.push([prop.x + cosR * along - sinR * across, prop.y + sinR * along + cosR * across]);
  return pts;
}
/** whether a point lies in a prop's footprint box */
function inProp(prop, x, y, pad = 0) {
  if (prop.front && prop.back) {
    const poly = [...prop.front, ...prop.back.slice().reverse()];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    // (within pad of its front or back counts: a paddock road ending behind the garages)
    return inside || (pad > 0 && (distToLine(prop.front, x, y) < pad || distToLine(prop.back, x, y) < pad));
  }
  const [width, height] = SIZE[prop.kind] || [prop.w || 0, prop.h || 0];
  if (!width || !height) return false;
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  const along = (x - prop.x) * cosR + (y - prop.y) * sinR;
  const across = -(x - prop.x) * sinR + (y - prop.y) * cosR;
  return Math.abs(along) <= width / 2 + pad && Math.abs(across) <= height / 2 + pad;
}
const distToLine = (pts, x, y) => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const frac = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
    best = Math.min(best, Math.hypot(x - ax - dx * frac, y - ay - dy * frac));
  }
  return best;
};
const onTrack = (x, y) => querySubtrack(level.subtrack, x, y).dist < half;
const onLane = (x, y, pad = 0) => level.lanes.find((lane) => distToLine(lane.pts, x, y) < lane.width / 2 + pad);

const props = level.props.filter((prop) => prop.kind !== 'tree' || true);
const problems = {};
const note = (kind, what) => { (problems[kind] ||= []).push(what); };
const name = (prop) => `${prop.kind}@${prop.x.toFixed(0)},${prop.y.toFixed(0)}`;

// props on props, on barriers, on roads / the track
const solidProps = props.filter((prop) => !OVER_ROADS.has(prop.kind));
for (const [i, prop] of solidProps.entries()) {
  const pts = footprint(prop);
  for (const other of solidProps.slice(i + 1)) {
    if (prop.kind === 'tree' && other.kind === 'tree') continue;
    if (Math.hypot(prop.x - other.x, prop.y - other.y) > 120) continue;
    if (pts.some(([x, y]) => inProp(other, x, y))) note('prop on prop', `${name(prop)} x ${name(other)}`);
  }
  if (pts.some(([x, y]) => onTrack(x, y))) note('prop on the track', name(prop));
  const lane = pts.map(([x, y]) => onLane(x, y)).find(Boolean);
  if (lane && prop.kind !== 'garagerow') note('prop on a road', `${name(prop)} on ${lane.surface.id} lane w${lane.width}`);
  for (const rail of level.barriers || []) {
    if (rail.kind === 'building') continue;
    if (rail.pts.some(([x, y]) => inProp(prop, x, y, 0.3))) { note('prop on a barrier', `${name(prop)} x ${rail.kind}`); break; }
  }
}
// by a road piece (the raced track, or a race road no layout uses - an old line beside a chicane):
// a tree's canopy and its shadow (0.85 of its size s from the trunk), a lamp's foot, a corner
// floodlight's ring of tyres - each PIECE_CLEAR_M clear of its edge, as the track's own are
const PIECE_CLEAR_M = 3;
// (a race piece is a 13 m lane: race tarmac, or an unraced rallycross gravel section's dirt)
const isPiece = (lane) => lane.surface.id === 'racetarmac' || lane.width === 13;
const pieces = level.lanes.filter(isPiece);
const pieceGap = (x, y) => Math.min(querySubtrack(level.subtrack, x, y).dist - half,
  ...pieces.map((lane) => distToLine(lane.pts, x, y) - lane.width / 2));
for (const tree of props.filter((prop) => prop.kind === 'tree'))
  if (pieceGap(tree.x, tree.y) < (tree.s || 4) * 0.85) note('canopy over a road piece', name(tree));
for (const lamp of planLamps(level))
  if (pieceGap(lamp.x, lamp.y) < 1) note('lamp on a road piece', name(lamp));
for (const tyre of cornerTyres(level))
  if (pieceGap(tyre.x, tyre.y) < PIECE_CLEAR_M) note('corner ring by a road piece', `${tyre.x.toFixed(0)},${tyre.y.toFixed(0)}`);
// tyre stacks on the track, on roads, in props
for (const cone of level.cones) {
  if (onTrack(cone.x, cone.y)) note('tyre on the track', `${cone.x.toFixed(0)},${cone.y.toFixed(0)}`);
  else {
    // a closing row stands across an unraced piece of the track by design
    const lane = onLane(cone.x, cone.y);
    if (lane && !isPiece(lane)) note('tyre on a road', `${cone.x.toFixed(0)},${cone.y.toFixed(0)}`);
  }
  const prop = solidProps.find((entry) => inProp(entry, cone.x, cone.y, 0.4));
  if (prop) note('tyre in a prop', `${cone.x.toFixed(0)},${cone.y.toFixed(0)} in ${name(prop)}`);
}
// barriers on the track, on roads, doubled, crossing
const rails = (level.barriers || []).filter((rail) => rail.kind !== 'building' && rail.kind !== 'line');
for (const [i, rail] of rails.entries()) {
  const onT = rail.pts.filter(([x, y]) => querySubtrack(level.subtrack, x, y).dist < half + 0.5).length;
  if (onT) note('barrier on the track', `${rail.kind} ${onT} pts`);
  const lanePts = rail.pts.filter(([x, y]) => onLane(x, y)).length;
  if (lanePts) note('barrier on a road', `${rail.kind} ${lanePts} pts at ${rail.pts[0].map((v) => v.toFixed(0))}`);
  for (const other of rails.slice(i + 1)) {
    // two chunks of one barrier share an end point (a joint, not a double): the stretch by it
    // is the joint's, as at a bend in the line
    const joints = [rail.pts[0], rail.pts.at(-1)].filter(([x, y]) => [other.pts[0], other.pts.at(-1)]
      .some(([ox, oy]) => Math.hypot(x - ox, y - oy) < 1));
    const close = rail.pts.filter(([x, y]) => distToLine(other.pts, x, y) < DOUBLE_M
      && joints.every(([jx, jy]) => Math.hypot(x - jx, y - jy) > DOUBLE_RUN_M));
    if (close.length * 2 >= DOUBLE_RUN_M) note('barriers doubled', `${rail.kind} x ${other.kind} over ~${close.length * 2} m at ${close[0].map((v) => v.toFixed(0))}`);
  }
}
// roads: every end joins another road, a paddock / zone, a building, a bridge or tunnel, or runs
// off the map's edge (a road going nowhere is a mistake)
const bounds = level.bounds;
const roadsOnly = level.lanes.filter((lane) => lane.surface.id !== 'racetarmac' && lane.surface.id !== 'gravel');
const inZone = (x, y) => level.zones.some((zone) => zone.poly && Math.abs(x - zone.x) <= zone.w / 2 && Math.abs(y - zone.y) <= zone.h / 2 && (() => { let inside = false; const poly = zone.poly; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; })());
for (const road of roadsOnly) {
  for (const [x, y] of [road.pts[0], road.pts[road.pts.length - 1]]) {
    // joined means the tarmac touches (half a metre past both edges at most)
    const joins = level.lanes.some((other) => other !== road && distToLine(other.pts, x, y) < (other.width + road.width) / 2 + 0.5)
      || inZone(x, y) || props.some((prop) => inProp(prop, x, y, road.width / 2 + 2))
      || props.some((prop) => /bridge|tunnel/.test(prop.kind) && Math.hypot(prop.x - x, prop.y - y) < (prop.wid || prop.w || 10) / 2 + 14)
      || x < bounds.x0 + 3 || x > bounds.x1 - 3 || y < bounds.y0 + 3 || y > bounds.y1 - 3
      // the race track (the pit lane's ends), or its own other end (a closed loop: kart track)
      || querySubtrack(level.subtrack, x, y).dist < half + road.width
      || Math.hypot(road.pts[0][0] - road.pts[road.pts.length - 1][0], road.pts[0][1] - road.pts[road.pts.length - 1][1]) < 3;
    if (!joins) note('road going nowhere', `${road.surface.id} w${road.width} end at ${x.toFixed(0)},${y.toFixed(0)}`);
  }
}
// roads doubled: one running beside another (within 9 m, the same way) for more than 16 m,
// away from where they join (the first and last 20 m of each are a joint's business)
const head = (pts, i) => { const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)]; return Math.atan2(q[1] - p[1], q[0] - p[0]); };
const along = (pts) => { const out = [0]; for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return out; };
for (const [i, road] of roadsOnly.entries()) {
  const dist = along(road.pts), total = dist[dist.length - 1];
  for (const other of roadsOnly.slice(i + 1)) {
    // a kart track (4 m) beside a road is two things, not one mapped twice (world/venueroads.ts)
    if ((road.width === 4) !== (other.width === 4)) continue;
    let run = 0, worst = 0;
    road.pts.forEach(([x, y], k) => {
      if (dist[k] < 20 || dist[k] > total - 20) { run = 0; return; }
      let best = Infinity, at = 0;
      other.pts.forEach(([ox, oy], m) => { const g = Math.hypot(ox - x, oy - y); if (g < best) { best = g; at = m; } });
      const turn = Math.abs(head(road.pts, k) - head(other.pts, at)) % Math.PI;
      run = best < 9 && Math.min(turn, Math.PI - turn) < 0.6 ? run + 2 : 0;
      worst = Math.max(worst, run);
    });
    if (worst > 16) note('roads doubled', `${road.width} m and ${other.width} m roads side by side ~${worst} m near ${road.pts[0].map((v) => v.toFixed(0))}`);
  }
}
// armco: whole runs (chunks that share an end joined) - too short, or ending at a road
const armco = rails.filter((rail) => rail.kind === 'armco');
const runs = [];
for (const rail of armco) {
  const run = runs.find((pts) => Math.hypot(pts[pts.length - 1][0] - rail.pts[0][0], pts[pts.length - 1][1] - rail.pts[0][1]) < 0.5);
  if (run) run.push(...rail.pts.slice(1)); else runs.push(rail.pts.slice());
}
const runLen = (pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
for (const pts of runs) {
  if (runLen(pts) < 24) note('armco run short', `${runLen(pts).toFixed(0)} m at ${pts[0].map((v) => v.toFixed(0))}`);
  for (const end of [pts[0], pts[pts.length - 1]]) {
    const lane = level.lanes.find((ln) => ln.surface.id !== 'racetarmac' && distToLine(ln.pts, end[0], end[1]) < ln.width / 2 + 4);
    // (a tunnel's mouth in the barrier line closes the gap: its portal stands there, solid)
    const atPortal = props.some((prop) => prop.kind === 'tunnel' && Math.hypot(prop.x - end[0], prop.y - end[1]) < (prop.wid || prop.w || 10) / 2 + 6);
    if (lane && !atPortal) note('armco ends at a road', `end ${end.map((v) => v.toFixed(0))} by ${lane.surface.id} w${lane.width}`);
  }
}
// roads: kinks (more than 30 deg between 2 m steps) and crossings with no junction
const resampleLine = (pts) => { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } return out; };
for (const road of roadsOnly.filter((lane) => lane.width > 4)) {
  // (a kart track's hairpins are real: karts)
  const pts = resampleLine(road.pts);
  let worst = 0, at = null;
  for (let i = 2; i < pts.length; i++) {
    const h1 = Math.atan2(pts[i - 1][1] - pts[i - 2][1], pts[i - 1][0] - pts[i - 2][0]), h2 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const bend = Math.abs(((h2 - h1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
    if (bend > worst) { worst = bend; at = pts[i - 1]; }
  }
  if (worst > 30) note('road kinked', `${worst.toFixed(0)} deg at ${at.map((v) => v.toFixed(0))} (w${road.width})`);
}
const segCross = (p, q, r, s) => { const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]); if (Math.abs(d) < 1e-9) return null; const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d; return t > 0 && t < 1 && u > 0 && u < 1 ? [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] : null; };
for (const [i, road] of roadsOnly.entries())
  for (const other of roadsOnly.slice(i + 1))
    for (let a = 0; a < road.pts.length - 1; a++)
      for (let b = 0; b < other.pts.length - 1; b++) {
        const at = segCross(road.pts[a], road.pts[a + 1], other.pts[b], other.pts[b + 1]);
        if (!at) continue;
        const nearEnd = [road.pts[0], road.pts[road.pts.length - 1], other.pts[0], other.pts[other.pts.length - 1]].some((e) => Math.hypot(e[0] - at[0], e[1] - at[1]) < 6);
        if (!nearEnd) note('roads cross', `at ${at.map((v) => v.toFixed(0))}`);
      }
const kinds = Object.keys(problems);
console.log(`${levelId}: ${props.length} props, ${level.cones.length} tyres, ${rails.length} barriers, ${level.lanes.length} roads`);
if (!kinds.length) console.log('venueaudit: nothing overlaps');
for (const kind of kinds) {
  console.log(`  ${kind}: ${problems[kind].length}`);
  if (flag === '--list') for (const what of problems[kind].slice(0, 25)) console.log(`      ${what}`);
}
process.exitCode = kinds.length ? 1 : 0;
