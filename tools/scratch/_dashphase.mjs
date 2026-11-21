// _dashphase.mjs - THE HIGHWAY'S LANE DASHES' PHASE (render/road.ts drawLaneDashes: the canvas dash
// pattern, 3 m on / 6 m off, offset by sub.sBase): the dash pattern runs along the STROKED line's
// own length from the window's first road point, at the lane line's offset - longer or shorter
// than the road's distance on a bend. A ground tile is painted once and kept (render/tiles.ts), so
// a spot's dashes are the phase of the window it was painted in. In node (as tools/worldhash.mjs
// drives the road): spots every 50 m, each one's dash phase (m into the 9 m pattern) in every
// window that holds it, for each lane line; how far it moves from window to window (wrapped to
// +-4.5 m) - 0 means the dashes in two tiles painted at different times line up. Then ?dashphase's
// way (render/lanedash.ts: a dash wherever the road's absolute distance is in the first 3 m of 9):
// where a dash's start lands in the world in each window (the road resampled each time) - how far
// it moves from window to window, m.
// node tools/scratch/_dashphase.mjs [road:scenery,...] [km]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';

const cases = (process.argv[2] || 'twisty:canyon,motorway:canyon,motorway:countryside,'
  + 'twisty:countryside').split(',').map((one) => one.split(':'));
const KM = +(process.argv[3] || 6);
const PATTERN_M = 9;

/**
 * The dash phase at road distance `at` on lane line `off` in the window now: the stroked length
 * from the first point to `at`, plus sBase, into the pattern.
 * @param sub the subtrack
 * @param off the line's offset, m
 * @param at the spot's road distance (absolute), m
 * @returns the phase, m, or null when the spot is not in the window
 */
function phaseAt(sub, off, at) {
  const pts = sub.pts, local = at - (sub.sBase || 0);
  if (local < 0 || local > pts[pts.length - 1].dist) return null;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], point = pts[i];
    const step = Math.hypot(point.x + point.nx * off - prev.x - prev.nx * off,
      point.y + point.ny * off - prev.y - prev.ny * off);
    if (point.dist >= local) {
      const share = (local - prev.dist) / Math.max(1e-9, point.dist - prev.dist);
      length += step * share;
      return (((sub.sBase || 0) + length) % PATTERN_M + PATTERN_M) % PATTERN_M;
    }
    length += step;
  }
  return null;
}

/**
 * ?dashphase: the world spot of the dash starting at absolute road distance `at` on lane line
 * `off` in the window now (as render/lanedash.ts lays it: along the piece of road it falls in).
 * @param sub the subtrack
 * @param off the line's offset, m
 * @param at the dash's start (absolute), m
 * @returns { x, y }, or null when the spot is not in the window
 */
function dashSpot(sub, off, at) {
  const pts = sub.pts, local = at - (sub.sBase || 0);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], point = pts[i];
    if (point.dist < local || prev.dist > local) continue;
    const share = (local - prev.dist) / Math.max(1e-9, point.dist - prev.dist);
    return { x: prev.x + prev.nx * off + (point.x + point.nx * off - prev.x - prev.nx * off) * share,
      y: prev.y + prev.ny * off + (point.y + point.ny * off - prev.y - prev.ny * off) * share };
  }
  return null;
}

for (const [road, scenery] of cases) {
  const level = createHighway(4242, road);
  setHighwayPreset(level, road, scenery);
  L.LEVELS.push(level);
  L.setLevel('highway');
  resetHighway(level);
  const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 };
  const last = new Map(), moves = [], lastSpot = new Map(), spotMoves = [];
  let shifts = 0;
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(level, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    if (!stepHighway(level, car)) continue;
    shifts++;
    const sub = level.subtrack;
    // the spots within 300 m of the car (the tiles round it)
    for (let at = Math.ceil((dist - 300) / 50) * 50; at <= dist + 300; at += 50)
      for (const off of sub.laneDash) {
        const phase = phaseAt(sub, off, at), key = `${at}:${off}`;
        if (phase === null) continue;
        if (last.has(key)) {
          let move = phase - last.get(key);
          move -= PATTERN_M * Math.round(move / PATTERN_M);
          moves.push(Math.abs(move));
        }
        last.set(key, phase);
        const spot = dashSpot(sub, off, at - (at % PATTERN_M));
        if (!spot) continue;
        if (lastSpot.has(key)) spotMoves.push(Math.hypot(spot.x - lastSpot.get(key).x,
          spot.y - lastSpot.get(key).y));
        lastSpot.set(key, spot);
      }
  }
  L.LEVELS.pop();
  moves.sort((a, b) => a - b);
  const pick = (share) => (moves.length ? moves[Math.floor(share * (moves.length - 1))] : 0);
  const over = (metres) => moves.filter((move) => move > metres).length;
  console.log(`${road}:${scenery}  ${KM} km, ${shifts} window moves, ${moves.length} spot moves: `
    + `phase move median ${pick(0.5).toFixed(2)} m, p95 ${pick(0.95).toFixed(2)}, worst `
    + `${pick(1).toFixed(2)} m; over 0.5 m ${over(0.5)}, over 1.5 m ${over(1.5)}`);
  spotMoves.sort((a, b) => a - b);
  console.log(`  ?dashphase: a dash start's world spot moved median `
    + `${(spotMoves[Math.floor(0.5 * (spotMoves.length - 1))] || 0).toFixed(3)} m, worst `
    + `${(spotMoves[spotMoves.length - 1] || 0).toFixed(3)} m over ${spotMoves.length}`);
}
