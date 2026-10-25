// CAR LAMPS SETTLE (?carlamps=1; owner: a car's lamps should behave like the street lights -
// flicker when damaged, then by chance work normally again or fail, by how much damage there
// is). A hit that adds damage to a lamp's corner sets it flickering for SETTLE_MIN_MS ..
// SETTLE_MAX_MS; then it settles: steady at full, or dead, dying by DIE_BASE plus DIE_PER_SHARE
// of the corner's damage share (between LAMP_OK and LAMP_GONE). A corner past LAMP_GONE is
// smashed: dark. A repair (RESET / RESTART: less damage than it had) brings it back. The flicker
// is the same for every reader in one FLICKER_SLOT_MS (the picture, the glow and the beam agree
// within a frame). Wall clock: it is only a look.
import type { RenderCar } from './types.ts';

// damage share at which a lamp starts to suffer, and at which it is smashed
export const LAMP_OK = 0.15, LAMP_GONE = 0.35;
// a hit's flicker, ms; the death chance (as the street lights: world/lamps.ts)
const SETTLE_MIN_MS = 3000, SETTLE_MAX_MS = 8000, DIE_BASE = 0.15, DIE_PER_SHARE = 0.7;
// damage a hit must add to count, and the flicker's slot and how often it is off in it
const HIT_DAMAGE = 0.01, FLICKER_SLOT_MS = 70, FLICKER_OFF = 0.45;

/** One lamp's state: the damage it last saw, when its flicker settles (0: none), dead, and
 * its own flicker seed (cars do not flicker in step). */
interface LampState {
  seen: number;
  until: number;
  dead: boolean;
  seed: number;
}

let isOn = false;
const states = new WeakMap<RenderCar, LampState[]>();

/**
 * Turns the settling car lamps on or off (?carlamps=1).
 * @param isWanted true to settle them
 */
export function setCarLamps(isWanted: boolean): void {
  isOn = isWanted;
}

/**
 * Whether the settling car lamps are on.
 * @returns true when on
 */
export function carLampsSettle(): boolean {
  return isOn;
}

/**
 * Whether a flickering lamp is off in this slot (the same answer all slot long).
 * @param seed the lamp's flicker seed
 * @param now the wall clock, ms
 * @returns true when off
 */
function flickersOff(seed: number, now: number): boolean {
  const slot = Math.floor(now / FLICKER_SLOT_MS) + seed;
  const hash = Math.sin(slot * 12.9898) * 43758.5453;
  return hash - Math.floor(hash) < FLICKER_OFF;
}

/**
 * A lamp's level by its corner's damage, flickering after a hit and then settling.
 * @param car the car
 * @param corner the corner (0 front -y, 1 front +y, 2 rear -y, 3 rear +y)
 * @param damage the corner's damage, 0..1
 * @returns the level, 0..1
 */
export function settledLampLevel(car: RenderCar, corner: number, damage: number): number {
  let lamps = states.get(car);
  if (!lamps) {
    lamps = [0, 1, 2, 3].map(() => ({ seen: 0, until: 0, dead: false,
      seed: Math.floor(Math.random() * 1e6) }));
    states.set(car, lamps);
  }
  const lamp = lamps[corner], now = performance.now();
  // repaired: as new
  if (damage < lamp.seen - HIT_DAMAGE) Object.assign(lamp, { seen: damage, until: 0, dead: false });
  if (damage >= LAMP_GONE) return 0;
  if (damage > lamp.seen + HIT_DAMAGE) {
    lamp.seen = damage;
    if (damage > LAMP_OK && !lamp.dead) {
      lamp.until = now + SETTLE_MIN_MS + Math.random() * (SETTLE_MAX_MS - SETTLE_MIN_MS);
    }
  }
  if (lamp.dead) return 0;
  if (!lamp.until) return 1;
  if (now < lamp.until) return flickersOff(lamp.seed, now) ? 0 : 1;
  lamp.until = 0;
  const share = Math.min(1, Math.max(0, (damage - LAMP_OK) / (LAMP_GONE - LAMP_OK)));
  lamp.dead = Math.random() < DIE_BASE + DIE_PER_SHARE * share;
  return lamp.dead ? 0 : 1;
}
