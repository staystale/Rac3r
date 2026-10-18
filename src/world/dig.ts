// dig.ts - HOW THE GROUND DENTS: the rut each tyre pass digs into soft ground (wear.ts digRut
// applies it to the wear cells; terrain.ts bumpAt lowers the ground by it), and which bare ground
// gets wear cells when dry so it can dent.

/** One ground's dig: m per pass, the floor (m), and the chance a pass digs at all. */
export interface DigRule { step: number; max: number; chance: number }

// RUT depth per soft base: m per pass, cap, and the chance a pass digs at all
const RUT: Record<string, DigRule> = {
  mud: { step: 0.025, max: 0.15, chance: 1 },
  thickMud: { step: 0.03, max: 0.22, chance: 1 },
  sand: { step: 0.02, max: 0.12, chance: 0.5 },
  gravel: { step: 0.015, max: 0.08, chance: 0.35 },
};
// SAND DIG (the default since 2026-10-18, ?sanddig=0 off; owner: sand the easiest ground to dent,
// dry or wet, with a deep floor so bumps wear down; mud and thick mud dent dry too, slower than
// wet): sand digs every pass, faster than thick mud; dry sand and thick mud get wear cells; a
// churned puddle on gravel leaves dirt
const SAND_DIG: DigRule = { step: 0.04, max: 0.45, chance: 1 };
const DIG_DRY = new Set(['sand', 'thickMud']), DRY_MUD_DIG = 0.5;
// GRAVEL DIG (the default since 2026-10-18, ?graveldig=0 off; owner: gravel dents like sand but
// takes more passes; both dent faster when wet)
const GRAVEL_DIG: DigRule = { step: 0.02, max: 0.3, chance: 1 }, WET_LOOSE_DIG = 1.5;

let sandDig = false, gravelDig = false;

/**
 * Sand dents fastest, dry too; dry mud digs slower; churned gravel leaves dirt (?sanddig).
 * @param isOn true for the sand dig
 */
export function setSandDig(isOn: boolean): void { sandDig = isOn; }

/**
 * Gravel digs like sand, slower; sand and gravel dig faster wet (?graveldig=1).
 * @param isOn true for the gravel dig
 */
export function setGravelDig(isOn: boolean): void { gravelDig = isOn; }

/**
 * Whether bare dry ground of this base gets a wear cell (it can dent).
 * @param base the surface id
 * @returns true when it digs dry
 */
export function digsDry(base: string): boolean {
  return (sandDig && DIG_DRY.has(base)) || (gravelDig && base === 'gravel');
}

/**
 * What a puddle churned into this base leaves, when the dig changes it (?sanddig: gravel -> dirt).
 * @param base the surface id
 * @returns the surface id, or null for the usual mix
 */
export function churnedTo(base: string): string | null {
  return sandDig && base === 'gravel' ? 'dirt' : null;
}

/**
 * The dig rule of a base, or undefined for ground that does not dent.
 * @param base the surface id
 * @returns the rule
 */
export function digRuleOf(base: string): DigRule | undefined {
  if (sandDig && base === 'sand') return SAND_DIG;
  if (gravelDig && base === 'gravel') return GRAVEL_DIG;
  return RUT[base];
}

/**
 * How fast a pass digs for the ground's dampness: dry mud at DRY_MUD_DIG (?sanddig), wet sand and
 * gravel at WET_LOOSE_DIG (?graveldig), else 1.
 * @param base the cell's base
 * @param wet whether the cell is wet enough to wear faster (wear.ts WET_WEAR_FROM)
 * @returns the step's factor
 */
export function digPace(base: string, wet: boolean): number {
  if (sandDig && !wet && (base === 'mud' || base === 'thickMud')) return DRY_MUD_DIG;
  if (gravelDig && wet && (base === 'sand' || base === 'gravel')) return WET_LOOSE_DIG;
  return 1;
}
