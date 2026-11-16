// newcars.ts - THE NEW CARS (owner-approved list, 11-16; passed cars 1-7 the same day): each
// one's ROSTER row and the classes only they race in (GT, TOURING). cars.ts adds them to the
// roster and the classes. A car still under test goes behind its own switch (core/fixes.ts) until
// the owner passes it. Each row follows the real car (src/realcars.ts helpers); EST marks a figure
// no source gave. Drafted with tools/newcarstart.mjs, checked with tools/newcar.mjs <id>.
import type { RosterRow } from './cars.ts';
import { FIX } from './core/fixes.ts';
import { dragOf, realCurve, tyreR } from './realcars.ts';

// GT: the GT3 racers (TODO CHAMPIONSHIPS: GT), a class of their own on race tyres
const GT_CLASS = { id: 'gt', name: 'GT', subs: ['GT3'] };
// TOURING: the touring cars (TODO CHAMPIONSHIPS: BTCC) and the one-make cup racers on the BTCC
// bill (the Clio Cup), a class of their own on race tyres
const TOURING_CLASS = { id: 'touring', name: 'TOURING', subs: ['BTCC', 'One-make'] };
/** Every new class's id (the tyres they fit: cars.ts TYRES). */
// PROTOTYPE: the Le Mans prototypes (Le Manky), a class of their own on race tyres
const PROTO_CLASS = { id: 'proto', name: 'PROTOTYPE',
  subs: FIX.r13 ? ['Group C', 'LMP1'] : ['Group C'] };
export const NEW_CLS_IDS = [GT_CLASS.id, TOURING_CLASS.id, PROTO_CLASS.id];

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
  id: 'transfit-van', kind: 'van',
  name: 'Fjord Transfit MWB',
  cls: 'road', sub: 'Van',
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

// Ford Transit (Mk7, 2006-13) T280 SWB low roof FWD 2.2 TDCi 110 PS (Ford; dealers' sheets;
// owner: "older mk7 please"): the short wheelbase 2,933 mm, 4,863 x 1,974 mm, height ~2.0 m,
// 81 kW (110 PS) at 3,500, 285 Nm, a five-speed manual, FWD, ABS. EST: the kerb weight (1,700
// kg: the sheets give 1,609-1,699), the torque's band (1,800-2,000), 4,500 rpm, the ratios and
// final drive (to ~150 km/h at 3,500), 195/70 R15 tyres, Cd 0.39 x 4.0 m^2, an empty van's
// 58 / 42, its CG, the van tyres' grip, the springs; no stability control (ESP an option).
const TRANSFIT_SWB: RosterRow = {
  id: 'transfit-swb', name: 'Fjord Transfit SWB', kind: 'van', cls: 'road', sub: 'Van',
  rimIn: 15,   // its real rim, inches (what tyres fit)
  cg: 0.72, rideH: 0.17, cyl: 4,
  aids: { abs: true, tcs: false },
  mass: 1700, lf: 1.232, lr: 1.701, len: 4.863, wid: 1.974, trackWidth: 1.7,
  tyreWidth: 0.195, wheelR: tyreR(195, 70, 15),
  drive: 1.0, brakeBiasF: 0.68, caF: 115000, caR: 85000, mu: 0.9,
  curve: realCurve({ idle: 800, low: 0.55, nm: 285, nmFrom: 1800, nmTo: 2000,
    kw: 81, kwAt: 3500, redline: 4500 }),
  redline: 4500, upshiftRpm: 4100, downshiftRpm: 1500, idleRpm: 800,
  gears: [4.06, 2.24, 1.36, 0.98, 0.76], finalDrive: 3.79, dragC: dragOf(0.39, 4.0),
  susF: 1.3, susZ: 0.4,
  // the white van, grey bumpers, the blue oval
  paint: '#f0f0ea', trim: '#5a5f69', glass: '#2a2f38', rim: '#5a5f69',
};

