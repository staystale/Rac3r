// _stopside.mjs - THE AI STOPS WITH ROOM BESIDE A CRASH (owner 11-22, round189: "AI seemed to stop
// when cars were stopped ahead but there was plenty of room to the side"). Stopped cars are staged
// across ONE HALF of a straight (the other half free) and a field drives up to them; per driver:
// passed or not, the s it spent nearly still before them, and while slow (under 4 m/s, within 80 m)
// a line a 0.5 s of what held it - the follow reason (followWhy: 'stopped' = the stopped-car
// brake, ai/stopDodge.ts), its place and its target across, the hazard's side it goes round on
// (car._hazardMove), the track's usable edge, the reverse's still time (?revstuck).
// Headless (the game's own driver, vehicle step and contact). Read only.
// node tools/scratch/_stopside.mjs [level] [half: left|right] [stopped] [n] [seed]
// (the switches as the node tools read them: HAZARD=1 SOFTBACK=1 BRAKEPEDAL=1 REVSTUCK=1)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [lv = 'brands-snatch', half = 'left', kArg = '3', nArg = '8', seedArg = '1']
  = process.argv.slice(2);
const K = +kArg, N = +nArg, seed = +seedArg, carId = 'hatch-rwd';
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, hwTrack = sub.width / 2;
// the straightest 250 m of the racing line: its middle is where the cars stop
const line = racingLine(L.LEVEL);
const win = Math.round(250 / line.sp);
let best = 0, bestR = 0;
for (let i = 0; i < line.n; i++) {
  let r = Infinity;
  for (let j = 0; j < win; j++) r = Math.min(r, line.pts[(i + j) % line.n].R);
  if (r > bestR) { bestR = r; best = i; }
}
const mid = line.pts[(best + Math.round(win * 0.7)) % line.n];
const atDist = L.querySubtrack(sub, mid.x, mid.y).trackDist;
const wrap = (d) => ((d % total) + total) % total;
// the stopped cars: spread over one half, nose across the road (sign: + is the left)
const sgn = half === 'left' ? 1 : -1;
const stopped = [];
for (let k = 0; k < K; k++) {
  const lat = sgn * (hwTrack - 1.3 - k * (hwTrack - 1.6) / Math.max(1, K - 1));
  const p = L.onTrack(sub, wrap(atDist + k * 5), lat, {});
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#stopped' + k };
  reset(car, p.x, p.y, p.rot + Math.PI / 2);
  stopped.push({ car, lat });
}
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const back = 160 + Math.floor(i / 2) * 9;
  const p = L.onTrack(sub, wrap(atDist - back), (i % 2 ? 1 : -1) * Math.min(2.5, hwTrack - 1.8), {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(2, i, N, seed));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, prog: 0, lastQ: null, still: 0, minV: Infinity, passed: false,
    lastLog: -1, hits: 0, touching: false });
}
const all = () => [...field.map((f) => f.car), ...stopped.map((s) => s.car)];
const freeSide = `the ${half === 'left' ? 'right' : 'left'} half free`;
console.log(`${lv}: ${K} cars stopped across the ${half} half at ${atDist.toFixed(0)} m (track ` +
  `${sub.width.toFixed(1)} m wide; stopped at ${stopped.map((s) => s.lat.toFixed(1)).join(', ')} ` +
  `m off the middle, + left; ${freeSide}); ${N} AI from 160 m back; seed ${seed}`);
const T_END = 45;
globalThis.__AI_WHY = 1;
const fmt = (o) => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v);
for (let t = 0; t < T_END && field.some((f) => !f.passed); t += DT) {
  for (const f of field) {
    const c = f.car;
    L.applyGround(c, DT);
    const u = f.drv.drive(c, DT, { cars: all().filter((o) => o !== c), lap: 1, laps: 9 });
    step(c, u, DT); L.barrierClamp(c); L.solidClamp(c);
    const q = L.querySubtrack(sub, c.x, c.y);
    if (f.lastQ === null) f.lastQ = q.trackDist;
    let dq = q.trackDist - f.lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total;
    f.prog += dq; f.lastQ = q.trackDist;
    let toGo = wrap(atDist - q.trackDist); if (toGo > total / 2) toGo -= total;
    if (toGo < -(K * 5 + 8)) { f.passed = true; continue; }
    const v = Math.hypot(c.vx, c.vy);
    if (toGo > 0 && toGo < 80) {
      f.minV = Math.min(f.minV, v);
      if (v < 1) f.still += DT;
      if ((v < 4 || (process.env.WATCH && +process.env.WATCH === field.indexOf(f) + 1)) && t - f.lastLog >= (process.env.WATCH ? 0.2 : 0.5)) {
        f.lastLog = t;
        const st = f.drv.state;
        const across = q.dist * (q.side === 'left' ? 1 : -1);
        let near = null;
        for (const s of stopped) {
          const d = Math.hypot(s.car.x - c.x, s.car.y - c.y);
          if (!near || d < near.d) near = { d, lat: s.lat };
        }
        console.log(`  #${field.indexOf(f) + 1} t ${t.toFixed(1)} to-go ${toGo.toFixed(1)} m ` +
          `across ${across.toFixed(2)} (nearest stopped ${near.d.toFixed(1)} m away, at ${near.lat.toFixed(1)}) v ${v.toFixed(1)} vT ${st.vT.toFixed(1)} held ` +
          `'${st.followWhy}' cap ${(st.cap ?? NaN).toFixed?.(1)} dodge ${st.dodge.toFixed(2)} ` +
          `hazardSide ${c._hazardMove ?? 0} gapBase ${(st.gapBase ?? NaN).toFixed?.(2)} ` +
          `slowT ${(st.slowT ?? 0).toFixed(1)} outs ${st.nOut ?? 0}`);
        if (!f.noted && st.boxedNote) { f.noted = true; console.log('    boxed: ' + fmt(st.boxedNote)); }
      }
    }
  }
  for (const s of stopped) {
    L.applyGround(s.car, DT);
    step(s.car, { steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0 }, DT);
  }
  const cars = all();
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      if (Math.hypot(cars[a].x - cars[b].x, cars[a].y - cars[b].y) < 7) carContact(cars[a], cars[b]);
    }
  }
}
let passed = 0, stuck = 0;
for (const f of field) {
  if (f.passed) passed++;
  if (f.still > 1) stuck++;
  console.log(`  #${field.indexOf(f) + 1} skill ${f.drv.traits.skill.toFixed(2)}: ` +
    `${f.passed ? 'passed' : 'NOT passed'} | still before them ${f.still.toFixed(1)} s | ` +
    `slowest ${f.minV === Infinity ? '-' : (f.minV * 3.6).toFixed(0)} km/h`);
}
console.log(`  TOTAL passed ${passed} of ${N}; held still over 1 s: ${stuck}`);
