// cars.js — THE ROSTER. Five cars, one table (PLAN.md "The roster").
//
// Every car is the SAME model with different numbers. If a car needs a special case in vehicle.js,
// the seam is broken (CLAUDE.md rule 6) — the difference belongs in this file.
//
// drive: 1.0 = front, 0.0 = rear, 0.5 = four-wheel.  THIS IS THE LOAD-BEARING NUMBER of the slice:
// drive force is split per axle by it and each axle's friction ellipse eats its own lateral budget.
// If all five cars feel the same, that split is not wired up (PLAN.md "What would count as wrong").
//
// Izz is computed, not authored: mass*(len^2 + wid^2)/12.
// Torque curves are 7-point tables, not a single peak — the shape is what makes gearing matter.

import type { Mark, Spray } from './world/types.ts';
import { dragOf, realCurve, tyreR } from './realcars.ts';

export const GRAVITY = 9.81;

// mods — THE ONLY SEAM between the game layer and the physics (CLAUDE.md rule 6). Every entry
// defaults to a no-op, so a stock car drives exactly as it did before upgrades existed. Nothing in
// vehicle.js may read a part name, an archetype or a pip. Slice 1 never sets any of these; they
// exist so slice 3 is an afternoon instead of a rewrite. What defaultMods returns: eight
// multipliers, 1 = no-op.
export interface Mods {
  power: number; shiftTime: number; inertia: number; gripLat: number;
  gripLong: number; brakeTorque: number; mass: number; rigidity: number;
}

// A surface as the physics reads it (SURFACE_LAB, and the entries built in src/world/surfaces.ts).
export interface Surface {
  id: string; mu: number; plough: number; hard: boolean;
  label?: string; peakK?: number; longK?: number; rough?: number;
  mark?: Mark | null; spray?: Spray | null; coolK?: number; heatK?: number; under?: string;
  wetK?: number;   // how wet, 0..1 (world/wet.ts damp and puddle surfaces)
  gripWetK?: number;   // the tyre's WET grip share on damp ground / a puddle (world/wet.ts)
  brush?: number;   // 1/s: a bush's drag, growing with speed (physics/tyres.ts)
}

// A torque table: [rpm, Nm] points.
export type Curve = [number, number][];

// One tyre model: its grip multipliers per surface and its optional heat-window fields.
export interface Tyre {
  id: string; brand: string; name: string; price: number; fits: string[];
  grip: Record<string, number>; bySurf?: Record<string, number>;
  opt?: [number, number]; peak?: number; cold?: number; slide?: number; heatHard?: number;
  note?: string;
  rims?: [number, number];   // the rim sizes it is made in, inches
}

// One ROSTER entry: the fields every car states, and the optional ones only some cars state.
export interface RosterRow {
  id: string; name: string; kind: string; cls: string; sub: string;
  cg: number; rideH: number; aids?: { abs: boolean; tcs: boolean };
  mass: number; lf: number; lr: number; len: number; wid: number;
  drive: number; brakeBiasF: number; caF: number; caR: number; mu: number;
  curve: Curve; redline: number; upshiftRpm: number; downshiftRpm: number;
  gears: number[]; finalDrive: number; dragC: number;
  paint: string; trim: string; glass: string;
  izzK?: number; rim?: string; aiK?: number; aeroK?: number; downforceF?: number;
  downforceR?: number;
  susF?: number; susZ?: number; trackWidth?: number; tyreWidth?: number; idleRpm?: number;
  wheelR?: number; cyl?: number; steerMax?: number;
  tyreOpt?: [number, number]; tyrePeak?: number; tyreColdGrip?: number;
  rimIn?: number; stockTyre?: string;   // its rim, inches; its own factory set
}

export function defaultMods(): Mods {
  return {
    power: 1.0,        // engine torque multiplier
    shiftTime: 1.0,    // gearbox: <1 is faster
    inertia: 1.0,      // drivetrain: <1 revs faster
    gripLat: 1.0,      // tyres: lateral friction
    gripLong: 1.0,     // tyres: longitudinal friction
    brakeTorque: 1.0,  // brakes: clamp force
    mass: 1.0,         // chassis + fuel load
    rigidity: 1.0,     // suspension / structure (unused in slice 1)
  };
}

// surface — A6. One multiplier into the grip term, defaulting to a no-op. The lab floor is the only
// surface this slice; adding it later would mean re-tuning every number in the bench grid.
export const SURFACE_LAB: Surface = { id: 'lab', mu: 1.0, plough: 0, hard: true };

// Shared defaults (PLAN.md). Anything a car does not state comes from here.
const SHARED = {
  // cgH: the tuned weight-transfer height every car shares (handling the user has approved). The
  // per-car cg / rideH below (requirement: easier to give cars cg and ride height) feed the
  // ROLLOVER threshold (track / 2 x cg) and the shadow, not the handling.
  cgH: 0.52,
  wheelR: 0.30,
  trackWidth: 1.5,
  tyreWidth: 0.20,
  // Fraction of peak grip a fully-sliding tyre retains. 0.75 -> 0.88 -> 1.00. The last step came
  // from the user tuning it by hand and is worth more than it looks: at 1.00, FmaxSlide ==
  // FmaxRoll, so the rolling and sliding laws agree in MAGNITUDE and the 2.8x force step at
  // breakaway that caused the track-car judder simply stops existing.
  slideGrip: 0.85,
  shiftTime: 0.25,
  // in g of demand at full pedal; A7 turns this into newtons. MEASURED: at 1.0 the front
  // axle can NEVER lock (demand 0.65 g vs ~0.72 g of capacity under load transfer), so only the
  // rear pair ever marked and PLAN.md's acceptance shot "four straight parallel lines, front pair
  // darker" was unreachable. Worse, full pedal was also the FASTEST stop (45.1 m vs 49.9 m at 85%),
  // so lock-up cost nothing and there was no threshold-braking skill. At 1.35 full pedal locks all
  // four and the optimum moves below 100%, which is what makes the marks mean something. 1.35 ->
  // 1.8 (requirement: braking effort needs to be turned up — I can no longer lock up the brakes).
  // MEASURED, warm tyres, ABS off, 100 km/h: at 1.35 the rally, track and naffcar could not lock at
  // all (warm tyres grip more since flex heat); at 1.8 every car can, and stops shorten
  // 1-3 m (hatch 38.1 -> 35.3 m). 2.2 gained only ~1 m more.
  brakeMaxDecel: 1.8,
  driveEff: 0.90,
  idleRpm: 850,
  // MEASURED (requirement: it is very slow): the hatch needed 166 m to reach 100 km/h and 637 m to
  // reach 150, in a 200 m lab — the car could never actually go fast. Torque curves were
  // raised ~72% across the roster and drag cut from 0.38, which is what moves TOP speed (power
  // fights v^2). per-car below; this is the fallback. Drag is what caps TOP speed without touching
  // acceleration, so it is the knob that keeps a 620 Nm muscle car off 413 km/h while it still
  // pulls hard.
  dragC: 0.40,
  rollC: 0.015,
  // Yaw-inertia multiplier. MEASURED (requirement: the cars do not have enough weight / momentum,
  // so it stops them from drifting right). The box approximation m*(len^2+wid^2)/12 gives the hatch
  // 1810 kg m^2, which is realistic but makes the car dart: it starts rotating
  // instantly and stops just as fast, so a slide snaps rather than swings. A real car carries its
  // mass high and long in the body, and a drift wants a lazy, heavy rotation you can catch.
  //
  // SWEPT, not guessed. Handbrake flick from 20 m/s, peak body-slip angle / speed still held at 2
  // s:
  //   1.55 -> 90 deg (fully sideways), 32% kept     2.4 -> 43 deg, 45% kept
  //   2.8  -> 30 deg, 61% kept, recovers to 1 deg   3.2 -> 23 deg, 68% (barely drifts)
  // 2.8 is a real drift angle that still carries speed. It is above the textbook box value on
  // purpose — the user asked for weight and momentum, and at the realistic figure the car simply
  // spun. RE-MEASURED against the FINISHED model (continuous tyre curve, mu 1.25,
  // continuous yaw damping). 2.8 was set earlier the same day to stop a handbrake flick reaching 90
  // deg while keeping only 32% of its speed — but with the model as it now stands the trade-off had
  // INVERTED:
  //      izzK   donut yaw   flick drift   speed kept
  //      1.0        0.94         70 deg         55%
  //      1.4        0.91         46 deg         73%
  //      2.8        0.83         18 deg         95%
  // At 2.8 the car could barely rotate and a drift collapsed to 18 deg (requirement: drifting does
  // not work, the muscle car cannot do donuts). Nothing runs backwards at any value now, so the
  // reason 2.8 existed is gone. A constant tuned against a model that has since changed is a lie.
  izzK: 2.4,
  // multiplier on aerodynamic directional stability. A car with a big rear wing
  aeroK: 1.0,
                        // has far more of it — see the track car.
  downforceF: 0.02,     // front aerodynamic downforce coefficient (Cl * A)
  downforceR: 0.04,     // rear aerodynamic downforce coefficient (Cl * A)
  // SUSPENSION, as the two numbers a suspension is really specified by. Per-car, because the load
  // factor a bump produces is DIMENSIONLESS — it depends only on these, not on mass. MEASURED
  // with them global, all six cars from 815 kg to 1880 kg rode the kerb at an identical
  // 0.36/1.39 load swing. Correct arithmetic, wrong game: a rally car soaking up a kerb and a track
  // car being thrown off one is the difference between the two cars existing.
  susF: 1.40,           // Hz body ride frequency. Road cars 1.0-1.5; a race car is 2+.
  susZ: 0.38,           // damping ratio. Under 1, so it overshoots — that IS the light-then-heavy.
  reverseRatio: -3.40,
  reverseMaxSpeed: 5.5, // m/s (~20 km/h). Was 8.0 — too fast to keep a reversing car stable.
};

