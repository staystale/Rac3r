// _shrails.mjs - Slidden Hill's rails seen on the aerial photographs, as lines offset from the OSM
// pieces (real m): the barrier stands about OFF m out from the road's centre on the side named.
// Prints them for the spec (spec.railsSeen) and each piece's turn (+ left, - right).
import { SLIDDEN_HILL_VENUE as V } from '../../src/world/levels/venues/slidden-hill.ts';
const OFF = 14;
const piece = (name) => V.pieces.find((entry) => entry.name === name).pts;
// side: +1 left of the driving direction, -1 right
const offset = (pts, side) => pts.map(([x, y], i) => {
  const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
  const len = Math.hypot(bx - ax, by - ay) || 1, nx = (by - ay) / len, ny = -(bx - ax) / len;
  return [+(x + nx * side * OFF).toFixed(1), +(y + ny * side * OFF).toFixed(1)];
});
const turn = (pts) => {
  let sum = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    sum += Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }
  return (sum * 180 / Math.PI).toFixed(0);
};
for (const name of ['Pilgrims 2', 'Chessons Drift', 'Dover Slope', 'Devils Elbow', 'North Bend', 'Paddock Bend'])
  console.log(name, 'turn (screen, + = right)', turn(piece(name)));
// the outsides (+1 left of the driving direction: the outside of a right-hander) and the line
// between the start straight and the gravel run back (the old level's start wall)
const lines = [
  offset([...piece('Pilgrims 2'), ...piece('Chessons Drift').slice(1), ...piece('Dover Slope').slice(1),
    ...piece('Dover Slope 2').slice(1)], 1),
  offset(piece('Devils Elbow'), -1),
  offset(piece('North Bend'), 1),
  offset([...piece('Paddock Bend'), ...piece('Paddock Bend 2').slice(1)], 1),
  offset(piece('way 265305396'), 1),
];
for (const line of lines) console.log(JSON.stringify(line) + ',');
