// game/police.ts - POLICE ON THE HIGHWAYS, the game's side (?police=1; TODO.md ROUND 4): each
// physics step after the contacts, the heat (ai/policeHeat.ts) reads you, the traffic's police
// (ai/trafficPolice.ts) and what happened this step - a speed camera's catch (game/sim.ts
// caughtBySpeedCamera), you running into a car - and sets the stars for the HUD (hud/overlays.ts
// drawHudHeat). LOST THEM on the notice line when you escape. BUSTED: the card (hud/overlays.ts
// drawHudBusted) with a fine as the speed camera's (shown, not charged in TEST MODE), then the
// police gone, the heat cleared and a normal reset (game/session.ts doReset: the car mended, our
// hard shoulder or a lay-by).
import { clearHeat, createHeat, stepHeat } from '../ai/policeHeat.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { LEVEL } from '../world/state.ts';
import { doReset } from './session.ts';
import { game, hwLevel } from './state.ts';

// $ a bust's fine at 1, 2, 3 stars (a speed camera's is $100 + $10 a mph over)
const BUST_FINE = [500, 1000, 2000];
// m/s your speed must change in a car-to-car contact for it to count as running into a car (a
// door rub is not a crash)
export const TOUCH_MS = 1.5;

// a speed camera caught you this step (game/sim.ts), for the next police step
let isCameraCaught = false;

/** A speed camera caught you: the heat reads it next step. */
export function notePoliceCamera() {
  isCameraCaught = true;
}

/**
 * The police's step for the game (the endless roads): the heat, the stars on the HUD, LOST THEM,
 * and a bust.
 * @param touched you ran into a car this step
 */
export function stepPoliceGame(touched: boolean) {
  if (!LEVEL.endless) return;
  const orders = game.traffic.police();
  const heat = (orders.heat ||= createHeat());
  const result = stepHeat(heat, { dt: PHYSICS_STEP_SECONDS, player: game.car, level: hwLevel(),
    slots: game.traffic.list, cars: game.traffic.cars, orders, camera: isCameraCaught, touched });
  isCameraCaught = false;
  game.heat = { stars: heat.stars, siren: heat.sees };
  if (result === 'escaped') game.notice = { text: 'LOST THEM', good: true, at: performance.now() };
  if (result === 'busted') bustPlayer(heat.stars);
}

/**
 * BUSTED: the card and the fine, the police gone, the heat cleared, a normal reset.
 * @param stars the heat when you were caught, 1-3
 */
function bustPlayer(stars: number) {
  const fine = BUST_FINE[Math.max(1, Math.min(3, stars)) - 1];
  game.busted = { at: performance.now(), stars, fine, charged: !game.testMode };
  game.bustCount = (game.bustCount || 0) + 1;
  game.bustFines = (game.bustFines || 0) + fine;
  game.traffic.clearPolice();
  const heat = game.traffic.police().heat;
  if (heat) clearHeat(heat);
  game.heat = { stars: 0, siren: false };
  // (the card is the news: a notice from before the reset - BACK TO THE ROAD, pushed off it -
  // would stay up 2.2 s over the reset car)
  game.notice = null;
  doReset();
}

/**
 * A restart: no card, no stars - and no stars on the HUD off the endless roads (the traffic's reset
 * forgets the police and the heat).
 */
export function restartPoliceGame() {
  game.busted = null;
  game.heat = LEVEL.endless ? { stars: 0, siren: false } : undefined;
  game.bustCount = 0;
  game.bustFines = 0;
}
