// _hwchevroncount.mjs - THE HIGHWAY'S CHEVRON BOARDS COUNTED (TODO 3a2 item 12): drives KM of each
// road type in each scenery the way tools/worldhash.mjs does (stepHighway every 4 m) and counts the
// chevron boards laid: a km, and how many stand where a lay-by reaches (their side, +-8 m), and the
// bends' tightest radius met. HWCHEVRON=1 for the switch's rule.
// [KM=20] [HWCHEVRON=1] node tools/scratch/_hwchevroncount.mjs
import * as L from '../../src/lab.ts';
import { addHighwayLevel, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
import { bayHere } from '../../src/highway/laybys.ts';

addHighwayLevel();
const KM = +(process.env.KM || 20);
const ROADS = ['motorway', 'interstate', 'dual', 'twisty'];
const SCENERIES = ['countryside', 'canyon'];

/**
 * Drives one road type in one scenery and counts its boards.
 * @param {string} road the road type
 * @param {string} scenery the scenery
 * @returns {string} the line
 */
function countRoad(road, scenery) {
  const lv = L.LEVELS.find((level) => level.id === 'highway');
  L.setLevel('highway');
  setHighwayPreset(lv, road, scenery);
  resetHighway(lv);
  const lane = lv._hw.geo.centres[0], car = { x: lv.spawn.x, y: lv.spawn.y };
  let boards = 0, inBay = 0, inOther = 0, tightest = Infinity;
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(lv, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    stepHighway(lv, car);
    for (const point of lv._hw.pts) {
      if (point.curv) tightest = Math.min(tightest, 1 / Math.abs(point.curv));
    }
    for (const obj of lv._hw.looseNew) {
      if (obj.kind !== 'chevron') continue;
      boards++;
      const at = roadPose(lv, obj._s, 0);
      const side = Math.sign((obj.x - at.x) * -Math.sin(at.h) + (obj.y - at.y) * Math.cos(at.h))
        || -1;
      if ([-8, 0, 8].some((off) => bayHere(lv, obj._s + off, side))) inBay++;
      if ([-8, 0, 8].some((off) => bayHere(lv, obj._s + off, -side))) inOther++;
    }
    lv._hw.looseNew.length = 0;
  }
  return `${road}/${scenery}: ${(boards / KM).toFixed(1)} boards a km (${boards}), ${inBay} in a lay-by on its side (${inOther} the other side),`
    + ` tightest bend R ${Math.round(tightest)} m`;
}

for (const scenery of SCENERIES) for (const road of ROADS) console.log(countRoad(road, scenery));
