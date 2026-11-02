// menu/specsheet.ts - THE SPEC SHEET (owner 11-02: "can we make sure almost all the stats we use
// about a car is listed in the garage screen"): every number the physics reads off the car,
// worked out of its spec (cars.ts spec) so it can never drift from what the car really does. The
// measured results (top speed, 0-100, braking, grip) stay on the garage's own panel.
import { spec, type Spec } from '../cars.ts';
import { torqueAt, STEER_MAX, AIR_DENSITY } from '../vehicle.ts';
import { addPane, addButton, addElement } from './widgets.js';

interface Menu { root: HTMLElement; openedAt: number }
const HP_PER_W = 1 / 745.7, KMH_PER_MS = 3.6;

/**
 * The engine's peak power and torque, off its curve.
 * @param car the spec
 * @returns peak horse and its rpm, peak Nm and its rpm
 */
function engineFigures(car: Spec) {
  let horse = 0, hpRpm = 0, newtonM = 0, nmRpm = 0;
  for (let rpm = car.idleRpm; rpm <= car.redline; rpm += 50) {
    const torque = torqueAt(car, rpm), power = torque * rpm * Math.PI / 30 * HP_PER_W;
    if (power > horse) { horse = power; hpRpm = rpm; }
    if (torque > newtonM) { newtonM = torque; nmRpm = rpm; }
  }
  return { horse, hpRpm, newtonM, nmRpm };
}

/**
 * The speed at the redline in a gear, km/h.
 * @param car the spec
 * @param ratio the gear's ratio
 * @returns km/h
 */
function gearKmh(car: Spec, ratio: number): number {
  return car.redline / (ratio * car.finalDrive) * Math.PI / 30 * car.wheelR * KMH_PER_MS;
}

/**
 * Where the drive goes, in words.
 * @param front the front share of the drive
 * @returns FWD, RWD or AWD with its split
 */
function driveText(front: number): string {
  if (front >= 0.999) return 'FWD';
  if (front <= 0.001) return 'RWD';
  return `AWD ${Math.round(front * 100)} / ${Math.round((1 - front) * 100)}`;
}

/**
 * The spec sheet's rows: [label, value], grouped by headings ([heading] alone).
 * @param carId the car
 * @returns the rows
 */
export function specRows(carId: string): string[][] {
  const car = spec(carId), eng = engineFigures(car), base = car.lf + car.lr;
  const cdA = car.dragC / (0.5 * AIR_DENSITY);
  const lockDeg = (car.steerMax || STEER_MAX) * 180 / Math.PI;
  const rows: string[][] = [['ENGINE'],
    ['POWER', `${Math.round(eng.horse)} HP (${Math.round(eng.horse / HP_PER_W / 1000)} KW) `
      + `@ ${eng.hpRpm} RPM`],
    ['TORQUE', `${Math.round(eng.newtonM)} NM @ ${eng.nmRpm} RPM`],
    ['REDLINE', `${car.redline} RPM (IDLE ${car.idleRpm})`],
    ['POWER / WEIGHT', `${Math.round(eng.horse / (car.mass / 1000))} HP PER TONNE`],
    ['GEARBOX'],
    ['GEARS', `${car.gears.length}-SPEED: `
      + car.gears.map((ratio) => ratio.toFixed(2)).join(' · ')],
    ['FINAL DRIVE', car.finalDrive.toFixed(2)],
    ['AT THE REDLINE', car.gears.map((ratio) => Math.round(gearKmh(car, ratio))).join(' · ')
      + ' KM/H'],
    ['SHIFTS', `UP ${car.upshiftRpm} · DOWN ${car.downshiftRpm} RPM, ${car.shiftTime} S`],
    ['DRIVE', driveText(car.drive)],
    ['CHASSIS'],
    ['WEIGHT', `${car.mass} KG`],
    ['WEIGHT SPLIT', `${Math.round(car.lr / base * 100)} % FRONT / ${Math.round(car.lf / base
      * 100)} % REAR`],
    ['CENTRE OF GRAVITY', `${car.cgH.toFixed(2)} M HIGH (HANDLING), `
      + `${car.cg.toFixed(2)} M (ROLLOVER)`],
    ['SIZE', `${car.len.toFixed(2)} × ${car.wid.toFixed(2)} M, WHEELBASE ${base.toFixed(2)} M`],
    ['TRACK', `${car.trackWidth.toFixed(2)} M`],
    ['SUSPENSION', `${car.susF.toFixed(1)} HZ, DAMPING ${car.susZ.toFixed(2)}`],
    ['STEERING LOCK', `${lockDeg.toFixed(0)}°`],
    ['TYRES AND BRAKES'],
    ['TYRE SIZE', `${Math.round(car.wheelR * 2000)} MM ACROSS, ${Math.round(car.tyreWidth * 1000)}`
      + ' MM WIDE'],
    ['TYRE GRIP', `μ ${car.mu.toFixed(2)} (SLIDING KEEPS ${Math.round(car.slideGrip * 100)} %)`],
    ['TYRE WINDOW', `${(car.tyreOpt || [65, 110]).join(' – ')} °C`],
    ['BRAKE BALANCE', `${Math.round(car.brakeBiasF * 100)} % FRONT`],
    ['AERO'],
    ['DRAG', `CdA ${cdA.toFixed(2)} M²`],
    ['DOWNFORCE', `ClA ${car.downforceF.toFixed(2)} FRONT · ${car.downforceR.toFixed(2)} REAR`],
  ];
  if (car.aids) {
    rows.push(['AIDS', [car.aids.abs && 'ABS', car.aids.tcs && 'TCS'].filter(Boolean).join(' + ')
      || 'NONE']);
  }
  return rows;
}

/**
 * SPEC SHEET: the car's numbers, in groups.
 * @param menu the menu context
 * @param carId the car
 * @param name its name
 * @param back reopens the garage
 */
export function showSpecSheet(menu: Menu, carId: string, name: string, back: () => void): void {
  const panel = addPane(menu, true) as HTMLElement;
  addElement(panel, 'h2', 'SPEC SHEET · ' + name);
  let grid: HTMLElement | null = null;
  for (const [label, value] of specRows(carId)) {
    if (value === undefined) {
      (addElement(panel, 'div', label, 'sub') as HTMLElement).style.marginTop = '8px';
      grid = addElement(panel, 'div', '', 'stats') as HTMLElement;
    } else if (grid) grid.innerHTML += `<span>${label}</span><b>${value}</b>`;
  }
  addButton(menu, panel, '◀ BACK', back);
}
