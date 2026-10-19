// dig.ts - HOW THE GROUND DENTS: the rut each tyre pass digs into soft ground (wear.ts digRut
// applies it to the wear cells; terrain.ts bumpAt lowers the ground by it), and which bare ground
// gets wear cells when dry so it can dent.

/** One ground's dig: m per pass, the floor (m), and the chance a pass digs at all. */
export interface DigRule { step: number; max: number; chance: number }

// RUT depth per soft base: m per pass, cap, and the chance a pass digs at all.
// SAND (owner: the easiest ground to dent, dry or wet, with a deep floor so bumps wear down)
// digs every pass, faster than thick mud; GRAVEL (owner: dents like sand but takes more passes);
// mud and thick mud dent dry too, slower than wet; sand and gravel dent faster wet
const RUT: Record<string, DigRule> = {
  mud: { step: 0.025, max: 0.15, chance: 1 },
  thickMud: { step: 0.03, max: 0.22, chance: 1 },
  sand: { step: 0.04, max: 0.45, chance: 1 },
  gravel: { step: 0.02, max: 0.3, chance: 1 },
};
// bare dry ground that gets wear cells (it can dent); dry mud's dig pace; wet sand / gravel's
const DIG_DRY = new Set(['sand', 'thickMud', 'gravel']), DRY_MUD_DIG = 0.5, WET_LOOSE_DIG = 1.5;

/**
 * Whether bare dry ground of this base gets a wear cell (it can dent).
 * @param base the surface id
 * @returns true when it digs dry
 */
export function digsDry(base: string): boolean {
  return DIG_DRY.has(base);
}

/**
 * What a puddle churned into this base leaves, when the dig changes it (gravel -> dirt).
 * @param base the surface id
 * @returns the surface id, or null for the usual mix
 */
export function churnedTo(base: string): string | null {
  return base === 'gravel' ? 'dirt' : null;
}

/**
 * The dig rule of a base, or undefined for ground that does not dent.
 * @param base the surface id
 * @returns the rule
 */
export function digRuleOf(base: string): DigRule | undefined {
  return RUT[base];
}

/**
 * How fast a pass digs for the ground's dampness: dry mud at DRY_MUD_DIG, wet sand and gravel at
 * WET_LOOSE_DIG, else 1.
 * @param base the cell's base
 * @param wet whether the cell is wet enough to wear faster (wear.ts WET_WEAR_FROM)
 * @returns the step's factor
 */
export function digPace(base: string, wet: boolean): number {
  if (!wet && (base === 'mud' || base === 'thickMud')) return DRY_MUD_DIG;
  if (wet && (base === 'sand' || base === 'gravel')) return WET_LOOSE_DIG;
  return 1;
}

// GROUND WEAR CHANCES (owner): DRY dirt turns to mud only DRY_DIRT_TO_MUD of the times its passes
// are done (wet dirt as before); DAMP sand turns to gravel and damp gravel to dirt by
// DAMP_LOOSE_WEAR a pass (a churned puddle still more: wear.ts WATER_CHURN_CHANCE); dry sand and
// gravel keep their surface
const DRY_DIRT_TO_MUD = 0.25, DAMP_LOOSE_WEAR = 0.1;
const DAMP_WORN_TO: Record<string, string> = { sand: 'gravel', gravel: 'dirt' };

/**
 * Whether ground whose passes are done stays as it is this time (dry dirt 3 in 4).
 * @param base the surface id
 * @param wet whether the cell is wet enough to wear faster
 * @returns true to keep the base
 */
export function wearHolds(base: string, wet: boolean): boolean {
  return !wet && base === 'dirt' && Math.random() >= DRY_DIRT_TO_MUD;
}

/**
 * What damp loose ground turns into on this pass (sand -> gravel, gravel -> dirt).
 * @param base the surface id
 * @param wet whether the cell is wet enough to wear faster
 * @returns the new surface id, or null to stay
 */
export function dampWornTo(base: string, wet: boolean): string | null {
  if (!wet || !DAMP_WORN_TO[base]) return null;
  return Math.random() < DAMP_LOOSE_WEAR ? DAMP_WORN_TO[base] : null;
}
