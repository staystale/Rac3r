// _understeer.mjs - how much STICK saturates the front at speed. Held speed (throttle trim), a
// steady stick s for 3 s: lateral g, front / rear axle saturation, front marks (slipSpeedF > 2.2),
// body slip. node tools/scratch/_understeer.mjs [cars,comma]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const ids = (process.argv[2] || 'hatch-fwd,hatch-rwd,muscle-rwd,lambo-awd').split(',');
const STICKS = [0.03, 0.06, 0.1, 0.15, 0.25, 0.4];
for (const id of ids) {
  const s = makeCar(id).spec;
  console.log(`${id}  front weight ${(s.lr / s.L * 100).toFixed(0)} %, cgH ${s.cgH}`);
  for (const kmh of [40, 80, 120]) {
    const row = STICKS.map((st) => {
      const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.tyreT = [80, 80, 80, 80];
      const v = kmh / 3.6; car.vx = v; car.gear = Math.max(1, Math.min(s.gears.length, Math.round(kmh / 40) + 1));
      let g = 0, n = 0, satF = 0, satR = 0, mark = 0;
      for (let k = 0; k < 360; k++) {
        step(car, { ...neutralInput(), steer: st, throttle: car.t.vLong < v ? 0.5 : 0 }, DT);
        if (k > 240) { g += Math.abs(car.t.vLong * car.yawRate) / 9.81; satF += car.t.satF; satR += car.t.satR; n++; if (car.t.slipSpeedF > 2.2) mark++; }
      }
      return `${(st * 100).toFixed(0).padStart(2)}%: ${(g / n).toFixed(2)}g F${(satF / n).toFixed(2)} R${(satR / n).toFixed(2)}${mark ? ' MARK' : ''}`;
    });
    console.log(`  ${String(kmh).padStart(3)} km/h  ${row.join(' | ')}`);
  }
}
