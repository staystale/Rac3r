// _holdshoulder.mjs - (1) NO ONCOMING TRAFFIC BEFORE THE START on a single carriageway
// (?holdoncoming=1): Deaf Valley's traffic stepped round a still player, held for 8 s (the
// lights), then released for 20 s - the other way's cars live, and the nearest one's distance,
// each phase. (2) WHERE A RESET PUTS YOU (?shoulder=1): each road type's put-back (the guard's,
// an AI's) - its offset across the road against the hard shoulder's and the lanes'.
// [HOLDONCOMING=1] [SHOULDER=1] node tools/scratch/_holdshoulder.mjs
import * as L from '../../src/lab.ts';
import * as H from '../../src/highway.ts';
import { hwPutBack } from '../../src/highwayrace.ts';
import { makeCar, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { createTraffic } from '../../src/traffic.ts';
H.addHighwayLevel();
const lv = H.createHighway(4242, 'canyon'); lv.id = 'hold'; L.LEVELS.push(lv); L.setLevel(lv.id);
const me = makeCar('saloon-rwd');
const sp = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s;
const pose = H.roadPose(lv, sp, lv._hw.geo.centres[0]);
Object.assign(me, { x: pose.x, y: pose.y, heading: pose.h, vx: 0, vy: 0 });
H.stepHighway(lv, me);
const tr = createTraffic(); tr.reset(lv, 0.6);
const theirs = () => tr.list.filter((slot) => !slot.parked && (slot.dir ?? 1) < 0);
const report = (name) => {
  const near = Math.min(...theirs().map((slot) => Math.abs(slot.s - sp)));
  console.log(`  ${name}: the other way's live ${theirs().length}, nearest ${Number.isFinite(near)
    ? near.toFixed(0) + ' m' : '-'}`);
};
console.log('Deaf Valley, traffic 0.6:');
report('at the reset');
let most = 0;
for (let t = 0; t < 8; t += DT) {
  tr.step(DT, { player: me, others: [], held: true });
  most = Math.max(most, theirs().length);
}
report(`after 8 s held (most live while held ${most})`);
for (let t = 0; t < 20; t += DT) tr.step(DT, { player: me, others: [] });
report('after 20 s racing');
console.log('the put-backs, m across the road (- = left):');
for (const preset of ['motorway', 'interstate', 'dual', 'walled', 'canyon']) {
  const road = H.createHighway(4242, preset); road.id = 'pb-' + preset; L.LEVELS.push(road);
  L.setLevel(road.id);
  const car = makeCar('saloon-rwd'), start = H.roadPose(road, 300, road._hw.geo.centres[0]);
  Object.assign(car, { x: start.x, y: start.y, heading: start.h, vx: 0, vy: 0 });
  H.stepHighway(road, car);
  road._hw.best = road._hw.pts[0].s + 400;
  const guard = H.highwayRespawn(road), back = hwPutBack(road, 380, []);
  const across = (p) => H.roadFrame(road, p.x, p.y, null)?.off;
  const geo = road._hw.geo, cfg = road._cfg;
  console.log(`  ${preset.padEnd(10)} guard ${across(guard).toFixed(2)}, AI ${across(back).toFixed(2)}`
    + ` | shoulder ${(-geo.hw).toFixed(2)}..${(-geo.hw + cfg.shoulder).toFixed(2)}, left lane`
    + ` ${geo.centres[0].toFixed(2)}`);
}
