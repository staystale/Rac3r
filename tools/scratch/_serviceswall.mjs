// _serviceswall.mjs - DOES A WALL CROSS A SERVICES' WAY IN? (the walled road, owner 11-11: "Petrol
// station on walled levels has a wall blocking its entrance"): the road (ROAD, SCENERY) driven KM
// headless; for every services, each 'wall' barrier segment within 400 m tested against the side
// road's lanes (crossing its centre line) and the yard's forecourt zones (inside them), and a car
// steered along the side road from its start into the yard: its wall hits.
// [ROAD=walled] [SCENERY=countryside] [SEED=4242] [ROADPARITY=1] node tools/scratch/_serviceswall.mjs [km]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import * as hw from '../../src/highway.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp, barrierClamp } from '../../src/world/barriers.ts';
import { insidePolygon } from '../../src/world/zones.ts';
const KM = +(process.argv[2] || 6);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
level.seed = +(process.env.SEED || 4242);
hw.setHighwayPreset(level, process.env.ROAD || 'walled', process.env.SCENERY || 'countryside');
hw.resetHighway(level);
const crosses = (a, b, c, d) => {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
};
const seen = new Set(), report = [];
function survey() {
  for (const hall of level.props) {
    if (hall.kind !== 'services' || seen.has(hall)) continue;
    seen.add(hall);
    const near = (item) => Math.abs((item._s ?? 0) - hall._s) < 400;
    const lanes = level.lanes.filter((lane) => near(lane) && lane.width < 7.5);
    const walls = level.barriers.filter((bar) => bar.kind === 'wall' && near(bar));
    const yards = level.zones.filter((zone) => zone.poly && near(zone)
      && Math.hypot(zone.x - hall.x, zone.y - hall.y) < 80);
    let laneHits = 0, yardHits = 0;
    for (const wall of walls) for (let i = 0; i + 1 < wall.pts.length; i++) {
      for (const lane of lanes) for (let j = 0; j + 1 < lane.pts.length; j++)
        if (crosses(wall.pts[i], wall.pts[i + 1], lane.pts[j], lane.pts[j + 1])) { laneHits++; if (process.env.WHERE) { const pts = level._hw.pts; let k = 0; for (let n = 0; n < pts.length; n++) if (Math.hypot(pts[n].x - wall.pts[i][0], pts[n].y - wall.pts[i][1]) < Math.hypot(pts[k].x - wall.pts[i][0], pts[k].y - wall.pts[i][1])) k = n; console.log('  wall _s', Math.round(wall._s), 'seg', i, '/', wall.pts.length - 1, 'near road pt', k, 's', Math.round(pts[k].s), 'sideOff', pts[k].sideOff?.toFixed(1), 'gapL', pts[k].gapL, '| lane _s', Math.round(lane._s), 'width', lane.width, 'dressed', level._hw.dressed, 'len', pts.length); } }
      for (const yard of yards)
        if (insidePolygon(yard.poly, (wall.pts[i][0] + wall.pts[i + 1][0]) / 2,
          (wall.pts[i][1] + wall.pts[i + 1][1]) / 2)) yardHits++;
    }
    report.push(`services @${Math.round(hall._s)}: ${walls.length} walls, ${lanes.length} side`
      + ` lanes, ${yards.length} yard zones; wall segments across a lane ${laneHits}, inside a`
      + ` yard ${yardHits}`);
  }
}
const car = makeCar('hatch-rwd');
reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
let sub = level.subtrack, driver = createAutoDriver(sub), time = 0;
while ((level._hw.driven || 0) < KM * 1000 && time < KM * 200) {
  if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  time += PHYSICS_STEP_SECONDS;
  solidClamp(car);
  if (hw.stepHighway(level, car, L.querySubtrack(sub, car.x, car.y).trackDist)) survey();
}
survey();
console.log(report.join('\n') || 'no services');
void barrierClamp;
