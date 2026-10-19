// TYRE WEAR (owner, 2026-10-18): a set of tyres wears out over several races (or one
// long aggressive one) - a running cost and a choice, never a nag. New tyres come only from the
// garage (fitting a set). Each wheel wears by the friction work it does (tyreheat.ts, the same
// work that heats it), faster when it runs above its temperature window, on ground it is not made
// for (its own grip table), and the owner's rule: dry tyres wear SLOWER in the wet, rain tyres
// FASTER in the dry. A worn tyre loses a fair bit of grip (more on wet ground: a bald tyre
// aquaplanes) and can puncture: the hotter and the more worn, the likelier; a healthy tyre in its
// window never punctures by chance (no random draw at all), so nothing happens out of the blue.
// Crashes (damage.js) and debris (cones/coneCar.js) may puncture too.

/** The tyre fields wear reads (cars.ts Tyre). */
interface WearTyre { grip: Record<string, number>; bySurf?: Record<string, number> }
/** The surface fields wear reads. */
interface WearSurface { id: string; under?: string; wetK?: number; hard?: boolean }

// wear per joule of friction work, per tonne of car (a heavier car does more work for the same
// driving). MEASURED (tools: a hatch racing 3 laps of Castle Cum at Realish ~0.1 of a set on its
// busiest tyre; a long aggressive race several times that) - see TODO.md
const WEAR_PER_J = 1.8e-7;
// a rain tyre (cars.ts: KUM Wet 1.22, PIRRELLY Full Wet 1.35); how wet ground must be to count
const RAIN_TYRE_WET = 1.2, WET_FROM = 0.3;
// dry tyres on wet ground wear this much slower; rain tyres on dry hard ground this much faster
const DRY_TYRE_IN_WET = 0.6, RAIN_TYRE_IN_DRY = 2.5;
// a tyre on ground it is not made for (its grip there below WRONG_FROM): faster by this per unit
const WRONG_FROM = 0.97, WRONG_GAIN = 4;
// above its window: faster by 1 per this many C
const HOT_WEAR_PER_C = 25;
// GRIP: a fully worn tyre keeps 1 - WORN_GRIP of its grip (curve WORN_EXP), and on wet ground
// another WORN_WET of it at wetness 1
const WORN_GRIP = 0.2, WORN_EXP = 1.3, WORN_WET = 0.25;
// PUNCTURES, chance a second: from heat (C above the window plus a margin, per HEAT_SPAN C, ^2)
// and from wear (past WORN_RISK_FROM, ^2)
const HEAT_MARGIN_C = 10, HEAT_SPAN_C = 40, HEAT_RISK_PER_S = 1 / 60;
const WORN_RISK_FROM = 0.7, WORN_RISK_PER_S = 1 / 150;
// SLIDING (owner, 2026-10-18: faster when sliding, faster still when wheelspinning /
// doing donuts; hot tyres wear more from a slide, as in real life; a cold slide no extra): a
// scrubbing wheel wears x 1 + SLIDE_WEAR x tanh(slip / SLIDE_WEAR_V), the gain itself x 1 per
// HOT_SLIDE_PER_C above the window. The heat model's work saturates its slip at ~4 m/s and fades
// with speed (so tyres stay hard to overheat); this puts the real slip back for the rubber.
const SLIDE_WEAR = 1, SLIDE_WEAR_V = 12, HOT_SLIDE_PER_C = 60;
// a hard hit on debris (m/s), its chance; driving over splinters (nails), its chance a pass
const DEBRIS_HIT_V = 3, DEBRIS_CHANCE = 0.04, SPLINTER_CHANCE = 0.01;

/**
 * How much faster than normal a tyre wears on this ground at this temperature.
 * @param tyre the fitted tyre, or null (Pre-Spun)
 * @param surface the ground
 * @param overC C above the top of the tyre's window (0 inside it)
 * @returns the factor
 */
