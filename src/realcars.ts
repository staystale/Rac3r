// realcars.ts - REAL CARS (?realcars=1, owner 11-03: "base it on a real car like all our vehicles
// should be"; "anything real is fine"; names "close to the real thing but different"). Each car
// takes its real counterpart's weight, engine (peak torque and power where the maker states them),
// gearbox, tyre size and drag (0.5 rho Cd A). Its cornering stiffness scales with the weight, so
// the tuned balance stays. Figures: makers' data as published (GTI Mk7 220 PS / 350 Nm / 1351 kg;
// E46 330i 231 PS / 300 Nm, Getrag 4.21 2.49 1.66 1.24 1.00, 3.07; GD STI 206 kW, 6MT 3.636 ...
// 0.756, 3.90; Huracan 610 PS / 560 Nm, 7DCT 3.133 ... 0.677, 4.89; Cooper S 1275 76 hp, 3.44,
// 145/80 R10; Fastrac 8330 348 hp / 1440 Nm, 70 km/h ...). A ratio set no source gave is
// estimated so the car reaches its real top speed near its power peak (EST below).
import type { Curve, RosterRow } from './cars.ts';

/** A real engine: its idle, the torque plateau, the power peak and the rev limit. */
interface Engine {
  idle: number; low: number;   // rpm; torque at idle as a share of the peak (turbo lag: low)
  nm: number; nmFrom: number; nmTo: number;   // peak torque and the rpm it holds over
  kw: number; kwAt: number;   // peak power and its rpm
  redline: number;
}

/**
 * A torque curve through an engine's stated figures: idle, the plateau, the power peak, the limit.
 * @param eng the engine
 * @returns the curve, Nm at the crank
 */
export function realCurve(eng: Engine): Curve {
  const atPeak = eng.kw * 1000 / (eng.kwAt * Math.PI / 30);
  return [[eng.idle, Math.round(eng.nm * eng.low)], [eng.nmFrom, eng.nm], [eng.nmTo, eng.nm],
    [eng.kwAt, Math.round(atPeak)], [eng.redline, Math.round(atPeak * 0.88)]];
}

/** 0.5 rho Cd A (N per (m/s)^2) from the drag coefficient and the frontal area. */
const dragOf = (coef: number, area: number) => +(0.6125 * coef * area).toFixed(3);
/** A tyre's rolling radius (m) from its size: width mm, aspect %, rim inches. */
const tyreR = (width: number, aspect: number, rim: number) =>
  +((rim * 25.4 + 2 * width * aspect / 100) / 2000).toFixed(3);

type Real = Partial<RosterRow> & { engine?: Engine };

