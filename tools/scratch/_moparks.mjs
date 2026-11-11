// _moparks.mjs - Moanaco's parks and gardens as grass pads (real m): OSM leisure=park / garden and
// landuse=grass (and the woods: natural=wood, landuse=forest) of MIN_M2 and more near the lap, each as its smallest turned rectangle (as
// tools/osmvenue.mjs boxes a building), printed as the spec's pads (scratch)
import fs from 'node:fs';
const osm = JSON.parse(fs.readFileSync('tools/venues/moanaco.osm.json', 'utf8'));
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const LAT0 = 43.7365, LON0 = 7.4255, ML = 111320, MO = 111320 * Math.cos(LAT0 * Math.PI / 180);
const toReal = (node) => [(node.lon - LON0) * MO, -(node.lat - LAT0) * ML];
const MIN_M2 = +(process.env.MIN_M2 || 600), REACH = 140;
const race = data.pieces.flatMap((piece) => piece.pts);
const hull = (points) => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of sorted.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};
const boxOf = (points) => {
  const h = hull(points);
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const [ax, ay] = h[i], [bx, by] = h[(i + 1) % h.length], ang = Math.atan2(by - ay, bx - ax);
    const c = Math.cos(ang), s = Math.sin(ang);
    const us = h.map(([x, y]) => x * c + y * s), vs = h.map(([x, y]) => -x * s + y * c);
    const w = Math.max(...us) - Math.min(...us), hh = Math.max(...vs) - Math.min(...vs);
    if (!best || w * hh < best.area) {
      const mu = (Math.max(...us) + Math.min(...us)) / 2, mv = (Math.max(...vs) + Math.min(...vs)) / 2;
      best = { area: w * hh, x: mu * c - mv * s, y: mu * s + mv * c, w, h: hh, rot: ang };
    }
  }
  return best;
};
const out = [];
for (const way of osm.elements) {
  const tags = way.tags || {};
  if (!(tags.leisure === 'park' || tags.leisure === 'garden' || tags.landuse === 'grass' || tags.natural === 'wood' || tags.landuse === 'forest') || !way.geometry) continue;
  const pts = way.geometry.map(toReal);
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; area += ax * by - bx * ay; }
  if (Math.abs(area / 2) < MIN_M2) continue;
  if (!pts.some(([x, y]) => race.some(([px, py]) => Math.hypot(px - x, py - y) < REACH))) continue;
  const box = boxOf(pts);
  // (a box much bigger than its park - an L-shaped garden - shrunk to the park's area)
  const fill = Math.min(1, Math.sqrt(Math.abs(area / 2) / box.area));
  out.push({ name: tags.name || `${tags.leisure || tags.landuse} ${way.id}`, at: [Math.round(box.x), Math.round(box.y)], w: Math.round(box.w * fill), h: Math.round(box.h * fill), rot: +box.rot.toFixed(2) });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, 'parks');
