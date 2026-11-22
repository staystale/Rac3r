// _contactscene.mjs - ?contactcost, STAGED (owner-approved 11-22: contact costs by kind in the gap
// picker). One AI driver comes onto Brands' straight at speed; as it reaches the straight, cars
// driven at a set speed straight down the road are placed round it (their place across and speed
// set from its own), one set-up a scene:
//   side   a slower car ahead on its line; a car at its speed alongside, just behind, inside it
//   cutfast  a slower car ahead; a FASTER car 11 m behind in the lane inside
//   cutlevel a slower car ahead; a car at ITS speed 9 m behind in the lane inside (entitled to go)
//   cutnose  a slower car ahead; a car at its speed with its nose at my back wheels, inside
//   rear   a much slower car ahead on its line; a slightly slower one nearer in the lane inside
// Per scene, 8 drivers (traits 1-8 of 8): contacts with the placed cars, the least side gap to the
// car beside (m between bodies), whether it moved over in front of the car behind, the least time to
// reach the slow car ahead, its slowest speed. Headless (the game's driver, vehicle step, contact).
// node tools/scratch/_contactscene.mjs [scenes] [seed]   (CONTACTCOST=1 for the switch)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [scenesArg = 'side,cutfast,cutlevel,cutnose,rear', seedArg = '1'] = process.argv.slice(2);
const seed = +seedArg, N = 8, carId = 'hatch-rwd';
L.setLevel('brands-snatch'); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const wrap = (d) => ((d % total) + total) % total;
// the straightest 250 m of the racing line: the scene starts as the driver reaches it
const line = racingLine(L.LEVEL);
const win = Math.round(250 / line.sp);
let best = 0, bestR = 0;
for (let i = 0; i < line.n; i++) {
  let r = Infinity;
  for (let j = 0; j < win; j++) r = Math.min(r, line.pts[(i + j) % line.n].R);
  if (r > bestR) { bestR = r; best = i; }
}
const startPt = line.pts[best];
const startDist = L.querySubtrack(sub, startPt.x, startPt.y).trackDist;
// a place on the track by distance and offset (+ left), between its points
function placeAt(dist, offset) {
  const d = wrap(dist), pts = sub.pts;
  let i = 0;
  while (i + 1 < pts.length && pts[i + 1].dist <= d) i++;
  const a = pts[i], b = pts[(i + 1) % pts.length];
  const span = (b.dist > a.dist ? b.dist : b.dist + total) - a.dist;
  const k = span > 0 ? (d - a.dist) / span : 0;
  const x = a.x + (b.x - a.x) * k + a.nx * offset, y = a.y + (b.y - a.y) * k + a.ny * offset;
  return { x, y, heading: a.heading };
}
const acrossOf = (q) => q.dist * (q.side === 'left' ? 1 : -1);
// the racing line's place across the track (+ left) by track distance (the placed cars drive it,
// or a set offset from it)
const LINE_AT = line.pts.map((pt) => {
  const q = L.querySubtrack(sub, pt.x, pt.y);
  return { dist: q.trackDist, across: acrossOf(q) };
}).sort((a, b) => a.dist - b.dist);
function lineAcross(dist) {
  const d = wrap(dist);
  let near = LINE_AT[0];
  for (const pt of LINE_AT) if (Math.abs(pt.dist - d) < Math.abs(near.dist - d)) near = pt;
  return near.across;
}
// the placed cars per scene: m ahead of the driver, m across from it (+ toward the middle), m/s
// from its speed
const SCENES = {
  side: [{ role: 'slow', fwd: 35, lat: 0, dv: -10 }, { role: 'beside', fwd: -3, lat: 3.0, dv: 0 }],
  cutfast: [{ role: 'slow', fwd: 40, lat: 0, dv: -8 }, { role: 'behind', fwd: -11, lat: 3.5, dv: 5 }],
  cutlevel: [{ role: 'slow', fwd: 40, lat: 0, dv: -8 }, { role: 'behind', fwd: -9, lat: 3.5, dv: 0 }],
  cutnose: [{ role: 'slow', fwd: 40, lat: 0, dv: -8 }, { role: 'behind', fwd: -5, lat: 3.5, dv: 0 }],
  rear: [{ role: 'slow', fwd: 50, lat: 0, dv: -15 }, { role: 'near', fwd: 22, lat: 3.5, dv: -4 }],
};
function runOne(scene, index) {
  const me = makeCar(carId); me.spec = { ...me.spec, id: carId + '#me' };
  const p0 = placeAt(startDist - 260, 0);
  reset(me, p0.x, p0.y, p0.heading);
  const drv = createAIDriver(L.LEVEL, aiTraits(2, index, N, seed));
  me.mods.power *= drv.traits.power ?? 1;
  const placed = [];
  const res = { contacts: 0, sideGap: Infinity, cutIn: false, ttc: Infinity, minV: Infinity,
    vAt: 0, touched: new Set(), moved: 0 };
  let t0 = null, myDist0 = 0, across0 = 0, inward = 1;
  for (let t = 0; t < 40; t += DT) {
    const cars = [...placed.map((c) => c.car)];
    L.applyGround(me, DT);
    const u = drv.drive(me, DT, { cars, lap: 1, laps: 9 });
    step(me, u, DT); L.barrierClamp(me); L.solidClamp(me);
    const q = L.querySubtrack(sub, me.x, me.y);
    const v = Math.hypot(me.vx, me.vy);
    let ahead = wrap(q.trackDist - startDist); if (ahead > total / 2) ahead -= total;
    if (t0 === null && ahead >= 0) {
      t0 = t; myDist0 = q.trackDist; across0 = acrossOf(q); res.vAt = v;
      inward = lineAcross(myDist0 + 40) > 0 ? -1 : 1;
      for (const spec of SCENES[scene]) {
        const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + spec.role };
        reset(car, me.x, me.y, me.heading);
        placed.push({ ...spec, car, v: Math.max(5, v + spec.dv) });
      }
    }
    if (t0 === null) continue;
    const since = t - t0;
    if (since > 8) break;
    for (const c of placed) {
      const along = myDist0 + c.fwd + c.v * since;
      const at = placeAt(along, lineAcross(along) + inward * c.lat);
      Object.assign(c.car, { x: at.x, y: at.y, heading: at.heading, yawRate: 0,
        vx: c.v * Math.cos(at.heading), vy: c.v * Math.sin(at.heading) });
      const dx = c.car.x - me.x, dy = c.car.y - me.y;
      const fwd = dx * Math.cos(me.heading) + dy * Math.sin(me.heading);
      const side = Math.abs(-dx * Math.sin(me.heading) + dy * Math.cos(me.heading));
      if (c.role !== 'slow' && Math.abs(fwd) < me.spec.len) {
        res.sideGap = Math.min(res.sideGap, side - me.spec.wid);
      }
      if (c.role === 'slow' && fwd > me.spec.len && v > c.v) {
        res.ttc = Math.min(res.ttc, (fwd - me.spec.len) / (v - c.v));
      }
      // (in front of it: it is behind me, within 12 m, and we overlap across)
      if (c.role === 'behind' && fwd < 0 && fwd > -12 && side < me.spec.wid + 0.3) res.cutIn = true;
      const hit = Math.hypot(dx, dy) < 7 && carContact(me, c.car);
      if (hit) res.touched.add(c.role);
    }
    res.minV = Math.min(res.minV, v);
    if (since <= 2) res.moved = (acrossOf(q) - lineAcross(q.trackDist)) * inward;
  }
  res.contacts = res.touched.size;
  return res;
}
const on = process.env.CONTACTCOST === '1';
for (const scene of scenesArg.split(',')) {
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(runOne(scene, i));
  const sum = (key) => rows.reduce((all, row) => all + row[key], 0);
  const least = (key) => Math.min(...rows.map((row) => row[key]));
  const fmt = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  console.log(`${scene.padEnd(8)} contactcost=${on ? 1 : 0} seed ${seed}: cars touched ${sum('contacts')} (${['slow', 'beside', 'behind', 'near'].map((role) => role + ' ' + rows.filter((row) => row.touched.has(role)).length).join(', ')})`
    + ` | moved in front of the car behind ${rows.filter((row) => row.cutIn).length} of ${N}`
    + ` | least side gap ${fmt(least('sideGap'))} m (each: ${rows.map((row) => fmt(row.sideGap)).join(' ')})`
    + ` | m off the line toward the middle at 2 s: ${rows.map((row) => row.moved.toFixed(1)).join(' ')}`
    + ` | least time to the slow car ${fmt(least('ttc'))} s | slowest ${(least('minV') * 3.6).toFixed(0)} km/h`
    + ` (from ${(rows[0].vAt * 3.6).toFixed(0)})`);
}
