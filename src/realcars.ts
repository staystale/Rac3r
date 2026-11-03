// realcars.ts - REAL CARS (passed 11-03; owner: "base it on a real car like all our vehicles should
// be"; "anything real is fine"; names "close to the real thing but different"). Every ROSTER car
// (cars.ts) takes its real counterpart's weight, engine (peak torque and power where the maker
// states them), gearbox, tyre size and drag (0.5 rho Cd A), its sources noted on its row. These
// are the helpers that turn a maker's figures into the model's: the torque curve, the drag and
// the tyre's rolling radius. A ratio set no source gave is estimated so the car reaches its real
// top speed near its power peak (EST on the row).
import type { Curve } from './cars.ts';

/** A real engine: its idle, the torque plateau, the power peak and the rev limit. */
export interface Engine {
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
export const dragOf = (coef: number, area: number) => +(0.6125 * coef * area).toFixed(3);
/** A tyre's rolling radius (m) from its size: width mm, aspect %, rim inches. */
export const tyreR = (width: number, aspect: number, rim: number) =>
  +((rim * 25.4 + 2 * width * aspect / 100) / 2000).toFixed(3);
