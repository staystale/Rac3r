// game/flashes.ts - YOU FLASHING THE TRAFFIC: your lights on and off
// quickly - the same flash the police heat sees (ai/policeHeat.ts flashed) - tells the car ahead of
// you in your lane (ai/trafficYield.ts noteFlash): a chance it moves over; the same car flashed
// three times, its driver gets angry. Each physics step, after the traffic's.
import { flashed } from '../ai/policeHeat.ts';
import type { FlashWatch } from '../ai/policeHeat.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { LEVEL } from '../world/state.ts';
import { game, hwLevel } from './state.ts';

// your lights as the flash reads them, its own clock (sim s)
const WATCH: FlashWatch = { lightsWas: null, lightsAt: -99, clock: 0 };

/**
 * One step of your flashes at the traffic (the endless roads, either switch on): a flash goes to
 * the car ahead of you in your lane.
 * @returns what the car did ('angry', 'yield', 'ignored'), or null
 */
export function stepFlashes(): string | null {
  if (!LEVEL.endless) return null;
  WATCH.clock += PHYSICS_STEP_SECONDS;
  const here = hwLevel()._hw.q;
  if (!flashed(WATCH, !!game.car.lightsOn) || !here) return null;
  return game.traffic.noteFlash(game.car, here, WATCH.clock);
}
