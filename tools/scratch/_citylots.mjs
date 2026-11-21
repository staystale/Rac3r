// _citylots.mjs - GETAWAY STOCKHOLM's lots (highway/city.ts) in node, no browser: the road built
// as the game builds it (stepHighway, a stand-in car in the left lane, as tools/worldhash.mjs)
// over 400-6000 m (every stretch kind: highway/cityplan.ts) on several seeds and road types. Every 20 m, each side:
// is the spot a lot's middle would stand on inside a lot; if not, what has that ground - a keep
// rect that is not a lot (a slip, an approach, a river, a lay-by, a services), the secret side
// road (left), or nothing (the lot found no room: a bend, the next lot).
// And at every window move: each city building's footprint (1 m grid) and each noise wall's
// points against the road (its half width) and every lane that is not the lot's own (slips, side
// roads, approaches, junctions): any inside counts as a clash.
// STOCKHOLM=1 node tools/scratch/_citylots.mjs [roads motorway,dual,...] [seeds 4242,7,99]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
import { cityStretchAt } from '../../src/highway/cityplan.ts';

const roads = (process.argv[2] || 'motorway,interstate,dual,walled,twisty').split(',');
const seeds = (process.argv[3] || '4242,7,99').split(',').map(Number);
// m: the lot's middle past the road edge (city.ts LOT_OUT_M + LOT_DEPTH_M / 2)
const MID_OUT_M = 6 + 22;

/**
 * Whether a point is on the road or on a lane that is not lot `field`'s.
 * @param level the highway level
 * @param x world x
 * @param y world y
 * @param field the lot's id
 * @returns what it is on, or null
 */
function onAWay(level, x, y, field) {
  const hw = level._hw.geo.hw;
  for (const point of level._hw.pts)
    if ((point.x - x) ** 2 + (point.y - y) ** 2 < (hw - 0.5) ** 2) return 'road';
  for (const lane of level.lanes) {
    if (lane.field === field) continue;
    const half = (lane.width || 6) / 2 - 0.3;
    for (let i = 1; i < lane.pts.length; i++) {
      const [ax, ay] = lane.pts[i - 1], [bx, by] = lane.pts[i];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const share = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      if ((ax + (bx - ax) * share - x) ** 2 + (ay + (by - ay) * share - y) ** 2 < half * half)
        return 'lane';
    }
  }
  return null;
}

const inRect = (rect, x, y) => {
  const dx = x - rect.x, dy = y - rect.y;
  return Math.abs(dx * rect.ax + dy * rect.ay) <= rect.hu
    && Math.abs(-dx * rect.ay + dy * rect.ax) <= rect.hv;
};

