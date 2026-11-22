// _rigg.mjs - ?trailroll step 1: THE RIG'S SIDEWAYS G TODAY (physics/trailer.ts), headless with the
// game's own steps on flat tarmac: the Scanyah and its half-loaded curtainsider in steady circles
// (steering held, flat out from 40 km/h), lane changes and a J-turn (full lock) at 60 / 80 / 100
// km/h; the tractor's tip check as the game runs it (physics/tip.ts stepTipping). Per run each
// body's top sideways g (the tractor's from its tyres, car.t.ay; the trailer's from its velocity),
// how long the trailer spent past its static tip point (track / 2 cg height = 0.68 g, 0.60 g with
// the springs' roll taken off), the tractor's phase at the end and the largest hitch angle.
// node tools/scratch/_rigg.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { attachTrailer, stepTrailer } from '../../src/physics/trailer.ts';
import { stepTipping } from '../../src/physics/tip.ts';
import { stepRigRoll } from '../../src/physics/trailroll.ts';
import { rolling, stepRoll, tripCheck } from '../../src/roll.ts';
import { FIX } from '../../src/core/fixes.ts';

const G = 9.81;
const TRAILER_TIP_G = 2.04 / (2 * 1.5), TRAILER_TIP_G_SOFT = TRAILER_TIP_G * (1 - 0.12);

/** A tractor and its trailer at rest, then up to a speed in a straight line. */
function rigAt(kph) {
  const car = makeCar('scanyah-r450');
  reset(car, 0, 0, 0);
  attachTrailer(car);
  for (let time = 0; time < 120 && car.t.vLong < kph / 3.6; time += dt)
    both(car, { steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0 }, null);
  return car;
}

/**
 * One step of both; the readings into the run's record.
 * @param car the tractor
 * @param input its controls
 * @param rec the record (or null)
 */
function both(car, input, rec) {
  car.surface = SURFACES.tarmac;
  car.trailer.surface = SURFACES.tarmac;
  const trailer = car.trailer, v0x = trailer.vx, v0y = trailer.vy;
  if (FIX.trailroll) {
    // (as game/sim.ts: a rolling cab tumbles, else its step and two-wheel state; then the trailer
    // with the roll - physics/trailroll.ts stepRigRoll)
    if (rolling(car)) stepRoll(car, dt, () => {});
    else {
      step(car, input, dt);
      // (a crash's side kick trips it as the game's: the dice always against it here)
      tripCheck(car, dt, () => 0);
      stepTipping(car, dt);
    }
    const cabWas = rolling(car), wasRolling = rolling(trailer);
    stepRigRoll(car, trailer, { vx: v0x, vy: v0y }, () => stepTrailer(car, input.brake, dt),
      (body) => stepRoll(body, dt, () => {}), dt);
    if (rec && !rec.first && (cabWas || rolling(trailer))) {
      const cabFirst = cabWas && !wasRolling;
      rec.first = { who: cabFirst ? 'cab' : 'trailer', rate: Math.abs((cabFirst ? car : trailer)
        .roll.w), time: rec.time };
    }
    if (rec && rec.first && !rec.outcome) rec.outcome = trailer.pinFree ? 'pin snapped'
      : rolling(car) && rolling(trailer) ? 'together' : null;
  } else {
    step(car, input, dt);
    if (!car.roll || car.roll.phase === 'none' || car.roll.phase === 'tipping') stepTipping(car, dt);
    stepTrailer(car, input.brake, dt);
  }
  if (!rec) return;
  const ax = (trailer.vx - v0x) / dt, ay = (trailer.vy - v0y) / dt;
  const latG = Math.abs(-ax * Math.sin(trailer.heading) + ay * Math.cos(trailer.heading)) / G;
  // (upright only: rolling, it is held on the pin or tumbling)
  if (!rolling(trailer)) rec.trailerG = Math.max(rec.trailerG, latG);
  if (latG > TRAILER_TIP_G_SOFT) rec.pastSoft += dt;
  if (latG > TRAILER_TIP_G) rec.pastTip += dt;
  rec.tractorG = Math.max(rec.tractorG, Math.abs(car.t?.ay ?? 0) / G);
  rec.hitch = Math.max(rec.hitch, Math.abs(Math.atan2(Math.sin(trailer.heading - car.heading),
    Math.cos(trailer.heading - car.heading))) * 180 / Math.PI);
  rec.phase = car.roll?.phase ?? 'none';
  const tPhase = trailer.roll?.phase ?? 'none';
  if (tPhase === 'tipping' && rec.liftG === null) rec.liftG = latG;
  if (tPhase !== 'none' && tPhase !== 'tipping' && !rec.over) {
    // (rolling outward: its lean away from the pull - the pull's sign against the lean's)
    rec.over = { pinFree: !!trailer.pinFree, outward: Math.sign(trailer.roll.phi) === -Math.sign(trailer._tipPull || 0) };
  }
  rec.trailerPhase = tPhase;
}

