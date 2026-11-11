// _rockoverhang.mjs - DEAF VALLEY'S ROCK LOOK PAST THE FACE: drive KM of the canyon road headless
// and, for every red-rock ground piece (highway/canyon.ts rockGround), how far its corners on the
// road's side stand nearer the road than the wall's face there, m (0 = none past the face): the
// count over 0.5 m, the 95th percentile, the worst.
// [ROAD=twisty] node tools/scratch/_rockoverhang.mjs [km]
const { makeCar, reset, step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const { insidePolygon } = await import('../../src/world/zones.ts');
const bad = [];
const KM = +(process.argv[2] || 6), ROAD = process.env.ROAD || 'twisty';
hw.addHighwayLevel();
L.setLevel('highway');
const lv = L.LEVEL;
hw.setHighwayPreset(lv, ROAD, 'canyon');
hw.resetHighway(lv);
const seen = new Set(), past = [];
const nearestRoad = (x, y) => {
  let best = Infinity;
  for (const pt of lv._hw.pts) best = Math.min(best, Math.hypot(pt.x - x, pt.y - y));
  return best;
};
function survey() {
  const rocks = lv.barriers.filter((bar) => bar.kind === 'rock');
  for (const zone of lv.zones) {
    if (zone.art !== 'redrock' || seen.has(zone)) continue;
    seen.add(zone);
    const cos = Math.cos(zone.rot || 0), sin = Math.sin(zone.rot || 0);
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => [
      zone.x + u * zone.w / 2 * cos - v * zone.h / 2 * sin,
      zone.y + u * zone.w / 2 * sin + v * zone.h / 2 * cos]);
    corners.sort((a, b) => nearestRoad(...a) - nearestRoad(...b));
    for (const [x, y] of corners.slice(0, 2)) {
      // the face point nearest this corner, and how much nearer the road the corner is
      let face = null, faceGap = Infinity;
      for (const bar of rocks) for (const [fx, fy] of bar.pts) {
        const gap = Math.hypot(fx - x, fy - y);
        if (gap < faceGap) { faceGap = gap; face = [fx, fy]; }
      }
      if (!face || faceGap >= 30) continue;
      const gap = Math.max(0, nearestRoad(...face) - nearestRoad(x, y));
      past.push(gap);
      if (gap > 0.5) bad.push(`@${Math.round(zone._s)} ${gap.toFixed(1)} m (face ${faceGap.toFixed(1)} m off,`
        + ` in a band ${rocks.some((bar) => bar.band && insidePolygon(bar.band, x, y))})`);
    }
  }
}
const car = makeCar('hatch-rwd');
reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0;
survey();
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  t += PHYSICS_STEP_SECONDS;
  solidClamp(car);
  const q = L.querySubtrack(sub, car.x, car.y);
  if (hw.stepHighway(lv, car, q.trackDist)) survey();
}
survey();
past.sort((a, b) => a - b);
if (process.env.LIST) console.log(bad.join(String.fromCharCode(10)));
console.log(`${ROAD} ${KM} km: rock pieces ${seen.size}, corners ${past.length}, past the face by`
  + ` > 0.5 m ${past.filter((gap) => gap > 0.5).length}, p95 ${past[Math.floor(past.length * 0.95)]
    ?.toFixed(2)} m, worst ${past[past.length - 1]?.toFixed(2)} m`);
