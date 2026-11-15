// _hwbarrelwhere.mjs - WHERE EACH CRASH-CUSHION CLUSTER STANDS AGAINST THE BARRIERS (TODO 3a2 item
// 13, ?hwbarrels=1): drives KM of each road like _hwbarrelcount.mjs and, once the road 150 m past a
// cluster is dressed (every barrier round it laid), sorts it: AT AN END - a barrier's end within
// 2.5 m of its back row, the barrier running on away from the cluster (what the owner wants);
// ALONGSIDE - a barrier within 2.5 m of a barrel without an end there; FREE - no barrier within
// 2.5 m. Prints the counts and the first few of each wrong kind (road distance, offset, what).
// [KM=20] [ROADS=..] [SCENERIES=..] HWBARRELS=1 node tools/scratch/_hwbarrelwhere.mjs
import * as L from '../../src/lab.ts';
import { addHighwayLevel, resetHighway, stepHighway, roadPose, roadFrame, setHighwayPreset }
  from '../../src/highway.ts';

addHighwayLevel();
const KM = +(process.env.KM || 20);
const ROADS = (process.env.ROADS || 'motorway,interstate,dual,walled,twisty').split(',');
const SCENERIES = (process.env.SCENERIES || 'countryside,canyon').split(',');
const NEAR_M = 2.5, SETTLE_M = 150;

/** Nearest distance from a point to a polyline, and whether that nearest is one of its ends. */
function nearestOn(pts, x, y) {
  let best = Infinity, atEnd = false;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k], dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const raw = ((x - ax) * dx + (y - ay) * dy) / len2, share = Math.max(0, Math.min(1, raw));
    const dist = Math.hypot(ax + dx * share - x, ay + dy * share - y);
    if (dist < best) {
      best = dist;
      atEnd = (k === 1 && raw <= 0.02) || (k === pts.length - 1 && raw >= 0.98);
    }
  }
  return { dist: best, atEnd };
}

/** Sorts one cluster by the barriers round it. */
function sortCluster(lv, cluster) {
  let alongside = null, atEnd = null;
  for (const barrel of cluster) for (const barrier of lv.barriers) {
    const near = nearestOn(barrier.pts, barrel.x, barrel.y);
    if (near.dist > NEAR_M) continue;
    // (an end is a real end only when no other barrier carries on from it)
    if (near.atEnd) atEnd = barrier.kind;
    else alongside = barrier.kind;
  }
  return alongside ? `alongside ${alongside}` : atEnd ? `at an end of ${atEnd}` : 'free';
}

/** Drives one road in one scenery; returns its line. */
function whereRoad(road, scenery) {
  const lv = L.LEVELS.find((level) => level.id === 'highway');
  L.setLevel('highway');
  setHighwayPreset(lv, road, scenery);
  resetHighway(lv);
  const lane = lv._hw.geo.centres[0], car = { x: lv.spawn.x, y: lv.spawn.y };
  const pending = [], tally = {}, examples = {};
  const take = (list) => {
    let cluster = [];
    for (const obj of list.filter((item) => item.kind === 'cushion')) {
      const last = cluster[cluster.length - 1];
      if (last && Math.hypot(last.x - obj.x, last.y - obj.y) > 3) {
        pending.push(cluster);
        cluster = [];
      }
      cluster.push(obj);
    }
    if (cluster.length) pending.push(cluster);
  };
  take(lv.cones);
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(lv, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    stepHighway(lv, car);
    take(lv._hw.looseNew);
    lv._hw.looseNew.length = 0;
    const dressedS = lv._hw.pts[Math.max(0, lv._hw.dressed - 1)].s;
    while (pending.length && pending[0][0]._s < dressedS - SETTLE_M) {
      const cluster = pending.shift(), kind = sortCluster(lv, cluster);
      const frame = roadFrame(lv, cluster[0].x, cluster[0].y, cluster[0]._s);
      const where = frame && Math.abs(frame.off - (lv._hw.geo.median ?? 99)) < 1.5 ? 'median'
        : 'gore';
      const key = `${where} ${kind}`;
      tally[key] = (tally[key] || 0) + 1;
      (examples[key] ||= []).push(`s ${cluster[0]._s.toFixed(0)} off ${frame?.off.toFixed(1)}`);
    }
  }
  const wrong = Object.entries(examples).filter(([key]) => !key.includes('at an end'))
    .map(([key, list]) => `${key}: ${list.slice(0, 3).join(', ')}`).join(' | ');
  return `${road}/${scenery}: ${JSON.stringify(tally)}${wrong ? '\n    ' + wrong : ''}`;
}

for (const scenery of SCENERIES) for (const road of ROADS) console.log(whereRoad(road, scenery));