for (const road of roads) {
  const tally = { lot: 0, keep: 0, side: 0, none: 0 };
  let made = 0, dropped = 0;
  const byKind = {};
  const clashes = { road: 0, lane: 0 }, checked = new Set();
  for (const seed of seeds) {
    const level = createHighway(seed, road);
    setHighwayPreset(level, road, 'stockholm');
    L.LEVELS.push(level);
    L.setLevel('highway');
    resetHighway(level);
    if (level._cfg.theme !== 'city') throw new Error('not the city: STOCKHOLM=1 missing?');
    const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 };
    const seen = new Set(), alive = new Map();
    for (let dist = 300; dist <= 5400; dist += 4) {
      const pose = roadPose(level, dist, lane);
      car.x = pose.x;
      car.y = pose.y;
      const moved = stepHighway(level, car);
      if (moved) for (const prop of level.props) {
        if ((prop.kind !== 'block' && prop.kind !== 'parkedcar') || prop.field == null
          || checked.has(prop)) continue;
        checked.add(prop);
        const ax = Math.cos(prop.rot || 0), ay = Math.sin(prop.rot || 0);
        const len = prop.w ?? 4.2, wide = prop.h ?? 1.8;
        for (let along = -len / 2; along <= len / 2; along += 1)
          for (let across = -wide / 2; across <= wide / 2; across += 1) {
            const on = onAWay(level, prop.x + ax * along - ay * across,
              prop.y + ay * along + ax * across, prop.field);
            if (on) {
              clashes[on]++;
              along = across = Infinity;
            }
          }
      }
      if (moved) for (const wall of level.barriers) {
        if (wall.kind !== 'wall' || wall.field == null || checked.has(wall)) continue;
        checked.add(wall);
        const on = wall.pts.map(([x, y]) => onAWay(level, x, y, wall.field)).find(Boolean);
        if (on) clashes[on]++;
      }
      // (a lot gone while still ahead of the car: dropped by a later feature, not behind)
      const now = new Map(level.zones.filter((zone) => zone.surface?.id === 'concrete'
        && zone.field != null).map((zone) => [zone.field, zone._s]));
      for (const [id, at] of now) if (!alive.has(id)) made++;
      for (const [id, at] of alive) if (!now.has(id) && at > dist) dropped++;
      for (const id of [...alive.keys()]) alive.delete(id);
      for (const [id, at] of now) alive.set(id, at);
      // (sampled 600 m ahead: laid, not yet dropped behind)
      const at = Math.round((dist + 600) / 20) * 20;
      if (at < 400 || at > 6000 || seen.has(at)) continue;
      seen.add(at);
      const state = level._hw, idx = state.pts.findIndex((pt) => pt.s >= at);
      if (idx < 0) continue;
      for (const side of [-1, 1]) {
        const spot = roadPose(level, at, side * (state.geo.hw + MID_OUT_M));
        const rects = state.keep.filter((rect) => inRect(rect, spot.x, spot.y));
        const isLot = rects.some((rect) => rect.field != null && level.zones.some((zone) =>
          zone.field === rect.field && zone.surface?.id === 'concrete'));
        const kind = cityStretchAt(at, seed).kind;
        byKind[kind] ||= { lot: 0, all: 0 };
        byKind[kind].all++;
        if (isLot) byKind[kind].lot++;
        if (isLot) tally.lot++;
        else if (rects.some((rect) => rect.field == null)) tally.keep++;
        else if (side < 0 && state.pts[idx].sideOff) tally.side++;
        else {
          tally.none++;
          if (process.env.WHY) {
            // (the nearest lot on this side along the road, m, and the bend's radius here)
            const near = state.keep.filter((rect) => rect.field != null && Math.sign(
              (rect.x - state.pts[idx].x) * -Math.sin(spot.rot) + (rect.y - state.pts[idx].y)
              * Math.cos(spot.rot)) === side).map((rect) => Math.hypot(rect.x - spot.x,
              rect.y - spot.y) - rect.hu).sort((a, b) => a - b)[0];
            console.log(`  none ${road} seed ${seed} at ${at} side ${side}: R `
              + `${Math.round(1 / Math.abs(state.pts[idx].curv || 1e-9))} m, nearest lot `
              + `${near === undefined ? '-' : near.toFixed(0)} m`);
          }
        }
      }
    }
    L.LEVELS.pop();
  }
  const total = tally.lot + tally.keep + tally.side + tally.none;
  const pct = (count) => `${Math.round((100 * count) / Math.max(1, total))}%`;
  console.log(`${road.padEnd(10)} spots ${total}: lot ${pct(tally.lot)} | slip/approach/river/`
    + `lay-by ${pct(tally.keep)} | side road ${pct(tally.side)} | no room ${pct(tally.none)}`
    + ` | lots made ${made}, dropped ahead of the car ${dropped}`
    + ` | clashes: on the road ${clashes.road}, on a lane ${clashes.lane} (of ${checked.size})`);
  console.log('  lots by stretch: ' + Object.entries(byKind).map(([kind, n]) => `${kind} `
    + `${Math.round((100 * n.lot) / n.all)}% of ${n.all}`).join(', '));
}