// Ford Transit (Mk8) 350 L3 H3 RWD 2.0 EcoBlue 130 PS 6-speed manual (Ford; dealers' sheets): the
// long wheelbase, 3,750 mm, 5,981 x 2,059 x 2,650 mm, 2,290 kg (2,289-2,357 by trim), RWD with the
// engine along the car, ABS and ESC. EST: the engine as the L2's (96 kW, 385 Nm, the same band),
// the RWD six-speed's ratios (5.44 2.84 1.72 1.22 1.0 0.79, the MT82's) and its axle 3.73, 235/65
// R16 tyres, Cd 0.37 x 4.8 m^2 (the high roof), an empty van's 55 / 45, its CG, tyres and springs.
const TRANSFIT_LWB: RosterRow = {
  id: 'transfit-lwb', name: 'Fjord Transfit LWB', kind: 'van', cls: 'road', sub: 'Van',
  rimIn: 16,   // its real rim, inches (what tyres fit)
  cg: 0.85, rideH: 0.18, cyl: 4,
  aids: { abs: true, tcs: true },
  mass: 2290, lf: 1.688, lr: 2.062, len: 5.981, wid: 2.059, trackWidth: 1.72,
  tyreWidth: 0.235, wheelR: tyreR(235, 65, 16),
  drive: 0.0, brakeBiasF: 0.66, caF: 125000, caR: 100000, mu: 0.9,
  curve: realCurve({ idle: 800, low: 0.55, nm: 385, nmFrom: 1500, nmTo: 2000,
    kw: 96, kwAt: 3500, redline: 4500 }),
  redline: 4500, upshiftRpm: 4100, downshiftRpm: 1500, idleRpm: 800,
  gears: [5.44, 2.84, 1.72, 1.22, 1.0, 0.79], finalDrive: 3.73, dragC: dragOf(0.37, 4.8),
  susF: 1.3, susZ: 0.4,
  // the white van as the L2's
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

// Renault Clio III Cup (2006-13, the one-make racer on the Clio RS 197 / 200; owner: the race car
// to pair with the road Clio III 200 Cup; Renault's 2007 Clio Cup sheet): the F4R RS 2.0 16v
// across the front, 151 kW (205 bhp) at 7,300, 7,500 rpm, 223 Nm at 5,550, a Sadev six-speed
// sequential with a limited-slip differential (not modelled), FWD, 1,060 kg unladen, 3,986 mm
// long, wheelbase 2,585, track 1,538 / 1,520, Michelin 20/62-17 slicks on 8 x 17, SCx 0.77 m^2.
// EST: 1,140 kg with its driver, the width (~1.80 m: the sheet's 2,025 is with the mirrors), the
// torque's band (5,000-5,600), the ratios and final drive (to ~215 km/h), 60 / 40, the CG and ride
// height, the slicks' grip and stiffness, the springs; no ABS (owner), no traction control.
const CLEO: RosterRow = {
  id: 'cleo-cup', name: 'Renolt Cleo Cup', kind: 'cleo', cls: 'touring', sub: 'One-make',
  rimIn: 17,   // its real rim, inches (what tyres fit)
  cg: 0.45, rideH: 0.08, cyl: 4,
  aids: { abs: false, tcs: false },
  mass: 1140, lf: 1.034, lr: 1.551, len: 3.986, wid: 1.8, trackWidth: 1.53,
  // 20/62-17: 0.62 m across, 0.20 m of tread
  tyreWidth: 0.2, wheelR: 0.31,
  drive: 1.0, brakeBiasF: 0.65, caF: 95000, caR: 95000, mu: 1.45,
  curve: realCurve({ idle: 1100, low: 0.6, nm: 223, nmFrom: 5000, nmTo: 5600,
    kw: 151, kwAt: 7300, redline: 7500 }),
  redline: 7500, upshiftRpm: 7300, downshiftRpm: 4200, idleRpm: 1100,
  gears: [2.83, 2.06, 1.62, 1.33, 1.13, 0.95], finalDrive: 4.3, dragC: dragOf(0.77, 1.0),
  susF: 2.3, susZ: 0.32,
  // white, the Renault Sport yellow roof (big), black details (the splitter, the mirrors)
  paint: '#f0f0ea', trim: '#f2a900', glass: '#2a2f38', rim: '#16181d',
};

// Renaultsport Clio 200 Cup (Clio III phase 2, 2009-12, 3-door; Renault's figures): the F4R 2.0
// four across the front (no turbo), 147 kW (201 PS) at 7,100, 215 Nm at 5,400, a six-speed manual,
// FWD, 1,204 kg, 4,017 x 1,768 mm, wheelbase 2,585, track 1,520, 215/45 R17, ABS; 225 km/h, 0-100
// 6.9 s. EST: the 7,500 limit, the ratios (the TL4 024's 3.18 1.95 1.48 1.21 0.97 0.81: the 200's
// TL4 031 is said to differ slightly) and the final drive (4.5, to 225 km/h near the limit), Cd
// 0.35 x 2.1 m^2, 61 / 39, the CG, the tyres' grip and stiffness, the Cup chassis' springs, its
// stability control (none: the Cup's was deleted - to check).
const CLEO_RS: RosterRow = {
  id: 'cleo-rs200', name: 'Renolt Cleo RS 200', kind: 'cleors', cls: 'road', sub: 'Hatch',
  rimIn: 17,   // its real rim, inches (what tyres fit)
  cg: 0.52, rideH: 0.12, cyl: 4,
  aids: { abs: true, tcs: false },
  mass: 1204, lf: 1.008, lr: 1.577, len: 4.017, wid: 1.768, trackWidth: 1.52,
  tyreWidth: 0.215, wheelR: tyreR(215, 45, 17),
  drive: 1.0, brakeBiasF: 0.65, caF: 100000, caR: 105000, mu: 1.28,
  curve: realCurve({ idle: 850, low: 0.6, nm: 215, nmFrom: 5400, nmTo: 5600,
    kw: 147, kwAt: 7100, redline: 7500 }),
  redline: 7500, upshiftRpm: 7300, downshiftRpm: 3800, idleRpm: 850,
  gears: [3.18, 1.95, 1.48, 1.21, 0.97, 0.81], finalDrive: 4.5, dragC: dragOf(0.35, 2.1),
  susF: 1.7, susZ: 0.38,
  // Liquid Yellow, a darker roof, black details (the blade, the diffuser, the mirrors)
  paint: '#f2a900', trim: '#c98a00', glass: '#2a2f38', rim: '#2a2d34',
};

// Toyota TS010 (1992, Group C; Toyota's figures): the RV10 3.5-litre 72-degree V10 behind the
// driver (no turbo), "c600 bhp" in its Le Mans trim (c700 for the sprints), a six-speed manual,
// RWD, a carbon monocoque, 750 kg (the race weight), 4,800 x 2,000 x 1,030 mm, wheelbase 2,750,
// Goodyear 17 / 18-inch slicks, carbon brakes; 346 km/h at Le Mans (second in 1992). EST: the
// power's rpm (11,000) and the 12,000 limit, the torque (400 Nm, 9,000-10,500), the ratios and
// final drive (to ~346 km/h), the weight with its driver (830 kg), 42 / 58, the tyres' sizes
// (290/640-17, 355/710-18), Cd 0.38 x 1.85 m^2 (set to reach the 346), the downforce (Le Mans
// trim, ClA 3.0, 40 / 60), the CG, grip and stiffness (slicks), the springs (3 Hz); no ABS or TC.
const TS010: RosterRow = {
  id: 'ts010', name: 'Toyoter TS010', kind: 'proto', cls: 'proto', sub: 'Group C',
  rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.3, rideH: 0.05, cyl: 10,
  aids: { abs: false, tcs: false },
  mass: 830, lf: 1.595, lr: 1.155, len: 4.8, wid: 2.0, trackWidth: 1.6,
  // the rear 355/710-18: 0.71 m across
  tyreWidth: 0.355, wheelR: 0.355,
  drive: 0.0, brakeBiasF: 0.58, caF: 140000, caR: 200000, mu: 1.75,
  curve: realCurve({ idle: 2500, low: 0.5, nm: 400, nmFrom: 9000, nmTo: 10500,
    kw: 448, kwAt: 11000, redline: 12000 }),
  redline: 12000, upshiftRpm: 11700, downshiftRpm: 7000, idleRpm: 2500,
  gears: [2.5, 1.9, 1.55, 1.3, 1.12, 0.98], finalDrive: 4.54, dragC: dragOf(0.38, 1.85),
  aeroK: 1.8, downforceF: 1.2, downforceR: 1.8, susF: 3.0, susZ: 0.3,
  // white, a red canopy (big), black wing and splitter
  paint: '#f0f0ea', trim: '#c8342a', glass: '#2a2f38', rim: '#16181d',
};

// AEC Routemaster RM (1959-68; London Transport, the London Bus Museum): the AEC AV590 9.6-litre
// six (no turbo) at the front, 115 bhp (86 kW) at 1,800 rpm, a four-speed semi-automatic
// epicyclic gearbox with a fluid flywheel, RWD on twin rear wheels, 27 ft 6 in x 8 ft x 14 ft 4.5
// in (8.38 x 2.44 x 4.38 m), 7.35 tons (7,470 kg) empty, no ABS. EST: the torque (520 Nm at
// 1,000-1,300), the 2,000 limit, the ratios and final drive (to ~65 km/h: 40 mph), the wheelbase
// (5.08 m) and the empty bus's 40 / 60, the tracks (2.05 front, the rear twins' middles 1.80: the
// tyres' outer edges ~1.16 m out, under the 1.22 m body, as on an 8 ft bus), the 10.00-20 tyres,
// Cd 0.8 x 9 m^2, the CG (1.4 m), the bus tyres' grip and stiffness, the springs.
const ROUTEMONSTER: RosterRow = {
  id: 'routemonster', name: 'AEC Routemonster', kind: 'bus', cls: 'road', sub: 'Bus',
  rimIn: 20,   // its real rim, inches (what tyres fit)
  cg: 1.4, rideH: 0.25, cyl: 6,
  aids: { abs: false, tcs: false },
  mass: 7470, lf: 3.048, lr: 2.032, len: 8.38, wid: 2.44, trackWidth: 2.05, trackR: 1.8,
  // 10.00-20: 1.03 m across, 0.27 m wide
  tyreWidth: 0.27, wheelR: 0.515,
  drive: 0.0, brakeBiasF: 0.55, caF: 250000, caR: 400000, mu: 0.85,
  curve: realCurve({ idle: 450, low: 0.7, nm: 520, nmFrom: 1000, nmTo: 1300,
    kw: 86, kwAt: 1800, redline: 2000 }),
  redline: 2000, upshiftRpm: 1800, downshiftRpm: 900, idleRpm: 450,
  gears: [5.3, 2.98, 1.71, 1.0], finalDrive: 5.7, dragC: dragOf(0.8, 9.0),
  susF: 1.2, susZ: 0.35,
  // London red, a darker red roof, the cream band
  paint: '#c8342a', trim: '#a52a22', glass: '#2a2f38', rim: '#16181d',
};

// Citroen Saxo Kit Car (1997-99, the F2 "maxi" kit car; period sheets, which disagree): the TU5J4
// 1.6 16v four across the front, 210-216 hp (157 kW) at 8,500, 190-200 Nm at 6,000-7,000, a six-
// speed dog box, FWD, 890-1,000 kg, the Saxo's 3,717 mm length and 2,385 wheelbase, 1.72-1.74 m
// wide on its arches. EST: the middle values (950 kg, 1.74 m, 195 Nm), the 9,000 limit, the ratios
// and final drive, 205/55 R15 (the 306 Maxi's), Cd 0.38 x 1.9 m^2, 62 / 38, the track, the CG,
// the tyres' grip and stiffness and the rally springs (the 306 Maxi's); no driver aids.
const SAXO: RosterRow = {
  id: 'saxo-kit', name: 'Citrone Saxo Max', kind: 'saxo', cls: 'rally', sub: '2L',
  rimIn: 15,   // its real rim, inches (what tyres fit)
  cg: 0.48, rideH: 0.15, cyl: 4,
  aids: { abs: false, tcs: false },
  mass: 950, lf: 0.906, lr: 1.479, len: 3.717, wid: 1.74, trackWidth: 1.55,
  tyreWidth: 0.205, wheelR: tyreR(205, 55, 15),
  drive: 1.0, brakeBiasF: 0.65, caF: 100000, caR: 90000, mu: 1.43,
  curve: realCurve({ idle: 1200, low: 0.5, nm: 195, nmFrom: 6000, nmTo: 7000,
    kw: 157, kwAt: 8500, redline: 9000 }),
  redline: 9000, upshiftRpm: 8700, downshiftRpm: 5000, idleRpm: 1200,
  gears: [3.0, 2.2, 1.75, 1.45, 1.22, 1.05], finalDrive: 4.5, dragC: dragOf(0.38, 1.9),
  susF: 1.15, susZ: 0.44,
  // white, a red roof (big), the blue chevrons
  paint: '#f0f0ea', trim: '#c8342a', glass: '#2a2f38', rim: '#f0f0ea',
};

// Range Rover L322 4.4 V8 (2002-05; an Australian road test, Parkers, cars-data): the BMW M62 4.4
// V8 along the front, 210 kW at 5,400, 440 Nm at 3,600, a five-speed ZF automatic, permanent
// four-wheel drive, 4,950 x 2,009 mm, wheelbase 2,880, ABS and DSC; 208 km/h, 0-100 9.2 s. EST: the
// kerb weight (2,440 kg: a 2008 V8 is listed at 2,480), the torque's band, the 6,000 limit, the
// ZF 5HP24's ratios and the final drive (3.73, a 2008 car's), 255/55 R19, Cd 0.42 x 2.9 m^2
// (set to reach its 208), 50 / 50, the track, the CG, the tyres' grip and stiffness, the air
// springs' rate. The low range and the air suspension's heights are not modelled.
const STRANGE: RosterRow = {
  id: 'strange-l322', name: 'Strange Rover', kind: 'rrover', cls: 'road', sub: 'SUV',
  rimIn: 19,   // its real rim, inches (what tyres fit)
  cg: 0.75, rideH: 0.22, cyl: 8,
  aids: { abs: true, tcs: true },
  mass: 2440, lf: 1.44, lr: 1.44, len: 4.95, wid: 2.009, trackWidth: 1.63,
  tyreWidth: 0.255, wheelR: tyreR(255, 55, 19),
  drive: 0.5, brakeBiasF: 0.65, caF: 115000, caR: 120000, mu: 1.05,
  curve: realCurve({ idle: 650, low: 0.6, nm: 440, nmFrom: 3600, nmTo: 3800,
    kw: 210, kwAt: 5400, redline: 6000 }),
  redline: 6000, upshiftRpm: 5600, downshiftRpm: 2200, idleRpm: 650,
  gears: [3.57, 2.2, 1.51, 1.0, 0.8], finalDrive: 3.73, dragC: dragOf(0.42, 2.9),
  susF: 1.1, susZ: 0.45,
  // Zambezi Silver, a black roof, chrome details
  paint: '#a9aeb6', trim: '#16181d', glass: '#2a2f38', rim: '#c9ccd4',
};

// Citroen Saxo VTR 1.6 8v (Phase 2, 2001-03; auto-data.net): the road car the Saxmax (750 Motor
// Club, 2006-13) and the JSCC race (Autosport: the series "uses the Citroen Saxo VTR"): the TU5JP4
// 1.6 8v across the front, 72 kW (98 hp) at 5,700, 135 Nm at 3,000, a five-speed manual, FWD, 920
// kg, 3,718 x 1,620 mm, wheelbase 2,385, track 1,401 / 1,321, 185/55 R14; 193 km/h, 0-100 10.5 s.
// EST: the ratios (3.42 1.95 1.36 1.05 0.85: one site, not confirmed as the VTR's) and the final
// drive, the 6,500 limit, the torque's band, Cd 0.30 x 1.9 m^2 (set to its 193), 62 / 38, the
// CG, the grip and stiffness, the springs; ABS on, no traction control.
const SAXO_VTR: RosterRow = {
  id: 'saxo-vtr', name: 'Citrone Saxo VTR', kind: 'saxovtr', cls: 'road', sub: 'Hatch',
  rimIn: 14,   // its real rim, inches (what tyres fit)
  cg: 0.5, rideH: 0.13, cyl: 4,
  aids: { abs: true, tcs: false },
  mass: 920, lf: 0.906, lr: 1.479, len: 3.718, wid: 1.62, trackWidth: 1.36,
  tyreWidth: 0.185, wheelR: tyreR(185, 55, 14),
  drive: 1.0, brakeBiasF: 0.65, caF: 85000, caR: 80000, mu: 1.2,
  curve: realCurve({ idle: 800, low: 0.65, nm: 135, nmFrom: 3000, nmTo: 3500,
    kw: 72, kwAt: 5700, redline: 6500 }),
  redline: 6500, upshiftRpm: 6200, downshiftRpm: 2500, idleRpm: 800,
  gears: [3.42, 1.95, 1.36, 1.05, 0.85], finalDrive: 3.94, dragC: dragOf(0.30, 1.9),
  susF: 1.4, susZ: 0.38,
  // Diablo Red, a darker red roof, black details, silver wheels
  paint: '#c8342a', trim: '#a52a22', glass: '#2a2f38', rim: '#c9ccd4',
};

// Tesla Model 3 Long Range AWD (2019-20; EV Database, evspecifications.com): two motors, 324 kW
// (441 PS), 493 Nm, one fixed reduction, AWD, 1,847 kg, 4,694 x 1,849 mm, wheelbase 2,875, Cd
// 0.23 (Tesla's), 233 km/h (limited), 0-100 4.6 s. The motor's curve by hand: its 493 Nm flat to
// ~6,300 rpm, then its 324 kW (the torque falling as power / speed) to the limit. Owner: its
// regen, 0.2 g off the throttle (regenG, in place of the engines' drag); no exhaust, the frunk
// under its bonnet, no petrol stations (carbits.ts electric). idle 100 / shift 200 rpm: no clutch
// to slip at a start (one gear never shifts). EST: the 9.03 reduction (widely quoted), the limit
// (set to its 233), 235/45 R18, 47 / 53, the front motor's share of the drive (0.4), the track,
// the frontal area (2.22 m^2), the CG (low: the battery in the floor), the tyres' grip and
// stiffness; ABS and traction control on.
const TESLA: RosterRow = {
  id: 'tesla-m3', name: 'Teslur Model Why', kind: 'tesla', cls: 'road', sub: 'Saloon',
  rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.46, rideH: 0.14, regenG: 0.2,
  aids: { abs: true, tcs: true },
  mass: 1847, lf: 1.524, lr: 1.351, len: 4.694, wid: 1.849, trackWidth: 1.58,
  tyreWidth: 0.235, wheelR: tyreR(235, 45, 18),
  drive: 0.4, brakeBiasF: 0.65, caF: 115000, caR: 120000, mu: 1.3,
  curve: [[100, 493], [6300, 493], [8000, 387], [10000, 309], [12000, 258], [14000, 221],
    [16000, 193], [17000, 182]],
  redline: 16600, upshiftRpm: 200, downshiftRpm: 150, idleRpm: 100,
  gears: [1.0], finalDrive: 9.03, dragC: dragOf(0.23, 2.22),
  // Pearl White, the glass roof (the second colour, big), black details, the aero wheels' grey
  paint: '#f2f2ee', trim: '#1c2026', glass: '#2a2f38', rim: '#9aa0a8',
};

// BMW M4 GT3 (G82, 2022 on; BMW M Motorsport's sheet): the P58 3.0 twin-turbo straight six along
// the front, "up to 590 hp" (434 kW; BoP), ~700 Nm, an Xtrac six-speed sequential, RWD, 5,020 x
// 2,040 mm (with the splitter, wing and mirrors), 1,308 mm high, wheelbase 2,917, race ABS and
// traction control, the swan-neck wing on the boot lid. EST: ~1,300 kg (BoP), the body's width
// (2.0 m), the torque's band (2,750-5,500) and power's rpm (6,250), the 7,250 limit, the ratios
// and final drive (to ~285 km/h, the 911's), Cd 0.45 x 2.15 m^2, the downforce (as the 911's, a
// little more on the nose), 52 / 48, the track, the CG, 30/68-18 and 31/71-18 slicks' grip and
// stiffness, the springs.
const M4GT3: RosterRow = {
  id: 'bmv-m4gt3', name: 'BMV M4 GT3', kind: 'm4gt3', cls: 'gt', sub: 'GT3',
  rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.43, rideH: 0.08, cyl: 6,
  aids: { abs: true, tcs: true },
  mass: 1300, lf: 1.4, lr: 1.517, len: 5.02, wid: 2.0, trackWidth: 1.7,
  // the rear tyre's 710 mm across (31/71-18), 310 mm wide
  tyreWidth: 0.31, wheelR: 0.355,
  drive: 0.0, brakeBiasF: 0.62, caF: 120000, caR: 160000, mu: 1.6,
  curve: realCurve({ idle: 1300, low: 0.6, nm: 700, nmFrom: 2750, nmTo: 5500,
    kw: 434, kwAt: 6250, redline: 7250 }),
  redline: 7250, upshiftRpm: 7050, downshiftRpm: 4000, idleRpm: 1300,
  gears: [3.1, 2.25, 1.8, 1.5, 1.29, 1.13], finalDrive: 2.95, dragC: dragOf(0.45, 2.15),
  aeroK: 1.3, downforceF: 0.95, downforceR: 1.2, susF: 2.2, susZ: 0.32,
  // white, the M stripes (the second colour, the M light blue; with the dark blue and red), black
  // details and wheels
  paint: '#f0f0ea', trim: '#3d8fd6', glass: '#2a2f38', rim: '#16181d',
};

// Toyota Corolla GR Sport BTCC (E210 hatch, Toyota Gazoo Racing UK / Speedworks, 2019 on; NGTC
// and Toyota UK's figures): the TOCA / M-Sport 2.0 turbo four across the front, ~350 bhp (261
// kW), 1,280 kg with the driver, FWD, NGTC's six-speed sequential, the road hatch's 4,370 mm
// length and 2,640 mm wheelbase, no ABS (owner) or traction control. EST: the torque (420 Nm) and
// its band, the power's rpm and the 7,000 limit, the ratios and final drive (as the Civvic's, to
// ~250 km/h), NGTC's 1,875 mm width and 1.68 m track, Cd 0.40 x 2.1 m^2, the splitter and wing's
// downforce (the Civvic's), 58 / 42, the CG, Goodyear 265/660 R18 slicks, the springs.
const COROLLA: RosterRow = {
  id: 'toyoter-corolla', name: 'Toyoter Corolla BTCC', kind: 'corolla', cls: 'touring',
  sub: 'BTCC', rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.45, rideH: 0.07, cyl: 4,
  aids: { abs: false, tcs: false },
  mass: 1280, lf: 1.109, lr: 1.531, len: 4.37, wid: 1.875, trackWidth: 1.68,
  // 265/660 R18: 0.66 m across
  tyreWidth: 0.265, wheelR: 0.33,
  drive: 1.0, brakeBiasF: 0.65, caF: 115000, caR: 115000, mu: 1.5,
  curve: realCurve({ idle: 1500, low: 0.6, nm: 420, nmFrom: 3500, nmTo: 5500,
    kw: 261, kwAt: 6500, redline: 7000 }),
  redline: 7000, upshiftRpm: 6800, downshiftRpm: 3800, idleRpm: 1500,
  gears: [2.92, 2.21, 1.8, 1.52, 1.31, 1.15], finalDrive: 3.0, dragC: dragOf(0.4, 2.1),
  aeroK: 1.2, downforceF: 0.35, downforceR: 0.45, susF: 2.4, susZ: 0.32,
  // Gazoo Racing: white, the red roof (the second colour, big), black details and wheels
  paint: '#f0f0ea', trim: '#d0202a', glass: '#2a2f38', rim: '#16181d',
};

// Rebellion R13 (2018-20, the non-hybrid LMP1; third at Le Mans 2018; Wikipedia / Wikiwand,
// UltimateCarPage): the Gibson GL458 4.5 V8 behind the driver (no turbo), ~670 bhp (500 kW),
// 9,000 rpm, the Xtrac P1159C six-speed sequential, RWD, 833 kg (LMP1), 4,645 mm long, wheelbase
// 2,905. Conflicting: the width (1,895 or 1,995 mm: the LMP1 rule's 1,900 taken). EST: the
// torque (560 Nm) and its band, the power's rpm (8,500), the weight with its driver (908 kg), the
// ratios and final drive (to ~340 km/h, Le Mans trim), 45 / 55, the track, 30/68-18 and 31/71-18
// slicks, Cd 0.36 x 1.85 m^2 and the downforce (Le Mans trim: the TS010's), the CG, the springs;
// traction control on, no ABS (LMP1's).
const R13: RosterRow = {
  id: 'rebelion-r13', name: 'Rebelion R13', kind: 'lmp1', cls: 'proto', sub: 'LMP1',
  rimIn: 18,   // its real rim, inches (what tyres fit)
  cg: 0.3, rideH: 0.05, cyl: 8,
  aids: { abs: false, tcs: true },
  mass: 908, lf: 1.598, lr: 1.307, len: 4.645, wid: 1.895, trackWidth: 1.65,
  // the rear 31/71-18: 0.71 m across, 0.31 m wide
  tyreWidth: 0.31, wheelR: 0.355,
  drive: 0.0, brakeBiasF: 0.58, caF: 140000, caR: 200000, mu: 1.75,
  curve: realCurve({ idle: 2200, low: 0.55, nm: 560, nmFrom: 6500, nmTo: 7500,
    kw: 500, kwAt: 8500, redline: 9000 }),
  redline: 9000, upshiftRpm: 8800, downshiftRpm: 5500, idleRpm: 2200,
  gears: [2.6, 2.0, 1.62, 1.36, 1.17, 1.02], finalDrive: 3.4, dragC: dragOf(0.36, 1.85),
  aeroK: 1.8, downforceF: 1.2, downforceR: 1.8, susF: 3.0, susZ: 0.3,
  // white, a black canopy roof and fin (the second colour), red details
  paint: '#f0f0ea', trim: '#16181d', glass: '#2a2f38', rim: '#16181d',
};

// Seat Ibiza Mk4 (6J, 2008-17) 1.4 16v 85 PS five-door (Seat; auto-data.net): the 1.4 four across
// the front, 63 kW at 5,000, 132 Nm at 3,800, a five-speed manual, FWD, 1,111 kg, 4,052 x 1,693
// mm, wheelbase 2,469, track 1,465 / 1,457, ABS; 177 km/h, 0-100 12.2 s. EST: the torque's band,
// the 6,200 limit, the ratios and final drive (the 0A4's 3.455 1.944 1.370 1.032 0.850 and 3.882:
// to its 177 at 5,600), 185/60 R15, Cd 0.30 x 1.98 m^2 (set to reach its 177), 61 / 39, the CG,
// the tyres' grip and stiffness (everyday tyres), the springs; no stability control.
const IBIZA: RosterRow = {
  id: 'seat-ibiza', name: 'Seat Ibeefa', kind: 'ibiza', cls: 'road', sub: 'Hatch',
  rimIn: 15,   // its real rim, inches (what tyres fit)
  cg: 0.52, rideH: 0.14, cyl: 4,
  aids: { abs: true, tcs: false },
  mass: 1111, lf: 0.963, lr: 1.506, len: 4.052, wid: 1.693, trackWidth: 1.46,
  tyreWidth: 0.185, wheelR: tyreR(185, 60, 15),
  drive: 1.0, brakeBiasF: 0.65, caF: 85000, caR: 80000, mu: 1.12,
  curve: realCurve({ idle: 800, low: 0.65, nm: 132, nmFrom: 3800, nmTo: 4200,
    kw: 63, kwAt: 5000, redline: 6200 }),
  redline: 6200, upshiftRpm: 5900, downshiftRpm: 2300, idleRpm: 800,
  gears: [3.455, 1.944, 1.37, 1.032, 0.85], finalDrive: 3.882, dragC: dragOf(0.30, 1.98),
  susF: 1.35, susZ: 0.4,
  // Emocion Red, the roof in the paint's darker red, black details, silver wheels
  paint: '#c41e2a', trim: '#a51a24', glass: '#2a2f38', rim: '#c9ccd4',
};

// Audi A4 Avant B8 (2008-15) 2.0 TDI 143 PS six-speed manual FWD (automobile-catalog, carfolio,
// encyCARpedia): the 2.0 TDI four along the front, 105 kW at 4,200, 320 Nm at 1,750-2,500, FWD,
// 4,703 x 1,826 mm, wheelbase 2,808, ABS and ESP; 208 km/h, 0-100 9.7 s. Conflicting: the kerb
// weight (1,520-1,595 kg: 1,595 taken, encyCARpedia's FWD figure). EST: the 4,800 limit, the
// ratios and final drive (its 208 near the power peak in sixth), 225/55 R16, Cd 0.26 x 2.08 m^2
// (set to reach its 208: Audi quotes ~0.30), 60 / 40, the track, the CG, the tyres, the springs.
const A4AVANT: RosterRow = {
  id: 'ordi-a4', name: 'Ordi A4 Avant', kind: 'a4avant', cls: 'road', sub: 'Estate',
  rimIn: 16,   // its real rim, inches (what tyres fit)
  cg: 0.55, rideH: 0.14, cyl: 4,
  aids: { abs: true, tcs: true },
  mass: 1595, lf: 1.123, lr: 1.685, len: 4.703, wid: 1.826, trackWidth: 1.56,
  tyreWidth: 0.225, wheelR: tyreR(225, 55, 16),
  drive: 1.0, brakeBiasF: 0.65, caF: 95000, caR: 90000, mu: 1.12,
  curve: realCurve({ idle: 800, low: 0.55, nm: 320, nmFrom: 1750, nmTo: 2500,
    kw: 105, kwAt: 4200, redline: 4800 }),
  redline: 4800, upshiftRpm: 4400, downshiftRpm: 1600, idleRpm: 800,
  gears: [3.778, 2.063, 1.257, 0.903, 0.738, 0.618], finalDrive: 3.9, dragC: dragOf(0.26, 2.08),
  susF: 1.3, susZ: 0.4,
  // Ibis White, the roof in the paint (its rails the third colour), silver wheels
  paint: '#eceeea', trim: '#e1e3df', glass: '#2a2f38', rim: '#c9ccd4',
};

/** The new cars: their roster rows, in the list's order. */
export const NEW_CARS: RosterRow[] = [PORCH, SEVEN, TRANSFIT, TROPHY, CIVVIC, DEFUNDER, FOCUST,
  CLEO, CLEO_RS, TRANSFIT_LWB, TRANSFIT_SWB, TS010, ROUTEMONSTER, SAXO, STRANGE, SAXO_VTR, TESLA,
  M4GT3, ...(FIX.corolla ? [COROLLA] : []), ...(FIX.r13 ? [R13] : []),
  ...(FIX.ibiza ? [IBIZA] : []), ...(FIX.a4avant ? [A4AVANT] : [])];

/** The classes only new cars race in. */
export const NEW_CLASSES = [GT_CLASS, TOURING_CLASS, PROTO_CLASS];
