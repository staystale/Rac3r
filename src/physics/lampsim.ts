// physics/lampsim.ts - A CAR'S LAMPS SETTLING, ON THE SIM CLOCK: the same rule as the
// look's (render/carlamps.ts) - a hit that takes a lamp's corner past LAMP_OK sets it flickering
// for SETTLE_MIN_S .. SETTLE_MAX_S, then it settles steady or dead (dying by DIE_BASE plus
// DIE_PER_SHARE of the corner's damage share), past LAMP_GONE it is smashed, a repair brings it
// back - kept in the sim so the sim can read it: a flickering headlight flashes the traffic ahead
// (game/flashes.ts), a dead one cannot flash. Its chances come from a hash of the car's own lamp
// seed, the corner and the lamp's hit count (no random stream drawn), its flicker from the sim
// clock in FLICKER_SLOT_S slots; the drawing reads it (render/cars.ts lampLevel).

// damage share at which a lamp starts to suffer, and at which it is smashed
export const LAMP_OK = 0.15, LAMP_GONE = 0.35;
// a hit's flicker, s; the death chance (as the street lights: world/lamps.ts)
export const SETTLE_MIN_S = 3, SETTLE_MAX_S = 8, DIE_BASE = 0.15, DIE_PER_SHARE = 0.7;
// damage a hit must add to count, the flicker's slot (s) and how often it is off in it
export const HIT_DAMAGE = 0.01, FLICKER_SLOT_S = 0.07, FLICKER_OFF = 0.45;

/** A car's lamps in the sim: per corner the damage last seen, when its flicker settles (sim s,
 * 0: none), dead, its hits; the car's lamp seed. */
export interface LampSim {
  seen: number[]; until: number[]; dead: boolean[]; hits: number[]; seed: number;
}
/** A car as the lamps read it. */
export interface LampCar { dmg?: number[]; lampSim?: LampSim }

// the sim clock the flickers run on, s; the next car's lamp seed
let lampClock = 0, nextSeed = 1;

/**
 * A chance in 0..1 from the lamp's seed, corner, hit count and what it is for.
 * @param seed the car's lamp seed
 * @param corner the corner
 * @param count the lamp's hit count
 * @param salt what the chance is for (1: the flicker's length, 2: death)
 * @returns 0..1
 */
function lampChance(seed: number, corner: number, count: number, salt: number): number {
  let acc = (seed * 374761393 + corner * 668265263 + count * 2246822519 + salt * 3266489917) | 0;
  acc = Math.imul(acc ^ (acc >>> 13), 1274126177);
  return ((acc ^ (acc >>> 16)) >>> 0) / 4294967296;
}

/**
 * Moves the lamps' sim clock on one step (once a physics step).
 * @param dt the step, s
 */
export function stepLampClock(dt: number) {
  lampClock += dt;
}

/**
 * One step of a car's lamps: a hit past LAMP_OK starts a flicker; a flicker over settles the
 * lamp steady or dead; a repair (less damage than seen) mends it.
 * @param car the car
 */
export function stepCarLamps(car: LampCar) {
  const lamps = (car.lampSim ||= { seen: [0, 0, 0, 0], until: [0, 0, 0, 0],
    dead: [false, false, false, false], hits: [0, 0, 0, 0], seed: nextSeed++ });
  for (let corner = 0; corner < 4; corner++) {
    const damage = car.dmg ? car.dmg[corner] : 0;
    if (damage < lamps.seen[corner] - HIT_DAMAGE) {
      lamps.seen[corner] = damage;
      lamps.until[corner] = 0;
      lamps.dead[corner] = false;
    }
    if (damage > lamps.seen[corner] + HIT_DAMAGE) {
      lamps.seen[corner] = damage;
      lamps.hits[corner]++;
      if (damage > LAMP_OK && damage < LAMP_GONE && !lamps.dead[corner])
        lamps.until[corner] = lampClock + SETTLE_MIN_S + lampChance(lamps.seed, corner,
          lamps.hits[corner], 1) * (SETTLE_MAX_S - SETTLE_MIN_S);
    }
    if (lamps.until[corner] && lampClock >= lamps.until[corner]) {
      lamps.until[corner] = 0;
      const share = Math.min(1, Math.max(0, (damage - LAMP_OK) / (LAMP_GONE - LAMP_OK)));
      lamps.dead[corner] = lampChance(lamps.seed, corner, lamps.hits[corner], 2)
        < DIE_BASE + DIE_PER_SHARE * share;
    }
  }
}

/**
 * A lamp's level as the sim has it: smashed or dead 0, flickering on and off by the sim clock,
 * else 1.
 * @param car the car (stepped: car.lampSim)
 * @param corner the corner (0 front -y, 1 front +y, 2 rear -y, 3 rear +y)
 * @returns the level, 0..1
 */
export function simLampLevel(car: LampCar, corner: number): number {
  const lamps = car.lampSim!, damage = car.dmg ? car.dmg[corner] : 0;
  if (damage >= LAMP_GONE || lamps.dead[corner]) return 0;
  if (!lamps.until[corner]) return 1;
  const slot = Math.floor(lampClock / FLICKER_SLOT_S) + lamps.seed * 4 + corner;
  const hash = Math.sin(slot * 12.9898) * 43758.5453;
  return hash - Math.floor(hash) < FLICKER_OFF ? 0 : 1;
}

/**
 * Whether a car's headlights are flickering now (either front lamp in its flicker).
 * @param car the car
 * @returns they are
 */
export function isHeadlightFlickering(car: LampCar): boolean {
  const lamps = car.lampSim;
  return !!lamps && [0, 1].some((corner) => lamps.until[corner] > 0
    && (car.dmg ? car.dmg[corner] : 0) < LAMP_GONE && !lamps.dead[corner]);
}

/**
 * Whether a car has a headlight that works (not smashed, not dead): only then can it flash.
 * @param car the car
 * @returns it has
 */
export function hasWorkingHeadlight(car: LampCar): boolean {
  const lamps = car.lampSim;
  return [0, 1].some((corner) => (car.dmg ? car.dmg[corner] : 0) < LAMP_GONE
    && !(lamps && lamps.dead[corner]));
}