function wearFactor(tyre: WearTyre | null | undefined, surface: WearSurface, overC: number) {
  const wet = (surface.wetK || 0) >= WET_FROM;
  const rain = !!tyre && (tyre.grip.wet ?? 1) >= RAIN_TYRE_WET;
  let factor = 1 + Math.max(0, overC) / HOT_WEAR_PER_C;
  if (wet && !rain) factor *= DRY_TYRE_IN_WET;
  if (!wet && rain && surface.hard) factor *= RAIN_TYRE_IN_DRY;
  const own = tyre && tyre.bySurf ? tyre.bySurf[surface.under || surface.id] ?? 1 : 1;
  if (own < WRONG_FROM) factor *= 1 + WRONG_GAIN * (WRONG_FROM - own);
  return factor;
}

/** The car fields wear reads and writes. */
interface WearCar {
  tyreWear?: number[];
  tyreT: number[];
  surface: WearSurface;
  punct?: boolean[];
}

/**
 * Wears the four tyres by this step's friction work, and lets a hot or worn one puncture.
 * @param car the car (tyreWear changed in place)
 * @param tyre the fitted tyre, or null (Pre-Spun)
 * @param window the tyre's working window [low, high], C
 * @param massKg the car's mass
 * @param wheelWork each wheel's friction work this step, W
 * @param dt seconds
 * @param wheelSlip each wheel's slip speed while it scrubs (0 rolling), m/s
 * @returns the tyre index that punctured this step, or -1
 */
export function wearTyres(car: WearCar, tyre: WearTyre | null | undefined, window: number[],
    massKg: number, wheelWork: number[], dt: number, wheelSlip: number[]): number {
  // a car without a saved set (the AI, a fresh pick) starts on new tyres
  if (!car.tyreWear) car.tyreWear = [0, 0, 0, 0];
  const wear = car.tyreWear, perTonne = 1000 / Math.max(500, massKg);
  let burst = -1;
  for (let i = 0; i < 4; i++) {
    const overC = car.tyreT[i] - window[1];
    const slide = wheelSlip[i] > 0 ? 1 + SLIDE_WEAR
      * Math.tanh(wheelSlip[i] / SLIDE_WEAR_V) * (1 + Math.max(0, overC) / HOT_SLIDE_PER_C) : 1;
    wear[i] = Math.min(1, wear[i] + wheelWork[i] * dt * WEAR_PER_J * perTonne
      * wearFactor(tyre, car.surface, overC) * slide);
    const heat = Math.max(0, overC - HEAT_MARGIN_C) / HEAT_SPAN_C;
    const worn = Math.max(0, wear[i] - WORN_RISK_FROM) / (1 - WORN_RISK_FROM);
    const risk = HEAT_RISK_PER_S * heat * heat + WORN_RISK_PER_S * worn * worn;
    if (risk > 0 && burst < 0 && Math.random() < risk * dt) burst = i;
  }
  return burst;
}

/**
 * The grip a worn pair of tyres keeps (an axle: the mean of its two), less on wet ground.
 * @param wearA one tyre's wear, 0..1
 * @param wearB the other's
 * @param wetK how wet the ground is, 0..1
 * @returns the grip factor, 1 = new
 */
export function wornGrip(wearA: number, wearB: number, wetK = 0): number {
  const worn = (wearA + wearB) / 2;
  return (1 - WORN_GRIP * worn ** WORN_EXP) * (1 - WORN_WET * worn * wetK);
}

/**
 * Whether a hit on loose debris punctures a tyre (a small chance; owner).
 * @param kind the object's kind
 * @param closingV the closing speed, m/s
 * @param isDebris whether the object is breakable debris (cones/coneConsts.js DEBRIS)
 * @returns true to puncture
 */
export function debrisPunctures(kind: string, closingV: number, isDebris: boolean): boolean {
  if (kind === 'splinters') return Math.random() < SPLINTER_CHANCE;
  return isDebris && closingV > DEBRIS_HIT_V && Math.random() < DEBRIS_CHANCE;
}

/**
 * The colour of a tyre in the HUD diagram by its wear (owner: colour, the numbers are the heat):
 * the colour table's good / warn / danger.
 * @param wear 0 new .. 1 bald
 * @param colours the HUD colour table (live, warn, danger)
 * @returns a CSS colour
 */
export function wearColour(wear: number, colours: { live: string; warn: string; danger: string }) {
  return wear < 0.45 ? colours.live : wear < 0.75 ? colours.warn : colours.danger;
}
