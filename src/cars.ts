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

// Curve shape borrowed from the hatch and scaled/shifted per car (PLAN.md).
const CURVE_HATCH: Curve  = [[900, 313], [2000, 430], [3000, 473], [4000, 488], [5000, 466], [6000,
  410], [6800, 343]];
const CURVE_ESTATE: Curve = [[900, 415], [1800, 565], [2600, 609], [3200, 625], [4000, 588], [4800,
  510], [6000, 410]];
const CURVE_MUSCLE: Curve = [[900, 1941], [1800, 2544], [2600, 2757], [3400, 2811], [4200, 2676],
  [5000, 2346], [6000, 1929]];
// Bumped when the roster-wide grip raise stopped it breaking traction — a rally car that
// cannot be made to slide is the wrong car.
const CURVE_RALLY: Curve  = [[1200, 537], [2200, 762], [3200, 862], [4200, 881], [5200, 840], [6400,
  737], [7600, 587]];
const CURVE_TRACK: Curve  = [[1500, 438], [3000, 568], [4500, 655], [6000, 723], [7000, 756], [8000,
  728], [9000, 616]];
// (requirement: a BMW 3 series 2000s and a Subaru WRX classic 2005 saloon) — game units, scaled
// from the real figures as the roster is (the hatch peaks 488): an E46 330i-style straight
// six (300 Nm real, ~1.5x the hatch, smooth and flat, 6500 redline) and a GD WRX-style turbo flat
// four (300 Nm real at 3600: soft under 2500, then the boost, tailing off to 7000)
const CURVE_SALOON: Curve = [[900, 460], [2000, 620], [3000, 700], [3500, 730], [4500, 720], [5500,
  680], [6500, 600]];
// v2 (requirement: feels a bit slow at acceleration / unable to wheelspin or drift): +12 % boost
// and the lag filled from 2000 rpm
const CURVE_WRZ: Curve    = [[1000, 380], [2000, 600], [2800, 790], [3600, 840], [4500, 820], [5500,
  730], [6500, 600], [7000, 540]];
const CURVE_TRACTOR: Curve = [[600, 3600], [1000, 5200], [1500, 5800], [1900, 5400], [2200, 4200],
  [2500, 800], [2600, 50]];
// NEW CARS. Curves are on the game's scale (the roster runs ~1.7x real torque —
// see SHARED dragC), set against the measured roster (tools/carstats.mjs), not the brochure.
const CURVE_MINI: Curve    = [[900, 120], [2000, 160], [3000, 178], [4000, 182], [5000, 172], [6000,
  150], [6500, 132]];
const CURVE_LAMBO: Curve   = [[1000, 620], [2500, 880], [4000, 990], [5500, 1060], [6500, 1070],
  [7500, 1020], [8500, 900]];
const CURVE_MIKRA: Curve   = [[1200, 170], [2200, 230], [3200, 255], [4200, 260], [5200, 246],
  [6200, 217], [7000, 191]];
const CURVE_KIT: Curve     = [[1500, 300], [3000, 420], [4500, 500], [6000, 540], [7000, 545],
  [8000, 500], [8500, 460]];
const CURVE_RX: Curve      = [[1500, 760], [2500, 1150], [3500, 1300], [4500, 1320], [5500, 1250],
  [6500, 1100], [7500, 940]];
const CURVE_BANGER: Curve  = [[900, 380], [2000, 500], [3000, 540], [4000, 545],
  [5000, 500], [6000, 430]];
const CURVE_GRASS: Curve   = [[1500, 200], [3000, 270], [4500, 320], [6000, 345], [7000, 350],
  [8000, 330], [8800, 300]];
const CURVE_DRIFT: Curve   = [[1200, 380], [2500, 640], [3500, 800], [4500, 830], [5500, 800],
  [6500, 720], [7800, 600]];
