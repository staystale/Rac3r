// _passscene.mjs - ONE DRIVER PASSING ONE CAR (measure only; the owner's "go round earlier /
// wider", 11-22). One AI driver comes onto Brands' straight at speed; as it reaches the straight
// one car is placed ahead of it, driven at a set speed down the racing line (or a set offset from
// it - the line sweeps about 8 m across this straight). Scenes:
//   slow15far        a car 15 m/s slower, on the line, 120 m ahead
//   slow15near       a car 15 m/s slower, on the line, 50 m ahead
//   stopped-on-line  a stopped car on the line, 70 m ahead
//   stopped-far      a stopped car on the line, 120 m ahead (where the line has swept across)
//   stopped-off-line a stopped car 2.5 m off the line (toward the middle), 70 m ahead
//   slow-off-line    a car 15 m/s slower, 2.5 m off the line, 50 m ahead
// Per scene, 8 drivers (traits 1-8 of 8): START - where the move round begins (its dodge first
// 0.3 m off the line: m to the car, and s at the closing speed); KM/H LOST - its speed as the move
// begins (or, with no move, 3 s before passing) less its slowest until 0.5 s after passing; RE-HOLDS - times the stopped-car brake
// (ai/stopDodge.ts) sets the speed again after letting go; BRAKE PULSES - the brake pressed past
// 0.3 anew; S TO PASS - until the car is 6 m behind; CONTACTS - drivers that touched it.
// Headless (the game's driver, vehicle step and contact). Switches as the node tools read them.
// node tools/scratch/_passscene.mjs [scenes] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');

const ALL = 'slow15far,slow15near,stopped-on-line,stopped-far,stopped-off-line,slow-off-line';
const [scenesArg = ALL, seedArg = '1'] = process.argv.slice(2);
const seed = +seedArg, DRIVERS = 8, carId = 'hatch-rwd';
// the placed car: m ahead, m off the line toward the middle, m/s from the driver's speed
const SCENES = {
  slow15far: { fwd: 120, off: 0, dv: -15 },
  slow15near: { fwd: 50, off: 0, dv: -15 },
  'stopped-on-line': { fwd: 70, off: 0, dv: -999 },
  'stopped-far': { fwd: 120, off: 0, dv: -999 },
  'stopped-off-line': { fwd: 70, off: 2.5, dv: -999 },
  'slow-off-line': { fwd: 50, off: 2.5, dv: -15 },
};
// the move's start: the dodge this far off the line, m; passed: the car this far behind, m
const START_M = 0.3, PASSED_M = 6;

L.setLevel('brands-snatch'); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const wrap = (dist) => ((dist % total) + total) % total;
const acrossOf = (hit) => hit.dist * (hit.side === 'left' ? 1 : -1);
// the straightest 250 m of the racing line: the scene begins as the driver reaches it
const line = racingLine(L.LEVEL);
const windowPts = Math.round(250 / line.sp);
let best = 0, bestR = 0;
for (let i = 0; i < line.n; i++) {
  let radius = Infinity;
  for (let j = 0; j < windowPts; j++) radius = Math.min(radius, line.pts[(i + j) % line.n].R);
  if (radius > bestR) { bestR = radius; best = i; }
}
const startDist = L.querySubtrack(sub, line.pts[best].x, line.pts[best].y).trackDist;
// the racing line's place across the track (+ left) by track distance
const LINE_AT = line.pts.map((pt) => {
  const hit = L.querySubtrack(sub, pt.x, pt.y);
  return { dist: hit.trackDist, across: acrossOf(hit) };
});
function lineAcross(dist) {
  const at = wrap(dist);
  let near = LINE_AT[0];
  for (const pt of LINE_AT) if (Math.abs(pt.dist - at) < Math.abs(near.dist - at)) near = pt;
  return near.across;
}
// a place on the track by distance and offset (+ left), between its points
function placeAt(dist, offset) {
  const at = wrap(dist), pts = sub.pts;
  let i = 0;
  while (i + 1 < pts.length && pts[i + 1].dist <= at) i++;
  const from = pts[i], to = pts[(i + 1) % pts.length];
  const span = (to.dist > from.dist ? to.dist : to.dist + total) - from.dist;
  const share = span > 0 ? (at - from.dist) / span : 0;
  return { x: from.x + (to.x - from.x) * share + from.nx * offset,
    y: from.y + (to.y - from.y) * share + from.ny * offset, heading: from.heading };
}

