// CAR LAMPS SETTLE (owner: a car's lamps should behave like the street lights -
// flicker when damaged, then by chance work normally again or fail, by how much damage there
// is). A hit that adds damage to a lamp's corner sets it flickering for SETTLE_MIN_MS ..
// SETTLE_MAX_MS; then it settles: steady at full, or dead, dying by DIE_BASE plus DIE_PER_SHARE
// of the corner's damage share (between LAMP_OK and LAMP_GONE). A corner past LAMP_GONE is
// smashed: dark. A repair (RESET / RESTART: less damage than it had) brings it back. The flicker
// is the same for every reader in one FLICKER_SLOT_MS (the picture, the glow and the beam agree
// within a frame). Wall clock: it is only a look.
import { makeLookRandom } from "./shared.ts";
import { LAMP_OK, LAMP_GONE, SETTLE_MIN_S, SETTLE_MAX_S, DIE_BASE, DIE_PER_SHARE, HIT_DAMAGE,
  FLICKER_SLOT_S, FLICKER_OFF } from '../physics/lampsim.ts';
import type { RenderCar } from './types.ts';

// (the rule's numbers are the sim's: physics/lampsim.ts, the sim-clock lamps; a car the sim does
// not step - none in a race - settles here, on the wall clock)
export { LAMP_OK, LAMP_GONE };
// a hit's flicker, ms; the flicker's slot, ms
const SETTLE_MIN_MS = SETTLE_MIN_S * 1000, SETTLE_MAX_MS = SETTLE_MAX_S * 1000;
const FLICKER_SLOT_MS = FLICKER_SLOT_S * 1000;

/** One lamp's state: the damage it last saw, when its flicker settles (0: none), dead, and
 * its own flicker seed (cars do not flicker in step). */
interface LampState {
  seen: number;
  until: number;
  dead: boolean;
  seed: number;
}

const states = new WeakMap<RenderCar, LampState[]>();
// the lamps' own random numbers: a car's lamps are first read when it is drawn or lit, and the
// drawing skips a car off the view (render/screen.ts forEachDrawnCar), so they draw from no other
// look's stream (salt: any count far from the looks' own)
const lampRandom = makeLookRandom(0x5a17_0000);

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
      seed: Math.floor(lampRandom() * 1e6) }));
    states.set(car, lamps);
  }
  const lamp = lamps[corner], now = performance.now();
  // repaired: as new
  if (damage < lamp.seen - HIT_DAMAGE) Object.assign(lamp, { seen: damage, until: 0, dead: false });
  if (damage >= LAMP_GONE) return 0;
  if (damage > lamp.seen + HIT_DAMAGE) {
    lamp.seen = damage;
    if (damage > LAMP_OK && !lamp.dead) {
      lamp.until = now + SETTLE_MIN_MS + lampRandom() * (SETTLE_MAX_MS - SETTLE_MIN_MS);
    }
  }
  if (lamp.dead) return 0;
  if (!lamp.until) return 1;
  if (now < lamp.until) return flickersOff(lamp.seed, now) ? 0 : 1;
  lamp.until = 0;
  const share = Math.min(1, Math.max(0, (damage - LAMP_OK) / (LAMP_GONE - LAMP_OK)));
  lamp.dead = lampRandom() < DIE_BASE + DIE_PER_SHARE * share;
  return lamp.dead ? 0 : 1;
}
