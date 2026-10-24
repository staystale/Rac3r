// _meltwater.mjs - what the weather's melt leaves (owner: melting snow and ice should leave
// water): from a full coat of snow (or ice) in a dry spell held at a track temperature, the share
// of Castle Cum's race surface under snow / ice / water over time and the most water seen.
// node tools/scratch/_meltwater.mjs [on]   (on: ?meltwater=1)
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const F = await import(W + 'world/coverfield.ts');
const STATE = await import(W + 'world/state.ts');
F.setMeltWater(process.argv[2] === 'on');

L.setLevel('castle-cum');
const sub = STATE.LEVEL.subtrack;
const road = [];
for (let dist = 0; dist < sub.totalDist; dist += 2) {
  for (let side = -sub.width / 2 + 0.5; side < sub.width / 2; side += 1.5)
    road.push(L.onTrack(sub, dist, side, {}));
}
const shares = () => {
  const count = { snow: 0, ice: 0, wet: 0 };
  for (const point of road) {
    const kind = wear.coverAt(point.x, point.y);
    if (kind in count) count[kind]++;
  }
  return Object.fromEntries(Object.entries(count).map(([key, n]) => [key, Math.round(100 * n / road.length)]));
};
for (const coat of ['snow', 'ice']) {
  for (const trackC of [5, 15, 30]) {
    Wx.startWeather({ mode: 'dry', season: 1, seed: 7 });
    F.resetCoverField();
    Object.assign(F.FIELD, { water: 0, snow: coat === 'snow' ? 1 : 0, ice: coat === 'ice' ? 1 : 0, packed: 0 });
    let maxWater = 0, maxWet = 0, damp10 = '';
    const marks = [];
    for (let second = 1; second <= 30 * 60; second++) {
      for (let step = 0; step < 10; step++) {
        Wx.stepWeather(0.1);
        Wx.WEATHER.trackC = trackC;
        Wx.WEATHER.rain = 0;
        Wx.WEATHER.snow = 0;
        F.stepCoverField(0.1);
      }
      maxWater = Math.max(maxWater, F.FIELD.water);
      if (second % 60 === 0) maxWet = Math.max(maxWet, shares().wet);
      if (second === 600) damp10 = Wx.WEATHER.wetness.toFixed(2);
      if ([120, 300, 600, 1200, 1800].includes(second)) {
        const s = shares();
        marks.push(`${second / 60}m ${coat} ${s[coat]}% wet ${s.wet}%`);
      }
    }
    console.log(`${coat} coat at ${trackC} C: ${marks.join(' | ')} | most water level`
      + ` ${maxWater.toFixed(3)}, most surface wet ${maxWet}%, damp at 10 min ${damp10}`);
  }
}