function runOne(scene, index) {
  const me = makeCar(carId); me.spec = { ...me.spec, id: carId + '#me' };
  const p0 = placeAt(startDist - 260, 0);
  reset(me, p0.x, p0.y, p0.heading);
  const drv = createAIDriver(L.LEVEL, aiTraits(2, index, DRIVERS, seed));
  me.mods.power *= drv.traits.power ?? 1;
  const res = { startM: null, startS: null, vIn: 0, vLow: Infinity, holds: 0, pulses: 0,
    passS: null, touched: false };
  let other = null, t0 = null, myDist0 = 0, inward = 1, held = false, braking = false;
  for (let t = 0; t < 40; t += DT) {
    L.applyGround(me, DT);
    const controls = drv.drive(me, DT, { cars: other ? [other.car] : [], lap: 1, laps: 9 });
    step(me, controls, DT); L.barrierClamp(me); L.solidClamp(me);
    const hit = L.querySubtrack(sub, me.x, me.y);
    const speed = Math.hypot(me.vx, me.vy);
    let ahead = wrap(hit.trackDist - startDist); if (ahead > total / 2) ahead -= total;
    if (t0 === null && ahead >= 0) {
      t0 = t; myDist0 = hit.trackDist; res.vIn = speed;
      inward = lineAcross(myDist0 + 40) > 0 ? -1 : 1;
      const spec = SCENES[scene];
      const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#placed' };
      reset(car, me.x, me.y, me.heading);
      other = { ...spec, car, v: Math.max(0, speed + spec.dv) };
    }
    if (t0 === null) continue;
    const since = t - t0;
    if (since > 10 || (res.passS !== null && since > res.passS + 0.5)) break;
    const along = myDist0 + other.fwd + other.v * since;
    const at = placeAt(along, lineAcross(along) + inward * other.off);
    Object.assign(other.car, { x: at.x, y: at.y, heading: at.heading, yawRate: 0,
      vx: other.v * Math.cos(at.heading), vy: other.v * Math.sin(at.heading) });
    let toCar = wrap(along - hit.trackDist); if (toCar > total / 2) toCar -= total;
    const st = drv.state;
    if (res.startM === null && Math.abs(st.dodge) >= START_M) {
      res.startM = toCar;
      res.startS = toCar / Math.max(0.1, speed - other.v);
      res.vRef = speed;
    }
    if (res.vRef === undefined && toCar / Math.max(0.1, speed - other.v) < 3) res.vRef = speed;
    const nowHeld = st.followWhy === 'stopped' && !!st.capBinds;
    if (nowHeld && !held) res.holds++;
    held = nowHeld;
    if (controls.brake > 0.3 && !braking) res.pulses++;
    braking = controls.brake > 0.3;
    if (res.vRef !== undefined) res.vLow = Math.min(res.vLow, speed);
    if (res.passS === null && toCar < -PASSED_M) res.passS = since;
    if (Math.hypot(other.car.x - me.x, other.car.y - me.y) < 7 && carContact(me, other.car)) {
      res.touched = true;
    }
  }
  return res;
}

const range = (list, digits = 0) => {
  const real = list.filter((x) => x !== null && Number.isFinite(x));
  if (!real.length) return '-';
  const low = Math.min(...real), high = Math.max(...real);
  return low === high ? low.toFixed(digits) : `${low.toFixed(digits)}-${high.toFixed(digits)}`;
};
console.log(`brands-snatch, seed ${seed}, ${DRIVERS} drivers a scene; ranges over the drivers`);
console.log('scene            | start m  | start s   | km/h lost | re-holds | pulses | s to pass'
  + ' | contacts');
for (const scene of scenesArg.split(',')) {
  const rows = [];
  for (let i = 0; i < DRIVERS; i++) rows.push(runOne(scene, i));
  const started = rows.filter((row) => row.startM !== null).length;
  console.log(`${scene.padEnd(16)} | ${range(rows.map((row) => row.startM)).padEnd(8)} | `
    + `${range(rows.map((row) => row.startS), 1).padEnd(9)} | `
    + `${range(rows.map((row) => (row.vRef - row.vLow) * 3.6)).padEnd(9)} | `
    + `${range(rows.map((row) => Math.max(0, row.holds - 1))).padEnd(8)} | `
    + `${range(rows.map((row) => row.pulses)).padEnd(6)} | `
    + `${range(rows.map((row) => row.passS), 1).padEnd(9)} | `
    + `${rows.filter((row) => row.touched).length} of ${DRIVERS}`
    + (started < DRIVERS ? ` (${DRIVERS - started} never moved off the line)` : ''));
}
