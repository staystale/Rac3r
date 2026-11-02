// core/steerfeel.ts - THE PLAYER'S STEERING FEEL (owner 11-02: the stick gave full lock in 38 px
// at any speed, so at 120 km/h the front tyres ran out of grip in the first 4-6 px; "I was
// thinking C but an expo like B would be cool but we'd have to make it customisable in settings
// for the player"). Two settings, each 0 (off: the stick as it was) .. 1, on the SETTINGS screen
// (menu/settings.ts), remembered on the device (localStorage rac3r.steer):
//   CURVE  (B) an expo on the stick, the same at every speed: steer = x^(1 + curve x
//          (CURVE_POW_MAX - 1)). At full, half the stick gives a sixth of the lock; the end of the
//          stick is still full lock.
//   THROW  (C) more thumb for full lock as the car goes faster: the stick's reach grows by up to
//          throw x THROW_GROW of itself, reached at THROW_V. Full lock is always there - it is
//          never speed-limited steering - it just takes a longer push at speed.
// Touch only: the keyboard's left / right are all-or-nothing.

const KEY = 'rac3r.steer';
const CURVE_POW_MAX = 2.6;
const THROW_GROW = 1.0, THROW_V = 33;   // x2 the reach at 120 km/h with THROW at 1

/** The two settings, 0..1 each. */
export const STEER_FEEL = { curve: 0, throw: 0 };

/** Read the saved settings (private windows: the defaults). */
function load(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<typeof STEER_FEEL>
      | null;
    if (saved) {
      STEER_FEEL.curve = clamp01(saved.curve);
      STEER_FEEL.throw = clamp01(saved.throw);
    }
  } catch { /* no storage: defaults */ }
}

/**
 * A setting value made safe.
 * @param value anything
 * @returns 0..1
 */
function clamp01(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : 0;
}

/**
 * Change one setting and remember it.
 * @param key curve or throw
 * @param value 0..1
 */
export function setSteerFeel(key: keyof typeof STEER_FEEL, value: number): void {
  STEER_FEEL[key] = clamp01(value);
  try {
    localStorage.setItem(KEY, JSON.stringify(STEER_FEEL));
  } catch { /* fine */ }
}

/**
 * The stick's reach for full lock at a speed (THROW).
 * @param basePx the reach at rest, px
 * @param speed the car's speed, m/s
 * @returns px of thumb for full lock
 */
export function stickReach(basePx: number, speed: number): number {
  return basePx * (1 + STEER_FEEL.throw * THROW_GROW * Math.min(1, Math.abs(speed) / THROW_V));
}

/**
 * The stick's share of its reach turned into the steer the car gets (CURVE).
 * @param share -1..1 of the reach
 * @returns -1..1
 */
export function curveSteer(share: number): number {
  const pow = 1 + STEER_FEEL.curve * (CURVE_POW_MAX - 1);
  return Math.sign(share) * Math.abs(share) ** pow;
}

load();
