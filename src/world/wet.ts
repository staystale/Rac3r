// WET GROUND (weather): the surfaces a tyre feels when the ground is DAMP (rain on it) or under a
// PUDDLE (standing water), and the DRY LINE cars drive into a damp track. One water system: a
// puddle is the existing 'wet' cover (wear.ts), damp is the same water spread thin; both read the
// owner's signed-off table (surfaces.ts WET_MU).
//
// DAMP between dry and the table's damp grip by how wet the ground is (0..1, in WET_BANDS steps,
// so every damp surface is built once and cached: groundAt never allocates). On hard ground the
// tyre reads its WET grip in proportion (wetK; cars.ts tyreGripOn) and the wheels leave the light
// "dried" wet mark, which is what shows the dry line. A cell's own dampness is the track's wetness
// less what tyres have dried there (rainDry), which the rain wins back over time.
import { SURFACES, WET_MU, MARK_WET, SPRAY_WET } from "./surfaces.ts";
import type { SurfaceId } from "./surfaces.ts";
import { WEATHER, WET_BANDS } from "./weather.ts";
import type { Surface, WearCell } from "./types.ts";

// damp ground at full wetness: the slip angle of peak grip comes a little earlier on wet hard
// ground (SURFACES.wet: 0.95), and damp sand ploughs less (it packs firm)
const DAMP_PEAK_HARD = 0.95, DAMP_SAND_PLOUGH = 0.6;
// below this dampness a hard surface keeps its own (no) mark: a barely damp road shows no trail
const DAMP_MARK_FROM = 0.3;
// 1/s toward ambient a soaked surface cools tyres at (SURFACES.wet), a puddle at least PUDDLE_COOL
const DAMP_COOL = 0.18, PUDDLE_COOL = 0.20;
// grip ratios for a surface missing from WET_MU (the gravel trap): gravel's
const OTHER_WET = { damp: 0.95, puddle: 0.8 };
// 1/s of the dry line won back per unit of rain: a downpour re-wets a fully dried cell in ~20 s
const REWET_PER_S = 0.05;

// keyed by the dry surface object, not its id: the gravel trap's depths all share id 'trap'
const DAMP = new Map<Surface, Surface[]>();
const PUDDLE = new Map<Surface, Surface>();

/**
 * The table's wet grip for a surface, mu.
 * @param surface the dry surface
 * @param kind 'damp' or 'puddle'
 * @returns mu
 */
function wetMu(surface: Surface, kind: 'damp' | 'puddle'): number {
  const row = WET_MU[surface.id as SurfaceId];
  return row ? row[kind] : surface.mu * OTHER_WET[kind];
}

/**
 * Builds a surface damp to one step.
 * @param surface the dry surface
 * @param band the dampness step, 1 .. WET_BANDS
 * @returns the damp surface
 */
function buildDamp(surface: Surface, band: number): Surface {
  const damp = band / WET_BANDS, hard = !!surface.hard;
  const marked = hard && damp >= DAMP_MARK_FROM;
  return {
    ...surface,
    under: surface.under || surface.id,
    label: 'DAMP ' + (surface.label || surface.id),
    mu: surface.mu + (wetMu(surface, 'damp') - surface.mu) * damp,
    peakK: hard ? surface.peakK * (1 - (1 - DAMP_PEAK_HARD) * damp) : surface.peakK,
    plough: surface.id === 'sand' ? surface.plough * (1 - (1 - DAMP_SAND_PLOUGH) * damp)
      : surface.plough,
    mark: marked ? MARK_WET : surface.mark,
    spray: marked ? SPRAY_WET : surface.spray,
    coolK: Math.max(surface.coolK || 0, DAMP_COOL * damp),
    wetK: damp,
  };
}

/**
 * A surface as it grips when damp (cached per surface and step).
 * @param surface the dry surface
 * @param damp how wet, 0 .. 1
 * @returns the damp surface (the dry one itself at 0)
 */
export function dampSurface(surface: Surface, damp: number): Surface {
  const band = Math.round(damp * WET_BANDS);
  if (band <= 0) return surface;
  let steps = DAMP.get(surface);
  if (!steps) DAMP.set(surface, steps = []);
  return steps[band] || (steps[band] = buildDamp(surface, band));
}

/**
 * A puddle (standing water) on a base: the table's puddle grip, less longitudinal bite, more drag,
 * the wet mark and spray. Cached per base.
 * @param base the dry surface under the water
 * @returns the puddle surface
 */
export function puddleSurface(base: Surface): Surface {
  if (base.id === 'wet') return base;
  const cached = PUDDLE.get(base);
  if (cached) return cached;
  const puddle: Surface = {
    ...base, id: 'puddle', under: base.id, label: 'PUDDLE (' + base.label + ')',
    mu: wetMu(base, 'puddle'), longK: (base.longK || 1) * 0.92,
    plough: (base.plough || 0) + 0.6, mark: MARK_WET, spray: SPRAY_WET,
    coolK: Math.max(PUDDLE_COOL, base.coolK || 0), wetK: 1,
  };
  PUDDLE.set(base, puddle);
  return puddle;
}

/**
 * How damp a wear cell is now: the track's wetness less the dry line tyres made there, which the
 * rain wins back since it was last driven.
 * @param cell the wear cell
 * @param clock the wear clock now, s
 * @returns 0 .. 1
 */
export function cellDamp(cell: WearCell, clock: number): number {
  if (WEATHER.wetness === 0) return 0;
  const dried = Math.max(0, (cell.rainDry || 0)
    - REWET_PER_S * WEATHER.rain * (clock - (cell.rainT || 0)));
  return WEATHER.wetness * (1 - dried);
}

/**
 * A tyre's pass over a damp cell dries it a little (wear.ts dryAmount: damp ground).
 * @param cell the wear cell (changed in place)
 * @param clock the wear clock now, s
 * @param dryBy the dryness this pass adds, 0 .. 1
 */
export function dryCellLine(cell: WearCell, clock: number, dryBy: number): void {
  if (WEATHER.wetness === 0) return;
  const damp = cellDamp(cell, clock);
  cell.rainDry = Math.min(1, 1 - damp / WEATHER.wetness + dryBy);
  cell.rainT = clock;
}

/** The dry surface a base id names (unknown ids: tarmac, as wear.ts surfaceOf). */
export function surfaceById(surfaceId: string): Surface {
  return SURFACES[surfaceId as SurfaceId] || SURFACES.tarmac;
}

/** How much of its dry grip a tarmac road has in today's wetness (1 when dry; the highway AI). */
export function roadWetGrip(): number {
  if (WEATHER.wetness === 0) return 1;
  return dampSurface(SURFACES.tarmac, WEATHER.wetness).mu / SURFACES.tarmac.mu;
}

/**
 * What a worn base becomes next (wear.ts BASE_WEAR): in hot and super hot weather dirt bakes to
 * GRAVEL rather than churning to mud (owner).
 * @param base the base now
 * @param next what the wear chain makes it
 * @returns what it becomes
 */
export function wornTo(base: string, next: string): string {
  const hot = WEATHER.kind === 'hot' || WEATHER.kind === 'superhot';
  return hot && base === 'dirt' && next === 'mud' ? 'gravel' : next;
}
