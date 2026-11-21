// game/flashes.ts - YOU FLASHING THE TRAFFIC: your lights on and off
// quickly - the same flash the police heat sees (ai/policeHeat.ts flashed) - tells the car ahead of
// you in your lane (ai/trafficYield.ts noteFlash): a chance it moves over; the same car flashed
// three times, its driver gets angry. Each physics step, after the traffic's. Every
// car's lamps settle on the sim clock (physics/lampsim.ts, stepAllLamps - every level); a
// FLICKERING headlight - yours or a racer's - flashes the car ahead once in each FLASH_S, as a
// flash of the lights does (three anger it, and it chases that driver); with no working headlight
// your lights cannot flash.
import { flashed, FLASH_S } from '../ai/policeHeat.ts';
import type { FlashWatch } from '../ai/policeHeat.ts';
import { hasWorkingHeadlight, isHeadlightFlickering, stepCarLamps, stepLampClock }
  from '../physics/lampsim.ts';
import type { LampCar } from '../physics/lampsim.ts';
import type { AiCar } from '../ai/types.ts';
import type { Tractor } from '../physics/trailer.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { LEVEL } from '../world/state.ts';
import { game, hwLevel } from './state.ts';

// your lights as the flash reads them, its own clock (sim s)
const WATCH: FlashWatch = { lightsWas: null, lightsAt: -99, clock: 0 };
// when each car's flickering headlight last flashed (WATCH's clock, s)
const FLICKER_AT = new WeakMap<object, number>();

/**
 * One step of every car's lamps on the sim clock - yours (and your trailer), the
 * racers', the traffic's.
 */
export function stepAllLamps() {
  stepLampClock(PHYSICS_STEP_SECONDS);
  const trailer = (game.car as Tractor).trailer;
  const cars: LampCar[] = [game.car, ...(trailer ? [trailer as unknown as LampCar] : []),
    ...game.ai.map((entry) => entry.car), ...game.traffic.cars];
  for (const car of cars) stepCarLamps(car);
}

/**
 * A car's flickering headlight flashes the car ahead of it (once in each FLASH_S).
 * @param car the driver's car
 * @param frame its road frame (s, off), or none
 * @returns what the car ahead did, or null
 */
function flickerFlash(car: AiCar & LampCar, frame: { s: number; off: number } | null | undefined)
  : string | null {
  if (!frame || !isHeadlightFlickering(car)) return null;
  if (WATCH.clock - (FLICKER_AT.get(car) ?? -Infinity) < FLASH_S) return null;
  FLICKER_AT.set(car, WATCH.clock);
  return game.traffic.noteFlash(car, frame, WATCH.clock);
}

/**
 * One step of the flashes at the traffic (the endless roads): your lights' flash goes to the car
 * ahead of you in your lane; a flickering headlight's too, yours and the racers'.
 * @returns what your car ahead did ('angry', 'yield', 'ignored'), or null
 */
export function stepFlashes(): string | null {
  if (!LEVEL.endless) return null;
  WATCH.clock += PHYSICS_STEP_SECONDS;
  const here = hwLevel()._hw.q;
  const isFlash = flashed(WATCH, !!game.car.lightsOn);
  for (const entry of game.ai) flickerFlash(entry.car, entry.car._hwf);
  const flicker = flickerFlash(game.car, here);
  if (!isFlash || !here || !hasWorkingHeadlight(game.car)) return flicker;
  return game.traffic.noteFlash(game.car, here, WATCH.clock);
}
