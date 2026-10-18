// _sandcover.mjs (node tools/scratch/_sandcover.mjs [level] [--sanddig]) - does EVERY sand square
// dent when driven? Each 1.5 m cell centre on sand ground gets 6 passes; cells left undented are
// counted with what the wear system sees there (its layers) and the terrain.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const dig = await import(W + 'world/dig.ts');
const Wx = await import(W + 'world/weather.ts');
const terrain = await import(W + 'world/terrain.ts');
const level = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'lab';
if (process.argv.includes('--sanddig')) dig.setSandDig(true);
L.setLevel(level);
Wx.startWeather({ mode: 'dry', season: 2, seed: 1 });
wear.clearWear();
const points = [];
for (let x = -800; x < 800; x += wear.WEAR_CELL) {
  for (let y = -800; y < 1200; y += wear.WEAR_CELL) {
    const cx = (Math.floor(x / wear.WEAR_CELL) + 0.5) * wear.WEAR_CELL;
    const cy = (Math.floor(y / wear.WEAR_CELL) + 0.5) * wear.WEAR_CELL;
    if (wear.groundSurfaceAt(cx, cy).id === 'sand') points.push([cx, cy]);
  }
}
let clock = 1e6;
const before = points.map(([x, y]) => terrain.bumpAt(x, y));
for (let pass = 0; pass < 6; pass++) {
  for (const [x, y] of points) wear.recordWearAt(x, y, null, (clock += 1000));
}
const stuck = {};
let dented = 0;
points.forEach(([x, y], index) => {
  const drop = before[index] - terrain.bumpAt(x, y);
  if (drop > 0.01) { dented++; return; }
  const layers = wear.layersAt(x, y);
  const key = `base ${layers.base} cover ${layers.cover}`;
  stuck[key] = stuck[key] || { count: 0, at: [x.toFixed(1), y.toFixed(1)] };
  stuck[key].count++;
});
console.log(`${level}: ${points.length} sand cells, dented ${dented}, not dented:`, stuck);
