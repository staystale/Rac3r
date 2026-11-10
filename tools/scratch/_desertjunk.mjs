// _desertjunk.mjs - DEAF VALLEY'S JUNK (?desertjunk=1; owner 11-09: "Burned-out cars, Crates and
// oil drums, Tumbleweed, Old tyres and a shack"): over the first window of the canyon road for each
// of SEEDS, the junk per km of road by kind (props and loose objects), the nearest of each to the
// road's edge (nothing may stand on the road), anything within 22 m of a petrol station (its
// forecourt and ways in and out are kept clear), and for the tumbleweed the side they lie on
// against the breeze (most should lie upwind, to blow across the road).
// [DESERTJUNK=1] node tools/scratch/_desertjunk.mjs [seeds]
import { createHighway } from '../../src/highway.ts';
import { setActiveLevel } from '../../src/world/state.ts';
import { stateOf, roadFrame } from '../../src/highway/road.ts';
const seeds = (process.argv[2] || '4242,7,99,1234,555,31337').split(',').map(Number);
const KINDS = ['wreck', 'skull', 'shack', 'crate', 'barrel', 'tyre', 'tyrestack', 'tumbleweed'];
const count = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
const nearest = Object.fromEntries(KINDS.map((kind) => [kind, Infinity]));
let roadKm = 0, byStation = 0, upwind = 0, downwind = 0;
for (const seed of seeds) {
  const level = createHighway(seed, 'canyon');
  setActiveLevel(level);
  const state = stateOf(level), road = state.pts, hw = state.geo.hw;
  roadKm += (road[road.length - 1].s - road[0].s) / 1000;
  const stations = level.props.filter((prop) => prop.kind === 'gasstation');
  for (const item of [...level.props, ...(level.cones || [])]) {
    if (!KINDS.includes(item.kind)) continue;
    count[item.kind]++;
    const frame = roadFrame(level, item.x, item.y, null);
    if (frame) nearest[item.kind] = Math.min(nearest[item.kind], Math.abs(frame.off) - hw);
    if (stations.some((st) => Math.hypot(st.x - item.x, st.y - item.y) < 22)) byStation++;
    if (item.kind === 'tumbleweed' && frame) {
      // the breeze blows toward +x or -x; the road's left (off < 0) is the screen's left (-x)
      if (Math.sign(frame.off) === -Math.sign(item.wind[0])) upwind++; else downwind++;
    }
  }
}
console.log(`${seeds.length} seeds, ${roadKm.toFixed(1)} km of road:`);
for (const kind of KINDS) console.log(`  ${kind.padEnd(11)} ${(count[kind] / roadKm).toFixed(2)
  .padStart(6)} a km | nearest ${Number.isFinite(nearest[kind]) ? nearest[kind].toFixed(1)
  + ' m past the edge' : '-'}`);
console.log(`within 22 m of a petrol station: ${byStation} | tumbleweed upwind ${upwind},`
  + ` downwind ${downwind}`);