const CURVE_F2: Curve      = [[1500, 350], [3000, 455], [4500, 525], [6000, 580], [7000, 605],
  [8000, 585], [9000, 495]];

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
];
const ALLC = ['road', 'rally', 'rx', 'stock', 'oval', 'single', 'drift', 'offroad'];
// grip x per surface, in TYRE_SURFS order: tarmac wet gravel dirt grass mud sand snow ice
const makeTyre = (tyreId: string, brand: string, name: string, price: number, fits: string[],
  grips: number[], extra: Partial<Tyre> = {}): Tyre =>
  ({ id: tyreId, brand, name, price, fits,
    grip: Object.fromEntries(TYRE_SURFS.map(([surf], i) => [surf, grips[i]])), ...extra });
export const TYRES = [
  makeTyre('pre-spun', 'spum', 'Pre-Spun', 0, ALLC,
    [1, 1, 1, 1, 1, 1, 1, 1, 1], { note: 'the floor: what every car leaves the factory on' }),
  makeTyre('all-season', 'spum', 'All-Season', 320, ['road', 'rally', 'rx', 'stock', 'drift'],
    [1.05, 1.1, 1.05, 1.05, 1.05, 1.04, 1.04, 1.12, 1.08],
    { note: 'a little better at everything' }),
  makeTyre('mud-plugger', 'spum', 'Mud-Plugger', 380, ['road', 'rally', 'rx', 'stock', 'drift',
    'offroad'], [0.92, 0.95, 1.1, 1.14, 1.22, 1.35, 1.12, 1.1, 0.95], { heatHard: 1.6,
    opt: [50, 95], note: 'mud + grass; cooks on tarmac' }),
  makeTyre('road-sport', 'kum', 'Road Sport', 520, ['road', 'stock', 'drift'],
    [1.1, 1.05, 0.98, 0.98, 0.97, 0.94, 0.96, 0.92, 0.92], { note: 'fast road tyre' }),
  makeTyre('semi-slick', 'kum', 'Semi-Slick', 780, ['road', 'rx', 'stock', 'oval', 'drift'],
    [1.18, 0.9, 0.92, 0.92, 0.9, 0.85, 0.9, 0.8, 0.8], { opt: [75, 120], peak: 100, cold: 0.8,
    note: 'track day: needs heat, hates rain' }),
  makeTyre('drift', 'kum', 'Drift', 450, ['road', 'drift'],
    [1.03, 0.95, 0.98, 0.98, 0.95, 0.92, 0.95, 0.9, 0.9], { slide: 1.1, opt: [80, 150], peak: 110,
    heatHard: 0.8, note: 'holds a slide, hard to overheat' }),
  makeTyre('kum-wet', 'kum', 'Wet', 480, ['road', 'rally', 'rx', 'stock', 'drift'],
    [1, 1.22, 1, 1.02, 1.02, 1.05, 1, 1.04, 1], { opt: [40, 85], peak: 60,
    note: 'rain tyre; overheats on a dry road' }),
  makeTyre('gravel', 'dunflop', 'Gravel', 600, ['road', 'rally', 'rx', 'stock', 'offroad'],
    [0.94, 0.98, 1.22, 1.18, 1.1, 1.08, 1.08, 1.05, 1], { heatHard: 1.8, opt: [45, 90], peak: 65,
    note: 'bites in the loose; hot on tarmac' }),
  makeTyre('soft-gravel', 'dunflop', 'Soft Gravel', 680, ['road', 'rally', 'rx'],
    [0.9, 0.97, 1.3, 1.24, 1.15, 1.12, 1.12, 1.08, 1], { heatHard: 2.2, opt: [40, 85], peak: 60,
    note: 'most loose grip; cooks fastest' }),
  makeTyre('tarmac-rally', 'dunflop', 'Tarmac Rally', 700, ['road', 'rally', 'rx'],
    [1.14, 1.06, 1, 1, 0.95, 0.92, 0.94, 0.9, 0.9], { note: 'asphalt stages, copes with dirt' }),
  makeTyre('studded', 'dunflop', 'Studded Snow', 650, ['road', 'rally', 'rx', 'offroad'],
    [0.88, 0.95, 1.08, 1.06, 1, 0.98, 0.98, 1.5, 1.9], { heatHard: 1.4,
    note: 'snow + ice; noisy and slow on tarmac' }),
  makeTyre('all-terrain', 'dunflop', 'All-Terrain', 500, ['road', 'rally', 'rx', 'stock',
    'offroad'], [0.98, 1, 1.12, 1.12, 1.15, 1.18, 1.15, 1.08, 1.02],
    { note: 'off the road and back' }),
  makeTyre('p-soft', 'pirrelly', 'Soft', 1400, ['single', 'oval'],
    [1.28, 0.85, 0.85, 0.85, 0.82, 0.75, 0.8, 0.7, 0.65], { opt: [90, 125], peak: 105, cold: 0.78,
    heatHard: 1.2, note: 'fastest; must be hot' }),
  makeTyre('p-medium', 'pirrelly', 'Medium', 1200, ['single', 'oval'],
    [1.22, 0.88, 0.88, 0.88, 0.85, 0.78, 0.82, 0.72, 0.68], { opt: [85, 130], peak: 100, cold: 0.8,
    note: 'a long stint' }),
  makeTyre('p-wet', 'pirrelly', 'Full Wet', 1100, ['single', 'oval'],
    [1.02, 1.35, 0.95, 0.95, 0.95, 0.92, 0.92, 0.85, 0.8], { opt: [40, 80], peak: 60,
    note: 'standing water; dies on a dry line' }),
];
for (const tyre of TYRES) {
  tyre.bySurf = {};
  for (const [sid, group] of Object.entries(SURF_GROUP)) tyre.bySurf[sid] = tyre.grip[group];
}
export const tyreOf = (tyreId: string) => TYRES.find((tyre) => tyre.id === tyreId) || TYRES[0];
// fit a tyre to a spec (null / unknown / 'pre-spun' = stock: no tyre object, the roster's own heat
// window — physics exactly as before)
export function applyTyre(carSpec: Spec, tyreId: string): Spec {
  const row = ROSTER.find((rosterRow) => rosterRow.id === String(carSpec.id).split('#')[0])
    || ({} as RosterRow),
    tyre = tyreOf(tyreId);
  const fits = tyre.fits.includes(row.cls);
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
    id: 'hatch-fwd', name: 'Hatch FWD', kind: 'hatch', cls: 'road', sub: 'Hatch',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.55, rideH: 0.14,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // The honest hatchback. Understeers on power, slides ONLY on the handbrake. The control case.
    mass: 1440, lf: 1.10, lr: 1.40, len: 4.0, wid: 1.7,
    // Brake bias is strongly FRONT on every car. MEASURED: at the old rearward figures
    // the rear locked under braking, lost all its lateral grip, and the car spun — 5 of 5 past 90
    // deg when braking in a turn. Real cars run 70-85% front for exactly this reason.
    drive: 1.0, brakeBiasF: 0.84, caF: 109000, caR: 117000, mu: 1.56,
    curve: CURVE_HATCH, redline: 6800, upshiftRpm: 6200, downshiftRpm: 2600,
    gears: [3.45, 1.95, 1.28, 0.95, 0.76], finalDrive: 4.06, dragC: 0.50,
    paint: '#4a8fd4', trim: '#2b5c8f', glass: '#8fb8d8',
  },
  {
    id: 'hatch-rwd', name: 'Hatch RWD', kind: 'hatch', cls: 'road', sub: 'Hatch',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.53, rideH: 0.13,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // Same shell, rear drive. The drift teacher — the car the mark showcase is tuned on.
    mass: 1440, lf: 1.25, lr: 1.25, len: 4.0, wid: 1.7,
    drive: 0.0, brakeBiasF: 0.82, caF: 109000, caR: 114000, mu: 1.56,
    curve: CURVE_HATCH, redline: 6800, upshiftRpm: 6200, downshiftRpm: 2600,
    gears: [3.45, 1.95, 1.28, 0.95, 0.76], finalDrive: 4.06, dragC: 0.50,
    // Per-car yaw inertia. MEASURED: this was the ONLY car still spinning to 180 on a held-lock
    // handbrake after the self-aligning fix — it is the shortest and lightest rear-drive car, so
    // the box formula gives it roughly half the muscle car's yaw inertia while it carries similar
    // grip. A per-car outlier deserves a per-car number, not another global knob.
    izzK: 3.4,
    paint: '#e0603a', trim: '#9c3a1c', glass: '#cfa98f',
  },
  {
    id: 'saloon-rwd', name: 'BMV 3 Serious', kind: 'saloon', cls: 'road', sub: 'Saloon',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow; handling still uses cgH
    cg: 0.52, rideH: 0.13,
    aids: { abs: true, tcs: true },   // ABS + DSC, as the real one
    // 2000s compact exec saloon (E46 330i-ish): rear drive, 50 / 50 on a long wheelbase, a smooth
    // straight six. Calmer and more stable than the short hatch RWD (longer wheelbase, more yaw
    // inertia), but it will still hang its tail out on the throttle.
    mass: 1450, lf: 1.36, lr: 1.36, len: 4.47, wid: 1.74,
    drive: 0.0, brakeBiasF: 0.80, caF: 112000, caR: 118000, mu: 1.58,
    curve: CURVE_SALOON, redline: 6500, upshiftRpm: 6100, downshiftRpm: 2600,
    gears: [4.23, 2.52, 1.66, 1.22, 1.00], finalDrive: 3.07, dragC: 0.52,
    // titanium silver, silver multi-spokes
    paint: '#a9aeb6', trim: '#4a4f58', glass: '#8fa3b8', rim: '#d6d9df',
  },
  {
    id: 'wrz-awd', name: 'Subaroo WRZ', kind: 'wrz', cls: 'rally', sub: '2L+',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow; handling still uses cgH
    cg: 0.53, rideH: 0.15,
    aids: { abs: true, tcs: false },  // 2005: ABS, no traction control
    // 2005 turbo AWD saloon (GD WRX-ish): symmetrical all-wheel drive (50 / 50), the boxer and
    // turbo up front (60 % of the weight on the nose: it pushes on entry, then the AWD pulls it
    // out), lag below 2500 rpm then a strong mid-range. A road car, not the Rally. v2: 57 % on the
    // nose (was 60) and a REAR-BIASED centre diff, 36 / 64 like the STI's DCCD (was 50 / 50: it
    // gripped and pushed — power-on gravel body slip 31 deg, yaw 44 deg/s vs the Rally's 70 / 74,
    // tools/carfeel)
    mass: 1410, lf: 1.09, lr: 1.435, len: 4.47, wid: 1.74,
    drive: 0.36, brakeBiasF: 0.80, caF: 112000, caR: 116000, mu: 1.60,
    curve: CURVE_WRZ, redline: 7000, upshiftRpm: 6500, downshiftRpm: 2800,
    gears: [3.45, 1.95, 1.37, 0.97, 0.74], finalDrive: 4.44, dragC: 0.55,
    // World Rally Blue, gold wheels
    paint: '#1d3f9a', trim: '#0f2257', glass: '#93abd2', rim: '#c9a227',
    // the AI's confidence in this car's plan (aidriver profileOf). 1.0: Sweaty Lamb Real off 25 s a
    // lap; 0.94: 2.9 s, laps 111-113 -> 108.7 s, Thruston +0.8 s
    aiK: 0.94,
  },
  {
    id: 'estate-4x4', name: 'Estate 4x4', kind: 'estate', cls: 'road', sub: 'Estate',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.66, rideH: 0.21,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: true },
    // Heavy, planted, four-wheel drive. Long lazy four-wheel slides, heavy marks, hard to stop.
    mass: 1810, lf: 1.35, lr: 1.35, len: 4.7, wid: 1.8,
    drive: 0.5, brakeBiasF: 0.82, caF: 124000, caR: 134000, mu: 1.49,
    curve: CURVE_ESTATE, redline: 6000, upshiftRpm: 5500, downshiftRpm: 2200,
    gears: [3.50, 2.00, 1.35, 1.00, 0.80], finalDrive: 3.90, dragC: 0.68,
    paint: '#4f6b52', trim: '#2f4433', glass: '#9fb8a4',
  },
  {
    id: 'muscle-rwd', name: 'Muscle', kind: 'muscle', cls: 'road', sub: 'Muscle',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.5, rideH: 0.12,
    // DRIVER AIDS by real-world fit; ON by default, switchable
    aids: { abs: true, tcs: false },
    // Torque far beyond the rear tyres. Power oversteer in any gear; the loudest marks in the lab.
    mass: 1880, lf: 1.30, lr: 1.30, len: 4.8, wid: 1.9,
    drive: 0.0, brakeBiasF: 0.82, caF: 119000, caR: 125000, mu: 1.58,
    curve: CURVE_MUSCLE, redline: 6000, upshiftRpm: 5500, downshiftRpm: 2200,
    // raised with the 3x power so the torque goes into
    gears: [2.66, 1.78, 1.30, 1.00], finalDrive: 3.31, dragC: 1.05,
                                     // wheelspin and acceleration rather than a 390 km/h top speed
    paint: '#b3252f', trim: '#6e141b', glass: '#d0a0a4',
  },
  {
    id: 'rally-4x4', name: 'Rally', kind: 'rally', cls: 'rally', sub: 'Group B',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.52, rideH: 0.2,
    // Group-B-flavoured: rear-BIASED all-wheel drive (22% front / 78% rear), turbo torque low in
    // the range, light, and a big wing. The 4x4 estate deliberately cannot be made to slide; this
    // one can, because the rear takes most of the drive — the same drive number doing the same job,
    // which is the whole point of the seam.
    mass: 1250, lf: 1.20, lr: 1.30, len: 4.1, wid: 1.82,
    // 22/78 front/rear. At 0.35 the roster-wide grip raise left it unable to break traction at all,
    // and a rally car has to be the one that slides.
    drive: 0.22, brakeBiasF: 0.80, caF: 112000, caR: 119000, mu: 1.64,
    curve: CURVE_RALLY, redline: 7600, upshiftRpm: 7000, downshiftRpm: 3000,
    gears: [3.20, 2.15, 1.60, 1.25, 1.02, 0.86], finalDrive: 4.10, dragC: 0.58,
    aeroK: 1.6,           // the wing
    // Raised to realistic levels. Real rally cars generate ~300kg+ downforce at 100mph.
    downforceF: 0.90, downforceR: 1.70,
    // Long-travel rally springs: soft and well damped. It soaks a kerb up instead of being thrown
    // off one, which is the entire reason this car exists.
    susF: 1.05, susZ: 0.46,
    paint: '#2f6fd0', trim: '#12325f', glass: '#9fc0e4',
  },
  {
    id: 'track-rwd', name: 'Track spec', kind: 'track', cls: 'single', sub: 'F1',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.36, rideH: 0.07,
    // Formula 1 archetype: featherweight, open-wheel, huge aero downforce, wide racing slicks.
    mass: 815, lf: 1.55, lr: 1.35, len: 4.4, wid: 1.35, trackWidth: 1.85, tyreWidth: 0.32,
    drive: 0.0, brakeBiasF: 0.86, caF: 159000, caR: 171000, mu: 1.92,
    curve: CURVE_TRACK, redline: 9000, upshiftRpm: 8600, downshiftRpm: 4200,
    gears: [2.90, 2.00, 1.55, 1.25, 1.05, 0.88], finalDrive: 3.90, dragC: 0.62,
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
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 0.48, rideH: 0.1,
    // Oval racer: heavy, massive V8 torque, 4-speed manual/auto, designed to go fast and turn left.
    // Extremely slippery on dirt/grass due to stiff setup and high power.
    mass: 1495, lf: 1.35, lr: 1.45, len: 5.1, wid: 1.95, trackWidth: 1.85,
    drive: 0.0, brakeBiasF: 0.80, caF: 135000, caR: 145000, mu: 1.85,
    curve: CURVE_MUSCLE, redline: 9000, upshiftRpm: 8500, downshiftRpm: 4500, idleRpm: 1500,
    gears: [2.65, 1.80, 1.30, 1.00], finalDrive: 3.50, dragC: 0.45, // very aerodynamic body
    aeroK: 1.1, downforceF: 0.80, downforceR: 1.20, // moderate downforce from the rear lip spoiler
    susF: 2.10, susZ: 0.35, // Stiff for banked corners
    paint: '#f2a900', trim: '#111111', glass: '#555555',
  },
  {
    id: 'tractor', name: 'Tractor', kind: 'tractor', cls: 'offroad', sub: 'Odd',
    // m: CENTRE OF GRAVITY and RIDE HEIGHT — rollover (roll.js) + shadow;
    // handling still uses cgH
    cg: 1.05, rideH: 0.45,
    // Heavy agricultural diesel puller. High torque, wide rear stance, open-wheel styling.
    mass: 5200, lf: 1.50, lr: 1.10, len: 4.2, wid: 2.1,
    drive: 0.0, brakeBiasF: 0.75, caF: 160000, caR: 280000, mu: 1.72,
    curve: CURVE_TRACTOR, redline: 2600, upshiftRpm: 2300, downshiftRpm: 1100, idleRpm: 750,
    gears: [4.20, 2.70, 1.80, 1.25, 0.90], finalDrive: 4.80, dragC: 3.50,
    aeroK: 0.8, downforceF: 0.0, downforceR: 0.0,
    susF: 1.10, susZ: 0.55,
    paint: '#2e7d32', trim: '#fbc02d', glass: '#37474f',
  },
  // ---------------- NEW CARS (requirement: an old classic Mini, a Lamborghini, and yeah fill those
  // classes)
  {
    id: 'mini-fwd', name: 'Minnie Cooped S', kind: 'mini', cls: 'road', sub: 'Hatch',
    cg: 0.48, rideH: 0.12,
    aids: { abs: false, tcs: false },   // 1965: nothing
    // the 1960s 1275 Cooper S: tiny, FWD, a transverse four, 10-inch wheels, wheels pushed to the
    // corners (a long wheelbase for its length) and 60 % on the nose. Slow in a straight line,
    // darts into corners, lifts a rear wheel and tucks in on a lift.
    mass: 690, lf: 0.82, lr: 1.22, len: 3.05, wid: 1.41, trackWidth: 1.24, wheelR: 0.27,
    drive: 1.0, brakeBiasF: 0.76, caF: 62000, caR: 64000, mu: 1.5,
    curve: CURVE_MINI, redline: 6500, upshiftRpm: 6100, downshiftRpm: 2600, idleRpm: 900,
    gears: [3.33, 2.06, 1.35, 1.0], finalDrive: 3.44, dragC: 0.42, izzK: 2.6,
    // British racing green, white roof, steel wheels
    paint: '#1f4d2e', trim: '#f0f0ea', glass: '#9fb8a4', rim: '#c9ccd4',
  },
  {
    id: 'lambo-awd', name: 'Lamburghini Hurrikan', kind: 'lambo', cls: 'road', sub: 'Sports',
    cg: 0.45, rideH: 0.1, cyl: 10,
    aids: { abs: true, tcs: true },
    // a mid-engined V10 supercar: 4WD with the drive mostly at the back (30 / 70), 43 / 57 weight,
    // a wide low wedge, 8500 rpm.
    mass: 1420, lf: 1.49, lr: 1.13, len: 4.46, wid: 1.93, trackWidth: 1.67, tyreWidth: 0.28,
      wheelR: 0.33,
    drive: 0.3, brakeBiasF: 0.78, caF: 128000, caR: 142000, mu: 1.72,
    curve: CURVE_LAMBO, redline: 8500, upshiftRpm: 8200, downshiftRpm: 4000, idleRpm: 1000,
    gears: [3.13, 2.59, 1.96, 1.57, 1.29, 1.08, 0.88], finalDrive: 3.4, dragC: 1.08,
    aeroK: 1.2, downforceF: 0.35, downforceR: 0.55, susF: 1.8, susZ: 0.38,
    paint: '#9bc53d', trim: '#16181d', glass: '#2a2f38', rim: '#16181d',   // verde, black wheels
  },
  {
    id: 'mikra-r1', name: 'Nissun Mikra R1', kind: 'mikra', cls: 'rally', sub: '1L',
    cg: 0.52, rideH: 0.18,
    aids: { abs: false, tcs: false },
    // the entry rally car: a 1-litre turbo supermini, front drive, rally springs, short gears.
    // Slow, honest, a ladder rung.
    mass: 980, lf: 0.98, lr: 1.47, len: 3.8, wid: 1.68,
    drive: 1.0, brakeBiasF: 0.78, caF: 92000, caR: 98000, mu: 1.52,
    curve: CURVE_MIKRA, redline: 7000, upshiftRpm: 6600, downshiftRpm: 3000,
    gears: [3.5, 2.1, 1.5, 1.15, 0.92], finalDrive: 4.3, dragC: 0.5,
    susF: 1.1, susZ: 0.45,
    paint: '#f0f0ea', trim: '#c8342a', glass: '#9fb0c4',
  },
  {
    id: 'kit-2l', name: 'Pugeot 306 Maxxi', kind: 'kit', cls: 'rally', sub: '2L',
    cg: 0.5, rideH: 0.17,
    aids: { abs: false, tcs: false },
    // a 2-litre FWD KIT CAR (the 90s F2 kit cars): a screaming 8500 rpm four, a close six-speed,
    // huge arches over a wide track, light. On tarmac it humbles 4WD cars; on gravel it scrabbles
    // at the front.
    mass: 1000, lf: 1.0, lr: 1.58, len: 4.03, wid: 1.83, trackWidth: 1.65,
    drive: 1.0, brakeBiasF: 0.76, caF: 114000, caR: 100000, mu: 1.6,
    curve: CURVE_KIT, redline: 8500, upshiftRpm: 8200, downshiftRpm: 4500, idleRpm: 1100,
    gears: [3.0, 2.2, 1.75, 1.45, 1.22, 1.05], finalDrive: 4.2, dragC: 0.55,
    susF: 1.15, susZ: 0.44,
    paint: '#f0f0ea', trim: '#1d3f9a', glass: '#9fb0c4',
  },
  {
    id: 'rx-super', name: 'Fjord Fiester RX', kind: 'rxcar', cls: 'rx', sub: 'Supercar',
    cg: 0.5, rideH: 0.2,
    aids: { abs: false, tcs: false },
    // a RALLYCROSS SUPERCAR: 600 hp from a 2-litre turbo in a supermini shell, 4WD (45 / 55), short
    // gears, 0-100 in under 2 s. Big wing.
    mass: 1300, lf: 1.15, lr: 1.34, len: 4.1, wid: 1.95, trackWidth: 1.7,
    drive: 0.45, brakeBiasF: 0.78, caF: 112000, caR: 118000, mu: 1.66,
    curve: CURVE_RX, redline: 7500, upshiftRpm: 7100, downshiftRpm: 3500, idleRpm: 1100,
    gears: [2.6, 1.9, 1.5, 1.2, 0.95], finalDrive: 4.0, dragC: 0.72,
    aeroK: 1.4, downforceF: 0.6, downforceR: 1.2, susF: 1.1, susZ: 0.46,
    paint: '#e0603a', trim: '#16181d', glass: '#2a2f38',
  },
  {
    id: 'banger-f2', name: 'BriSKA F2 Stocker', kind: 'banger', cls: 'stock', sub: 'Stock car',
    cg: 0.5, rideH: 0.14,
    aids: { abs: false, tcs: false },
    // an F2 SHORT-OVAL STOCK CAR: a 2-litre RWD saloon shell on a steel chassis, huge front + rear
    // bumpers, nerf rails, the roof painted in your grade colour (trim). Contact is the point.
    mass: 1150, lf: 1.25, lr: 1.25, len: 4.3, wid: 1.85,
    drive: 0.0, brakeBiasF: 0.72, caF: 108000, caR: 112000, mu: 1.55,
    curve: CURVE_BANGER, redline: 6500, upshiftRpm: 6000, downshiftRpm: 2600,
    gears: [2.97, 2.01, 1.40, 1.0], finalDrive: 3.9, dragC: 0.78,
    susF: 1.6, susZ: 0.36,
    paint: '#c8342a', trim: '#f2a900', glass: '#2a2f38',
  },
  {
    id: 'grass-special', name: 'Autograss Special', kind: 'grass', cls: 'stock', sub: 'Grass track',
    cg: 0.42, rideH: 0.2,
    aids: { abs: false, tcs: false },
    // a GRASS-TRACK SPECIAL (autograss Class 8-ish): a space-frame buggy, a 1.6 16v behind the
    // driver, rear drive, 57 % on the back, long
    // soft springs. Light, it digs in on grass and goes sideways everywhere.
    mass: 650, lf: 1.25, lr: 0.95, len: 3.4, wid: 1.75, trackWidth: 1.6,
    drive: 0.0, brakeBiasF: 0.7, caF: 70000, caR: 80000, mu: 1.55,
    curve: CURVE_GRASS, redline: 8800, upshiftRpm: 8400, downshiftRpm: 4500, idleRpm: 1100,
    gears: [2.9, 2.1, 1.65, 1.35, 1.12], finalDrive: 4.9, dragC: 0.72,
    susF: 1.0, susZ: 0.5,
    paint: '#f2a900', trim: '#16181d', glass: '#2a2f38',
  },
  {
    id: 'drift-s13', name: 'Nissun Sylvya S13 D', kind: 'drift', cls: 'drift', sub: 'Pro',
    cg: 0.5, rideH: 0.11, steerMax: 0.85,
    aids: { abs: false, tcs: false },
    // a PRO DRIFT build of the 1990 coupe: a big-turbo 2-litre, RWD, a welded diff, ANGLE KIT
    // (steerMax 0.85 rad = 49 deg of lock; the
    // road cars 0.56), a softer rear axle (caR < caF) so it breaks loose and holds angle.
    mass: 1220, lf: 1.23, lr: 1.25, len: 4.52, wid: 1.69,
    drive: 0.0, brakeBiasF: 0.7, caF: 116000, caR: 98000, mu: 1.56,
    curve: CURVE_DRIFT, redline: 7800, upshiftRpm: 7400, downshiftRpm: 3500,
    gears: [3.32, 1.9, 1.31, 1.0, 0.75], finalDrive: 4.6, dragC: 0.6, izzK: 2.6,
    paint: '#f0f0ea', trim: '#e86fa8', glass: '#2a2f38', rim: '#c9a227',
  },
  {
    id: 'f2-rwd', name: 'Formula Too', kind: 'track', cls: 'single', sub: 'F2',
    cg: 0.36, rideH: 0.07, cyl: 6,
    // the FEEDER single-seater: the F1 car's shape, ~80 % of its power and ~65 % of its downforce,
    // heavier per hp — fast, but a step down.
    mass: 755, lf: 1.55, lr: 1.35, len: 4.3, wid: 1.3, trackWidth: 1.8, tyreWidth: 0.3,
    drive: 0.0, brakeBiasF: 0.84, caF: 150000, caR: 160000, mu: 1.85,
    curve: CURVE_F2, redline: 9000, upshiftRpm: 8600, downshiftRpm: 4200,
    gears: [2.9, 2.0, 1.55, 1.25, 1.05, 0.88], finalDrive: 3.9, dragC: 1.02,
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
  return out;
}

export const CAR_IDS = ROSTER.map((car) => car.id);
