// _moheights.mjs - Moanaco's lap heights from EU-DEM 25 m (opentopodata.org eudem25m), every STEP real m
// round the mapped lap, written as [x, y, h] real m (scratch)
import fs from 'node:fs';
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const LAT0 = 43.7365, LON0 = 7.4255, ML = 111320, MO = 111320 * Math.cos(LAT0 * Math.PI / 180);
const STEP = 40, line = [];
for (const [name, way] of data.layouts.gp) {
  const piece = data.pieces.find((entry) => entry.name === name);
  const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
  line.push(...(line.length ? pts.slice(1) : pts));
}
const samples = [];
let carry = 0;
for (let i = 0; i + 1 < line.length; i++) {
  const [ax, ay] = line[i], [bx, by] = line[i + 1], len = Math.hypot(bx - ax, by - ay);
  for (let t = carry; t < len; t += STEP) samples.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]);
  carry = (carry - len) % STEP; if (carry < 0) carry += STEP;
}
// and a grid round it (the hills' shape off the lap): every 120 m
for (let x = -450; x <= 500; x += 120) for (let y = -650; y <= 550; y += 120) samples.push([x, y]);
const out = [];
for (let i = 0; i < samples.length; i += 90) {
  const part = samples.slice(i, i + 90);
  const locs = part.map(([x, y]) => `${(LAT0 - y / ML).toFixed(6)},${(LON0 + x / MO).toFixed(6)}`).join('|');
  const res = await fetch(`https://api.opentopodata.org/v1/eudem25m?locations=${locs}`);
  const json = await res.json();
  json.results.forEach((result, k) => out.push([Math.round(part[k][0]), Math.round(part[k][1]), result.elevation]));
  await new Promise((done) => setTimeout(done, 1100));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log(out.length, 'heights; lap min', Math.min(...out.slice(0, 84).map((p) => p[2])), 'max', Math.max(...out.slice(0, 84).map((p) => p[2])));