const REAL: Record<string, Real> = {
  // VW Golf GTI Mk7 (2013): 220 PS @ 4500-6200, 350 Nm @ 1500-4400, 1351 kg, 6MT (ratios EST),
  // 225/40 R18, Cd 0.32 x 2.19 m^2; 246 km/h
  'hatch-fwd': { name: 'Folksvagon Gulf GTEye', mass: 1351,
    engine: { idle: 900, low: 0.6, nm: 350, nmFrom: 1500, nmTo: 4400, kw: 162, kwAt: 6200,
      redline: 6500 },
    upshiftRpm: 6200, gears: [3.77, 2.09, 1.47, 1.10, 0.92, 0.77], finalDrive: 3.94,
    wheelR: tyreR(225, 40, 18), tyreWidth: 0.225, dragC: dragOf(0.32, 2.19) },
  // BMW M135i (F20, 2012): 320 hp @ 5800, 450 Nm @ 1300-4500, 1425 kg, 6MT (1st 4.11; rest
  // EST), 245/35 R18, Cd 0.33 x 2.2; 250 km/h (governed)
  'hatch-rwd': { name: 'BMV Em135Aye', mass: 1425,
    engine: { idle: 800, low: 0.6, nm: 450, nmFrom: 1300, nmTo: 4500, kw: 235, kwAt: 5800,
      redline: 7000 },
    upshiftRpm: 6600, gears: [4.11, 2.32, 1.54, 1.18, 1.00, 0.85], finalDrive: 3.15,
    wheelR: tyreR(245, 35, 18), tyreWidth: 0.245, dragC: dragOf(0.33, 2.2) },
  // BMW 330i (E46): 231 PS @ 5900, 300 Nm @ 3500, 1450 kg, Getrag 5MT, 3.07, 225/45 R17,
  // Cd 0.30 x 2.13; 250 km/h
  'saloon-rwd': { mass: 1450,
    engine: { idle: 750, low: 0.75, nm: 300, nmFrom: 3000, nmTo: 4000, kw: 170, kwAt: 5900,
      redline: 6500 },
    upshiftRpm: 6200, gears: [4.21, 2.49, 1.66, 1.24, 1.00], finalDrive: 3.07,
    wheelR: tyreR(225, 45, 17), tyreWidth: 0.225, dragC: dragOf(0.30, 2.13) },
  // Subaru Impreza WRX STI (GD, 2005): 206 kW @ 6400, 407 Nm @ 4000, 1495 kg, 6MT 3.636 2.375
  // 1.761 1.346 0.971 0.756, 3.90, 225/45 R17, Cd 0.35 x 2.1; 255 km/h
  'wrz-awd': { mass: 1495,
    engine: { idle: 900, low: 0.45, nm: 407, nmFrom: 3600, nmTo: 4400, kw: 206, kwAt: 6400,
      redline: 7000 },
    upshiftRpm: 6700, gears: [3.636, 2.375, 1.761, 1.346, 0.971, 0.756], finalDrive: 3.90,
    wheelR: tyreR(225, 45, 17), tyreWidth: 0.225, dragC: dragOf(0.35, 2.1) },
  // Volvo V70 R (2004): 300 PS @ 5500, 400 Nm @ 1950-5250, 1665 kg, 6MT (EST), 235/40 R18,
  // Cd 0.33 x 2.3; 250 km/h
  'estate-4x4': { name: 'Volvoh V70 Arr', mass: 1665,
    engine: { idle: 800, low: 0.6, nm: 400, nmFrom: 1950, nmTo: 5250, kw: 221, kwAt: 5500,
      redline: 6500 },
    upshiftRpm: 6000, gears: [3.54, 2.05, 1.38, 1.03, 0.82, 0.68], finalDrive: 3.55,
    wheelR: tyreR(235, 40, 18), tyreWidth: 0.235, dragC: dragOf(0.33, 2.3) },
  // Chevrolet Chevelle SS 454 LS6 (1970): 450 hp gross (~360 net, what reaches the road) @ 5600,
  // 500 lb-ft (678 Nm) @ 3600, ~1730 kg, M22 4MT 2.20 1.64 1.28 1.00, 3.31, F70-14, Cd 0.50 x 2.2
  'muscle-rwd': { name: 'Chevvy Shovelle SS 454', mass: 1730,
    engine: { idle: 750, low: 0.7, nm: 678, nmFrom: 3000, nmTo: 3600, kw: 268, kwAt: 5600,
      redline: 6500 },
    upshiftRpm: 6000, gears: [2.20, 1.64, 1.28, 1.00], finalDrive: 3.31,
    wheelR: 0.335, tyreWidth: 0.215, dragC: dragOf(0.50, 2.2) },
  // Audi Sport quattro S1 E2 (1985): ~350 kW (factory 470 hp) @ 8000, 590 Nm @ 5500, 1090 kg,
  // 6MT (EST, geared for the stages: ~235 km/h), Cd 0.40 x 2.0 with its wings
  'rally-4x4': { name: 'Ordi Sport Kwattro S1', mass: 1090,
    engine: { idle: 1200, low: 0.4, nm: 590, nmFrom: 4500, nmTo: 5500, kw: 350, kwAt: 8000,
      redline: 8500 },
    upshiftRpm: 8000, gears: [3.00, 2.06, 1.55, 1.23, 1.00, 0.84], finalDrive: 4.90,
    dragC: dragOf(0.40, 2.0) },
  // a Formula 1 car (2022 rules): ~1000 hp with the hybrid (746 kW) @ 11500, 798 kg with the
  // driver, 8-speed (EST), 18-inch tyres (0.36 m), Cd A ~1.1 m^2; ~340 km/h
  'track-rwd': { name: 'Formula Won', mass: 798,
    engine: { idle: 4000, low: 0.6, nm: 640, nmFrom: 9000, nmTo: 10500, kw: 746, kwAt: 11500,
      redline: 12500 },
    upshiftRpm: 12000, downshiftRpm: 8000,
    gears: [3.10, 2.40, 1.95, 1.65, 1.42, 1.25, 1.12, 1.00], finalDrive: 4.80,
    wheelR: 0.36, dragC: dragOf(1.0, 1.1) },
  // a NASCAR Cup car (Next Gen): 670 hp (500 kW) @ 9000, ~610 Nm, 1542 kg, 5-speed sequential
  // (EST), 18-inch, Cd A ~0.9 m^2; ~320 km/h unrestricted
  naffcar: { mass: 1542,
    engine: { idle: 1500, low: 0.6, nm: 610, nmFrom: 6500, nmTo: 7500, kw: 500, kwAt: 9000,
      redline: 9500 },
    upshiftRpm: 9200, downshiftRpm: 5500, gears: [2.85, 1.97, 1.49, 1.20, 1.00], finalDrive: 3.90,
    wheelR: 0.356, dragC: dragOf(1.0, 0.9) },
  // JCB Fastrac 8330: 348 hp (260 kW) @ 2100, 1440 Nm @ 1500, ~11 400 kg, 70 km/h, 600/70 R30
  // (0.80 m), Cd 0.9 x 7 m^2 (its CVT as five steps)
  tractor: { name: 'JCBee Fastrack 8330', mass: 11400,
    engine: { idle: 800, low: 0.65, nm: 1440, nmFrom: 1400, nmTo: 1600, kw: 260, kwAt: 2100,
      redline: 2300 },
    upshiftRpm: 2200, finalDrive: 11.1, wheelR: tyreR(600, 70, 30), tyreWidth: 0.6,
    dragC: dragOf(0.9, 7) },
  // Mini Cooper S 1275 (Mk1): 76 hp @ 5800, 107 Nm @ 3000, ~650 kg, 4MT 3.33 2.09 1.35 1.00,
  // 3.44, 145/80 R10, Cd 0.48 x 1.6; 156 km/h
  'mini-fwd': { mass: 650,
    engine: { idle: 800, low: 0.7, nm: 107, nmFrom: 3000, nmTo: 3500, kw: 57, kwAt: 5800,
      redline: 6500 },
    upshiftRpm: 6200, gears: [3.33, 2.09, 1.35, 1.00], finalDrive: 3.44,
    wheelR: tyreR(145, 80, 10), tyreWidth: 0.145, dragC: dragOf(0.48, 1.6) },
  // Lamborghini Huracan LP 610-4: 610 PS @ 8250, 560 Nm @ 6500, 1553 kg, 7DCT 3.133 2.083 1.575
  // 1.244 0.979 0.788 0.677, 4.89, 305/30 R20, Cd 0.39 x 1.95; 325 km/h
  'lambo-awd': { mass: 1553,
    engine: { idle: 1000, low: 0.65, nm: 560, nmFrom: 6000, nmTo: 6500, kw: 449, kwAt: 8250,
      redline: 8500 },
    upshiftRpm: 8300, gears: [3.133, 2.083, 1.575, 1.244, 0.979, 0.788, 0.677], finalDrive: 4.89,
    wheelR: tyreR(305, 30, 20), tyreWidth: 0.305, dragC: dragOf(0.39, 1.95) },
  // Peugeot 306 Maxi (F2 kit car, 1996): 960 kg
  'kit-2l': { mass: 960 },
  // Ford Fiesta RX (World RX supercar): 600 hp, 900 Nm, 1300 kg
  'rx-super': { engine: { idle: 1500, low: 0.55, nm: 900, nmFrom: 3500, nmTo: 4500, kw: 447,
    kwAt: 6500, redline: 7500 } },
  // Dallara F2 (2018): 620 hp @ 8750, 755 kg with the driver, final drive EST, Cd A ~0.95 m^2;
  // ~335 km/h
  'f2-rwd': { finalDrive: 3.4, dragC: dragOf(1.0, 0.95) },
};

/**
 * Puts each roster car on its real counterpart (?realcars=1): its figures, its curve from the
 * engine's, its cornering stiffness scaled with the weight.
 * @param roster the roster, changed in place
 */
export function applyRealCars(roster: RosterRow[]): void {
  for (const row of roster) {
    const real = REAL[row.id];
    if (!real) continue;
    const { engine, ...fields } = real;
    const massK = (fields.mass ?? row.mass) / row.mass;
    Object.assign(row, fields);
    row.caF = Math.round(row.caF * massK);
    row.caR = Math.round(row.caR * massK);
    if (engine) {
      row.curve = realCurve(engine);
      row.redline = engine.redline;
      row.idleRpm = engine.idle;
    }
  }
}
