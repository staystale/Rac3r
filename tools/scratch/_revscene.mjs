// _revscene.mjs - ?revroom, STAGED (owner 11-22: "if stuck behind a car they don't reverse quick
// enough ... and they also don't reverse enough to steer clear when they go forward n keep getting
// stuck"; "they should reverse quicker rather than resetting"). On Brands' straight one AI driver
// starts from standstill with its nose 0.5 m from a crashed car stopped ACROSS the road on its half
// (by the wall); scenes:
//   wall    just that car ahead (the rest of the road free)
//   boxed   and a second stopped car alongside it on the free side, its nose level with mine
// Per scene 8 drivers (traits 1-8 of 8), 40 s: the s to its first reverse (from the start - the
// drive-out waits 3 s), reverses, the most m backed in one, given up (three in 15 s: the game
// would put it back), freed (past the crashed car) and the s it took, contacts with the stopped
// cars. Headless (the game's driver, vehicle step and contact); switches as node tools read them.
// node tools/scratch/_revscene.mjs [scenes] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');

const [scenesArg = 'wall,boxed', seedArg = '1'] = process.argv.slice(2);
const seed = +seedArg, DRIVERS = 8, carId = 'hatch-rwd', RUN_S = 40;
L.setLevel('brands-snatch'); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, half = sub.width / 2;
const wrap = (dist) => ((dist % total) + total) % total;
// the straightest 250 m of the racing line: the scene is in its middle
const line = racingLine(L.LEVEL);
const windowPts = Math.round(250 / line.sp);
let best = 0, bestR = 0;
for (let i = 0; i < line.n; i++) {
  let radius = Infinity;
  for (let j = 0; j < windowPts; j++) radius = Math.min(radius, line.pts[(i + j) % line.n].R);
  if (radius > bestR) { bestR = radius; best = i; }
}
const midPt = line.pts[(best + Math.round(windowPts / 2)) % line.n];
const crashDist = L.querySubtrack(sub, midPt.x, midPt.y).trackDist;

function runOne(scene, index) {
  const spec = makeCar(carId).spec;
  // the crashed car across the right half, by the wall; me behind it, nose 0.5 m from its side
  const crashLat = -(half - spec.len / 2 - 0.3);
  const crash = makeCar(carId); crash.spec = { ...crash.spec, id: carId + '#crash' };
  const at = L.onTrack(sub, wrap(crashDist), crashLat, {});
  reset(crash, at.x, at.y, at.rot + Math.PI / 2);
  const stopped = [crash];
  const myLat = crashLat + 0.6;
  const me = makeCar(carId); me.spec = { ...me.spec, id: carId + '#me' };
  const mine = L.onTrack(sub, wrap(crashDist - spec.wid / 2 - 0.5 - spec.len / 2), myLat, {});
  reset(me, mine.x, mine.y, mine.rot);
  if (scene === 'boxed') {
    const side = makeCar(carId); side.spec = { ...side.spec, id: carId + '#side' };
    const sideAt = L.onTrack(sub, wrap(crashDist - spec.wid / 2 - 0.5 - spec.len / 2),
      myLat + spec.wid + 0.5, {});
    reset(side, sideAt.x, sideAt.y, sideAt.rot);
    stopped.push(side);
  }
  const drv = createAIDriver(L.LEVEL, aiTraits(2, index, DRIVERS, seed));
  const res = { firstRev: null, revs: 0, backed: 0, gaveUp: false, freedAt: null, touched: 0 };
  let revFrom = null, lastOut = 0;
  const touching = new Set();
  for (let t = 0; t < RUN_S && res.freedAt === null; t += DT) {
    L.applyGround(me, DT);
    const controls = drv.drive(me, DT, { cars: stopped, lap: 1, laps: 9 });
    step(me, controls, DT); L.barrierClamp(me); L.solidClamp(me);
    for (const car of stopped) {
      L.applyGround(car, DT);
      step(car, { steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0 }, DT);
      const hit = Math.hypot(car.x - me.x, car.y - me.y) < 7 && carContact(me, car);
      if (hit && !touching.has(car)) res.touched++;
      if (hit) touching.add(car); else touching.delete(car);
    }
    const st = drv.state;
    if ((st.nOut ?? 0) > lastOut) {
      lastOut = st.nOut; res.revs = lastOut;
      if (res.firstRev === null) res.firstRev = t;
      revFrom = { x: me.x, y: me.y };
    }
    if (revFrom && controls.reverse) {
      res.backed = Math.max(res.backed, Math.hypot(me.x - revFrom.x, me.y - revFrom.y));
    }
    if (st.giveUp) res.gaveUp = true;
    const q = L.querySubtrack(sub, me.x, me.y);
    let past = wrap(q.trackDist - crashDist); if (past > total / 2) past -= total;
    if (past > spec.len + 2) res.freedAt = t;
  }
  return res;
}

const range = (list, digits = 1) => {
  const real = list.filter((x) => x !== null && Number.isFinite(x));
  if (!real.length) return '-';
  const low = Math.min(...real), high = Math.max(...real);
  return low === high ? low.toFixed(digits) : `${low.toFixed(digits)}-${high.toFixed(digits)}`;
};
console.log(`brands-snatch, seed ${seed}, ${DRIVERS} drivers a scene, ${RUN_S} s; ranges over the`
  + ' drivers');
console.log('scene | first reverse s | reverses | most m backed | given up | freed | s to free'
  + ' | touches');
for (const scene of scenesArg.split(',')) {
  const rows = [];
  for (let i = 0; i < DRIVERS; i++) rows.push(runOne(scene, i));
  console.log(`${scene.padEnd(5)} | ${range(rows.map((row) => row.firstRev)).padEnd(15)} | `
    + `${range(rows.map((row) => row.revs), 0).padEnd(8)} | `
    + `${range(rows.map((row) => row.backed)).padEnd(13)} | `
    + `${rows.filter((row) => row.gaveUp).length} of ${DRIVERS} | `
    + `${rows.filter((row) => row.freedAt !== null).length} of ${DRIVERS} | `
    + `${range(rows.map((row) => row.freedAt)).padEnd(9)} | `
    + `${range(rows.map((row) => row.touched), 0)}`);
}
