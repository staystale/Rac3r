// newcars.ts - THE NEW CARS (owner-approved list, 11-16), each behind its own switch until the
// owner passes it (core/fixes.ts): its ROSTER row and the class it races in. cars.ts adds them to
// the roster and the classes only with the switch on, so the garage, the menus and every table
// walk show them only then. Each row follows the real car (src/realcars.ts helpers); EST marks a
// figure no source gave. Drafted with tools/newcarstart.mjs, checked with tools/newcar.mjs <id>.
import type { RosterRow } from './cars.ts';
import { FIX } from './core/fixes.ts';
import { dragOf, realCurve, tyreR } from './realcars.ts';

// GT: the GT3 racers (TODO CHAMPIONSHIPS: GT), a class of their own on race tyres
const GT_CLASS = { id: 'gt', name: 'GT', subs: ['GT3'] };
// TOURING: the touring cars (TODO CHAMPIONSHIPS: BTCC), a class of their own on race tyres
const TOURING_CLASS = { id: 'touring', name: 'TOURING', subs: ['BTCC'] };
/** Every new class's id, switched on or not (the tyres they fit: cars.ts TYRES). */
export const NEW_CLS_IDS = [GT_CLASS.id, TOURING_CLASS.id];

// Porsche 911 GT3 R (992, 2023; Porsche Motorsport's data): 4,194 cc flat six behind the rear
// axle, ~416 kW (565 PS; BoP), 9,250 rpm max, 6-speed sequential, RWD, ~1,250 kg (BoP), 4,619 x
// 2,050 mm, wheelbase 2,507, Michelin 30/68-18 front / 31/71-18 rear on 12.5J / 13.5J x 18,
// race ABS and traction control, a central radiator in the nose, the swan-neck wing on the
// engine lid. EST: the torque (not published: 490 Nm), the power's rpm (8,750), the ratios and
// final drive (to ~285 km/h at the limit), Cd 0.45 x 2.1 m^2, the weight split (39 / 61), the
// track, the downforce (as the 992 GT3 RS's published 409 kg at 200 km/h: ClA 2.1, 40 / 60), the
// tyres' grip and stiffness (slicks), the springs (a race car's 2+ Hz).
const PORCH: RosterRow = {
  id: 'porch-gt3r', name: 'Porch 911 GT3 Arr', kind: 'porch', cls: 'gt', sub: 'GT3',
  rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.42, rideH: 0.08, cyl: 6,
  aids: { abs: true, tcs: true },
  mass: 1250, lf: 1.529, lr: 0.978, len: 4.619, wid: 2.05, trackWidth: 1.72,
  // the rear tyre's 710 mm across (31/71-18), 310 mm wide
  tyreWidth: 0.31, wheelR: 0.355,
  drive: 0.0, brakeBiasF: 0.62, caF: 110000, caR: 170000, mu: 1.6,
  curve: realCurve({ idle: 1500, low: 0.6, nm: 490, nmFrom: 6000, nmTo: 7500,
    kw: 416, kwAt: 8750, redline: 9250 }),
  redline: 9250, upshiftRpm: 9050, downshiftRpm: 4350, idleRpm: 1500,
  gears: [3.0, 2.15, 1.72, 1.45, 1.26, 1.12], finalDrive: 3.89, dragC: dragOf(0.45, 2.1),
  aeroK: 1.3, downforceF: 0.85, downforceR: 1.27, susF: 2.2, susZ: 0.32,
  // white, a red roof and wing, black details and wheels
  paint: '#f0f0ea', trim: '#c8342a', glass: '#2a2f38', rim: '#16181d',
};

