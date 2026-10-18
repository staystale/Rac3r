// _coldsurface.mjs (node tools/scratch/_coldsurface.mjs [--on]) - the cold-surface rules measured:
// 1 what a square shows where snow meets the Lab's ice / wet areas and the weather's water;
// 2 rain on the weather's ice: does the covered share grow; 3 driven ice -> water by temperature;
// 4 rain: snow vs ice melt; 5 ground wear chances (dirt dry / damp, sand and gravel damp).
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const field = await import(W + 'world/coverfield.ts');
const dig = await import(W + 'world/dig.ts');
const snow = await import(W + 'world/snowwear.ts');
const on = process.argv.includes('--on');
Wx.setColdSurface(on); dig.setWearChance(on); dig.setSandDig(true); dig.setGravelDig(true);
Wx.setMelt(true); snow.setWinterSnow(true); Wx.setWinterCold(true);
L.setLevel('lab');
const square = (i) => [(i % 400) * 1.3 + 0.25, Math.floor(i / 400) * 1.3 + 0.25];
const share = (fn) => { let n = 0; for (let i = 0; i < 20000; i++) if (fn(...square(i))) n++;
  return (100 * n / 20000).toFixed(0) + '%'; };
// 1: snow 0.5 over an ice area (full), a wet area (full), and weather water 0.4
Object.assign(field.FIELD, { water: 0.4, snow: 0.5, ice: 0, packed: 0 });
console.log(`1 ${on ? 'ON ' : 'OFF'} ice area + snow 0.5: snow shows on`,
  share((x, y) => field.fieldCoverAt(x, y, 'ice') === 'snow'),
  '| wet area + snow:', share((x, y) => field.fieldCoverAt(x, y, 'wet') === 'snow'),
  '| weather water 0.4 + snow 0.5: snow over water squares',
  share((x, y) => field.catchAt(x, y, field.WATER_SEED) < 0.4
    && field.fieldCoverAt(x, y, null) === 'snow'));
// 2: rain on weather ice 0.4 at 3 C for 120 s: covered share before / after
Wx.startWeather({ mode: 'rain', season: 1, seed: 3 });
field.resetCoverField();
Object.assign(field.FIELD, { water: 0, snow: 0, ice: 0.4, packed: 0 });
const covered = () => share((x, y) => !!field.fieldCoverAt(x, y, null));
const before = covered();
for (let s = 0; s < 120; s++) { Wx.WEATHER.trackC = -1; Wx.WEATHER.rain = 1; field.stepCoverField(1); }
console.log(`2 rain 120 s on ice 0.4 at -1 C: covered ${before} -> ${covered()}, ice squares`,
  share((x, y) => field.fieldCoverAt(x, y, null) === 'ice'));
// 3: driven ice -> water share over 40 passes, by temperature
for (const tempC of [-5, 0, 5]) {
  Wx.startWeather({ mode: 'dry', season: 0, seed: 1 });
  wear.clearWear();
  let clock = 1e6, water = 0;
  const points = [];
  const zone = (await import(W + 'world/state.ts')).LEVEL.zones.find((z) => z.surface.id === 'ice');
  for (let k = 0; k < 40; k++) points.push([zone.x - 20 + (k % 8) * 5, zone.y - 20 + Math.floor(k / 8) * 5]);
  for (let pass = 0; pass < 8; pass++) {
    Wx.WEATHER.trackC = tempC;
    for (const [x, y] of points) wear.recordWearAt(x, y, null, (clock += 1000));
  }
  for (const [x, y] of points) { const g = wear.groundAt(x, y); if (((g.surface && g.surface.id) || g.id) !== 'ice') water++; }
  console.log(`3 ${tempC} C, 8 passes over the Lab ice: ${water}/40 cells no longer ice`);
}
// 4: rain on snow vs ice areas at 5 C: time to half
Wx.startWeather({ mode: 'rain', season: 1, seed: 3 });
field.resetCoverField();
const gone = {};
for (let s = 1; s < 20000 && !(gone.snow && gone.ice); s++) {
  Wx.WEATHER.trackC = 5; Wx.WEATHER.rain = 1; field.stepCoverField(1);
  if (!gone.snow && field.AREAS.snow.snow < 0.6) gone.snow = s;
  if (!gone.ice && field.AREAS.ice.ice < 0.6) gone.ice = s;
}
console.log(`4 heavy rain at 5 C: a level's snow half gone in ${gone.snow} s, its ice in ${gone.ice} s`);
// 5: ground wear: 40 passes each, The Rough Patch (dirt, sand, gravel), no field water
L.setLevel(process.argv.includes('--lab5') ? 'lab' : 'rough-patch');
for (const [id, wetness] of [['dirt', 0], ['dirt', 0.8], ['sand', 0.8], ['gravel', 0.8], ['sand', 0], ['gravel', 0]]) {
  Wx.startWeather({ mode: 'dry', season: 2, seed: 2 });
  Wx.setWetness(wetness);
  field.resetCoverField();
  Object.assign(field.FIELD, { water: 0, snow: 0, ice: 0, packed: 0 });
  wear.clearWear();
  const pts = [];
  for (let x = -600; x < 600 && pts.length < 40; x += 1.6) for (let y = -600; y < 600 && pts.length < 40; y += 1.6) {
    const is = (dx, dy) => wear.groundSurfaceAt(x + dx, y + dy).id === id;
    if (is(0, 0) && is(1.6, 0) && is(-1.6, 0) && is(0, 1.6) && is(0, -1.6)) { pts.push([x, y]); y += 6; }
  }
  let clock = 1e6;
  const after = {};
  for (const passes of [2, 6]) {
    for (let p = 0; p < (passes === 2 ? 2 : 4); p++) for (const [x, y] of pts) wear.recordWearAt(x, y, null, (clock += 1000));
    const left = {};
    for (const [x, y] of pts) { const g = wear.groundAt(x, y); const k = (g.surface && g.surface.id) || g.id; left[k] = (left[k] || 0) + 1; }
    after[passes] = JSON.stringify(left);
  }
  console.log(`5 ${id} wet ${wetness}: after 2 passes ${after[2]}  after 6 ${after[6]}`);
}
