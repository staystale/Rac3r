// _citylots.mjs - GETAWAY STOCKHOLM's lots (highway/city.ts) in node, no browser: the road built
// as the game builds it (stepHighway, a stand-in car in the left lane, as tools/worldhash.mjs)
// over the first city stretch (400-2100 m) on several seeds and road types. Every 20 m, each side:
// is the spot a lot's middle would stand on inside a lot; if not, what has that ground - a keep
// rect that is not a lot (a slip, an approach, a river, a lay-by, a services), the secret side
// road (left), or nothing (the lot found no room: a bend, the next lot).
// STOCKHOLM=1 node tools/scratch/_citylots.mjs [roads motorway,dual,...] [seeds 4242,7,99]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';

const roads = (process.argv[2] || 'motorway,interstate,dual,walled,twisty').split(',');
const seeds = (process.argv[3] || '4242,7,99').split(',').map(Number);
// m: the lot's middle past the road edge (city.ts LOT_OUT_M + LOT_DEPTH_M / 2)
const MID_OUT_M = 6 + 22;

const inRect = (rect, x, y) => {
  const dx = x - rect.x, dy = y - rect.y;
  return Math.abs(dx * rect.ax + dy * rect.ay) <= rect.hu
    && Math.abs(-dx * rect.ay + dy * rect.ax) <= rect.hv;
};

for (const road of roads) {
  const tally = { lot: 0, keep: 0, side: 0, none: 0 };
  let made = 0, dropped = 0;
  for (const seed of seeds) {
    const level = createHighway(seed, road);
    setHighwayPreset(level, road, 'stockholm');
    L.LEVELS.push(level);
    L.setLevel('highway');
    resetHighway(level);
    if (level._cfg.theme !== 'city') throw new Error('not the city: STOCKHOLM=1 missing?');
    const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 };
    const seen = new Set(), alive = new Map();
    for (let dist = 300; dist <= 1500; dist += 4) {
      const pose = roadPose(level, dist, lane);
      car.x = pose.x;
      car.y = pose.y;
      stepHighway(level, car);
      // (a lot gone while still ahead of the car: dropped by a later feature, not behind)
      const now = new Map(level.zones.filter((zone) => zone.surface?.id === 'concrete'
        && zone.field != null).map((zone) => [zone.field, zone._s]));
      for (const [id, at] of now) if (!alive.has(id)) made++;
      for (const [id, at] of alive) if (!now.has(id) && at > dist) dropped++;
      for (const id of [...alive.keys()]) alive.delete(id);
      for (const [id, at] of now) alive.set(id, at);
      // (sampled 600 m ahead: laid, not yet dropped behind)
      const at = Math.round((dist + 600) / 20) * 20;
      if (at < 400 || at > 2100 || seen.has(at)) continue;
      seen.add(at);
      const state = level._hw, idx = state.pts.findIndex((pt) => pt.s >= at);
      if (idx < 0) continue;
      for (const side of [-1, 1]) {
        const spot = roadPose(level, at, side * (state.geo.hw + MID_OUT_M));
        const rects = state.keep.filter((rect) => inRect(rect, spot.x, spot.y));
        const isLot = rects.some((rect) => rect.field != null && level.zones.some((zone) =>
          zone.field === rect.field && zone.surface?.id === 'concrete'));
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
    + ` | lots made ${made}, dropped ahead of the car ${dropped}`);
}
