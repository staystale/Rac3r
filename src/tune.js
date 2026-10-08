// tune.js — THE DEBUG PANEL'S DATA. Open it, adjust, close it.
//
// Asked for directly by the user on 2026-09-27, and they were right to: handling feel was being
// converged on by me guessing a number, measuring it headlessly and shipping a build, when the person
// who can tell whether it feels good can find the value by hand in under a minute. This is also the
// hidden-numbers overlay CLAUDE.md §3 asks for, made writable.
//
// Every row is DATA: label, how to read it off the live car, how to write it back, and its range. Draw
// and hit-test both walk this one list, so a control can never be drawn somewhere its tap is not.
//
// Rows write either to `car.spec` (per-car numbers — a fresh copy per car, so edits are safe and are
// discarded when you switch car), `car.mods` (the upgrade seam), or `TUNE` (global model shape).

import { TUNE } from './vehicle.js';

// Izz depends on mass AND izzK, so anything touching either has to rebuild it.
function recalcIzz(car) {
  const s = car.spec;
  s.Izz = ((s.mass * (s.len * s.len + s.wid * s.wid)) / 12) * s.izzK;
}

const drive3 = (v) => (v >= 0.99 ? 'FWD' : v <= 0.01 ? 'RWD' : '4WD');

export const ROWS = [
  { label: 'Grip', hint: 'mu',
    get: (c) => c.spec.mu, set: (c, v) => { c.spec.mu = v; },
    step: 0.05, min: 0.40, max: 2.20, fmt: (v) => v.toFixed(2) },

  { label: 'Tyre stiffness', hint: 'how fast grip builds',
    get: (c) => c.spec.caF, set: (c, v) => { const k = v / c.spec.caF; c.spec.caF = v; c.spec.caR = Math.round(c.spec.caR * k); },
    step: 6000, min: 30000, max: 220000, fmt: (v) => (v / 1000).toFixed(0) + 'k' },

  { label: 'Peak slip', hint: 'angle where grip peaks',
    get: () => TUNE.alphaPeakK, set: (c, v) => { TUNE.alphaPeakK = v; },
    step: 0.1, min: 0.6, max: 4.0, fmt: (v) => v.toFixed(1) },

  { label: 'Slide grip', hint: 'grip kept once sliding',
    get: (c) => c.spec.slideGrip, set: (c, v) => { c.spec.slideGrip = v; },
    step: 0.02, min: 0.40, max: 1.00, fmt: (v) => v.toFixed(2) },

  { label: 'Steer lock', hint: 'authority past the limit',
    get: () => TUNE.steerHeadroom, set: (c, v) => { TUNE.steerHeadroom = v; },
    step: 0.05, min: 0.60, max: 3.00, fmt: (v) => v.toFixed(2) },

  { label: 'Self-align', hint: 'wheel straightens at limit',
    get: () => TUNE.selfAlign, set: (c, v) => { TUNE.selfAlign = v; },
    step: 0.05, min: 0.00, max: 1.00, fmt: (v) => v.toFixed(2) },

  { label: 'Momentum', hint: 'yaw inertia',
    get: (c) => c.spec.izzK, set: (c, v) => { c.spec.izzK = v; recalcIzz(c); },
    step: 0.1, min: 0.4, max: 5.0, fmt: (v) => v.toFixed(1) },

  { label: 'Yaw damping', hint: 'settles spins only',
    get: () => TUNE.yawDamp, set: (c, v) => { TUNE.yawDamp = v; },
    step: 0.1, min: 0.0, max: 4.0, fmt: (v) => v.toFixed(1) },

  { label: 'Power', hint: 'engine torque',
    get: (c) => c.mods.power, set: (c, v) => { c.mods.power = v; },
    step: 0.1, min: 0.2, max: 3.0, fmt: (v) => v.toFixed(1) + 'x' },

  { label: 'Mass', hint: '',
    get: (c) => c.spec.mass, set: (c, v) => { c.spec.mass = v; recalcIzz(c); },
    step: 50, min: 400, max: 2600, fmt: (v) => v.toFixed(0) + 'kg' },

  { label: 'Drive', hint: 'front / four / rear',
    get: (c) => c.spec.drive, set: (c, v) => { c.spec.drive = v; },
    step: 0.5, min: 0, max: 1, fmt: drive3 },

  { label: 'Handbrake', hint: 'rear lock strength',
    get: () => TUNE.handbrakeForce, set: (c, v) => { TUNE.handbrakeForce = v; },
    step: 0.05, min: 0.40, max: 2.00, fmt: (v) => v.toFixed(2) },

  { label: 'Brake bias', hint: 'front share',
    get: (c) => c.spec.brakeBiasF, set: (c, v) => { c.spec.brakeBiasF = v; },
    step: 0.02, min: 0.30, max: 0.90, fmt: (v) => (v * 100).toFixed(0) + '%F' },

  { label: 'Brake force', hint: 'g at full pedal',
    get: (c) => c.spec.brakeMaxDecel, set: (c, v) => { c.spec.brakeMaxDecel = v; },
    step: 0.05, min: 0.5, max: 2.5, fmt: (v) => v.toFixed(2) + 'g' },

  { label: 'Weight shift', hint: 'suspension lag',
    get: () => TUNE.transferTau, set: (c, v) => { TUNE.transferTau = v; },
    step: 0.02, min: 0.02, max: 0.80, fmt: (v) => v.toFixed(2) + 's' },

  { label: 'Drag', hint: 'caps top speed',
    get: (c) => c.spec.dragC, set: (c, v) => { c.spec.dragC = v; },
    step: 0.04, min: 0.08, max: 1.40, fmt: (v) => v.toFixed(2) },

  { label: 'Volume', hint: 'engine & tyre audio',
    get: () => (typeof window !== 'undefined' && window.__game?.audio ? window.__game.audio.volume : 0.5),
    set: (c, v) => { if (typeof window !== 'undefined' && window.__game?.audio) window.__game.audio.setVolume(v); },
    step: 0.1, min: 0.0, max: 1.0, fmt: (v) => Math.round(v * 100) + '%' },
];

const TUNE_DEFAULTS = { ...TUNE };

// Put everything back exactly as cars.js and vehicle.js shipped it.
export function resetAll(car) {
  Object.assign(TUNE, TUNE_DEFAULTS);
  const keep = { x: car.x, y: car.y, heading: car.heading };
  Object.assign(car.spec, car.spec0);
  for (const k in car.mods) car.mods[k] = 1.0;
  recalcIzz(car);
  Object.assign(car, keep);
}

export function nudge(car, row, dir) {
  const v = row.get(car) + dir * row.step;
  row.set(car, Math.max(row.min, Math.min(row.max, +v.toFixed(6))));
}

// Is this row currently away from the value the car shipped with? Drives the "changed" marker, so the
// panel reports what is ON the car rather than what you think you set (CLAUDE.md rule 10).
export function isChanged(car, row) {
  const cur = row.get(car);
  const before = car.__tuneBase?.get(row.label);
  return before !== undefined && Math.abs(cur - before) > 1e-9;
}

export function snapshot(car) {
  const m = new Map();
  for (const r of ROWS) m.set(r.label, r.get(car));
  car.__tuneBase = m;
}
