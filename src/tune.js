// tune.js — THE DEBUG PANEL'S DATA. Open it, adjust, close it.
//
// Asked for directly by the user on, and they were right to: handling feel was being
// converged on by me guessing a number, measuring it headlessly and shipping a build, when the
// person who can tell whether it feels good can find the value by hand in under a minute. This
// is also the hidden-numbers overlay CLAUDE.md §3 asks for, made writable.
//
// Every row is DATA: label, how to read it off the live car, how to write it back, and its
// range. Draw and hit-test both walk this one list, so a control can never be drawn somewhere
// its tap is not.
//
// Rows write either to `car.spec` (per-car numbers — a fresh copy per car, so edits are safe
// and are discarded when you switch car), `car.mods` (the upgrade seam), or `TUNE` (global
// model shape).

import { TUNE } from './vehicle.ts';

let tuneAudio = null;   // the game's audio, handed over by main.js (setTuneAudio)
export function setTuneAudio(audio) { tuneAudio = audio; }

// Izz depends on mass AND izzK, so anything touching either has to rebuild it.
function recalcIzz(car) {
  const spec = car.spec;
  spec.Izz = ((spec.mass * (spec.len * spec.len + spec.wid * spec.wid)) / 12) * spec.izzK;
}

const drive3 = (value) => (value >= 0.99 ? 'FWD' : value <= 0.01 ? 'RWD' : '4WD');

export const ROWS = [
  { label: 'Grip', hint: 'mu',
    get: (car) => car.spec.mu, set: (car, value) => { car.spec.mu = value; },
    step: 0.05, min: 0.40, max: 2.20, fmt: (value) => value.toFixed(2) },

  { label: 'Tyre stiffness', hint: 'how fast grip builds',
    get: (car) => car.spec.caF, set: (car, value) => {
      const ratio = value / car.spec.caF;
      car.spec.caF = value;
      car.spec.caR = Math.round(car.spec.caR * ratio);
    },
    step: 6000, min: 30000, max: 220000, fmt: (value) => (value / 1000).toFixed(0) + 'k' },

  { label: 'Peak slip', hint: 'angle where grip peaks',
    get: () => TUNE.alphaPeakK, set: (car, value) => { TUNE.alphaPeakK = value; },
    step: 0.1, min: 0.6, max: 4.0, fmt: (value) => value.toFixed(1) },

  { label: 'Slide grip', hint: 'grip kept once sliding',
    get: (car) => car.spec.slideGrip, set: (car, value) => { car.spec.slideGrip = value; },
    step: 0.02, min: 0.40, max: 1.00, fmt: (value) => value.toFixed(2) },

  { label: 'Steer lock', hint: 'authority past the limit',
    get: () => TUNE.steerHeadroom, set: (car, value) => { TUNE.steerHeadroom = value; },
    step: 0.05, min: 0.60, max: 3.00, fmt: (value) => value.toFixed(2) },

  { label: 'Self-align', hint: 'wheel straightens at limit',
    get: () => TUNE.selfAlign, set: (car, value) => { TUNE.selfAlign = value; },
    step: 0.05, min: 0.00, max: 1.00, fmt: (value) => value.toFixed(2) },

  { label: 'Momentum', hint: 'yaw inertia',
    get: (car) => car.spec.izzK, set: (car, value) => { car.spec.izzK = value; recalcIzz(car); },
    step: 0.1, min: 0.4, max: 5.0, fmt: (value) => value.toFixed(1) },

  { label: 'Yaw damping', hint: 'settles spins only',
    get: () => TUNE.yawDamp, set: (car, value) => { TUNE.yawDamp = value; },
    step: 0.1, min: 0.0, max: 4.0, fmt: (value) => value.toFixed(1) },

  { label: 'Power', hint: 'engine torque',
    get: (car) => car.mods.power, set: (car, value) => { car.mods.power = value; },
    step: 0.1, min: 0.2, max: 3.0, fmt: (value) => value.toFixed(1) + 'x' },

  { label: 'Mass', hint: '',
    get: (car) => car.spec.mass, set: (car, value) => { car.spec.mass = value; recalcIzz(car); },
    step: 50, min: 400, max: 2600, fmt: (value) => value.toFixed(0) + 'kg' },

  { label: 'Drive', hint: 'front / four / rear',
    get: (car) => car.spec.drive, set: (car, value) => { car.spec.drive = value; },
    step: 0.5, min: 0, max: 1, fmt: drive3 },

  { label: 'Handbrake', hint: 'rear lock strength',
    get: () => TUNE.handbrakeForce, set: (car, value) => { TUNE.handbrakeForce = value; },
    step: 0.05, min: 0.40, max: 2.00, fmt: (value) => value.toFixed(2) },

  { label: 'Brake bias', hint: 'front share',
    get: (car) => car.spec.brakeBiasF, set: (car, value) => { car.spec.brakeBiasF = value; },
    step: 0.02, min: 0.30, max: 0.90, fmt: (value) => (value * 100).toFixed(0) + '%F' },

  { label: 'Brake force', hint: 'g at full pedal',
    get: (car) => car.spec.brakeMaxDecel, set: (car, value) => { car.spec.brakeMaxDecel = value; },
    step: 0.05, min: 0.5, max: 2.5, fmt: (value) => value.toFixed(2) + 'g' },

  { label: 'Weight shift', hint: 'suspension lag',
    get: () => TUNE.transferTau, set: (car, value) => { TUNE.transferTau = value; },
    step: 0.02, min: 0.02, max: 0.80, fmt: (value) => value.toFixed(2) + 's' },

  { label: 'Drag', hint: 'caps top speed',
    get: (car) => car.spec.dragC, set: (car, value) => { car.spec.dragC = value; },
    step: 0.04, min: 0.08, max: 1.40, fmt: (value) => value.toFixed(2) },

  { label: 'Volume', hint: 'engine & tyre audio',
    get: () => (tuneAudio ? tuneAudio.volume : 0.5),
    set: (car, value) => { if (tuneAudio) tuneAudio.setVolume(value); },
    step: 0.1, min: 0.0, max: 1.0, fmt: (value) => Math.round(value * 100) + '%' },
];

const TUNE_DEFAULTS = { ...TUNE };

// Put everything back exactly as cars.js and vehicle.js shipped it.
export function resetAll(car) {
  Object.assign(TUNE, TUNE_DEFAULTS);
  const keep = { x: car.x, y: car.y, heading: car.heading };
  Object.assign(car.spec, car.spec0);
  for (const key in car.mods) car.mods[key] = 1.0;
  recalcIzz(car);
  Object.assign(car, keep);
}

export function nudge(car, row, dir) {
  const value = row.get(car) + dir * row.step;
  row.set(car, Math.max(row.min, Math.min(row.max, +value.toFixed(6))));
}

// Is this row currently away from the value the car shipped with? Drives the "changed" marker,
// so the panel reports what is ON the car rather than what you think you set (CLAUDE.md rule
// 10).
export function isChanged(car, row) {
  const cur = row.get(car);
  const before = car.__tuneBase?.get(row.label);
  return before !== undefined && Math.abs(cur - before) > 1e-9;
}

export function snapshot(car) {
  const baseValues = new Map();
  for (const row of ROWS) baseValues.set(row.label, row.get(car));
  car.__tuneBase = baseValues;
}
