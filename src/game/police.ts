// game/police.ts - POLICE ON THE HIGHWAYS, the game's side (?police=1; TODO.md, POLICE): each
// physics step after the contacts, every driver's heat (ai/policeHeat.ts stepHeats) - you, the
// racing AI rivals, the traffic (not the police) - reads what happened this step: a speed camera's
// catch (yours only: game/sim.ts caughtBySpeedCamera), a driver running into a car (noteTouches).
// Your stars go on the HUD (hud/heat.ts); LOST THEM on the notice line and the BUSTED card are
// yours only. A bust: you - the card with a fine as the speed camera's (shown, not charged in TEST
// MODE), your chasers gone, your heat cleared and a normal reset (game/session.ts doReset); an AI
// rival - held where it was stopped for BUST_HOLD_S (out of the race), then put back by its own
// reset (game/ai.ts: its hurt wait, then aiReset); a traffic driver - put away (off the road).
import { clearHeat, heatOf, stepHeats } from '../ai/policeHeat.ts';
import type { Driver } from '../ai/policeHeat.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { LEVEL } from '../world/state.ts';
import { doReset } from './session.ts';
import { game, hwLevel } from './state.ts';
import type { AiEntry } from './state.ts';
import type { TrafficCar } from '../ai/types.ts';

// $ a bust's fine at 1, 2, 3 stars (a speed camera's is $100 + $10 a mph over)
const BUST_FINE = [500, 1000, 2000];
// m/s a car's speed must change in a car-to-car contact for it to count as running into a car (a
// door rub is not a crash)
export const TOUCH_MS = 1.5;
// s a busted AI rival is held where it was stopped before its own reset puts it back
const BUST_HOLD_S = 6;

// a speed camera caught you this step (game/sim.ts), for the next police step
let isCameraCaught = false;
// the cars that ran into a car this step (noteTouches), and the drivers (reused every step)
const TOUCHED = new Set<object>();
const DRIVERS: Driver[] = [];

/** A speed camera caught you: the heat reads it next step. */
export function notePoliceCamera() {
  isCameraCaught = true;
}

/**
 * The cars of this step's contact pass that ran into a car - their speed changed by more than
 * TOUCH_MS (game/sim.ts, between the contacts and their damage: the hit is noted on the car).
 * @param cars the contact pass's cars
 * @param startVel each one's velocity before it, m/s
 */
export function noteTouches(cars: { vx: number; vy: number; _hitKind?: string | null }[],
  startVel: number[][]) {
  TOUCHED.clear();
  cars.forEach((car, i) => {
    if (car._hitKind === 'car' && Math.hypot(car.vx - startVel[i][0], car.vy - startVel[i][1])
      > TOUCH_MS) TOUCHED.add(car);
  });
}

/**
 * The i-th driver of the step, filled in (the pool grows once to the most drivers).
 * @param i its index
 * @param fill its fields
 * @returns the driver
 */
function driverAt(i: number, fill: Omit<Driver, 'touched'>): Driver {
  const driver = DRIVERS[i] ||= {} as Driver;
  Object.assign(driver, fill, { touched: TOUCHED.has(fill.car) });
  return driver;
}

/**
 * This step's drivers: you, the AI rivals, the traffic but the police.
 * @returns how many (the first of DRIVERS)
 */
function collectDrivers(): number {
  let count = 0;
  const here = hwLevel()._hw.q;
  driverAt(count++, { car: game.car, frame: here, isYou: true, camera: isCameraCaught,
    kind: 'you', owner: null });
  for (const entry of game.ai)
    driverAt(count++, { car: entry.car, frame: entry.car._hwf ?? null, isYou: false,
      camera: false, kind: 'ai', owner: entry });
  for (const slot of game.traffic.list) {
    if (slot.parked || slot.police) continue;
    driverAt(count++, { car: slot.car, frame: slot, isYou: false, camera: false,
      kind: 'traffic', owner: slot });
  }
  DRIVERS.length = count;
  return count;
}

/**
 * The police's step for the game (the endless roads): every driver's heat, your stars on the HUD,
 * LOST THEM (yours), and the busts.
 */
export function stepPoliceGame() {
  if (!LEVEL.endless) return;
  const orders = game.traffic.police();
  collectDrivers();
  const events = stepHeats(orders, DRIVERS, { dt: PHYSICS_STEP_SECONDS, level: hwLevel(),
    slots: game.traffic.list, cars: game.traffic.cars });
  isCameraCaught = false;
  TOUCHED.clear();
  const yours = heatOf(orders, game.car);
  game.heat = { stars: yours?.stars ?? 0, siren: !!yours?.sees };
  for (const { driver, result } of events) {
    if (driver.isYou && result === 'escaped')
      game.notice = { text: 'LOST THEM', good: true, at: performance.now() };
    if (result !== 'busted') continue;
    if (driver.isYou) bustPlayer(yours?.stars ?? 1);
    else if (driver.kind === 'ai') holdAI(driver.owner as AiEntry);
    else game.traffic.putAway((driver.owner as TrafficCar).car);
    const heat = heatOf(orders, driver.car);
    if (heat) clearHeat(heat);
  }
}

/**
 * A busted AI rival: held where it was stopped (on the brakes, out of the race) for BUST_HOLD_S,
 * then put back by its own reset (game/ai.ts stepAIInjury: the hurt wait, then aiReset).
 * @param entry the AI
 */
function holdAI(entry: AiEntry) {
  entry.hurtWait = BUST_HOLD_S;
  entry.hurtT = 0;
}

/**
 * BUSTED: the card and the fine, your chasers gone, your heat cleared, a normal reset.
 * @param stars the heat when you were caught, 1-3
 */
function bustPlayer(stars: number) {
  const fine = BUST_FINE[Math.max(1, Math.min(3, stars)) - 1];
  game.busted = { at: performance.now(), stars, fine, charged: !game.testMode };
  game.bustCount = (game.bustCount || 0) + 1;
  game.bustFines = (game.bustFines || 0) + fine;
  game.traffic.clearPolice(game.car);
  game.heat = { stars: 0, siren: false };
  // (the card is the news: a notice from before the reset - BACK TO THE ROAD, pushed off it -
  // would stay up 2.2 s over the reset car)
  game.notice = null;
  doReset();
}

/**
 * A restart: no card, no stars - and no stars on the HUD off the endless roads (the traffic's reset
 * forgets the police and the heats).
 */
export function restartPoliceGame() {
  game.busted = null;
  game.heat = LEVEL.endless ? { stars: 0, siren: false } : undefined;
  game.bustCount = 0;
  game.bustFines = 0;
}
