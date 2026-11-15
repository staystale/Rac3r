// game/sirens.ts - WHICH POLICE CARS SOUND THEIR SIREN (?siren=1), the game's side of the siren
// (audiosiren.ts the sound): a police car chasing - its light bar flashing (ai/trafficPolice.ts
// sets car.blues, render/lightbar.ts draws it) - sounds; a cruising, waiting or angry one does
// not. The nearest SIREN_VOICES of them, heard from your car; each voice keeps its car while that
// car stays among the nearest (a voice swapping cars would jump in pan and pattern). Silent on the
// menu, at pause, behind the loading screen and a walkthrough. Read only: nothing here changes the
// police or the sim.
import { SIREN_VOICES } from '../audiosiren.ts';
import type { SirenSpot } from '../audiosiren.ts';
import { game, shared } from './state.ts';

/** What the siren reads of a traffic car. */
interface SirenCar { x: number; y: number; police?: boolean; blues?: boolean }

// each voice's car this frame (reused: no allocation per frame)
const SPOTS: SirenSpot[] = Array.from({ length: SIREN_VOICES }, () => ({ isOn: false, dx: 0,
  dy: 0 }));
// the car each voice follows, and this frame's nearest chasers with their distances, m
const VOICE_CARS: (SirenCar | null)[] = new Array(SIREN_VOICES).fill(null);
const NEAREST: (SirenCar | null)[] = new Array(SIREN_VOICES).fill(null);
const NEAREST_M: number[] = new Array(SIREN_VOICES).fill(Infinity);

/**
 * Whether every siren is silent this frame: not racing, paused, held or in a walkthrough.
 * @returns true when silent
 */
function isSirenQuiet(): boolean {
  return shared.mode !== 'session' || !shared.started || shared.paused || !!game.raceHeld
    || shared.guide.active;
}

/**
 * Puts a chaser into the nearest list (sorted, nearest first) when it is near enough.
 * @param car the chaser
 * @param distM its distance from you, m
 * @param count how many the list holds
 * @returns how many it holds now
 */
function insertNearest(car: SirenCar, distM: number, count: number): number {
  if (count === SIREN_VOICES && distM >= NEAREST_M[count - 1]) return count;
  const held = Math.min(SIREN_VOICES, count + 1);
  let place = held - 1;
  while (place > 0 && NEAREST_M[place - 1] > distM) {
    NEAREST[place] = NEAREST[place - 1];
    NEAREST_M[place] = NEAREST_M[place - 1];
    place--;
  }
  NEAREST[place] = car;
  NEAREST_M[place] = distM;
  return held;
}

/**
 * This frame's nearest chasing police cars to you (NEAREST), their lights flashing.
 * @param you your car
 * @returns how many
 */
function findNearestChasers(you: SirenCar): number {
  let count = 0;
  for (const slot of game.traffic.list) {
    const car: SirenCar = slot.car;
    if (slot.parked || !car.police || !car.blues) continue;
    count = insertNearest(car, Math.hypot(car.x - you.x, car.y - you.y), count);
  }
  for (let i = count; i < SIREN_VOICES; i++) NEAREST[i] = null;
  return count;
}

/**
 * Gives each voice its car: a voice keeps its car while it is still among the nearest, a free
 * voice takes a new one; then each voice's spot, from you.
 * @param you your car
 * @param count how many nearest chasers
 */
function assignVoices(you: SirenCar, count: number) {
  for (let i = 0; i < SIREN_VOICES; i++) {
    const kept = VOICE_CARS[i];
    if (kept && NEAREST.indexOf(kept) < 0) VOICE_CARS[i] = null;
  }
  for (let i = 0; i < count; i++) {
    const car = NEAREST[i];
    if (!car || VOICE_CARS.indexOf(car) >= 0) continue;
    VOICE_CARS[VOICE_CARS.indexOf(null)] = car;
  }
  for (let i = 0; i < SIREN_VOICES; i++) {
    const car = VOICE_CARS[i], spot = SPOTS[i];
    spot.isOn = !!car;
    spot.dx = car ? car.x - you.x : 0;
    spot.dy = car ? car.y - you.y : 0;
  }
}

/**
 * One frame of the police sirens (?siren=1): which chasers sound, where, into the sound engine.
 */
export function stepSirens() {
  const count = isSirenQuiet() ? 0 : findNearestChasers(game.car);
  if (!count) NEAREST.fill(null);
  assignVoices(game.car, count);
  shared.audio.sirens(SPOTS);
}