// TORQUE CURVES, Nm at the crank. A car on its real counterpart (realcars.ts) takes realCurve of
// its engine's stated figures on its row; these are the curves of the cars still to be put on
// theirs, each scaled to its car's real peak power (K13, passed 11-02).
const CURVE_MIKRA: Curve = [[1200, 108], [2200, 146], [3200, 162], [4200, 165], [5200, 156],
  [6200, 138], [7000, 121]];
const CURVE_KIT: Curve = [[1500, 149], [3000, 209], [4500, 249], [6000, 269], [7000, 272],
  [8000, 249], [8500, 229]];
const CURVE_BANGER: Curve = [[900, 194], [2000, 255], [3000, 276], [4000, 278], [5000, 255],
  [6000, 219]];
const CURVE_GRASS: Curve = [[1500, 161], [3000, 218], [4500, 258], [6000, 278], [7000, 282],
  [8000, 266], [8800, 242]];
const CURVE_DRIFT: Curve = [[1200, 344], [2500, 579], [3500, 724], [4500, 751], [5500, 724],
  [6500, 652], [7800, 543]];
const CURVE_F2: Curve = [[1500, 330], [3000, 429], [4500, 495], [6000, 547], [7000, 571],
  [8000, 552], [9000, 467]];

// CLASSES (requirement: classes... subclasses for events; the car menu filters by class then
// subclass; upgrading never changes a car's class; split agreed as proposed). Each ROSTER row
// carries cls + sub; events will ask for a class (and maybe a subclass).
export const CLASSES = [
  { id: 'road', name: 'ROAD', subs: ['Hatch', 'Saloon', 'Estate', 'Sports', 'Muscle'] },
  { id: 'rally', name: 'RALLY', subs: ['1L', '2L', '2L+', 'Group B'] },
  { id: 'rx', name: 'RALLYCROSS', subs: ['Supercar', 'Super 1600'] },
  { id: 'stock', name: 'STOCK / GRASS', subs: ['Stock car', 'Grass track'] },
  { id: 'oval', name: 'OVAL', subs: ['Naffcar'] },
  { id: 'single', name: 'SINGLE-SEATER', subs: ['F1', 'F2', 'FE'] },
  { id: 'drift', name: 'DRIFT', subs: ['Pro', 'Street'] },
  { id: 'offroad', name: 'OFF-ROAD / ODD', subs: ['Odd'] },
];
export const classOf = (classId: string) => CLASSES.find((cls) => cls.id === classId);

// PAINT + NUMBER (requirement: palette + number + preview): 16 colours for body and trim; a race
// number 1-99 (0 = none). A livery is { paint, trim, num } per car id in the menu profile;
// applyLivery puts it on a car's spec (missing fields = the roster's own), so it follows the car
// into every event and render.ts caches a sprite per livery.
export const PALETTE = ['#f0f0ea', '#a9aeb6', '#5a5f69', '#16181d', '#c8342a', '#7a1d22', '#e0603a',
  '#f2a900',
  '#9bc53d', '#2e7d32', '#1f4d2e', '#3fb6c9', '#2f6fd0', '#1d3f9a', '#8a4fc0', '#e86fa8'];
// TYRES (requirement: the first upgrade — manufacturers, ranges per class; only fit what fits;
// rally / off-road tyres on a road car = more off-road grip but heat up too quickly on tarmac;
// wets, race... a real mix with distinct grip interactions; "4 brands, 15 types"; TODAY's grip =
// the floor: "SPUM — Pre-Spun +0"). grip = x on the surface's mu per SURFACE GROUP (Pre-Spun
// = 1 everywhere, so a stock car is exactly as before); opt / peak / cold = the heat window
// (vehicle.js tyreGrip, hard ground only); heatHard = x heat-up on hard ground (knobbly / soft
// compounds cook on tarmac). fits = the classes that can run it. Prices: shown; test mode does not
// charge. v2 (requirement: tyre stats don't show all the surfaces they affect — mud etc isn't shown
// ever): NINE surfaces, each its own number and its own bar (v1 had 5 groups — GRASS hid mud
// + sand, GRAVEL hid dirt, SNOW hid ice). Kerbs / concrete / broken count as tarmac.
export const TYRE_SURFS = [['tarmac', 'TARMAC'], ['wet', 'WET'], ['gravel', 'GRAVEL'], ['dirt',
  'DIRT'], ['grass', 'GRASS'], ['mud', 'MUD'], ['sand', 'SAND'], ['snow', 'SNOW'], ['ice', 'ICE']];
