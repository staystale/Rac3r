// _snpx.mjs <aerial: west|east|start> <px,py> ... - aerial photograph pixels (zoom 18 / 19 crops
// stitched by the venue helper) to Snotterton's real frame (m, north up, origin 52.4652, 0.947)
const CROPS = { west: [18, 131753, 86034], east: [18, 131764, 86034] };
const [crop, ...pairs] = process.argv.slice(2);
const [zoom, tx0, ty0] = CROPS[crop] || crop.split(':').map(Number);
const n = 2 ** zoom, LAT0 = 52.4652, LON0 = 0.947, ML = 111320, MO = 111320 * Math.cos(LAT0 * Math.PI / 180);
for (const pair of pairs) {
  const [px, py] = pair.split(',').map(Number), X = tx0 + px / 256, Y = ty0 + py / 256;
  const lon = X / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / n))) * 180 / Math.PI;
  console.log(`${pair} -> [${((lon - LON0) * MO).toFixed(1)}, ${(-(lat - LAT0) * ML).toFixed(1)}]  (${lat.toFixed(6)}, ${lon.toFixed(6)})`);
}
