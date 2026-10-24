// _icecrack.mjs - ice cracks (world/icecrack.ts) on the Lab's ice sheet in a cold dry
// spell: one wheel line driven across the sheet pass after pass (a pass a second); after each
// pass the cracks along the line, how far cracks have spread from it, the line's grip, and how
// many of its cells have broken through to water. node tools/scratch/_icecrack.mjs [trackC]
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const Wx = await import(W + 'world/weather.ts');
const F = await import(W + 'world/coverfield.ts');
const P = await import(W + 'world/puddles.ts');
const C = await import(W + 'world/icecrack.ts');
const trackC = +(process.argv[2] ?? -5);
L.setLevel('lab');
Wx.startWeather({ mode: 'dry', season: 0, seed: 11 });
F.resetCoverField();
wear.clearWear();
const hold = () => { Wx.WEATHER.trackC = trackC; Wx.WEATHER.tempC = trackC; Wx.WEATHER.rain = 0; Wx.WEATHER.snow = 0; };
// the sheet: ellipse 60 x 30 m at (-95, -185); the line along its long axis, y = -185
const LINE_Y = -185, FROM_X = -115, TO_X = -75, CELL = wear.WEAR_CELL;
const lineCells = () => {
  const out = [];
  for (let x = FROM_X; x <= TO_X; x += CELL) {
    const cell = wear.wearMap.get(wear.wearKey(Math.floor(x / CELL), Math.floor(LINE_Y / CELL)));
    if (cell) out.push(cell);
  }
  return out;
};
let timeMs = 0;
const rows = [];
for (let pass = 1; pass <= 16; pass++) {
  for (let x = FROM_X; x <= TO_X; x += 0.5) wear.recordWearAt(x, LINE_Y, null, timeMs, 18);
  // a second of weather, cover field and cell ticks between passes
  for (let step = 0; step < 10; step++) { Wx.stepWeather(0.1); hold(); F.stepCoverField(0.1); P.stepPuddles(0.1); }
  timeMs += 1000;
  const cells = lineCells(), ice = cells.filter((cell) => cell.cover === 'ice');
  const water = cells.filter((cell) => cell.cover === 'wet').length;
  const crack = ice.length ? ice.reduce((sum, cell) => sum + (cell.crack || 0), 0) / ice.length : 0;
  let spreadM = 0, cracked = 0;
  for (const cell of wear.wearMap.values()) {
    if (cell.cover !== 'ice' || !(cell.crack > 0)) continue;
    cracked++;
    spreadM = Math.max(spreadM, Math.abs((cell.cy + 0.5) * CELL - LINE_Y));
  }
  const mu = ice.length ? wear.getWornSurface((ice[0].cx + 0.5) * CELL, LINE_Y).mu : 0;
  if ([1, 2, 4, 6, 8, 12, 16].includes(pass)) rows.push(`pass ${pass}: line ice ${ice.length}/${cells.length} crack ${crack.toFixed(2)}`
    + ` mu ${mu.toFixed(3)} water ${water} | cracked cells ${cracked}, out to ${spreadM.toFixed(1)} m`);
}
// then 60 s with no driving: the spread, and melting at this temperature
for (let second = 0; second < 60; second++) for (let step = 0; step < 10; step++) { Wx.stepWeather(0.1); hold(); F.stepCoverField(0.1); P.stepPuddles(0.1); }
let cracked = 0, spreadM = 0;
for (const cell of wear.wearMap.values()) if (cell.cover === 'ice' && cell.crack > 0) { cracked++; spreadM = Math.max(spreadM, Math.abs((cell.cy + 0.5) * CELL - LINE_Y)); }
console.log(`ice cracks at ${trackC} C`);
for (const row of rows) console.log('  ' + row);
console.log(`  +60 s idle: cracked cells ${cracked}, out to ${spreadM.toFixed(1)} m; line water ${lineCells().filter((cell) => cell.cover === 'wet').length}`);