export const SURF_GROUP = { lab: 'tarmac', racetarmac: 'tarmac', tarmac: 'tarmac', kerb: 'tarmac',
  broken: 'tarmac', concrete: 'tarmac', wet: 'wet',
  gravel: 'gravel', dirt: 'dirt', grass: 'grass', grassShort: 'grass', grassLong: 'grass',
    bush: 'grass', mud: 'mud', thickMud: 'mud', sand: 'sand', snow: 'snow', packedSnow: 'snow',
    ice: 'ice' };
export const TYRE_BRANDS = [
  { id: 'spum', name: 'SPUM', col: '#9aa0aa', blurb: 'budget' },
  { id: 'kum', name: 'KUM', col: '#e0603a', blurb: 'road + track' },
  { id: 'dunflop', name: 'DUNFLOP', col: '#4c8fd4', blurb: 'rally + off-road' },
  { id: 'pirrelly', name: 'PIRRELLY', col: '#f2c21b', blurb: 'race' },
  // period and drag tyres (muscletyres, passed 11-03; NOTES register: Goodyear = GOOD YEAH,
  // Mickey Thompson = MICKY TOMSON, BFGoodrich = BF GOODWRENCH)
  { id: 'goodyeah', name: 'GOOD YEAH', col: '#7aa8ff', blurb: 'classic' },
  { id: 'tomson', name: 'MICKY TOMSON', col: '#d8453c', blurb: 'drag' },
  { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },
];
const ALLC = ['road', 'rally', 'rx', 'stock', 'oval', 'single', 'drift', 'offroad'];
// grip x per surface, in TYRE_SURFS order: tarmac wet gravel dirt grass mud sand snow ice
const makeTyre = (tyreId: string, brand: string, name: string, price: number, fits: string[],
  grips: number[], extra: Partial<Tyre> = {}): Tyre =>
  ({ id: tyreId, brand, name, price, fits,
    grip: Object.fromEntries(TYRE_SURFS.map(([surf], i) => [surf, grips[i]])), ...extra });
export const TYRES = [
  makeTyre('pre-spun', 'spum', 'Pre-Spun', 0, ALLC,
    [1, 1, 1, 1, 1, 1, 1, 1, 1], { rims: [10, 30],
    note: 'the floor: what every car leaves the factory on' }),
  makeTyre('all-season', 'spum', 'All-Season', 320, ['road', 'rally', 'rx', 'stock', 'drift'],
    [1.05, 1.1, 1.05, 1.05, 1.05, 1.04, 1.04, 1.12, 1.08],
    { rims: [10, 19],
    note: 'a little better at everything' }),
  makeTyre('mud-plugger', 'spum', 'Mud-Plugger', 380, ['road', 'rally', 'rx', 'stock', 'drift',
    'offroad'], [0.92, 0.95, 1.1, 1.14, 1.22, 1.35, 1.12, 1.1, 0.95], { rims: [13, 17],
    heatHard: 1.6,
    opt: [50, 95], note: 'mud + grass; cooks on tarmac' }),
  makeTyre('road-sport', 'kum', 'Road Sport', 520, ['road', 'stock', 'drift'],
    [1.1, 1.05, 0.98, 0.98, 0.97, 0.94, 0.96, 0.92, 0.92], { rims: [15, 20],
    note: 'fast road tyre' }),
  makeTyre('semi-slick', 'kum', 'Semi-Slick', 780, ['road', 'rx', 'stock', 'oval', 'drift'],
    [1.18, 0.9, 0.92, 0.92, 0.9, 0.85, 0.9, 0.8, 0.8], { rims: [13, 19],
    opt: [75, 120], peak: 100, cold: 0.8,
    note: 'track day: needs heat, hates rain' }),
  makeTyre('drift', 'kum', 'Drift', 450, ['road', 'drift'],
    [1.03, 0.95, 0.98, 0.98, 0.95, 0.92, 0.95, 0.9, 0.9], { rims: [15, 18],
    slide: 1.1, opt: [80, 150], peak: 110,
    heatHard: 0.8, note: 'holds a slide, hard to overheat' }),
  makeTyre('kum-wet', 'kum', 'Wet', 480, ['road', 'rally', 'rx', 'stock', 'drift'],
    [1, 1.22, 1, 1.02, 1.02, 1.05, 1, 1.04, 1], { rims: [10, 18],
    opt: [40, 85], peak: 60,
    note: 'rain tyre; overheats on a dry road' }),
  makeTyre('gravel', 'dunflop', 'Gravel', 600, ['road', 'rally', 'rx', 'stock', 'offroad'],
    [0.94, 0.98, 1.22, 1.18, 1.1, 1.08, 1.08, 1.05, 1], { rims: [15, 16],
    heatHard: 1.8, opt: [45, 90], peak: 65,
    note: 'bites in the loose; hot on tarmac' }),
  makeTyre('soft-gravel', 'dunflop', 'Soft Gravel', 680, ['road', 'rally', 'rx'],
    [0.9, 0.97, 1.3, 1.24, 1.15, 1.12, 1.12, 1.08, 1], { rims: [15, 16],
    heatHard: 2.2, opt: [40, 85], peak: 60,
    note: 'most loose grip; cooks fastest' }),
  makeTyre('tarmac-rally', 'dunflop', 'Tarmac Rally', 700, ['road', 'rally', 'rx'],
    [1.14, 1.06, 1, 1, 0.95, 0.92, 0.94, 0.9, 0.9], { rims: [15, 18],
    note: 'asphalt stages, copes with dirt' }),
  makeTyre('studded', 'dunflop', 'Studded Snow', 650, ['road', 'rally', 'rx', 'offroad'],
    [0.88, 0.95, 1.08, 1.06, 1, 0.98, 0.98, 1.5, 1.9], { rims: [13, 17],
    heatHard: 1.4,
    note: 'snow + ice; noisy and slow on tarmac' }),
  makeTyre('all-terrain', 'dunflop', 'All-Terrain', 500, ['road', 'rally', 'rx', 'stock',
    'offroad'], [0.98, 1, 1.12, 1.12, 1.15, 1.18, 1.15, 1.08, 1.02],
    { rims: [15, 18],
    note: 'off the road and back' }),
  makeTyre('p-soft', 'pirrelly', 'Soft', 1400, ['single', 'oval'],
    [1.28, 0.85, 0.85, 0.85, 0.82, 0.75, 0.8, 0.7, 0.65], { rims: [13, 18],
    opt: [90, 125], peak: 105, cold: 0.78,
    heatHard: 1.2, note: 'fastest; must be hot' }),
  makeTyre('p-medium', 'pirrelly', 'Medium', 1200, ['single', 'oval'],
    [1.22, 0.88, 0.88, 0.88, 0.85, 0.78, 0.82, 0.72, 0.68], { rims: [13, 18],
    opt: [85, 130], peak: 100, cold: 0.8,
    note: 'a long stint' }),
  makeTyre('p-wet', 'pirrelly', 'Full Wet', 1100, ['single', 'oval'],
    [1.02, 1.35, 0.95, 0.95, 0.95, 0.92, 0.92, 0.85, 0.8], { rims: [13, 18],
    opt: [40, 80], peak: 60,
    note: 'standing water; dies on a dry line' }),
  // MUSCLE TYRES (passed 11-03; owner: "suitable tyres for the muscle car / some that don't
  // fit"):
  // BIAS-BELTED Polyglass GT, the 1970 Chevelle SS's own F70-14 - far less grip than a modern
  // radial, so the car launches like the real one; a DRAG RADIAL (launches, scared of rain); a
  // 1970s street RADIAL. 13-15 / 14-17 inch rims: the old cars only.
  makeTyre('polyglass', 'goodyeah', 'Polyglass GT', 180, ['road', 'stock', 'drift'],
    [0.85, 0.78, 0.92, 0.92, 0.9, 0.88, 0.9, 0.85, 0.85], { rims: [13, 15], slide: 0.95,
    note: 'bias-belted 1970: the muscle car\'s factory set' }),
  makeTyre('radial-ta', 'goodwrench', 'Radial T/A', 340, ['road', 'stock', 'drift'],
    [0.88, 0.9, 0.98, 0.98, 0.95, 0.92, 0.95, 0.9, 0.9], { rims: [13, 17],
    note: 'the first street radial: more grip, same look' }),
  makeTyre('et-street', 'tomson', 'ET Streat', 560, ['road', 'stock', 'drift'],
    [1.06, 0.7, 0.85, 0.85, 0.82, 0.75, 0.8, 0.6, 0.6], { rims: [14, 17], opt: [60, 110],
    peak: 85, cold: 0.85, heatHard: 1.3, note: 'drag radial: hooks off the line, hates rain' }),
];
for (const tyre of TYRES) {
  tyre.bySurf = {};
  for (const [sid, group] of Object.entries(SURF_GROUP)) tyre.bySurf[sid] = tyre.grip[group];
}
export const tyreOf = (tyreId: string) => TYRES.find((tyre) => tyre.id === tyreId) || TYRES[0];
/**
 * Whether a tyre fits a car: its class and its rim size; a car with its own
 * factory set (stockTyre) does not take the generic Pre-Spun.
 * @param tyre the tyre
 * @param row the car's roster row
 * @returns true when it fits
 */
