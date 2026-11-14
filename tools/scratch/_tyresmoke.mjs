// _tyresmoke.mjs - TYRE SMOKE per tyre, headless: when and how hard each tyre smokes by the
// renderer's rule (render/particles.ts emitTyreSmoke: strength 0..1 from the tyre's heat and its
// axle's slip; puffs a second = strength x SMOKE_RATE), on EVERY car (CAR_IDS), aids off then on.
// Cases (tarmac, 18 C):
//   thruston / spa  one racing AI (ai/circuit.ts, difficulty 4, alone), laps 2-3 counted
//   launch    10 s full throttle from rest, tyres 18 C
//   burnout   8 s full throttle from rest, held by the brake at 0.4 (a front-drive car: the
//             handbrake), tyres 18 C
//   donut     20 s full lock and full throttle from rest, tyres 18 C
//   stops     ten stops from min(60 m/s, the car's 30 s speed), the phone's brake ramp
//   arc       60 s on a 50 m circle at 18.5 m/s (0.7 g), yaw-rate steering
//   fast      60 s on a 150 m circle at 40 m/s (1.1 g at 144 km/h)
//   under     UNDERSTEER: tyres 85 C, from 30 m/s full lock, throttle 0.6, 5 s
//   lockup    tyres 85 C, from 30 m/s, full brake at once, 4 s
//   hotslide  tyres 130 C, from 22 m/s: full lock and the handbrake 0.6 s, then full throttle
//             at half lock, 4 s
// Per tyre and rule: % of the time smoking (strength > 0), the mean strength while smoking and
// the mean puffs a second. Tyres in the tables: front pair / rear pair (the busier of each pair).
// node tools/scratch/_tyresmoke.mjs [cases,...] [cars,...]   JSON=path writes every tyre's numbers;
// TYRE=<tyre id> fits that set (cars.ts TYRES) to every car, for another working window.
// The rules are the game's own (render/tyresmoke.ts), old and new, on the same run.
import { makeCar, step, reset, setAidsDefault, neutralInput, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import { CAR_IDS, applyTyre } from '../../src/cars.ts';
import * as L from '../../src/lab.ts';
import { writeFileSync } from 'node:fs';
import { earlySmokeStrength, windowSmokeStrength } from '../../src/render/tyresmoke.ts';

const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const ALL_CASES = ['thruston', 'spa', 'launch', 'burnout', 'donut', 'stops', 'arc', 'fast',
  'under', 'lockup', 'hotslide'];
const [casesArg = '', carsArg = ''] = process.argv.slice(2);
const cases = casesArg ? casesArg.split(',') : ALL_CASES;
const cars = carsArg ? carsArg.split(',') : CAR_IDS;
// old: the early rule (the plain game); new: the window rule (?tyresmoke=1)
const SMOKE_RULES = { old: earlySmokeStrength, new: windowSmokeStrength };
const RULES = Object.keys(SMOKE_RULES);
const speedOf = (car) => Math.hypot(car.vx, car.vy);

/** A tally of one run: per rule, per tyre, steps smoking, strength sum, all steps. */
function newTally() {
  const perRule = {};
  for (const rule of RULES) perRule[rule] = [0, 1, 2, 3].map(() => ({ on: 0, sum: 0 }));
  return { steps: 0, perRule, heat: [0, 1, 2, 3].map(() => ({ sum: 0, peak: 0 })) };
}

/** Adds this step's smoke of each tyre to the tally, by every rule. */
function countStep(tally, car) {
  tally.steps++;
  const telem = car.t;
  for (let tyre = 0; tyre < 4; tyre++) {
    const front = tyre < 2;
    const wheel = {
      front,
      heat: car.tyreT[tyre],
      slip: front ? telem.slipSpeedF : telem.slipSpeedR,
    };
    tally.heat[tyre].sum += wheel.heat;
    tally.heat[tyre].peak = Math.max(tally.heat[tyre].peak, wheel.heat);
    for (const rule of RULES) {
      const strength = SMOKE_RULES[rule](wheel, car);
      if (strength <= 0) continue;
      const cell = tally.perRule[rule][tyre];
      cell.on++;
      cell.sum += strength;
    }
  }
}

/** A car, on the set TYRE=<id> names when set (another working window). */
function fittedCar(id) {
  const car = makeCar(id);
  if (process.env.TYRE) applyTyre(car.spec, process.env.TYRE);
  return car;
}

/** A fresh car on tarmac, its tyres at a temperature. */
function freshCar(id, tyreC = 18) {
  const car = fittedCar(id);
  reset(car, 0, 0, 0);
  car.surface = L.SURFACES.tarmac;
  car.tyreT = [tyreC, tyreC, tyreC, tyreC];
  return car;
}

/** Steps a car on tarmac for some seconds under a control function, counting every step. */
function drive(car, seconds, control, tally) {
  for (let i = 0; i < seconds / DT; i++) {
    car.surface = L.SURFACES.tarmac;
    step(car, { ...neutralInput(), ...control(car, i * DT) }, DT);
    countStep(tally, car);
  }
}

/** A circle at a speed, yaw-rate steering. */
function arcCase(id, radius, target, tally) {
  const car = freshCar(id);
  car.vx = target;
  drive(car, 60, (now) => {
    const speed = speedOf(now), wantYaw = speed / radius;
    const steer = Math.max(-1, Math.min(1, 0.15 + 2 * (wantYaw - now.yawRate)));
    return { steer, throttle: speed < target ? 0.6 : 0 };
  }, tally);
}

/** Ten stops with the phone's brake ramp. */
function stopsCase(id, tally) {
  const scout = freshCar(id);
  drive(scout, 30, () => ({ throttle: 1 }), newTally());
  const car = freshCar(id), target = Math.min(60, 0.95 * speedOf(scout));
  for (let stop = 0; stop < 10; stop++) {
    for (let guard = 0; speedOf(car) < target && guard < 40 / DT; guard++)
      drive(car, DT, () => ({ throttle: 1 }), tally);
    for (let guard = 0; speedOf(car) > 0.5 && guard < 30 / DT; guard++)
      drive(car, DT, () => ({ brake: Math.min(1, 0.28 + 0.72 * guard * DT) }), tally);
  }
}

/** One racing AI's laps on a circuit, laps 2-3 counted. */
function lapCase(id, level, tally) {
  L.setLevel(level);
  L.clearWear();
  const line = racingLine(L.LEVEL), sub = L.LEVEL.subtrack, car = fittedCar(id);
  const start = line.pts[0];
  reset(car, start.x, start.y, start.h);
  const driver = createAIDriver(L.LEVEL, aiTraits(4, 0, 1, 3));
  let clock = 0, laps = 0, lapStart = 0, prev = null, stuck = 0;
  while (laps < 3 && clock < 600 && stuck < 20) {
    L.applyGround(car, DT);
    step(car, driver.drive(car, DT, { cars: [], lap: laps + 1, laps: 3 }), DT);
    clock += DT;
    stuck = speedOf(car) < 1 ? stuck + DT : 0;
    const where = L.querySubtrack(sub, car.x, car.y);
    if (prev !== null && prev > sub.totalDist - 80 && where.trackDist < 80
      && clock - lapStart > 20) {
      laps++;
      lapStart = clock;
    }
    if (Number.isFinite(where.trackDist)) prev = where.trackDist;
    if (laps >= 1) countStep(tally, car);
  }
  tally.stuck = stuck >= 20;
}

const CASES = {
  thruston: (id, tally) => lapCase(id, 'thruston', tally),
  spa: (id, tally) => lapCase(id, 'spa', tally),
  launch: (id, tally) => drive(freshCar(id), 10, () => ({ throttle: 1 }), tally),
  burnout: (id, tally) => {
    const car = freshCar(id), hold = car.spec.drive >= 0.99 ? { handbrake: true } : { brake: 0.4 };
    drive(car, 8, () => ({ throttle: 1, ...hold }), tally);
  },
  donut: (id, tally) => drive(freshCar(id), 20, () => ({ steer: 1, throttle: 1 }), tally),
  stops: stopsCase,
  arc: (id, tally) => arcCase(id, 50, 18.5, tally),
  fast: (id, tally) => arcCase(id, 150, 40, tally),
  under: (id, tally) => {
    const car = freshCar(id, 85);
    car.vx = 30;
    drive(car, 5, () => ({ steer: 1, throttle: 0.6 }), tally);
  },
  lockup: (id, tally) => {
    const car = freshCar(id, 85);
    car.vx = 30;
    drive(car, 4, () => ({ brake: 1 }), tally);
  },
  hotslide: (id, tally) => {
    const car = freshCar(id, 130);
    car.vx = 22;
    drive(car, 4.6, (now, time) => (time < 0.6 ? { steer: 1, handbrake: true }
      : { steer: 0.5, throttle: 1 }), tally);
  },
};

/** Per rule and tyre: % smoking, mean strength while smoking, mean puffs a second. */
function summarise(tally) {
  const out = { heat: tally.heat.map((cell) => ({ mean: cell.sum / Math.max(1, tally.steps),
    peak: cell.peak })) };
  for (const rule of RULES) {
    out[rule] = tally.perRule[rule].map((cell) => ({
      share: (100 * cell.on) / Math.max(1, tally.steps),
      strength: cell.on ? cell.sum / cell.on : 0,
      puffs: (38 * cell.sum) / Math.max(1, tally.steps),
    }));
  }
  return out;
}

const pairText = (tyres, first) => {
  const pick = tyres[first].share >= tyres[first + 1].share ? tyres[first] : tyres[first + 1];
  return `${pick.share.toFixed(0).padStart(3)}% ${pick.strength.toFixed(2)} ${
    pick.puffs.toFixed(1).padStart(4)}`;
};
const rows = [];
for (const caseName of cases) {
  for (const aids of [false, true]) {
    setAidsDefault(aids);
    console.log(`\n${caseName.toUpperCase()}, AIDS ${aids ? 'ON' : 'OFF'}: per rule, front pair | `
      + 'rear pair: % of the time smoking, mean strength while smoking, puffs/s');
    for (const id of cars) {
      const tally = newTally();
      CASES[caseName](id, tally);
      const stats = summarise(tally);
      rows.push({ caseName, aids, id, stuck: !!tally.stuck, seconds: tally.steps * DT, stats });
      const text = RULES.map((rule) => `${rule} F ${pairText(stats[rule], 0)} R ${
        pairText(stats[rule], 2)}`).join('   ');
      const heat = stats.heat, pairHeat = (first) => `${Math.max(heat[first].mean, heat[first + 1].mean)
        .toFixed(0)}/${Math.max(heat[first].peak, heat[first + 1].peak).toFixed(0)}`;
      const heatText = `C F ${pairHeat(0)} R ${pairHeat(2)}`;
      console.log(`${id.padEnd(14)} ${heatText.padEnd(20)} ${text}${tally.stuck ? ' STUCK' : ''}`);
    }
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows));
