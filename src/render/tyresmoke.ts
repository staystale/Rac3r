// render/tyresmoke.ts - TYRE SMOKE STRENGTH: how hard one tyre smokes, 0..1. render/particles.ts
// emitTyreSmoke turns it into puffs a second, their opacity and how long they hang.
import { scrubs } from '../physics/tyreheat.ts';

// SMOKE STRENGTH: each tyre's strength is its heat share x its slide share (SMOKE_SLIP_MIN ->
// SMOKE_SLIP_FULL m/s), so the amount and the opacity follow both the heat and the slide; the
// puffs a second, their opacity and how long a strong one lives all follow it
// (render/particles.ts).
const SMOKE_SLIP_MIN = 2, SMOKE_SLIP_FULL = 14;
// the heat share rises as a curve (power SMOKE_EARLY_POW): smoke begins progressively, less of
// it and fainter while the tyre is cooler
const SMOKE_EARLY_POW = 1.6;

// THE WINDOW RULE. MEASURED (tools/scratch/_tyresmoke.mjs, every car, aids off and on): with the
// old rule (smoke from 60 C at any slip over 2 m/s, gripping or not) a front tyre in its working
// window smoked whenever its axle's slip passed 2 m/s - in a held 1.1 g corner at 144 km/h
// gripping fronts smoked up to 76 % of the time (the WRZ, 67 % while gripping), in any slide at
// 85 C 80-100 % of the time. Now, the same for every tyre:
// - only past grip: the axle spins, locks or slides, by the heat model's own test (scrubs);
// - the heat share counts from SMOKE_START_SHARE of the window's width below its top (98.75 C on
//   the stock 65-110 C window) to SMOKE_FULL_OVER C above it (165 C), on the same curve;
// - a locked or spinning tyre rubs the same rubber round through the patch, so its surface runs
//   up to SMOKE_FLASH_C hotter than the tyre by its slide share: a lock-up and a burnout smoke
//   much as before, a gripping or gently sliding tyre in its window does not.
const SMOKE_START_SHARE = 0.25, SMOKE_FULL_OVER = 55, SMOKE_FLASH_C = 30;
// the working window of a car with none of its own, C (vehicle.ts tyre grip)
const STOCK_WINDOW: [number, number] = [65, 110];

/** One tyre as the smoke reads it (marks.ts wheelsOf). */
export interface SmokeWheel {
  heat: number;   // C
  slip: number;   // its axle's slip speed, m/s (0 where the wheel leaves no mark)
  front?: boolean;   // on the front axle
}

/** What the smoke reads of a car: its window and its axles' state (vehicle.ts car.t). */
export interface SmokeCar {
  spec: { tyreOpt?: [number, number] };
  t: {
    slipSpeedF: number; slipSpeedR: number;
    spinF?: boolean; spinR?: boolean; lockedF?: boolean; lockedR?: boolean;
    slidingF?: boolean; slidingR?: boolean;
  };
}

/** A value clamped to 0..1. */
const unit = (value: number) => Math.min(1, Math.max(0, value));

// the axle scrubs reads (reused: no allocation per frame)
const axleNow = { spinning: false, sliding: false, slipSpeed: 0 };

/**
 * How hard a tyre smokes, 0..1 (THE WINDOW RULE above).
 * @param wheel the tyre
 * @param car its car
 * @returns the strength
 */
export function tyreSmokeStrength(wheel: SmokeWheel, car: SmokeCar): number {
  const telem = car.t, front = !!wheel.front;
  axleNow.spinning = !!(front ? telem.spinF : telem.spinR);
  axleNow.sliding = !!(front ? telem.slidingF : telem.slidingR);
  axleNow.slipSpeed = front ? telem.slipSpeedF : telem.slipSpeedR;
  const locked = !!(front ? telem.lockedF : telem.lockedR);
  if (!scrubs(axleNow, locked)) return 0;
  const slipK = unit((wheel.slip - SMOKE_SLIP_MIN) / (SMOKE_SLIP_FULL - SMOKE_SLIP_MIN));
  const [cool, hot] = car.spec.tyreOpt || STOCK_WINDOW;
  const start = hot - SMOKE_START_SHARE * (hot - cool), full = hot + SMOKE_FULL_OVER;
  const surface = wheel.heat + (locked || axleNow.spinning ? SMOKE_FLASH_C * slipK : 0);
  return unit((surface - start) / (full - start)) ** SMOKE_EARLY_POW * slipK;
}

