// _hillroad.mjs - THE HILL CLIMB'S ROAD SHAPE (?hillclimb; highway/hillplan.ts, road.ts
// switchbackElements), in node: the road grown 6 km on the hill climb's shape (the single lane's
// cross-section), per seed: its stretches, the hairpins (turns past 120 deg) and their least radius,
// the least gap between two parts of the road more than 80 m apart along it (centre line to centre
// line - under the road's width plus 4 m: they touch), the heading's range off straight up, and
// the rise at the finish (5 km). [SEEDS=4242,7,99] node tools/scratch/_hillroad.mjs
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { growTo } = await import('../../src/highway/road.ts');
const { HW_PRESETS, UP_HEADING, wrap } = await import('../../src/highway/presets.ts');
const { hillRoadAt, hillStretchAt, gradeOf, HILL_LENGTH_M } = await import(
  '../../src/highway/hillplan.ts');

const SEEDS = (process.env.SEEDS || '4242,7,99').split(',').map(Number);
for (const seed of SEEDS) {
  const level = hw.createHighway(seed, 'twisty');
  level._cfg = { ...HW_PRESETS.twisty, kRate: 2.5e-3, stretch: hillRoadAt, theme: 'peak' };
  L.LEVELS.push(level);
  L.setLevel('highway');
  hw.resetHighway(level);
  growTo(level, 6000);
  const pts = level._hw.pts, width = level._hw.geo.width;
  // hairpins: runs of curvature one way turning past 120 deg
  let run = 0, runSign = 0, runK = 0, hairpins = 0, leastR = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const turn = wrap(Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
      - (i > 1 ? Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x) : 0));
    if (i === 1) continue;
    const sign = Math.sign(turn), k = Math.abs(turn) / (pts[i].s - pts[i - 1].s);
    if (sign === runSign && Math.abs(turn) > 1e-4) { run += Math.abs(turn); runK = Math.max(runK, k); }
    else {
      if (run > 120 * Math.PI / 180) { hairpins++; leastR = Math.min(leastR, 1 / runK); }
      run = Math.abs(turn); runSign = sign; runK = k;
    }
  }
  // the least gap between parts of the road more than 80 m apart along it
  let leastGap = Infinity, gapAt = null, touching = 0;
  for (let i = 0; i < pts.length; i += 2) for (let j = i + 20; j < pts.length; j += 2) {
    if (pts[j].s - pts[i].s < 80) continue;
    const gap = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
    if (gap < leastGap) { leastGap = gap; gapAt = [Math.round(pts[i].s), Math.round(pts[j].s)]; }
    if (gap < width + 4) touching++;
  }
  // (the climb as the game lays it: each point by its road kind's grade - highway/hillground.ts)
  const { SPAWN_S } = await import('../../src/highway/presets.ts');
  let climbed = 0;
  const laid = {};
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].s <= SPAWN_S || pts[i].s > SPAWN_S + HILL_LENGTH_M) continue;
    climbed += gradeOf(pts[i].tag) * (pts[i].s - pts[i - 1].s);
    laid[pts[i].tag || 'none'] = (laid[pts[i].tag || 'none'] || 0) + 4;
  }
  const offs = pts.map((point, i) => (i ? wrap(Math.atan2(point.y - pts[i - 1].y,
    point.x - pts[i - 1].x) - UP_HEADING) * 180 / Math.PI : 0));
  const kinds = [];
  for (let dist = 0; dist < 6000;) {
    const stretch = hillStretchAt(dist, seed);
    kinds.push(`${stretch.kind}:${stretch.len}`);
    dist += stretch.len - stretch.along;
  }
  console.log(`seed ${seed}: ${kinds.join(' ')}`);
  console.log(`  hairpins ${hairpins}, least radius ${leastR.toFixed(1)} m; least gap between `
    + `parts of the road ${leastGap.toFixed(1)} m (at ${gapAt}), point pairs under the width + 4 m `
    + `${touching}; heading off up ${Math.min(...offs).toFixed(0)}..${Math.max(...offs).toFixed(0)}`
    + ` deg; the 5 km from the start line rise ${climbed.toFixed(0)} m (${(climbed / 50).toFixed(1)} %),`
    + ` laid as ${JSON.stringify(laid)} m`);
  L.LEVELS.pop();
}
