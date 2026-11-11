// _desertroads.mjs - DEAF VALLEY'S MOTORWAY EXTRAS (?desertroads=1, with ?hwstations=1 and
// ?medianlamps=1): drive KM of a Deaf Valley road headless and list every slip, bridge, services
// and lamp laid (road distance, the stretch it is on), and any rock wall, cactus or litter standing
// on a slip's tarmac, the side road or a services yard.
// [ROAD=motorway] [OFF=1 the switches off] node tools/scratch/_desertroads.mjs [km]
import { FIX } from '../../src/core/fixes.ts';
if (!process.env.OFF) Object.assign(FIX, { desertroads: true, hwstations: true, medianlamps: true,
  desertmore: true });
const { makeCar, reset, step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const { stretchAt } = await import('../../src/highway/desertplan.ts');
const { insidePolygon } = await import('../../src/world/zones.ts');
const KM = +(process.argv[2] || 12), ROAD = process.env.ROAD || 'motorway';
hw.addHighwayLevel();
L.setLevel('highway');
const lv = L.LEVEL;
hw.setHighwayPreset(lv, ROAD, 'canyon');
hw.resetHighway(lv);
const seen = new Set(), found = [], clashes = [];
let lamps = 0;
const nearLine = (line, x, y, half) => {
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9, f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy)
      / l2));
    if (Math.hypot(x - ax - dx * f, y - ay - dy * f) < half) return true;
  }
  return false;
};
function survey() {
  for (const prop of lv.props) {
    if (seen.has(prop)) continue;
    seen.add(prop);
    if (['slip', 'bridge', 'river', 'services', 'station', 'servicehall'].includes(prop.kind)
      || prop.kind?.includes('service'))
      found.push(`${prop.kind}${prop.carries ? ':' + prop.carries : ''}${prop.label ? ' ' + prop.label
        : ''} @${Math.round(prop._s)} (${stretchAt(prop._s, lv._hw.seed).kind})`);
  }
  for (const lamp of lv.lamps) if (!seen.has(lamp)) { seen.add(lamp); lamps++; }
  const rocks = lv.barriers.filter((bar) => bar.kind === 'rock' && bar.band);
  const loose = [...(lv._hw.looseNew || []), ...(lv.cones || [])];
  for (const lane of lv.lanes) {
    if (seen.has(lane)) continue;
    seen.add(lane);
    for (const bar of rocks)
      if (bar.band.some(([x, y]) => nearLine(lane.pts, x, y, lane.width / 2)))
        clashes.push(`rock on lane @${Math.round(lane._s)}`);
    for (const obj of loose)
      if (Math.abs((obj._s ?? 0) - lane._s) < 600 && nearLine(lane.pts, obj.x, obj.y, lane.width / 2))
        clashes.push(`${obj.kind} on lane @${Math.round(obj._s)}`);
    for (const bar of rocks)
      if (lane.pts.some(([x, y]) => insidePolygon(bar.band, x, y)))
        clashes.push(`lane point in rock @${Math.round(lane._s)}`);
  }
}
const car = makeCar('hatch-rwd');
reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0;
survey();
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  t += PHYSICS_STEP_SECONDS;
  solidClamp(car);
  const q = L.querySubtrack(sub, car.x, car.y);
  if (hw.stepHighway(lv, car, q.trackDist)) survey();
}
survey();
console.log(`${ROAD}: driven ${Math.round(lv._hw.driven || 0)} m, lamps laid ${lamps}`);
for (const line of found) console.log('  ' + line);
console.log(`clashes ${clashes.length}`, [...new Set(clashes)].slice(0, 12).join('; '));
