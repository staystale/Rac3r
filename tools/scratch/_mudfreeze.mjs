// _mudfreeze.mjs (node tools/scratch/_mudfreeze.mjs [tempC] [--frost]) - does mud and thick mud
// freeze over in the cold, driven over or not, and how fast? OG Lab's mud and thick mud panels:
// 100 points each driven once (one tyre pass) and 100 never driven; a cold track (weather running,
// winter on) stepped a second at a time; what the tyres feel (groundAt) is counted. --frost:
// ?mudfreeze=1 (the cover field's frost), else the old cell-by-cell freeze.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const P = await import(W + 'world/puddles.ts');
const snow = await import(W + 'world/snowwear.ts');
const field = await import(W + 'world/coverfield.ts');
const STATE = await import(W + 'world/state.ts');
const frost = process.argv.includes('--frost');
Wx.setMelt(true); snow.setWinterSnow(true); P.setWeatherPuddles(true);
field.setMudFrost(frost);
L.setLevel('lab');
const panel = (id) => STATE.LEVEL.zones.find((zone) => zone.surface && zone.surface.id === id
  && zone.boxed);
const sets = {};
for (const id of ['mud', 'thickMud']) {
  const zone = panel(id), driven = [], left = [];
  for (let x = zone.x - 24; x < zone.x + 24; x += 2.4) {
    for (let y = zone.y - 24; y < zone.y; y += 2.4) driven.push([x, y]);
    for (let y = zone.y + 1; y < zone.y + 25; y += 2.4) left.push([x, y]);
  }
  sets[id + ' driven'] = driven.slice(0, 100);
  sets[id + ' undriven'] = left.slice(0, 100);
}
const tempC = +(process.argv[2] || -5);
Wx.startWeather({ mode: 'dry', season: 0, seed: 1 });
Wx.WEATHER.trackC = 10;
wear.clearWear();
field.resetCoverField();
let clock = 1e6;
for (const [name, cells] of Object.entries(sets)) {
  if (name.endsWith('driven') && !name.endsWith('undriven')) {
    for (const [x, y] of cells) wear.recordWearAt(x, y, null, (clock += 1000));
  }
}
const iced = () => Object.entries(sets).map(([name, cells]) => {
  const ice = cells.filter(([x, y]) => {
    const ground = wear.groundAt(x, y);
    return ((ground.surface && ground.surface.id) || ground.id) === 'ice';
  }).length;
  return `${name} ${ice}%`;
}).join(' | ');
console.log(`${frost ? 'FROST (?mudfreeze=1)' : 'OLD'} at ${tempC} C. start:`, iced());
for (let second = 1; second <= 600; second++) {
  Wx.WEATHER.trackC = tempC;
  for (let step = 0; step < 10; step++) field.stepCoverField(0.1);
  P.stepPuddles(1);
  if ([60, 120, 300, 420, 600].includes(second)) console.log(`${second} s:`, iced());
}
Wx.WEATHER.trackC = 8;
for (let second = 1; second <= 300; second++) {
  for (let step = 0; step < 10; step++) field.stepCoverField(0.1);
  P.stepPuddles(1);
  if ([60, 180, 300].includes(second)) console.log(`thaw at 8 C, ${second} s:`, iced());
}
