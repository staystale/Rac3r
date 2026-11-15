// _hwbarrelcount.mjs - THE HIGHWAY'S CRASH-CUSHION BARRELS COUNTED AND CHECKED (TODO 3a2 item 13,
// ?hwbarrels=1): drives KM of each road type in each scenery the way tools/worldhash.mjs does
// (stepHighway every 4 m) and counts the barrels laid - clusters a km at a slip's nose (gore) and at
// the central reservation's barrier ends (median), barrels a cluster - and every barrel's footprint
// against what it must not stand on: a carriageway's tarmac, a lane (slips, junction roads, lay-by
// and side roads), a barrier, a street light's post, another loose object, a prop's centre within
// 1.5 m. Also counts the slips laid (so a slip without a nose cluster shows).
// [KM=20] HWBARRELS=1 node tools/scratch/_hwbarrelcount.mjs
import * as L from '../../src/lab.ts';
import { addHighwayLevel, resetHighway, stepHighway, roadPose, roadFrame, setHighwayPreset }
  from '../../src/highway.ts';

addHighwayLevel();
const KM = +(process.env.KM || 20);
const ROADS = (process.env.ROADS || 'motorway,interstate,dual,walled,twisty').split(',');
const SCENERIES = (process.env.SCENERIES || 'countryside,canyon').split(',');
const BARREL_R = 0.45;

/** Distance from a point to a polyline. */
function toLine(pts, x, y) {
  let best = Infinity;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k], dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const share = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(ax + dx * share - x, ay + dy * share - y));
  }
  return best;
}

/** Every barrel's footprint checked; returns the problem strings. */
function checkBarrel(lv, obj, others) {
  const out = [], geo = lv._hw.geo, frame = roadFrame(lv, obj.x, obj.y, obj._s);
  if (frame) {
    const off = frame.off, near = (from, to) => off + BARREL_R > from && off - BARREL_R < to;
    if (geo.median == null ? near(-geo.hw, geo.hw) : near(-geo.hw, geo.ownR) || near(geo.oppL, geo.hw))
      out.push(`on the carriageway (off ${off.toFixed(2)})`);
  }
  for (const lane of lv.lanes) if (toLine(lane.pts, obj.x, obj.y) < lane.width / 2 + BARREL_R)
    out.push(`on a lane ${lane.width} m wide`);
  for (const barrier of lv.barriers) if (toLine(barrier.pts, obj.x, obj.y) < BARREL_R + 0.1)
    out.push(`on a ${barrier.kind} barrier`);
  for (const lamp of lv.lamps || []) if (Math.hypot(lamp.x - obj.x, lamp.y - obj.y) < BARREL_R + 0.3)
    out.push('on a street light');
  for (const prop of lv.props) if (prop.kind !== 'slip' && prop.kind !== 'river' && prop.kind !== 'bridge'
    && Math.hypot(prop.x - obj.x, prop.y - obj.y) < 1.5) out.push(`by a ${prop.kind} prop's centre`);
  for (const other of others) if (other !== obj && other.kind !== 'cushion'
    && Math.hypot(other.x - obj.x, other.y - obj.y) < BARREL_R + 0.5) out.push(`on a ${other.kind}`);
  return out;
}

/** Drives one road in one scenery; returns its line. */
function countRoad(road, scenery) {
  const lv = L.LEVELS.find((level) => level.id === 'highway');
  L.setLevel('highway');
  setHighwayPreset(lv, road, scenery);
  resetHighway(lv);
  const lane = lv._hw.geo.centres[0], car = { x: lv.spawn.x, y: lv.spawn.y };
  let junctions = 0, barrels = 0, gore = 0, median = 0, slips = 0, sides = 0, sizes = {};
  const problems = {}, seenSlips = new Set();
  const take = (list) => {
    const mine = list.filter((obj) => obj.kind === 'cushion');
    barrels += mine.length;
    // a cluster: barrels within 3 m of the one before (laid together)
    let cluster = [];
    const flush = () => {
      if (!cluster.length) return;
      const frame = roadFrame(lv, cluster[0].x, cluster[0].y, cluster[0]._s);
      if (frame && Math.abs(frame.off - (lv._hw.geo.median ?? 99)) < 1.5) median++;
      else gore++;
      sizes[cluster.length] = (sizes[cluster.length] || 0) + 1;
      cluster = [];
    };
    for (const obj of mine) {
      const last = cluster[cluster.length - 1];
      if (last && Math.hypot(last.x - obj.x, last.y - obj.y) > 3) flush();
      cluster.push(obj);
      for (const problem of checkBarrel(lv, obj, list)) problems[problem.replace(/\(.*\)/, '')]
        = (problems[problem.replace(/\(.*\)/, '')] || 0) + 1;
    }
    flush();
  };
  take(lv.cones);
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(lv, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    stepHighway(lv, car);
    if (lv._hw.side && !seenSlips.has(lv._hw.side)) { seenSlips.add(lv._hw.side); sides++; }
    for (const strip of lv.lanes) if (strip.width === 6 && !seenSlips.has('j' + strip._s)) { seenSlips.add('j' + strip._s); junctions++; }
    for (const prop of lv.props) if (prop.kind === 'slip' && prop.label && !seenSlips.has(prop)) {
      seenSlips.add(prop);
      slips++;
    }
    take(lv._hw.looseNew);
    lv._hw.looseNew.length = 0;
  }
  const sizeText = Object.entries(sizes).map(([size, count]) => `${size}:${count}`).join(' ');
  return `${road}/${scenery}: ${barrels} barrels (${(barrels / KM).toFixed(1)} a km), clusters gore ${gore}`
    + ` median ${median}, sizes ${sizeText || '-'}; slips ${slips} + side roads ${sides} + junctions ${junctions};`
    + ` problems ${JSON.stringify(problems)}`;
}

for (const scenery of SCENERIES) for (const road of ROADS) console.log(countRoad(road, scenery));