export function tyreFits(tyre: Tyre, row: RosterRow): boolean {
  if (!tyre.fits.includes(row.cls)) return false;
  if (row.stockTyre && tyre.id === 'pre-spun') return false;
  return !tyre.rims || !row.rimIn || (row.rimIn >= tyre.rims[0] && row.rimIn <= tyre.rims[1]);
}
/**
 * The tyre a car runs for a set asked for: the stock set (none, unknown, Pre-Spun) is the car's
 * own factory set when it has one, else Pre-Spun.
 * @param row the car's roster row
 * @param tyreId the set asked for
 * @returns the tyre id
 */
function fittedId(row: RosterRow, tyreId: string): string {
  const stock = !tyreId || tyreId === 'pre-spun' || !TYRES.some((x) => x.id === tyreId);
  return stock && row.stockTyre ? row.stockTyre : tyreId;
}
/**
 * The tyre a car is on for a set asked for (the garage's FITTED: its own factory set when none
 * was bought).
 * @param row the car's roster row
 * @param tyreId the set asked for (none: the stock set)
 * @returns the tyre
 */
export const fittedTyre = (row: RosterRow, tyreId?: string) => tyreOf(fittedId(row, tyreId || ''));
// fit a tyre to a spec (null / unknown / 'pre-spun' = stock: no tyre object, the roster's own heat
// window — physics exactly as before; a car's own factory set when it has one)
export function applyTyre(carSpec: Spec, tyreId: string): Spec {
  const row = ROSTER.find((rosterRow) => rosterRow.id === String(carSpec.id).split('#')[0])
    || ({} as RosterRow);
  const tyre = tyreOf(fittedId(row, tyreId));
  const fits = tyreFits(tyre, row);
  carSpec.tyre = tyre.id === 'pre-spun' || !fits ? null : tyre;
  carSpec.tyreOpt = (carSpec.tyre && carSpec.tyre.opt) || row.tyreOpt;
  carSpec.tyrePeak = (carSpec.tyre && carSpec.tyre.peak) || row.tyrePeak;
  carSpec.tyreColdGrip = (carSpec.tyre && carSpec.tyre.cold) || row.tyreColdGrip;
  if (carSpec.tyreOpt === undefined) delete carSpec.tyreOpt;
  if (carSpec.tyrePeak === undefined) delete carSpec.tyrePeak;
  if (carSpec.tyreColdGrip === undefined) delete carSpec.tyreColdGrip;
  return carSpec;
}
export function applyLivery(
  carSpec: Spec, livery: { paint?: string; trim?: string; num?: number } | null,
): Spec {
  const row = ROSTER.find((rosterRow) => rosterRow.id === String(carSpec.id).split('#')[0])
    || ({} as RosterRow);
  carSpec.paint = (livery && livery.paint) || row.paint;
  carSpec.trim = (livery && livery.trim) || row.trim;
  carSpec.num = (livery && livery.num) || 0;
  return carSpec;
}

