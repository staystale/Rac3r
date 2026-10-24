// _coverfield.mjs (node tools/scratch/_coverfield.mjs) - the cover field (?coverfield=1): how much
// of the race surface heavy rain / snow covers over time and how it dries / melts after, the
// patches' size, and the per-second cost with thousands of wear cells.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const F = await import(W + 'world/coverfield.ts');
const STATE = await import(W + 'world/state.ts');

L.setLevel('castle-cum');
const sub = STATE.LEVEL.subtrack;
// the race surface: points across the road every 1 m along the lap
const road = [];
for (let dist = 0; dist < sub.totalDist; dist += 1) {
  for (let side = -sub.width / 2 + 0.5; side < sub.width / 2; side += 1) road.push(L.onTrack(sub, dist, side, {}));
}
const share = (kind) => {
  let hit = 0;
  for (const point of road) if (wear.coverAt(point.x, point.y) === kind) hit++;
  return (100 * hit / road.length).toFixed(0) + '%';
};
const run = (label, plan, minutes, kind, keep) => {
  Wx.startWeather(plan);
  if (!keep) F.resetCoverField();
  const marks = [];
  for (let second = 1; second <= minutes * 60; second++) {
    for (let step = 0; step < 10; step++) { Wx.stepWeather(0.1); F.stepCoverField(0.1); }
    if ([30, 60, 120, 300, 600, 900, 1500].includes(second)) marks.push(`${second / 60} min ${share(kind)}`);
  }
  console.log(`${label} (track ${Wx.WEATHER.trackC.toFixed(0)} C): start ${keep ? '' : 'settled '}`
    + `-> ${marks.join(', ')}  [levels w ${F.FIELD.water.toFixed(2)} s ${F.FIELD.snow.toFixed(2)} i ${F.FIELD.ice.toFixed(2)}]`);
};
F.FIELD.water = 0; F.FIELD.snow = 0; F.FIELD.ice = 0;
run('heavy rain from dry', { mode: 'heavy', season: 3, seed: 1 }, 10, 'wet', true);
run('then dry, summer', { mode: 'dry', season: 2, seed: 2 }, 25, 'wet', true);
F.FIELD.water = 0; F.FIELD.snow = 0; F.FIELD.ice = 0;
run('rain (light) from dry', { mode: 'rain', season: 3, seed: 3 }, 25, 'wet', true);
F.FIELD.water = 0; F.FIELD.snow = 0; F.FIELD.ice = 0;
run('snow from bare', { mode: 'snow', season: 0, seed: 4 }, 10, 'snow', true);
run('then hot', { mode: 'hot', season: 2, seed: 5 }, 10, 'snow', true);
run('heavy rain, settled start', { mode: 'heavy', season: 3, seed: 6 }, 1, 'wet', false);
run('snow, settled start', { mode: 'snow', season: 0, seed: 7 }, 1, 'snow', false);

// cost: ~4000 wear cells, the field step with its once-a-second cell sync
Wx.startWeather({ mode: 'heavy', season: 3, seed: 8 }); F.resetCoverField(); wear.clearWear();
Wx.setWetness(0.5);
let clock = 1e6;
for (const point of road) if ((clock += 1000) && Math.random() < 0.5) wear.recordWearAt(point.x, point.y, null, clock);
const t0 = performance.now();
for (let second = 0; second < 100; second++) F.stepCoverField(1);
console.log(`cost: ${wear.wearMap.size} wear cells, ${((performance.now() - t0) / 100).toFixed(2)} ms a second of race`);
