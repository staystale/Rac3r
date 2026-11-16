// newcars.ts - THE NEW CARS (owner-approved list, 11-16), each behind its own switch until the
// owner passes it (core/fixes.ts): its ROSTER row and the class it races in. cars.ts adds them to
// the roster and the classes only with the switch on, so the garage, the menus and every table
// walk show them only then. Each row follows the real car (src/realcars.ts helpers); EST marks a
// figure no source gave. Drafted with tools/newcarstart.mjs, checked with tools/newcar.mjs <id>.
import type { RosterRow } from './cars.ts';
import { FIX } from './core/fixes.ts';
import { dragOf, realCurve } from './realcars.ts';

// GT: the GT3 racers (TODO CHAMPIONSHIPS: GT), a class of their own on race tyres
const GT_CLASS = { id: 'gt', name: 'GT', subs: ['GT3'] };

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

/** The new cars switched on: their roster rows, in the list's order. */
export const NEW_CARS: RosterRow[] = [...(FIX.porch ? [PORCH] : [])];

/** The classes only new cars race in, while one of them is switched on. */
export const NEW_CLASSES = [...(FIX.porch ? [GT_CLASS] : [])];