export const ROSTER: RosterRow[] = [
  {
    id: 'hatch-fwd', name: 'Folksvagon Gulf GTEye', kind: 'hatch', cls: 'road', sub: 'Hatch',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // VW Golf GTI Mk7 (2013): 220 PS @ 4500-6200, 350 Nm @ 1500-4400, 1351 kg, 6MT (ratios EST),
    // 225/40 R18, Cd 0.32 x 2.19 m^2; 246 km/h
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.55, rideH: 0.14,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // The honest hatchback. Understeers on power, slides ONLY on the handbrake. The control case.
    mass: 1351, lf: 1.10, lr: 1.40, len: 4.0, wid: 1.7,
    // Brake bias is strongly FRONT on every car. MEASURED: at the old rearward figures
    // the rear locked under braking, lost all its lateral grip, and the car spun — 5 of 5 past 90
    // deg when braking in a turn. Real cars run 70-85% front for exactly this reason. K13 (passed
    // 11-02): 0.65 front on every road car, 0.60 on single-seaters, with LOCK_SHARE 0.70
    // (wheelspin.ts) the spin under braking is gone (brakecheck 12 -> 5 of the turns).
    drive: 1.0, brakeBiasF: 0.65, caF: 102263, caR: 109769, mu: 1.3,
    curve: realCurve({ idle: 900, low: 0.6, nm: 350, nmFrom: 1500, nmTo: 4400,
      kw: 162, kwAt: 6200, redline: 6500 }), redline: 6500, upshiftRpm: 6200, downshiftRpm: 2600,
    gears: [3.77, 2.09, 1.47, 1.10, 0.92, 0.77], finalDrive: 3.94, dragC: dragOf(0.32, 2.19),
    idleRpm: 900, wheelR: tyreR(225, 40, 18), tyreWidth: 0.225,
    paint: '#4a8fd4', trim: '#2b5c8f', glass: '#8fb8d8',
  },
  {
    id: 'hatch-rwd', name: 'BMV Em135Aye', kind: 'hatch', cls: 'road', sub: 'Hatch',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // BMW M135i (F20, 2012): 320 hp @ 5800, 450 Nm @ 1300-4500, 1425 kg, 6MT (1st 4.11; rest
    // EST), 245/35 R18, Cd 0.33 x 2.2; 250 km/h (governed)
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.53, rideH: 0.13,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // Same shell, rear drive. The drift teacher — the car the mark showcase is tuned on.
    mass: 1425, lf: 1.25, lr: 1.25, len: 4.0, wid: 1.7,
    drive: 0.0, brakeBiasF: 0.65, caF: 107865, caR: 112813, mu: 1.32,
    curve: realCurve({ idle: 800, low: 0.6, nm: 450, nmFrom: 1300, nmTo: 4500,
      kw: 235, kwAt: 5800, redline: 7000 }), redline: 7000, upshiftRpm: 6600, downshiftRpm: 2600,
    gears: [4.11, 2.32, 1.54, 1.18, 1.00, 0.85], finalDrive: 3.15, dragC: dragOf(0.33, 2.2),
    idleRpm: 800, wheelR: tyreR(245, 35, 18), tyreWidth: 0.245,
    // Per-car yaw inertia. MEASURED: this was the ONLY car still spinning to 180 on a held-lock
    // handbrake after the self-aligning fix — it is the shortest and lightest rear-drive car, so
    // the box formula gives it roughly half the muscle car's yaw inertia while it carries similar
    // grip. A per-car outlier deserves a per-car number, not another global knob.
    izzK: 3.4,
    paint: '#e0603a', trim: '#9c3a1c', glass: '#cfa98f',
  },
  {
    id: 'saloon-rwd', name: 'BMV 3 Serious', kind: 'saloon', cls: 'road', sub: 'Saloon',
    rimIn: 17,   // its real rim, inches (what tyres fit)
    // BMW 330i (E46): 231 PS @ 5900, 300 Nm @ 3500, 1450 kg, Getrag 5MT, 3.07, 225/45 R17,
    // Cd 0.30 x 2.13; 250 km/h
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow; handling still uses cgH
    cg: 0.52, rideH: 0.13,
    aids: { abs: true, tcs: true },   // ABS + DSC, as the real one
    // 2000s compact exec saloon (E46 330i-ish): rear drive, 50 / 50 on a long wheelbase, a smooth
    // straight six. Calmer and more stable than the short hatch RWD (longer wheelbase, more yaw
    // inertia), but it will still hang its tail out on the throttle.
    mass: 1450, lf: 1.36, lr: 1.36, len: 4.47, wid: 1.74,
    drive: 0.0, brakeBiasF: 0.65, caF: 112000, caR: 118000, mu: 1.34,
    curve: realCurve({ idle: 750, low: 0.75, nm: 300, nmFrom: 3000, nmTo: 4000,
      kw: 170, kwAt: 5900, redline: 6500 }), redline: 6500, upshiftRpm: 6200, downshiftRpm: 2600,
    gears: [4.21, 2.49, 1.66, 1.24, 1.00], finalDrive: 3.07, dragC: dragOf(0.30, 2.13),
    idleRpm: 750, wheelR: tyreR(225, 45, 17), tyreWidth: 0.225,
    // titanium silver, silver multi-spokes
    paint: '#a9aeb6', trim: '#4a4f58', glass: '#8fa3b8', rim: '#d6d9df',
  },
  {
    id: 'wrz-awd', name: 'Subaroo WRZ', kind: 'wrz', cls: 'rally', sub: '2L+',
    rimIn: 17,   // its real rim, inches (what tyres fit)
    // Subaru Impreza WRX STI (GD, 2005): 206 kW @ 6400, 407 Nm @ 4000, 1495 kg, 6MT 3.636 2.375
    // 1.761 1.346 0.971 0.756, 3.90, 225/45 R17, Cd 0.35 x 2.1; 255 km/h
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow; handling still uses cgH
    cg: 0.53, rideH: 0.15,
    aids: { abs: true, tcs: false },  // 2005: ABS, no traction control
    // 2005 turbo AWD saloon (GD WRX-ish): symmetrical all-wheel drive (50 / 50), the boxer and
    // turbo up front (60 % of the weight on the nose: it pushes on entry, then the AWD pulls it
    // out), lag below 2500 rpm then a strong mid-range. A road car, not the Rally. v2: 57 % on the
    // nose (was 60) and a REAR-BIASED centre diff, 36 / 64 like the STI's DCCD (was 50 / 50: it
    // gripped and pushed — power-on gravel body slip 31 deg, yaw 44 deg/s vs the Rally's 70 / 74,
    // tools/carfeel)
    mass: 1495, lf: 1.09, lr: 1.435, len: 4.47, wid: 1.74,
    drive: 0.36, brakeBiasF: 0.65, caF: 118752, caR: 122993, mu: 1.32,
    curve: realCurve({ idle: 900, low: 0.45, nm: 407, nmFrom: 3600, nmTo: 4400,
      kw: 206, kwAt: 6400, redline: 7000 }), redline: 7000, upshiftRpm: 6700, downshiftRpm: 2800,
    gears: [3.636, 2.375, 1.761, 1.346, 0.971, 0.756], finalDrive: 3.90, dragC: dragOf(0.35, 2.1),
    idleRpm: 900, wheelR: tyreR(225, 45, 17), tyreWidth: 0.225,
    // World Rally Blue, gold wheels
    paint: '#1d3f9a', trim: '#0f2257', glass: '#93abd2', rim: '#c9a227',
    // the AI's confidence in this car's plan (aidriver profileOf). 1.0: Sweaty Lamb Real off 25 s a
    // lap; 0.94: 2.9 s, laps 111-113 -> 108.7 s, Thruston +0.8 s
    aiK: 0.94,
  },
  {
    id: 'estate-4x4', name: 'Volvoh V70 Arr', kind: 'estate', cls: 'road', sub: 'Estate',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // Volvo V70 R (2004): 300 PS @ 5500, 400 Nm @ 1950-5250, 1665 kg, 6MT (EST), 235/40 R18,
    // Cd 0.33 x 2.3; 250 km/h
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.66, rideH: 0.21,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // Heavy, planted, four-wheel drive. Long lazy four-wheel slides, heavy marks, hard to stop.
    mass: 1665, lf: 1.35, lr: 1.35, len: 4.7, wid: 1.8,
    drive: 0.5, brakeBiasF: 0.65, caF: 114066, caR: 123265, mu: 1.24,
    curve: realCurve({ idle: 800, low: 0.6, nm: 400, nmFrom: 1950, nmTo: 5250,
      kw: 221, kwAt: 5500, redline: 6500 }), redline: 6500, upshiftRpm: 6000, downshiftRpm: 2200,
    gears: [3.54, 2.05, 1.38, 1.03, 0.82, 0.68], finalDrive: 3.55, dragC: dragOf(0.33, 2.3),
    idleRpm: 800, wheelR: tyreR(235, 40, 18), tyreWidth: 0.235,
    paint: '#4f6b52', trim: '#2f4433', glass: '#9fb8a4',
  },
  {
    id: 'muscle-rwd', name: 'Chevvy Shovelle SS 454', kind: 'muscle', cls: 'road', sub: 'Muscle',
    rimIn: 14, stockTyre: 'polyglass',   // its rim; its own factory set
    // Chevrolet Chevelle SS 454 LS6 (1970): 450 hp gross (~360 net, what reaches the road) @ 5600,
    // 500 lb-ft (678 Nm) @ 3600, ~1730 kg, M22 4MT 2.20 1.64 1.28 1.00, 3.31, F70-14, Cd 0.50 x 2.2
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.5, rideH: 0.12,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: false },
    // Torque far beyond the rear tyres. Power oversteer in any gear; the loudest marks in the lab.
    mass: 1730, lf: 1.30, lr: 1.30, len: 4.8, wid: 1.9,
    drive: 0.0, brakeBiasF: 0.65, caF: 109505, caR: 115027, mu: 1.34,
    curve: realCurve({ idle: 750, low: 0.7, nm: 678, nmFrom: 3000, nmTo: 3600,
      kw: 268, kwAt: 5600, redline: 6500 }), redline: 6500, upshiftRpm: 6000, downshiftRpm: 2200,
    // (owner 11-02: "keep the muscle car at 4 gears ... 1st shorter ... 4 being quite long"):
    // 1st 60 km/h at the redline (was 77), 4th 270 (was 205, its old top speed on the limiter)
    gears: [2.20, 1.64, 1.28, 1.00], finalDrive: 3.31, dragC: dragOf(0.50, 2.2),
    idleRpm: 750, wheelR: 0.335, tyreWidth: 0.215,
    paint: '#b3252f', trim: '#6e141b', glass: '#d0a0a4',
  },
  {
    id: 'rally-4x4', name: 'Ordi Sport Kwattro S1', kind: 'rally', cls: 'rally', sub: 'Group B',
    rimIn: 15,   // its real rim, inches (what tyres fit)
    // Audi Sport quattro S1 E2 (1985): ~350 kW (factory 470 hp) @ 8000, 590 Nm @ 5500, 1090 kg,
    // 6MT (EST, geared for the stages: ~235 km/h), Cd 0.40 x 2.0 with its wings
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.52, rideH: 0.2,
    // Group-B-flavoured: rear-BIASED all-wheel drive (22% front / 78% rear), turbo torque low in
    // the range, light, and a big wing. The 4x4 estate deliberately cannot be made to slide; this
    // one can, because the rear takes most of the drive — the same drive number doing the same job,
    // which is the whole point of the seam.
    mass: 1090, lf: 1.20, lr: 1.30, len: 4.1, wid: 1.82,
    // 22/78 front/rear. At 0.35 the roster-wide grip raise left it unable to break traction at all,
    // and a rally car has to be the one that slides.
    drive: 0.22, brakeBiasF: 0.65, caF: 97664, caR: 103768, mu: 1.41,
    curve: realCurve({ idle: 1200, low: 0.4, nm: 590, nmFrom: 4500, nmTo: 5500,
      kw: 350, kwAt: 8000, redline: 8500 }), redline: 8500, upshiftRpm: 8000, downshiftRpm: 3000,
    gears: [3.00, 2.06, 1.55, 1.23, 1.00, 0.84], finalDrive: 4.90, dragC: dragOf(0.40, 2.0),
    idleRpm: 1200,
    aeroK: 1.6,           // the wing
    // Raised to realistic levels. Real rally cars generate ~300kg+ downforce at 100mph.
    downforceF: 0.90, downforceR: 1.70,
    // Long-travel rally springs: soft and well damped. It soaks a kerb up instead of being thrown
    // off one, which is the entire reason this car exists.
    susF: 1.05, susZ: 0.46,
    paint: '#2f6fd0', trim: '#12325f', glass: '#9fc0e4',
  },
  {
    id: 'track-rwd', name: 'Formula Won', kind: 'track', cls: 'single', sub: 'F1',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // a Formula 1 car (2022 rules): ~1000 hp with the hybrid (746 kW) @ 11500, 798 kg with the
    // driver, 8-speed (EST), 18-inch tyres (0.36 m), Cd A ~1.1 m^2; ~340 km/h
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.36, rideH: 0.07,
    // Formula 1 archetype: featherweight, open-wheel, huge aero downforce, wide racing slicks.
    mass: 798, lf: 1.55, lr: 1.35, len: 4.4, wid: 1.35, trackWidth: 1.85, tyreWidth: 0.32,
    drive: 0.0, brakeBiasF: 0.60, caF: 155683, caR: 167433, mu: 1.92,
    curve: realCurve({ idle: 4000, low: 0.6, nm: 640, nmFrom: 9000, nmTo: 10500,
      kw: 746, kwAt: 11500, redline: 12500 }),
    redline: 12500, upshiftRpm: 12000, downshiftRpm: 8000,
    gears: [3.10, 2.40, 1.95, 1.65, 1.42, 1.25, 1.12, 1.00], finalDrive: 4.80, dragC: dragOf(1.0,
    1.1),
    idleRpm: 4000, wheelR: 0.36,
    aeroK: 1.4,
    // 0.65 / 0.95 -> 1.73 / 2.50 (user, step 2 aero check: yes). Was ClA 1.6 = ~0.38x
    // weight at 200 km/h; a real F1 car makes ~its own weight there. Now 4.23 = 1.0x at 200 km/h,
    // same 41/59 balance. Drag unchanged.
    downforceF: 1.73, downforceR: 2.50,
    susF: 2.30, susZ: 0.30,
    paint: '#e9e9ee', trim: '#3a3a44', glass: '#9aa0ae',
  },
  {
    id: 'naffcar', name: 'Naffcar V8', kind: 'muscle', cls: 'oval', sub: 'Naffcar',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // a NASCAR Cup car (Next Gen): 670 hp (500 kW) @ 9000, ~610 Nm, 1542 kg, 5-speed sequential
    // (EST), 18-inch, Cd A ~0.9 m^2; ~320 km/h unrestricted
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 0.48, rideH: 0.1,
    // Oval racer: heavy, massive V8 torque, 4-speed manual/auto, designed to go fast and turn left.
    // Extremely slippery on dirt/grass due to stiff setup and high power.
    mass: 1542, lf: 1.35, lr: 1.45, len: 5.1, wid: 1.95, trackWidth: 1.85,
    drive: 0.0, brakeBiasF: 0.65, caF: 139244, caR: 149559, mu: 1.74,
    curve: realCurve({ idle: 1500, low: 0.6, nm: 610, nmFrom: 6500, nmTo: 7500,
      kw: 500, kwAt: 9000, redline: 9500 }),
    redline: 9500, upshiftRpm: 9200, downshiftRpm: 5500, idleRpm: 1500,
    gears: [2.85, 1.97, 1.49, 1.20, 1.00], finalDrive: 3.90, dragC: dragOf(1.0, 0.9),
    // very aerodynamic body
    wheelR: 0.356,
    aeroK: 1.1, downforceF: 0.80, downforceR: 1.20, // moderate downforce from the rear lip spoiler
    susF: 2.10, susZ: 0.35, // Stiff for banked corners
    paint: '#f2a900', trim: '#111111', glass: '#555555',
  },
  {
    id: 'tractor', name: 'JCBee Fastrack 8330', kind: 'tractor', cls: 'offroad', sub: 'Odd',
    rimIn: 30,   // its real rim, inches (what tyres fit)
    // JCB Fastrac 8330: 348 hp (260 kW) @ 2100, 1440 Nm @ 1500, ~11 400 kg, 70 km/h, 600/70 R30
    // (0.80 m), Cd 0.9 x 7 m^2 (its CVT as five steps)
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.ts) + shadow;
    // handling still uses cgH
    cg: 1.05, rideH: 0.45,
    // Heavy agricultural diesel puller. High torque, wide rear stance, open-wheel styling.
    mass: 11400, lf: 1.50, lr: 1.10, len: 4.2, wid: 2.1,
    drive: 0.0, brakeBiasF: 0.65, caF: 350769, caR: 613846, mu: 1.33,
    curve: realCurve({ idle: 800, low: 0.65, nm: 1440, nmFrom: 1400, nmTo: 1600,
      kw: 260, kwAt: 2100, redline: 2300 }),
    redline: 2300, upshiftRpm: 2200, downshiftRpm: 1100, idleRpm: 800,
    gears: [4.20, 2.70, 1.80, 1.25, 0.90], finalDrive: 11.1, dragC: dragOf(0.9, 7),
    wheelR: tyreR(600, 70, 30), tyreWidth: 0.6,
    aeroK: 0.8, downforceF: 0.0, downforceR: 0.0,
    susF: 1.10, susZ: 0.55,
    paint: '#2e7d32', trim: '#fbc02d', glass: '#37474f',
  },
  // ---------------- NEW CARS (requirement: an old classic Mini, a Lamborghini, and yeah fill those
  // classes)
  {
    id: 'mini-fwd', name: 'Minnie Cooped S', kind: 'mini', cls: 'road', sub: 'Hatch',
    rimIn: 10,   // its real rim, inches (what tyres fit)
    // Mini Cooper S 1275 (Mk1): 76 hp @ 5800, 107 Nm @ 3000, ~650 kg, 4MT 3.33 2.09 1.35 1.00,
    // 3.44, 145/80 R10, Cd 0.48 x 1.6; 156 km/h
    cg: 0.48, rideH: 0.12,
    aids: { abs: false, tcs: false },   // 1965: nothing
    // the 1960s 1275 Cooper S: tiny, FWD, a transverse four, 10-inch wheels, wheels pushed to the
    // corners (a long wheelbase for its length) and 60 % on the nose. Slow in a straight line,
    // darts into corners, lifts a rear wheel and tucks in on a lift.
    mass: 650, lf: 0.82, lr: 1.22, len: 3.05, wid: 1.41, trackWidth: 1.24, wheelR: tyreR(145, 80,
    10),
    drive: 1.0, brakeBiasF: 0.65, caF: 58406, caR: 60290, mu: 1.18,
    curve: realCurve({ idle: 800, low: 0.7, nm: 107, nmFrom: 3000, nmTo: 3500,
      kw: 57, kwAt: 5800, redline: 6500 }),
    redline: 6500, upshiftRpm: 6200, downshiftRpm: 2600, idleRpm: 800,
    gears: [3.33, 2.09, 1.35, 1.00], finalDrive: 3.44, dragC: dragOf(0.48, 1.6), izzK: 2.6,
    tyreWidth: 0.145,
    // British racing green, white roof, steel wheels
    paint: '#1f4d2e', trim: '#f0f0ea', glass: '#9fb8a4', rim: '#c9ccd4',
  },
  {
    id: 'lambo-awd', name: 'Lamburghini Hurrikan', kind: 'lambo', cls: 'road', sub: 'Sports',
    rimIn: 20,   // its real rim, inches (what tyres fit)
    // Lamborghini Huracan LP 610-4: 610 PS @ 8250, 560 Nm @ 6500, 1553 kg, 7DCT 3.133 2.083 1.575
    // 1.244 0.979 0.788 0.677, 4.89, 305/30 R20, Cd 0.39 x 1.95; 325 km/h
    cg: 0.45, rideH: 0.1, cyl: 10,
    aids: { abs: true, tcs: true },
    // a mid-engined V10 supercar: 4WD with the drive mostly at the back (30 / 70), 43 / 57 weight,
    // a wide low wedge, 8500 rpm.
    mass: 1553, lf: 1.49, lr: 1.13, len: 4.46, wid: 1.93, trackWidth: 1.67, tyreWidth: 0.305,
      wheelR: tyreR(305, 30, 20),
    drive: 0.3, brakeBiasF: 0.65, caF: 139989, caR: 155300, mu: 1.45,
    curve: realCurve({ idle: 1000, low: 0.65, nm: 560, nmFrom: 6000, nmTo: 6500,
      kw: 449, kwAt: 8250, redline: 8500 }),
    redline: 8500, upshiftRpm: 8300, downshiftRpm: 4000, idleRpm: 1000,
    gears: [3.133, 2.083, 1.575, 1.244, 0.979, 0.788, 0.677], finalDrive: 4.89, dragC: dragOf(0.39,
    1.95),
    aeroK: 1.2, downforceF: 0.35, downforceR: 0.55, susF: 1.8, susZ: 0.38,
    paint: '#9bc53d', trim: '#16181d', glass: '#2a2f38', rim: '#16181d',   // verde, black wheels
  },
  {
    id: 'mikra-r1', name: 'Nissun Mikra R1', kind: 'mikra', cls: 'rally', sub: '1L',
    rimIn: 15,   // its real rim, inches (what tyres fit)
    cg: 0.52, rideH: 0.18,
    aids: { abs: false, tcs: false },
    // the entry rally car: a 1-litre turbo supermini, front drive, rally springs, short gears.
    // Slow, honest, a ladder rung.
    mass: 980, lf: 0.98, lr: 1.47, len: 3.8, wid: 1.68,
    drive: 1.0, brakeBiasF: 0.65, caF: 92000, caR: 98000, mu: 1.29,
    curve: CURVE_MIKRA, redline: 7000, upshiftRpm: 6600, downshiftRpm: 3000,
    gears: [3.5, 2.1, 1.5, 1.15, 0.92], finalDrive: 4.3, dragC: 0.44,
    susF: 1.1, susZ: 0.45,
    paint: '#f0f0ea', trim: '#c8342a', glass: '#9fb0c4',
  },
  {
    id: 'kit-2l', name: 'Pugeot 306 Maxxi', kind: 'kit', cls: 'rally', sub: '2L',
    rimIn: 15,   // its real rim, inches (what tyres fit)
    // Peugeot 306 Maxi (F2 kit car, 1996): 960 kg
    cg: 0.5, rideH: 0.17,
    aids: { abs: false, tcs: false },
    // a 2-litre FWD KIT CAR (the 90s F2 kit cars): a screaming 8500 rpm four, a close six-speed,
    // huge arches over a wide track, light. On tarmac it humbles 4WD cars; on gravel it scrabbles
    // at the front.
    mass: 960, lf: 1.0, lr: 1.58, len: 4.03, wid: 1.83, trackWidth: 1.65,
    drive: 1.0, brakeBiasF: 0.65, caF: 109440, caR: 96000, mu: 1.43,
    curve: CURVE_KIT, redline: 8500, upshiftRpm: 8200, downshiftRpm: 4500, idleRpm: 1100,
    gears: [3.0, 2.2, 1.75, 1.45, 1.22, 1.05], finalDrive: 4.2, dragC: 0.44,
    susF: 1.15, susZ: 0.44,
    paint: '#f0f0ea', trim: '#1d3f9a', glass: '#9fb0c4',
  },
  {
    id: 'rx-super', name: 'Fjord Fiester RX', kind: 'rxcar', cls: 'rx', sub: 'Supercar',
    rimIn: 17,   // its real rim, inches (what tyres fit)
    // Ford Fiesta RX (World RX supercar): 600 hp, 900 Nm, 1300 kg
    cg: 0.5, rideH: 0.2,
    aids: { abs: false, tcs: false },
    // a RALLYCROSS SUPERCAR: 600 hp from a 2-litre turbo in a supermini shell, 4WD (45 / 55), short
    // gears, 0-100 in under 2 s. Big wing.
    mass: 1300, lf: 1.15, lr: 1.34, len: 4.1, wid: 1.95, trackWidth: 1.7,
    drive: 0.45, brakeBiasF: 0.65, caF: 112000, caR: 118000, mu: 1.48,
    curve: realCurve({ idle: 1500, low: 0.55, nm: 900, nmFrom: 3500, nmTo: 4500,
      kw: 447, kwAt: 6500, redline: 7500 }),
    redline: 7500, upshiftRpm: 7100, downshiftRpm: 3500, idleRpm: 1500,
    gears: [2.6, 1.9, 1.5, 1.2, 0.95], finalDrive: 4.0, dragC: 0.6,
    aeroK: 1.4, downforceF: 0.6, downforceR: 1.2, susF: 1.1, susZ: 0.46,
    paint: '#e0603a', trim: '#16181d', glass: '#2a2f38',
  },
  {
    id: 'banger-f2', name: 'BriSKA F2 Stocker', kind: 'banger', cls: 'stock', sub: 'Stock car',
    rimIn: 13,   // its real rim, inches (what tyres fit)
    cg: 0.5, rideH: 0.14,
    aids: { abs: false, tcs: false },
    // an F2 SHORT-OVAL STOCK CAR: a 2-litre RWD saloon shell on a steel chassis, huge front + rear
    // bumpers, nerf rails, the roof painted in your grade colour (trim). Contact is the point.
    mass: 1150, lf: 1.25, lr: 1.25, len: 4.3, wid: 1.85,
    drive: 0.0, brakeBiasF: 0.65, caF: 108000, caR: 112000, mu: 1.34,
    curve: CURVE_BANGER, redline: 6500, upshiftRpm: 6000, downshiftRpm: 2600,
    gears: [2.97, 2.01, 1.40, 1.0], finalDrive: 3.9, dragC: 0.66,
    susF: 1.6, susZ: 0.36,
    paint: '#c8342a', trim: '#f2a900', glass: '#2a2f38',
  },
  {
    id: 'grass-special', name: 'Autograss Special', kind: 'grass', cls: 'stock', sub: 'Grass track',
    rimIn: 13,   // its real rim, inches (what tyres fit)
    cg: 0.42, rideH: 0.2,
    aids: { abs: false, tcs: false },
    // a GRASS-TRACK SPECIAL (autograss Class 8-ish): a space-frame buggy, a 1.6 16v behind the
    // driver, rear drive, 57 % on the back, long
    // soft springs. Light, it digs in on grass and goes sideways everywhere.
    mass: 650, lf: 1.25, lr: 0.95, len: 3.4, wid: 1.75, trackWidth: 1.6,
    drive: 0.0, brakeBiasF: 0.65, caF: 70000, caR: 80000, mu: 1.38,
    curve: CURVE_GRASS, redline: 8800, upshiftRpm: 8400, downshiftRpm: 4500, idleRpm: 1100,
    gears: [2.9, 2.1, 1.65, 1.35, 1.12], finalDrive: 4.9, dragC: 0.65,
    susF: 1.0, susZ: 0.5,
    paint: '#f2a900', trim: '#16181d', glass: '#2a2f38',
  },
  {
    id: 'drift-s13', name: 'Nissun Sylvya S13 D', kind: 'drift', cls: 'drift', sub: 'Pro',
    rimIn: 17,   // its real rim, inches (what tyres fit)
    cg: 0.5, rideH: 0.11, steerMax: 0.85,
    aids: { abs: false, tcs: false },
    // a PRO DRIFT build of the 1990 coupe: a big-turbo 2-litre, RWD, a welded diff, ANGLE KIT
    // (steerMax 0.85 rad = 49 deg of lock; the
    // road cars 0.56), a softer rear axle (caR < caF) so it breaks loose and holds angle.
    mass: 1220, lf: 1.23, lr: 1.25, len: 4.52, wid: 1.69,
    drive: 0.0, brakeBiasF: 0.65, caF: 116000, caR: 98000, mu: 1.37,
    curve: CURVE_DRIFT, redline: 7800, upshiftRpm: 7400, downshiftRpm: 3500,
    gears: [3.32, 1.9, 1.31, 1.0, 0.75], finalDrive: 4.6, dragC: 0.42, izzK: 2.6,
    paint: '#f0f0ea', trim: '#e86fa8', glass: '#2a2f38', rim: '#c9a227',
  },
  {
    id: 'f2-rwd', name: 'Formula Too', kind: 'track', cls: 'single', sub: 'F2',
    rimIn: 18,   // its real rim, inches (what tyres fit)
    // Dallara F2 (2018): 620 hp @ 8750, 755 kg with the driver, final drive EST, Cd A ~0.95 m^2;
    // ~335 km/h
    cg: 0.36, rideH: 0.07, cyl: 6,
    // the FEEDER single-seater: the F1 car's shape, ~80 % of its power and ~65 % of its downforce,
    // heavier per hp — fast, but a step down.
    mass: 755, lf: 1.55, lr: 1.35, len: 4.3, wid: 1.3, trackWidth: 1.8, tyreWidth: 0.3,
    drive: 0.0, brakeBiasF: 0.60, caF: 150000, caR: 160000, mu: 1.9,
    curve: CURVE_F2, redline: 9000, upshiftRpm: 8600, downshiftRpm: 4200,
    gears: [2.9, 2.0, 1.55, 1.25, 1.05, 0.88], finalDrive: 3.4, dragC: dragOf(1.0, 0.95),
    aeroK: 1.3, downforceF: 1.12, downforceR: 1.62, susF: 2.2, susZ: 0.3,
    paint: '#2f6fd0', trim: '#16181d', glass: '#9aa0ae',
  },
];

// What spec(id) returns: SHARED + the row + L and Izz (+ what applyTyre / applyLivery set).
export type Spec = typeof SHARED & RosterRow
  & { L: number; Izz: number; tyre?: Tyre | null; num?: number };

// Resolve a roster row into a full spec: SHARED defaults + computed wheelbase and yaw inertia.

export function spec(carId: string): Spec {
  const row = ROSTER.find((car) => car.id === carId) || ROSTER[0];
  const out = { ...SHARED, ...row } as Spec;   // L and Izz are filled in just below
  out.L = out.lf + out.lr;
  out.Izz = ((out.mass * (out.len * out.len + out.wid * out.wid)) / 12) * out.izzK;
  // a car with its own factory set leaves the garage on it
  if (row.stockTyre) applyTyre(out, row.stockTyre);
  return out;
}

export const CAR_IDS = ROSTER.map((car) => car.id);
