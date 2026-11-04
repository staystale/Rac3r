// ai/driverFoot.ts - THE DRIVER'S RIGHT FOOT (the AI rework R4 / A9, passed 11-04; owner: AI
// "on icy starts cannot pull away and get reset"). MEASURED (tools/scratch/_icestart.mjs,
// Thruston, ice laid over the grid): the AI held full throttle on ice - the muscle car's rear
// wheels spun at 32 m/s with the car at 0.3 m/s, 3-10 m in 10 s, nearly still 9-13 s (the game
// resets after 3); a hatch 26 m. A real driver feathers the throttle to keep the driven wheels
// just past the grip peak, as TCS does (physics/loads.ts tractionCut), so every AI car does it
// with its foot - aids or not. On GRIPPY ground it holds the spin near the peak, as TCS does
// (owner 11-04: "shouldn't ai especially more skilled ones realise the slip and feather the
// throttle? like players have to"); on LOOSE ground it lets much more through - the measured
// lesson (driverPedals.ts) is that some spin there is the fast way, and a blanket wheelspin cut
// cost lap time. A better driver catches it sooner and holds it closer to the peak. Not while
// drifting (the throttle holds the slide) nor in a throttle mistake (the error IS too much
// throttle).
import type { AiCar, Traits } from './types.ts';

// m/s of spin let through at a standstill, skill 1 / extra at skill 0; and as a share of road
// speed, skill 1 / extra at skill 0, on grippy ground (TCS lets ~10 %: physics/loads.ts) and on
// loose (from 0.5 grip down)
const SPIN_FLOOR = 2.5, SPIN_FLOOR_WEAK = 2.0;
const GRIP_SHARE = 0.12, GRIP_SHARE_WEAK = 0.25, LOOSE_SHARE = 0.25, LOOSE_SHARE_WEAK = 0.35;
// throttle taken off a m/s of spin past that, the least it leaves, and how fast the foot moves
// (1/s)
const EASE_PER = 0.4, EASE_MIN = 0.02, FOOT_RATE = 12;

/**
 * The throttle after the foot has felt the driven wheels.
 * @param drv the driver (traits.skill; state.footK, the foot's share) - circuit or highway
 * @param car the car (car.wheelSpin, m/s its driven wheels run ahead of the road)
 * @param speed m/s
 * @param throttle the throttle the driver wants
 * @param dt s since the foot last moved
 * @param free true when the spin is meant (a held drift, a throttle mistake)
 * @returns the throttle
 */
export function footThrottle(drv: { traits: Traits; state: { footK?: number } }, car: AiCar,
  speed: number, throttle: number, dt: number, free: boolean): number {
  const state = drv.state, weak = 1 - Math.max(0, Math.min(1, drv.traits.skill));
  const spin = (car as AiCar & { wheelSpin?: number }).wheelSpin || 0;
  // loose: 0 on tarmac (grip 1) .. 1 at grip 0.5 and under (as the slide step reads it)
  const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5));
  const share = GRIP_SHARE + GRIP_SHARE_WEAK * weak
    + (LOOSE_SHARE + LOOSE_SHARE_WEAK * weak - GRIP_SHARE - GRIP_SHARE_WEAK * weak) * loose;
  const allow = Math.max(SPIN_FLOOR + SPIN_FLOOR_WEAK * weak, share * speed);
  const target = free || spin <= allow ? 1 : Math.max(EASE_MIN, 1 - (spin - allow) * EASE_PER);
  const footK = state.footK ?? 1;
  state.footK = footK + (target - footK) * Math.min(1, FOOT_RATE * dt);
  return throttle * state.footK;
}
