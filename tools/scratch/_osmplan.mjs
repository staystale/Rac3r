// _osmplan.mjs - a raw OpenStreetMap download drawn as a plan (no browser): race roads labelled with
// their way id and name, roads, buildings, stands, woods, water, barriers, in real metres round an
// origin. node tools/scratch/_osmplan.mjs <osm.json> <lat> <lon> <half m> <out.json> [px, 1400]
//   then: powershell -File tools/scratch/_planpng.ps1 <out.json> <out.png>
import fs from 'node:fs';
const [file, lat0, lon0, halfArg, out, pxArg = '1400'] = process.argv.slice(2);
const osm = JSON.parse(fs.readFileSync(file, 'utf8'));
const LAT0 = +lat0, LON0 = +lon0, HALF = +halfArg, PX = +pxArg, Z = PX / (2 * HALF);
const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
const px = ({ lat, lon }) => [Math.round(((lon - LON0) * mLon + HALF) * Z * 10) / 10,
  Math.round((-(lat - LAT0) * mLat + HALF) * Z * 10) / 10];
const cmds = [];
const order = (tags) => tags.natural === 'wood' || tags.landuse === 'forest' ? 0 : tags.natural === 'water' ? 1
  : tags.building || tags.leisure === 'bleachers' ? 2 : tags.highway === 'raceway' ? 4 : 3;
const ways = osm.elements.filter((el) => el.type === 'way' && el.geometry)
  .sort((a, b) => order(a.tags || {}) - order(b.tags || {}));
for (const way of ways) {
  const tags = way.tags || {}, pts = way.geometry.map(px);
  if (tags.natural === 'wood' || tags.landuse === 'forest') cmds.push({ t: 'poly', pts, col: '#8fbf7f' });
  else if (tags.natural === 'water') cmds.push({ t: 'poly', pts, col: '#4f86c6' });
  else if (tags.leisure === 'bleachers') cmds.push({ t: 'poly', pts, col: '#aa00aa' });
  else if (tags.building) cmds.push({ t: 'poly', pts, col: '#777777' });
  else if (tags.natural === 'shingle') cmds.push({ t: 'poly', pts, col: '#e0cf9a' });
  else if (tags.highway === 'raceway') {
    cmds.push({ t: 'line', pts, col: /unpaved|dirt|gravel|ground|compacted/.test(tags.surface || '') ? '#a0522d' : tags.sport === 'karting' ? '#cc8800' : '#222222', w: 10 * Z });
    cmds.push({ t: 'text', at: pts[Math.floor(pts.length / 2)], s: `${way.id} ${tags.name || ''}`, col: '#0000ff' });
  } else if (tags.highway) cmds.push({ t: 'line', pts, col: '#999999', w: 4 * Z });
  else if (tags.barrier === 'guard_rail') cmds.push({ t: 'line', pts, col: '#1e5fd0', w: 2 });
  else if (tags.barrier === 'tyres') cmds.push({ t: 'line', pts, col: '#000000', w: 3 });
  else if (tags.barrier === 'fence' || tags.barrier === 'wall') cmds.push({ t: 'line', pts, col: '#cc00ff', w: 1 });
}
for (let m = -HALF; m <= HALF; m += 100) {
  cmds.push({ t: 'line', pts: [[(m + HALF) * Z, 0], [(m + HALF) * Z, PX]], col: '#f0a0a0', w: 1 });
  cmds.push({ t: 'line', pts: [[0, (m + HALF) * Z], [PX, (m + HALF) * Z]], col: '#f0a0a0', w: 1 });
}
fs.writeFileSync(out, JSON.stringify({ w: PX, h: PX, cmds }));
console.log('wrote', out, cmds.length, 'draw commands');
