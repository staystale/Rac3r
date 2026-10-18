// _sanddig.mjs (node tools/scratch/_sanddig.mjs [--sanddig]) - what tyre passes do to sand, gravel,
// mud and thick mud, dry and wet: the dent (rut, cm) after 1, 3, 6, 10 passes, and the surface
// left. OG Lab, 50 points per surface (each 1.6 m inside it). --sanddig: ?sanddig=1.
const W = new URL('../../src/', import.meta.url).href;
const L = await import(W + 'lab.js');
const wear = await import(W + 'world/wear.ts');
const dig = await import(W + 'world/dig.ts');
const Wx = await import(W + 'world/weather.ts');
const sandDig = process.argv.includes('--sanddig');
if (sandDig) dig.setSandDig(true);
if (process.argv.includes('--graveldig')) dig.setGravelDig(true);
L.setLevel('lab');
const IDS = ['sand', 'gravel', 'mud', 'thickMud'];
const POINTS = {};
for (const id of IDS) {
  POINTS[id] = [];
  for (let x = -600; x < 600 && POINTS[id].length < 50; x += 1.6) {
    for (let y = -600; y < 600 && POINTS[id].length < 50; y += 1.6) {
      const is = (dx, dy) => wear.groundSurfaceAt(x + dx, y + dy).id === id;
      if (is(0, 0) && is(1.6, 0) && is(-1.6, 0) && is(0, 1.6) && is(0, -1.6)) {
        POINTS[id].push([x, y]);
        y += 6;
      }
    }
  }
}
const surfaceAt = (x, y) => {
  const now = wear.groundAt(x, y);
  return (now.surface && now.surface.id) || now.id;
};
for (const wetness of [0, 0.8]) {
  Wx.startWeather({ mode: 'dry', season: 2, seed: 1 });
  Wx.setWetness(wetness);
  wear.clearWear();
  let clock = 1e6;
  console.log(`wetness ${wetness}${sandDig ? ' (?sanddig=1)' : ''}`);
  for (const id of IDS) {
    const points = POINTS[id], depths = [], left = {};
    for (let pass = 1; pass <= 10; pass++) {
      for (const [x, y] of points) wear.recordWearAt(x, y, null, (clock += 1000));
      if ([1, 3, 6, 10].includes(pass)) {
        const mean = points.reduce((sum, [x, y]) => sum + wear.rutAt(x, y), 0) / points.length;
        depths.push(`${pass}:${(mean * 100).toFixed(1)}`);
      }
    }
    for (const [x, y] of points) left[surfaceAt(x, y)] = (left[surfaceAt(x, y)] || 0) + 1;
    console.log(`  ${id.padEnd(8)} (${points.length}) dent cm after passes ${depths.join(' ')}`
      + `  left ${JSON.stringify(left)}`);
  }
}