// Caterham Seven 420R (2015, S3 chassis; Caterham's figures): Ford Duratec 2.0 four in front,
// 157 kW (210 bhp) at 7,600, 203 Nm at 6,300, RWD on a de Dion axle, 560 kg, 2,225 mm wheelbase,
// 1,575 mm wide, Avon 195/50 R15, no ABS or traction control; 219 km/h, 0-60 mph 3.8 s. EST:
// the length (3,100 mm; sources give 3,100-3,380), the track (1,270 front / 1,336 rear: 1.30), the
// 7,800 rpm limit, the six-speed's ratios and final drive, Cd 0.7 x 1.25 m^2 (the area set so it
// reaches the real 219 km/h; the open body lifts: the shared downforce), the weight split
// (47 / 53), the tyres' grip and stiffness (road-legal track tyres), the springs.
const SEVEN: RosterRow = {
  id: 'seven-420r', name: 'Caterpillar Seven', kind: 'seven', cls: 'road', sub: 'Sports',
  rimIn: 15,   // its real rim, inches (what tyres fit)
  cg: 0.38, rideH: 0.1, cyl: 4,
  aids: { abs: false, tcs: false },
  mass: 560, lf: 1.179, lr: 1.046, len: 3.1, wid: 1.575, trackWidth: 1.3,
  tyreWidth: 0.195, wheelR: tyreR(195, 50, 15),
  drive: 0.0, brakeBiasF: 0.62, caF: 52000, caR: 60000, mu: 1.36,
  curve: realCurve({ idle: 900, low: 0.6, nm: 203, nmFrom: 5500, nmTo: 6300,
    kw: 157, kwAt: 7600, redline: 7800 }),
  redline: 7800, upshiftRpm: 7550, downshiftRpm: 3300, idleRpm: 900,
  gears: [2.92, 2.09, 1.57, 1.24, 1.0, 0.85], finalDrive: 4.1, dragC: dragOf(0.7, 1.25),
  susF: 1.8, susZ: 0.38,
  // the aluminium tub, the nose cone and wings in green, a yellow stripe, silver wheels
  paint: '#a9aeb6', trim: '#2e7d32', glass: '#9fb0c4', rim: '#c9ccd4',
};

// Ford Transit (Mk8, 2019) 290 L2 H2 FWD 2.0 EcoBlue 130 PS 6-speed manual (Ford; cars-data):
// 96 kW, 385 Nm, 1,997 kg, 5,531 x 2,059 x 2,490 mm, wheelbase 3,300, track 1,503 / 1,486,
// 215/65 R15, 1,850 rpm at 100 km/h in top (the top gear's overall 2.30), ABS and ESC. EST: the
// torque's band (1,500-2,000) and power's rpm (3,500), the 4,500 rpm limit, the lower ratios and
// the final drive (3.29, top 0.70: the published 1,850 rpm), Cd 0.37 x 4.4 m^2, an empty van's
// weight split (58 / 42) and its CG height, the tyres' grip and stiffness (van tyres), springs.
const TRANSFIT: RosterRow = {
  id: 'transfit-van', name: 'Fjord Transfit', kind: 'van', cls: 'road', sub: 'Van',
  rimIn: 15,   // its real rim, inches (what tyres fit)
  cg: 0.75, rideH: 0.18, cyl: 4,
  aids: { abs: true, tcs: true },
  mass: 1997, lf: 1.386, lr: 1.914, len: 5.531, wid: 2.059, trackWidth: 1.495,
  tyreWidth: 0.215, wheelR: tyreR(215, 65, 15),
  drive: 1.0, brakeBiasF: 0.68, caF: 125000, caR: 90000, mu: 0.9,
  curve: realCurve({ idle: 800, low: 0.55, nm: 385, nmFrom: 1500, nmTo: 2000,
    kw: 96, kwAt: 3500, redline: 4500 }),
  redline: 4500, upshiftRpm: 4100, downshiftRpm: 1500, idleRpm: 800,
  gears: [4.71, 2.53, 1.6, 1.1, 0.86, 0.7], finalDrive: 3.29, dragC: dragOf(0.37, 4.4),
  susF: 1.3, susZ: 0.4,
  // the white van: black bumpers and trim, a blue badge
  paint: '#f0f0ea', trim: '#2a2d34', glass: '#2a2f38', rim: '#5a5f69',
};

