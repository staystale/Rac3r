// _oncomingface.mjs - THE OTHER WAY'S TRAFFIC FACES AND MOVES THE OTHER WAY (?oncoming=1): a
// motorway's traffic stepped 30 s round a scripted player; per car each second, the angle between
// its nose and the road's way, and between its motion and the road's way (ours ~0, theirs ~180).
// ONCOMING=1 node tools/scratch/_oncomingface.mjs [preset]
import * as L from '../../src/lab.ts';
import * as H from '../../src/highway.ts';
import { makeCar } from '../../src/vehicle.ts';
import { createTraffic } from '../../src/traffic.ts';
import { PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
H.addHighwayLevel();
const preset = process.argv[2] || 'motorway';
const lv = H.createHighway(4242, preset); lv.id = 'face'; L.LEVELS.push(lv); L.setLevel(lv.id);
const me = makeCar('saloon-rwd'), C = lv._hw.geo.centres;
let pS = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s;
const place = () => { const p = H.roadPose(lv, pS, C[0]); Object.assign(me, { x: p.x, y: p.y, heading: p.h, vx: Math.cos(p.h) * 30, vy: Math.sin(p.h) * 30 }); };
place(); H.stepHighway(lv, me);
const tr = createTraffic(); tr.reset(lv, 1);
const worst = { 1: { nose: 0, move: 0 }, '-1': { nose: 0, move: 0 } };
const ang = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI;
for (let t = 0; t < 30; t += DT) {
  pS += 30 * DT; place(); H.stepHighway(lv, me);
  tr.step(DT, { player: me, others: [] });
  if (Math.round(t / DT) % 120) continue;
  for (const slot of tr.list) {
    if (slot.parked) continue;
    const f = H.roadFrame(lv, slot.car.x, slot.car.y, slot.s); if (!f) continue;
    const road = Math.atan2(f.dy, f.dx), dir = slot.dir ?? 1, want = dir < 0 ? Math.PI : 0;
    const w = worst[dir], speed = Math.hypot(slot.car.vx, slot.car.vy);
    w.nose = Math.max(w.nose, ang(slot.car.heading - road - want));
    if (speed > 3) w.move = Math.max(w.move, ang(Math.atan2(slot.car.vy, slot.car.vx) - road - want));
  }
}
console.log(preset, 'worst nose / motion off its way, deg: ours', worst[1].nose.toFixed(1), '/',
  worst[1].move.toFixed(1), '| theirs', worst[-1].nose.toFixed(1), '/', worst[-1].move.toFixed(1));
