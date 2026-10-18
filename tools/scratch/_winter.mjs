// _winter.mjs (node tools/scratch/_winter.mjs) - ?winter=1 / ?labweather=1 measured: what snow and
// packed snow become by temperature, how fast a level's snow patch melts, a snow stage's weather,
// the lab floors' sites, and the per-tick cost of the cell passes with thousands of wear cells.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const P = await import(W + 'world/puddles.ts');
const snow = await import(W + 'world/snowwear.ts');
const STATE = await import(W + 'world/state.ts');
Wx.setMelt(true); snow.setWinterSnow(true); P.setWeatherPuddles(true);

// 1. outcomes: 400 cells of the Bowling Alley's snow lane, 4 passes (loose snow), then 4 more
L.setLevel('bowling-alley');
const lane = STATE.LEVEL.zones.find((zone) => zone.lane === 'snow');
const cells = [];
for (let x = lane.x - lane.w / 2 + 1; cells.length < 400; x += wear.WEAR_CELL) {
  for (let y = lane.y - 4; y <= lane.y + 4 && cells.length < 400; y += wear.WEAR_CELL) cells.push([x, y]);
}
for (const tempC of [-8, 0, 5]) {
  Wx.startWeather({ mode: 'dry', season: 0, seed: 1 }); wear.clearWear();
  const first = {}, second = {};
  let clock = 1e6;
  for (const [x, y] of cells) {
    Wx.WEATHER.trackC = tempC;
    let now;
    for (let pass = 0; pass < 4; pass++) now = wear.recordWearAt(x, y, null, (clock += 1000));
    first[now] = (first[now] || 0) + 1;
    if (now !== 'packedSnow') continue;
    for (let pass = 0; pass < 4; pass++) now = wear.recordWearAt(x, y, null, (clock += 1000));
    second[now] = (second[now] || 0) + 1;
  }
  console.log(`${String(tempC).padStart(3)} C  snow after 4 passes ${JSON.stringify(first)}`
    + `  | that packed snow after 4 more ${JSON.stringify(second)}`);
}

// 2. a level's snow patch (Test Track) in warm weather: how long until it melts, then dries
L.setLevel('test-track'); STATE.LEVEL._puddleSites = P.buildPuddleSites(STATE.LEVEL);
for (const [label, mode, season] of [['spring dry', 'dry', 1], ['hot', 'hot', 2]]) {
  Wx.startWeather({ mode, season, seed: 3 }); P.resetPuddles();
  const patch = STATE.LEVEL._staticCovers.find((cover) => cover.cover === 'snow');
  patch._melt = undefined;
  let melted = null, dried = null;
  for (let t = 0; t < 3600 && dried === null; t += 1) {
    Wx.stepWeather(1); P.stepPuddles(1);
    if (melted === null && patch._melt === 'water') melted = t;
    if (patch._melt === 'gone') dried = t;
  }
  console.log(`Test Track snow patch, ${label} (track ${Wx.WEATHER.trackC.toFixed(0)} C): water after`
    + ` ${melted ?? '>3600'} s, dried after ${dried ?? '>3600'} s`);
}

// 3. a snow stage's weather (snow ground): every mode
(await import(W + 'stagegen.js')).addStageLevels();
L.setLevel('stage-ikeaflatpack');
const stage = STATE.LEVEL;
const kinds = [];
for (const mode of ['dry', 'hot', 'superhot', 'rain', 'heavy', 'snow', 'season']) {
  Wx.startWeather({ mode, season: 2, seed: 7 }, true);
  kinds.push(`${mode} -> ${Wx.WEATHER.kind} ${Wx.WEATHER.trackC.toFixed(0)} C`);
}
console.log(`${stage.id} (snow ground): ${kinds.join(', ')}`);
Wx.startWeather(null);

// 4. sites on the lab floors
for (const id of ['lab', 'bowling-alley', 'rough-patch']) {
  L.setLevel(id);
  const sites = P.buildPuddleSites(STATE.LEVEL);
  console.log(`${id}: ${sites.length} sites (water ${sites.filter((s) => s.catchK > 0).length},`
    + ` snow ${sites.filter((s) => s.snowy).length})`);
}

// 5. cost: Castle Cum with ~6000 wear cells, the per-second puddle tick (cell passes included)
L.setLevel('castle-cum'); STATE.LEVEL._puddleSites = P.buildPuddleSites(STATE.LEVEL); wear.clearWear();
Wx.startWeather({ mode: 'dry', season: 2, seed: 5 }); P.resetPuddles(); Wx.setWetness(0.3);
const sub = STATE.LEVEL.subtrack;
let clock = 2e6;
for (let dist = 0; dist < sub.totalDist; dist += 0.5) {
  for (const side of [-4, -2, 0, 2, 4]) {
    const point = L.onTrack(sub, dist, side, {});
    wear.recordWearAt(point.x, point.y, null, (clock += 1000));
  }
}
for (const [label, tempC, wetness] of [['warm dry spell', 20, 0], ['freezing', -6, 0.2]]) {
  Wx.WEATHER.trackC = tempC; Wx.setWetness(wetness);
  P.stepPuddles(1);
  const t0 = performance.now();
  for (let tick = 0; tick < 100; tick++) P.stepPuddles(1);
  console.log(`tick cost, ${wear.wearMap.size} cells, ${label}: ${((performance.now() - t0) / 100).toFixed(2)} ms a second of race`);
}