const runs = [];
for (const steer of [0.1, 0.2, 0.35]) runs.push([`circle steer ${steer}`, 40, (time) => ({
  steer, throttle: 1, brake: 0 }), 20]);
for (const kph of [60, 80, 100]) {
  runs.push([`lane change ${kph}`, kph, (time) => ({ steer: time < 0.6 ? 0.25 : time < 1.4 ? -0.25
    : 0, throttle: 0.5, brake: 0 }), 4]);
  runs.push([`J-turn ${kph}`, kph, () => ({ steer: 0.55, throttle: 0.6, brake: 0 }), 4]);
}
// (TRAILROLL=1 only: the steadier circles and side hits on the trailer)
if (FIX.trailroll) {
  for (const steer of [0.15, 0.25]) runs.push([`circle steer ${steer}`, 40, () => ({ steer,
    throttle: 1, brake: 0 }), 20]);
  for (const kick of [4, 8, 14]) runs.push([`side hit ${kick} m/s at 60`, 60, () => ({ steer: 0,
    throttle: 0.4, brake: 0 }), 4, kick]);
  // (a crash's side kick on the cab: a gentle and a violent trip - roll.ts startRoll's rate)
  for (const kick of [8, 14]) runs.push([`cab hit ${kick} m/s at 60`, 60, () => ({ steer: 0,
    throttle: 0.4, brake: 0 }), 4, kick, true]);
}
for (const [name, kph, control, seconds, kick, cabHit] of runs) {
  const car = rigAt(kph), rec = { trailerG: 0, tractorG: 0, pastSoft: 0, pastTip: 0, hitch: 0,
    phase: 'none', liftG: null, over: null, trailerPhase: 'none', first: null, outcome: null,
    time: 0 };
  for (let time = 0; time < seconds; time += dt) {
    rec.time = time;
    if (kick && cabHit && Math.abs(time - 0.5) < dt / 2) car._sideKick = { dir: 1, dv: kick };
    else if (kick && Math.abs(time - 0.5) < dt / 2) {
      // (a side hit on the trailer: KICK m/s sideways at once)
      car.trailer.vx -= Math.sin(car.trailer.heading) * kick;
      car.trailer.vy += Math.cos(car.trailer.heading) * kick;
    }
    both(car, { handbrake: 0, reverse: 0, ...control(time) }, rec);
  }
  console.log(`${name.padEnd(20)} tractor ${rec.tractorG.toFixed(2)} g, trailer ${rec.trailerG
    .toFixed(2)} g (past ${TRAILER_TIP_G_SOFT.toFixed(2)} g ${rec.pastSoft.toFixed(2)} s, past `
    + `${TRAILER_TIP_G.toFixed(2)} g ${rec.pastTip.toFixed(2)} s), hitch up to ${rec.hitch.toFixed(0)}`
    + ` deg, the tractor ${rec.phase} at the end, ${(car.t.vLong * 3.6).toFixed(0)} km/h`
    + (FIX.trailroll && rec.first ? `; FIRST OVER: the ${rec.first.who} at ${rec.first.time.toFixed(1)} s, ${rec.first.rate.toFixed(1)} rad/s -> ${rec.outcome}; the cab ${car.roll?.phase ?? 'none'}, the trailer ${car.trailer.roll?.phase ?? 'none'}` : '')
    + (FIX.trailroll ? `; the trailer ${rec.liftG === null ? 'never lifted' : 'lifted at '
      + rec.liftG.toFixed(2) + ' g'}${rec.over ? ', WENT OVER (pin ' + (rec.over.pinFree ? 'snapped'
      : 'held') + ', ' + (rec.over.outward ? 'outward' : 'INWARD') + ')' : ''}, ${rec.trailerPhase}`
      : ''));
}
