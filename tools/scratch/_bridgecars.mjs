// _bridgecars.mjs - THE BRIDGES' TRAFFIC (?bridgecars=1, ai/trafficBridge.ts): the endless road
// (ROAD, SCENERY) with traffic, the autopilot driven until a drivable bridge (a junction's when
// JUNCTION=1) is loaded ahead; then a still stand-in for you is set beside it and the traffic run
// for SECONDS: each bridge car's times over the deck (on its crossing, end to end), its slowest
// and fastest, whether it wrecked or stood stuck, the worst its centre came off its road.
// BRIDGECARS=1 [ROAD=motorway] [SCENERY=countryside] [SEED=4242] [SECONDS=90] node tools/scratch/_bridgecars.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import * as hw from '../../src/highway.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp } from '../../src/world/barriers.ts';
import { createTraffic } from '../../src/traffic.ts';
const SECONDS = +(process.env.SECONDS || 90);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
level.seed = +(process.env.SEED || 4242);
hw.setHighwayPreset(level, process.env.ROAD || 'motorway', process.env.SCENERY || 'countryside');
hw.resetHighway(level);
const traffic = createTraffic();
traffic.reset(level, 0.6);
const pilot = makeCar('hatch-rwd');
reset(pilot, level.spawn.x, level.spawn.y, level.spawn.heading);
let sub = level.subtrack, driver = createAutoDriver(sub), bridge = null;
for (let time = 0; time < 900 && !bridge; time += PHYSICS_STEP_SECONDS) {
  if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
  L.applyGround(pilot, PHYSICS_STEP_SECONDS);
  step(pilot, driver.drive(pilot, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  solidClamp(pilot);
  hw.stepHighway(level, pilot, L.querySubtrack(sub, pilot.x, pilot.y).trackDist);
  traffic.step(PHYSICS_STEP_SECONDS, { player: pilot });
  bridge = level.props.find((prop) => prop.kind === 'bridge' && prop.look === 'venue'
    && (!process.env.JUNCTION || prop.rings) && Math.hypot(prop.x - pilot.x, prop.y - pilot.y) < 500
    && (prop.x - pilot.x) * pilot.vx + (prop.y - pilot.y) * pilot.vy > 0);
}
if (!bridge) { console.log('no bridge reached'); process.exit(1); }
// the stand-in: still on the verge by the bridge
const you = makeCar('hatch-rwd');
reset(you, bridge.x + Math.cos(bridge.rot) * 40, bridge.y + Math.sin(bridge.rot) * 40, 0);
const mine = () => (traffic.cars || []).filter((car) => Math.hypot(car.x - bridge.x,
  car.y - bridge.y) < 250 && car.crossing !== undefined || false);
const stats = new Map();
for (let time = 0; time < SECONDS; time += PHYSICS_STEP_SECONDS) {
  traffic.step(PHYSICS_STEP_SECONDS, { player: you });
  for (const car of traffic.cars) {
    if (Math.hypot(car.x - bridge.x, car.y - bridge.y) > 260) continue;
    const row = stats.get(car) || { crossings: 0, on: false, vMin: 99, vMax: 0, stillT: 0,
      worstStill: 0, rolled: false };
    const speed = Math.hypot(car.vx, car.vy);
    const onDeck = (car.crossing ?? -1) >= 0;
    if (onDeck && !row.on) row.crossings++;
    row.on = onDeck;
    row.vMin = Math.min(row.vMin, speed);
    row.vMax = Math.max(row.vMax, speed);
    row.stillT = speed < 1 ? row.stillT + PHYSICS_STEP_SECONDS : 0;
    row.worstStill = Math.max(row.worstStill, row.stillT);
    if (car.rollAngle && Math.abs(car.rollAngle) > 1) row.rolled = true;
    stats.set(car, row);
  }
}
const isBridgeCar = (car) => Math.abs((car.x - bridge.x) * Math.sin(bridge.rot)
  - (car.y - bridge.y) * Math.cos(bridge.rot)) < 12;
console.log(`bridge at ${Math.round(bridge._s)} m (${bridge.rings ? 'a junction' : 'plain'}),`
  + ` ${SECONDS} s:`);
for (const [car, row] of stats)
  if (row.crossings || isBridgeCar(car))
    console.log(`  ${car.spec.id.split('#')[0].padEnd(12)} over the deck ${row.crossings} times,`
      + ` ${(row.vMin * 3.6).toFixed(0)}-${(row.vMax * 3.6).toFixed(0)} km/h, longest still`
      + ` ${row.worstStill.toFixed(1)} s${row.rolled ? ', ROLLED' : ''}`);
void mine;
