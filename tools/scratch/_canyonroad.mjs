// _canyonroad.mjs - DEAF VALLEY's road shape by stretch (highway/desertplan.ts desertRoadAt): over
// the first KM km of the canyon road, for each stretch kind the share of road that is straight
// (curvature under 1/900), the tightest radius and the longest straight - the HIGH road windier,
// the open desert straighter. node tools/scratch/_canyonroad.mjs [km]
import { createHighway } from '../../src/highway.ts';
import { growTo, stateOf } from '../../src/highway/road.ts';
import { stretchAt } from '../../src/highway/desertplan.ts';
const km = Number(process.argv[2] || 12), level = createHighway(4242, 'canyon');
growTo(level, km * 1000);
const stats = {};
let run = 0, runKind = '';
for (const pt of stateOf(level).pts) {
  const kind = stretchAt(pt.s, level.seed).kind, row = stats[kind] ||= { pts: 0, straight: 0, minR: Infinity,
    longest: 0 };
  row.pts++;
  const curv = Math.abs(pt.curv || 0);
  if (curv < 1 / 900) { row.straight++; run = runKind === kind ? run + 4 : 4; runKind = kind; }
  else run = 0;
  row.longest = Math.max(row.longest, run);
  if (curv > 0) row.minR = Math.min(row.minR, 1 / curv);
}
for (const [kind, row] of Object.entries(stats))
  console.log(kind.padEnd(7), 'straight', `${Math.round(100 * row.straight / row.pts)}%`.padStart(4),
    'tightest R', String(Math.round(row.minR)).padStart(5), 'm  longest straight',
    String(row.longest).padStart(5), 'm');
