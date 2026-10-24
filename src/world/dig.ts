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

// GROUND WEAR CHANCES (owner): DAMP sand turns to gravel and damp gravel to dirt by
// DAMP_LOOSE_WEAR a pass (a churned puddle still more: wear.ts WATER_CHURN_CHANCE); dry sand and
// gravel keep their surface; worn dirt goes by wornDirtTo below
const DAMP_LOOSE_WEAR = 0.1;
const DAMP_WORN_TO: Record<string, string> = { sand: 'gravel', gravel: 'dirt' };

// WORN DIRT (owner): DRY dirt turns to mud less the hotter the track - DIRT_TO_MUD_COOL
// at DIRT_COOL_C and below, falling evenly to DIRT_TO_MUD_HOT at DIRT_HOT_C (20 C: ~0.18, 30 C:
// ~0.10); damp ground slides from that up to always (wet). It BAKES to gravel more the hotter:
// none at DIRT_BAKE_FROM_C, DIRT_TO_GRAVEL_HOT at DIRT_BAKE_FULL_C and over (35 C: ~0.12), less
// the damper.
const DIRT_TO_MUD_COOL = 0.25, DIRT_TO_MUD_HOT = 0.03, DIRT_COOL_C = 10, DIRT_HOT_C = 40;
const DIRT_TO_GRAVEL_HOT = 0.25, DIRT_BAKE_FROM_C = 25, DIRT_BAKE_FULL_C = 45;

/** A share 0..1 of the way from one temperature to another. */
const heatShare = (trackC: number, fromC: number, toC: number) =>
  Math.max(0, Math.min(1, (trackC - fromC) / (toC - fromC)));

/**
 * The chance worn dirt turns to mud when its passes are done.
 * @param wetShare how damp the cell is, 0 (dry) .. 1 (wet enough to wear faster)
 * @param trackC the track temperature, C
 * @returns the chance, 0..1
 */
export function dirtToMudChance(wetShare: number, trackC: number): number {
  const heat = heatShare(trackC, DIRT_COOL_C, DIRT_HOT_C);
  const dry = DIRT_TO_MUD_COOL + (DIRT_TO_MUD_HOT - DIRT_TO_MUD_COOL) * heat;
  const share = Math.max(0, Math.min(1, wetShare));
  return dry + (1 - dry) * share;
}

/**
 * The chance worn dirt bakes to gravel when its passes are done.
 * @param wetShare how damp the cell is, 0 (dry) .. 1 (wet)
 * @param trackC the track temperature, C
 * @returns the chance, 0..1
 */
export function dirtToGravelChance(wetShare: number, trackC: number): number {
  const dry = 1 - Math.max(0, Math.min(1, wetShare));
  return DIRT_TO_GRAVEL_HOT * heatShare(trackC, DIRT_BAKE_FROM_C, DIRT_BAKE_FULL_C) * dry;
}

/**
 * What worn dirt becomes when its passes are done: mud, gravel or (null) still
 * dirt, from one draw against the two chances.
 * @param wetShare how damp the cell is, 0 (dry) .. 1 (wet)
 * @param trackC the track temperature, C
 * @returns the new surface id, or null to stay dirt
 */
export function wornDirtTo(wetShare: number, trackC: number): string | null {
  const draw = Math.random(), toMud = dirtToMudChance(wetShare, trackC);
  if (draw < toMud) return 'mud';
  return draw < toMud + dirtToGravelChance(wetShare, trackC) ? 'gravel' : null;
}

/**
 * Whether ground whose passes are done stays as it is this time: dry mud always (it thickens
 * only with water, levelmud.ts); dirt goes by wornDirtTo instead.
 * @param base the surface id
 * @param wet whether the cell is wet enough to wear faster
 * @returns true to keep the base
 */
export function wearHolds(base: string, wet: boolean): boolean {
  return base === 'mud' && !wet;
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
