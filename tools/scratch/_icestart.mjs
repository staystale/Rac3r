// _icestart.mjs - AI ON AN ICY START (A9, the AI rework R4; owner: AI "on icy starts cannot pull
// away and get reset"). Ice is laid over the whole track from ICE_BACK m behind the start line to
// ICE_AHEAD m past it (wear cells, cover 'ice', as winter lays it); a field of N lines up on it on
// the game's grid and goes at t = 0. Per car: seconds to 10 m/s, metres after 10 s, seconds nearly
// still (under 1 m/s: the game resets after 3), and the mean wheel slip on the ice.
// node tools/scratch/_icestart.mjs [level] [car] [diff] [n] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', nArg = '6', seedArg = '7'] = process.argv.slice(2);
const N = +nArg, seed = +seedArg, ICE_BACK = 40, ICE_AHEAD = 60, RUN_S = 15;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn;
const d0 = L.querySubtrack(sub, sp.x, sp.y).trackDist;
// the ice, over the road's whole width and its verges
let iced = 0;
for (let along = -ICE_BACK; process.env.DRY !== "1" && along <= ICE_AHEAD; along += 0.75) {
  for (let side = -sub.width / 2 - 2; side <= sub.width / 2 + 2; side += 0.75) {
    const p = L.onTrack(sub, ((d0 + along) % total + total) % total, side, {});
    const cell = L.getCell(Math.floor(p.x / L.WEAR_CELL), Math.floor(p.y / L.WEAR_CELL), true);
    if (cell && !cell.fixed && cell.cover !== 'ice') {
      Object.assign(cell, { cover: 'ice', standing: true, dry: 0, scrub: 0, passes: 0, current: 'ice' });
      iced++;
    }
  }
}
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8)), back = 4 + i * 7;
  const p = L.onTrack(sub, ((d0 - back) % total + total) % total, i % 2 ? lat : -lat, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed));
  car.mods.power *= drv.traits.power ?? 1;
  if (process.env.TCS) car.tcsOn = true;   // TCS=1: the game's traction control on every car (a reference)
  field.push({ car, drv, t10: null, still: 0, slip: 0, slipN: 0, x0: car.x, y0: car.y, d10: 0 });
}
const surfaceAt = L.groundSurfaceAt(field[0].car.x, field[0].car.y).id;
for (let t = 0; t < RUN_S; t += DT) {
  for (const f of field) {
    const c = f.car;
    L.applyGround(c, DT);
    const u = f.drv.drive(c, DT, { cars: field.filter((o) => o !== f).map((o) => o.car), lap: 1, laps: 3 });
    step(c, u, DT); L.barrierClamp(c);
    const v = Math.hypot(c.vx, c.vy);
    if (f.t10 === null && v >= 10) f.t10 = t;
    if (t > 1 && v < 1) f.still += DT;
    if (process.env.TRACE && f === field[+process.env.TRACE] && Math.round(t / DT) % 30 === 0 && t < 6) console.log(`    t ${t.toFixed(2)} surf ${c.surface && c.surface.id} thr ${u.throttle.toFixed(2)} brk ${u.brake.toFixed(2)} v ${v.toFixed(2)} wU ${c.wU ? c.wU.map((w) => w.toFixed(1)).join('/') : '-'} tcs ${c.tcsOn} gear ${c.gear} spin ${(c.wheelSpin || 0).toFixed(1)} foot ${(f.drv.state.footK ?? 1).toFixed(2)} vT ${f.drv.state.vT.toFixed(1)} rev ${u.reverse || 0}`);
    if (c.surface && c.surface.id === 'ice' && c.wU) {
      // the driven wheels' slip speed (rear for rwd, front for fwd)
      const driven = (c.spec.drive ?? 0) >= 0.5 ? 0 : 1;
      f.slip += Math.abs(c.wU[driven] - (driven ? c.t.vLong : c.t.vLong)); f.slipN++;
    }
    if (Math.abs(t - 10) < DT / 2) f.d10 = Math.hypot(c.x - f.x0, c.y - f.y0);
  }
}
console.log(`${lv} ${carId} diff ${d} x${N}: ${iced} ice cells, grid on '${surfaceAt}'`);
for (const f of field) {
  console.log(`  ${f.drv.traits.persona.padEnd(10)} skill ${f.drv.traits.skill.toFixed(2)} | 10 m/s at ${f.t10 === null ? 'never' : f.t10.toFixed(1) + ' s'} | ${f.d10.toFixed(0)} m in 10 s | still ${f.still.toFixed(1)} s | wheel slip on ice ${(f.slip / Math.max(1, f.slipN)).toFixed(1)} m/s`);
}