// Ford F-150 Trophy Truck (an open-class SCORE trophy truck; Auto Bild's track test): a 7.2 V8
// set back ahead of the cabin, 850 PS (625 kW), RWD, a 3.15 m wheelbase, ~2.5 tonnes, 80-90 cm of
// wheel travel, ~60 cm of ground clearance. EST (no published figures): the torque (900 Nm) and
// the power's rpm (6,000), the 6,500 limit, a three-speed automatic's ratios (a TH400's) and the
// final drive (5.0), the size (5.6 x 2.35 m, track 2.0), 39x13.5 R17 desert tyres, Cd 0.6 x 3.2
// m^2, 50 / 50, the CG height, the soft long-travel springs, the tyres' grip and stiffness.
const TROPHY: RosterRow = {
  id: 'effing-tt', name: 'Fjord Effing-150 Trophy Truck', kind: 'trophy', cls: 'offroad',
  sub: 'Trophy truck', rimIn: 17,   // its real rim, inches (what tyres fit)
  // its factory set: desert tyres, as the Dunflop All-Terrain (more bite on loose ground)
  stockTyre: 'all-terrain',
  cg: 0.95, rideH: 0.6, cyl: 8,
  aids: { abs: false, tcs: false },
  mass: 2500, lf: 1.575, lr: 1.575, len: 5.6, wid: 2.35, trackWidth: 2.0,
  // 39 x 13.5 R17: 0.99 m across, 0.34 m wide
  tyreWidth: 0.34, wheelR: 0.495,
  drive: 0.0, brakeBiasF: 0.6, caF: 150000, caR: 160000, mu: 1.07,
  curve: realCurve({ idle: 1000, low: 0.6, nm: 900, nmFrom: 4000, nmTo: 5000,
    kw: 625, kwAt: 6000, redline: 6500 }),
  redline: 6500, upshiftRpm: 6200, downshiftRpm: 3200, idleRpm: 1000,
  gears: [2.48, 1.48, 1.0], finalDrive: 5.0, dragC: dragOf(0.6, 3.2),
  susF: 0.9, susZ: 0.45,
  // white, the race blue (big), an orange line, black wheels
  paint: '#f0f0ea', trim: '#1d3f9a', glass: '#2a2f38', rim: '#16181d',
};

// Honda Civic Type R BTCC (FK8, 2018-21: an NGTC touring car, before the 2022 hybrid; NGTC, TOCA
// and the team's published figures): a 2.0 turbo four across the front, "350+ bhp" (261 kW),
// FWD, an Xtrac six-speed sequential, a base weight of 1,280 kg with the driver, the FK8's 4,557 mm
// length and 2,700 mm wheelbase, NGTC's 1,875 mm width, Goodyear 265/660 R18 slicks on 18-inch
// centre-lock wheels, no ABS or traction control. EST (not published): the torque (450 Nm) and
// its band, the power's rpm (6,500) and the 7,000 limit, the ratios and final drive (to ~250 km/h:
// 145-160 mph is quoted at Thruxton), Cd 0.40 x 2.1 m^2, the weight split (58 / 42), the track
// (1.68), the CG and ride height, the downforce (splitter and wing: ClA 0.8, ~220 kg at 240 km/h),
// the tyres' grip and stiffness (slicks), the springs (a race car's 2+ Hz).
const CIVVIC: RosterRow = {
  id: 'civvic-btcc', name: 'Honder Civvic Type Arr BTCC', kind: 'btcc', cls: 'touring',
  sub: 'BTCC', rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.45, rideH: 0.07, cyl: 4,
  aids: { abs: false, tcs: false },
  mass: 1280, lf: 1.134, lr: 1.566, len: 4.557, wid: 1.875, trackWidth: 1.68,
  // 265/660 R18: 0.66 m across
  tyreWidth: 0.265, wheelR: 0.33,
  drive: 1.0, brakeBiasF: 0.65, caF: 115000, caR: 115000, mu: 1.5,
  curve: realCurve({ idle: 1500, low: 0.6, nm: 450, nmFrom: 3500, nmTo: 5500,
    kw: 261, kwAt: 6500, redline: 7000 }),
  redline: 7000, upshiftRpm: 6800, downshiftRpm: 3800, idleRpm: 1500,
  gears: [2.92, 2.21, 1.8, 1.52, 1.31, 1.15], finalDrive: 3.0, dragC: dragOf(0.4, 2.1),
  aeroK: 1.2, downforceF: 0.35, downforceR: 0.45, susF: 2.4, susZ: 0.32,
  // white, a red roof (big), black details (the wing, the splitter, the mirrors), black wheels
  paint: '#f0f0ea', trim: '#c8342a', glass: '#2a2f38', rim: '#16181d',
};

