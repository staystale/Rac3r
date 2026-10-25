// PUNCTURES BY WHAT YOU HIT (owner: "objects should have a chance to cause
// puncture and it should be relevant to the object hit / run over - tyres or tarps don't risk much
// puncture but pallets, broken glass, sign posts have a higher chance"; table approved 10-24).
// MEASURED before (tools/scratch/_puncturehit.mjs): a hit losing 40 km/h or more punctured a tyre
// ~50 % of the time whatever was hit - a tyre wall as concrete - and a smaller one never. Each
// step the clamps, the car contacts and the loose objects note what a car hit (the sharpest
// wins); damage.ts scales its puncture roll by that kind's chance in a big hit (BIG_HIT_FLAT =
// the old flat chance, x1). Running into debris and over pallet nails have chances of their own.

/** A car that can note what it hit this step. */
interface HitNoter { _hitKind?: string | null }

// the chance a big hit punctured a tyre whatever was hit (damage.ts PUNCT_P's scale)
const BIG_HIT_FLAT = 0.5;
// the chance a big hit punctures a tyre, by how sharp or hard the thing is
const SOFT = 0.05, MEDIUM = 0.25, HARD = 0.35, SHARP = 0.5;
const BIG_HIT_CHANCE: Record<string, number> = {
  tyre: SOFT, tyrestack: SOFT, bale: SOFT, straw: SOFT, tarp: SOFT, cone: SOFT, box: SOFT,
  cardboard: SOFT, sheep: SOFT, fluff: SOFT,
  car: MEDIUM, barrel: MEDIUM, bin: MEDIUM, sandbag: MEDIUM, sand: MEDIUM, armco: MEDIUM,
  fence: MEDIUM, cow: MEDIUM, banger: MEDIUM, caravan: MEDIUM, truck: MEDIUM,
  wall: HARD, pitwall: HARD, building: HARD, grandstand: HARD, rock: HARD, tree: HARD,
  block: HARD, tower: HARD, sculpture: HARD,
  board: SHARP, chevron: SHARP, flag: SHARP, gantry: SHARP, pylon: SHARP, lamp: SHARP,
  tapepost: SHARP, windsock: SHARP, pallet: SHARP, crate: SHARP, splinters: SHARP,
  exhaust: SHARP, bumper: SHARP, wing: SHARP, panel: SHARP,
};
// anything not in the table counts as hard
const UNKNOWN = HARD;
// running into a piece of roadside debris (over DEBRIS_HIT_V, physics/tyrewear.ts): its chance
const DEBRIS_CHANCE: Record<string, number> = {
  pallet: 0.15, crate: 0.15, exhaust: 0.08, bumper: 0.08, wing: 0.08, panel: 0.08, box: 0.01,
  bin: 0.01, barrel: 0.01, sandbag: 0.01, tarp: 0,
};
// driving over a broken pallet's nails: the chance a second on them
const NAILS_CHANCE = 0.03;

// what a car hitting it meets as METAL ON METAL (sparks fly from a big hit: render/particles.ts)
const METAL = new Set(['car', 'banger', 'truck', 'caravan', 'armco', 'fence', 'barrel', 'gantry',
  'pylon', 'lamp', 'chevron', 'tower', 'windsock', 'exhaust', 'bumper', 'wing', 'panel']);

/**
 * Whether what the car hit this step is metal (a car's body meeting it is metal on metal).
 * Reads the step's hit without taking it (takeHitFactor does).
 * @param car the car
 * @returns true for metal
 */
export function hitIsMetal(car: HitNoter): boolean {
  return !!car._hitKind && METAL.has(car._hitKind);
}

/**
 * The chance a big hit on this kind of thing punctures a tyre.
 * @param kind what was hit (a barrier, solid, object kind, or 'car')
 * @returns the chance, 0..1
 */
const chanceOf = (kind: string) => BIG_HIT_CHANCE[kind] ?? UNKNOWN;

/**
 * Notes what a car hit this step (the sharpest of the step's hits counts).
 * @param car the car
 * @param kind what it hit
 */
export function noteHit(car: HitNoter, kind: string): void {
  const before = car._hitKind;
  if (!before || chanceOf(kind) > chanceOf(before)) car._hitKind = kind;
}

/**
 * Takes this step's hit kind off the car and gives the factor on the puncture roll.
 * @param car the car
 * @returns the kind's chance over the old flat one's
 */
export function takeHitFactor(car: HitNoter): number {
  const kind = car._hitKind;
  car._hitKind = null;
  return (kind ? chanceOf(kind) : UNKNOWN) / BIG_HIT_FLAT;
}

/**
 * The chance running into this debris, or a second on pallet nails, punctures a tyre.
 * @param kind the object's kind ('splinters': the nails)
 * @returns the chance
 */
export function debrisChance(kind: string): number {
  return kind === 'splinters' ? NAILS_CHANCE : DEBRIS_CHANCE[kind] ?? 0;
}