// Land Rover Defender 110 Station Wagon 2.2 TDCi (2012-16; Land Rover's figures): the Puma 2.2
// diesel four along the front, 90 kW (122 PS) at 3,500 and 360 Nm at 2,000, the six-speed manual
// (5.443 2.839 1.721 1.223 1.0 0.794), the transfer box's high range 1.211 on 3.538 axles (4.285),
// permanent four-wheel drive (a locking centre: 50 / 50), 1,987 kg, 4,785 mm long with the spare
// on the door, 1,790 wide, wheelbase 2,794, 235/85 R16, ABS and traction control; 145 km/h, 0-100
// 15.8 s. EST: the torque's band (2,000-2,400), the 4,500 limit, Cd 0.55 x 2.8 m^2, the weight
// split (52 / 48), the track (1,486), the CG height and ride height, the all-terrain tyres' grip
// and stiffness, the soft coil springs. The low range is not modelled (no new mechanic).
const DEFUNDER: RosterRow = {
  id: 'defunder-110', name: 'Lend Rover Defunder 110', kind: 'defunder', cls: 'offroad',
  sub: '4x4', rimIn: 16,   // its real rim, inches (what tyres fit)
  cg: 0.8, rideH: 0.25, cyl: 4,
  aids: { abs: true, tcs: true },
  mass: 1987, lf: 1.341, lr: 1.453, len: 4.785, wid: 1.79, trackWidth: 1.486,
  tyreWidth: 0.235, wheelR: tyreR(235, 85, 16),
  drive: 0.5, brakeBiasF: 0.65, caF: 90000, caR: 90000, mu: 0.85,
  curve: realCurve({ idle: 750, low: 0.55, nm: 360, nmFrom: 2000, nmTo: 2400,
    kw: 90, kwAt: 3500, redline: 4500 }),
  redline: 4500, upshiftRpm: 4000, downshiftRpm: 1600, idleRpm: 750,
  gears: [5.443, 2.839, 1.721, 1.223, 1.0, 0.794], finalDrive: 4.285, dragC: dragOf(0.55, 2.8),
  susF: 1.1, susZ: 0.4,
  // green, a white roof (big), black arches, bumper and mirrors, silver wheels
  paint: '#1f4d2e', trim: '#f0f0ea', glass: '#2a2f38', rim: '#a9aeb6',
};

// Ford Focus ST (Mk4, 2019 on) 2.3 EcoBoost 280 PS six-speed manual 5-door (Ford; auto-data): the
// 2.3 turbo four across the front, 206 kW at 5,500, 420 Nm at 3,000-4,000, FWD, 1,433 kg (DIN),
// 4,388 x 1,825 mm, wheelbase 2,700, track 1,567 / 1,556, 235/35 R19, the ratios 2-6 1.952 1.321
// 1.029 0.821 0.686 and the final drive 4.063, ABS and ESC; 250 km/h (limited), 0-100 5.7 s. EST:
// first gear 3.231 (the Mk3 ST's, the same six-speed), the 6,500 limit, Cd 0.32 x 2.25 m^2, the
// weight split (61 / 39), the CG height, the tyres' grip and stiffness, the springs. Its
// electronic limited-slip front differential is not modelled (no new mechanic).
const FOCUST: RosterRow = {
  id: 'focust-st', name: 'Fjord Focust ST', kind: 'focust', cls: 'road', sub: 'Hatch',
  rimIn: 19,   // its real rim, inches (what tyres fit)
  cg: 0.53, rideH: 0.13, cyl: 4,
  aids: { abs: true, tcs: true },
  mass: 1433, lf: 1.053, lr: 1.647, len: 4.388, wid: 1.825, trackWidth: 1.562,
  tyreWidth: 0.235, wheelR: tyreR(235, 35, 19),
  drive: 1.0, brakeBiasF: 0.65, caF: 110000, caR: 112000, mu: 1.33,
  curve: realCurve({ idle: 800, low: 0.6, nm: 420, nmFrom: 3000, nmTo: 4000,
    kw: 206, kwAt: 5500, redline: 6500 }),
  redline: 6500, upshiftRpm: 6200, downshiftRpm: 2600, idleRpm: 800,
  gears: [3.231, 1.952, 1.321, 1.029, 0.821, 0.686], finalDrive: 4.063, dragC: dragOf(0.32, 2.25),
  susF: 1.5, susZ: 0.38,
  // Ford Performance blue, a darker roof, black details (grille, spoiler, mirrors), dark wheels
  paint: '#2f6fd0', trim: '#1d3f9a', glass: '#2a2f38', rim: '#2a2d34',
};

/** The new cars switched on: their roster rows, in the list's order. */
export const NEW_CARS: RosterRow[] = [...(FIX.porch ? [PORCH] : []),
  ...(FIX.seven ? [SEVEN] : []), ...(FIX.transfit ? [TRANSFIT] : []),
  ...(FIX.trophy ? [TROPHY] : []), ...(FIX.civvic ? [CIVVIC] : []),
  ...(FIX.defunder ? [DEFUNDER] : []), ...(FIX.focust ? [FOCUST] : [])];

/** The classes only new cars race in, while one of them is switched on. */
export const NEW_CLASSES = [...(FIX.porch ? [GT_CLASS] : []),
  ...(FIX.civvic ? [TOURING_CLASS] : [])];
