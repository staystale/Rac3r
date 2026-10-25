import { hitIsMetal, takeHitFactor } from './physics/punctures.ts';
import type { CarWreck } from './vehicle.ts';
import {
  pressureInit, startLeak, stepTyrePressure, pressureWreck, isFlat, isPunctured,
  type PressureCar, type PressureState,
} from './physics/tyrepressure.ts';
import { scrapeMetal, gougeImpact, type ScrapeCar } from './world/metalscrape.ts';
import { levelStingers, tyresOnStinger } from './world/stingers.ts';
import { LEVEL } from './world/state.ts';
import { CORNER_OF_WHEEL } from './world/wheels.ts';
// damage.ts — CAR DAMAGE. Bookkeeping on the sim step; vehicle.ts reads only
// car.wreck (multipliers, no-op by default — CLAUDE.md §2 rule 6), render.ts draws the crush /
// dents / chips / loose wheels, hud.js the tyre diagram, the results the repair bill.
//
// USER: "full damage — but limited"; "damage resets with RESET — but is COUNTED
// cost-wise against you, paid at the end of a race in Story mode — shown in Test but never
// charged; repairs by pits in certain events (ask when); if an AI is too injured it should
// reset"; AI take damage by the same rules. Then, after seeing v1: "not ACCURATE enough to the
// 1/4 of the car damaged; WHEELS don't come OFF in large impacts; PAINT doesn't emit; damage
// seems really HARD to cause and unrealistic"; "cars don't DENT — they should clearly dent if
// hit" -> v2 (this file):
//
// HOW: every collision the game resolves (walls / barriers / props, other cars, heavy objects)
// changes the car's velocity in one step. main.js snapshots the velocity around each and calls
// hit: under SCRAPE_DV nothing; SCRAPE_DV..DMG_FLOOR = a SCRAPE (sliding along a wall or a car:
// light damage by speed x time on that side + paint chips); above DMG_FLOOR an IMPACT, (dv -
// floor)^DMG_EXP, shared over the four corners by where it came from. Each corner keeps HOW it was
// hit: crushL (end-on: shortens the car) and crushS (side-on: pushes the side in), so the sprite
// crumples the right quarter the right way. Corners: 0 front / -y, 1 front / +y, 2 rear / -y, 3
// rear / +y (car frame: +x forward; +y = the lateral of contact.js / render.ts; the car's RIGHT).
// EFFECTS (limited): axle grip down to -20 %, power down to -15 % (front), a steering PULL toward
// the harder-hit front, a PUNCTURE (a leak, below) from a heavy corner hit, and a WHEEL OFF from a
// big hit on a corner already near wrecked: that axle x0.45, a hard pull, the bare corner drags
// (rolling drag x5 per wheel). Never a DNF: the player RESETs (repairs), an AI that is tooInjured
// resets itself. The BILL counts every hit, repaired or not.
// CAR SYSTEMS C (physics/tyrepressure.ts): a puncture is a LEAK - a burst (a big hit, heat, a
// stinger) flat in half a second with a sharp pull, a slow one (debris, nails, a bush:
// car.burstSlow) over 10-30 s - and the axle grip, pull and drag follow the tyre's pressure, down
// to the rim; stepDamage runs the air, the stingers and metal on the ground
// (world/metalscrape.ts) each physics step.
// m/s of impact velocity change below which it is only a scrape (v1: 2.5 — "really hard to cause")
export const DMG_FLOOR = 1.5;
// m/s: a contact this small in one step is a car sliding along something
const SCRAPE_DV = 0.12;
// head-on: 20 km/h ~0.15 / front corner, 35 ~0.4, 50 ~0.8, 70+ wrecked (v1 0.026: ~half that)
const DMG_K = 0.035, DMG_EXP = 1.4;
// damage per (m/s x s) of scraping on the side touching: 20 m/s along a wall ~0.16 / s
const SCRAPE_K = 0.008;
// a single hit adding >= PUNCT_HIT to one corner may puncture it
const PUNCT_HIT = 0.25, PUNCT_P = 0.3;
// a single hit adding >= WHEEL_HIT to a corner that ends >= WHEEL_AT tears the wheel off
const WHEEL_HIT = 0.4, WHEEL_AT = 0.85;
// £ per 1.0 of corner damage (four wrecked corners ~ £6,000); a lost wheel +£400
export const REPAIR_PER = 1500;

/** One damage event for the particles (paint chips): the corner, its size, a scrape or not. */
export interface DamageEvent {
  c: number; amt: number; scrape?: boolean;
  // an impact's: what was hit was metal; the way the car was going into it (rad) and how fast
  metal?: boolean; aim?: number; speed?: number;
}
/** The damage state on a car (all four arrays by corner). */
export interface DamageState {
  dmg: number[]; crushL: number[]; crushS: number[]; roofDmg: number; wheelOff: boolean[];
}
/** A car as this file reads and writes it (the tyres' air: physics/tyrepressure.ts). */
export interface DamageCar extends Partial<DamageState>, PressureCar {
  vx: number; vy: number; heading: number;
  dmgBill?: number; dmgHits?: number; dmgFlash?: number;
  dmgEvents?: DamageEvent[]; wheelSpawn?: number[];
  streamers?: unknown[] | null; wreck?: CarWreck;
  burstTyre?: number; burstSlow?: boolean; _hitKind?: string | null;
  _dsp?: unknown; _scrapeT?: number; _sideKick?: { dir: number; dv: number };
}
/** A car whose damage state has been made (damageInit has run). */
type DamagedCar = DamageCar & DamageState & PressureState;

/**
 * Makes a car's damage state new: no damage, no punctures, every wheel on. Keeps the bill.
 * @param car the car
 */
export function damageInit(car: DamageCar): asserts car is DamagedCar {
  car.dmg = [0, 0, 0, 0];
  car.crushL = [0, 0, 0, 0];
  car.crushS = [0, 0, 0, 0];
  car.roofDmg = 0;
  car.wheelOff = [false, false, false, false];
  car.dmgBill = car.dmgBill || 0;
  pressureInit(car);
  derive(car as DamagedCar);
}
/**
 * RESET / RESTART / an AI's self-reset: the car is mended (the bill stays; resetBill clears it,
 * RESTART does).
 * @param car the car
 */
export function repair(car: DamageCar): void {
  const bill = car.dmgBill || 0, hits = car.dmgHits || 0;
  damageInit(car);
  car.dmgBill = bill;
  car.dmgHits = hits;
  car._dsp = null;
}
/**
 * Clears the repair bill and the hit count.
 * @param car the car
 */
export function resetBill(car: DamageCar): void { car.dmgBill = 0; car.dmgHits = 0; }

/**
 * The corner shares for an impact from direction (fore, lateral).
 * @param fore unit, car frame, where it came FROM, along the car
 * @param lateral unit, car frame, across the car
 * @returns the four corners' shares, summing to 1
 */
const shares = (fore: number, lateral: number): number[] => {
  const weights = [[1, -1], [1, 1], [-1, -1], [-1, 1]]
    .map(([alongFore, alongLat]) => Math.max(0, alongFore * fore + alongLat * lateral) + 0.1),
    total = weights[0] + weights[1] + weights[2] + weights[3];
  return weights.map((x) => x / total);
};

/**
 * A SCRAPE (a hit under DMG_FLOOR): light damage on the corners by sliding speed x time.
 * @param car the car
 * @param dt the step, s
 * @param weights the corner shares
 * @param endW how end-on the contact is, 0..1
 * @param top the corner taking most
 * @returns the damage added, 0 when too slow
 */
function scrape(car: DamagedCar, dt: number, weights: number[], endW: number, top: number) {
  // SCRAPE: light damage by sliding speed x time on the side touching, a few paint chips now
  // and then (rate-limited)
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 3) return 0;
  const amt = SCRAPE_K * speed * dt;
  for (let corner = 0; corner < 4; corner++) {
    const add = amt * weights[corner] * 1.6;
    car.dmg[corner] = Math.min(1, car.dmg[corner] + add);
    car.crushS[corner] = Math.min(1, car.crushS[corner] + add * (1 - endW));
    car.crushL[corner] = Math.min(1, car.crushL[corner] + add * endW);
  }
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
  car._scrapeT = (car._scrapeT || 0) + dt;
  if (car._scrapeT > 0.06) {
    car._scrapeT = 0;
    pushEvent(car, { c: top, amt: 0.04, scrape: true });
  }
  derive(car);
  return amt;
}

/**
 * Spreads a hard hit of size amt over the corners: damage, crush, punctures, lost wheels.
 * @param car the car
 * @param amt the hit's damage
 * @param weights the corner shares
 * @param endW how end-on the hit is, 0..1
 * @param rnd the random source
 * @param punctureK the scale on the puncture roll (what was hit)
 */
function hardHitCorners(
  car: DamagedCar, amt: number, weights: number[], endW: number, rnd: () => number,
  punctureK = 1,
) {
  for (let corner = 0; corner < 4; corner++) {
    const add = amt * weights[corner];
    car.dmg[corner] = Math.min(1, car.dmg[corner] + add);
    car.crushL[corner] = Math.min(1, car.crushL[corner] + add * endW);
    car.crushS[corner] = Math.min(1, car.crushS[corner] + add * (1 - endW));
    if (add >= PUNCT_HIT && !isPunctured(car, corner) && rnd() < PUNCT_P * punctureK) {
      startLeak(car, corner, true, rnd);
    }
    if (add >= WHEEL_HIT && car.dmg[corner] >= WHEEL_AT && !car.wheelOff[corner]) {
      car.wheelOff[corner] = true;
      car.dmgBill = (car.dmgBill || 0) + 400;
      (car.wheelSpawn || (car.wheelSpawn = [])).push(corner);
    }
  }
}

/**
 * One resolved collision: the velocity change since (vx0, vy0) becomes a scrape or an impact.
 * @param car the car, its velocity already changed by the collision
 * @param vx0 velocity x before, m/s
 * @param vy0 velocity y before, m/s
 * @param dt the step, s
 * @param rnd the random source
 * @returns the damage added
 */
export function hit(
  car: DamageCar, vx0: number, vy0: number, dt = 1 / 120, rnd: () => number = Math.random,
): number {
  // what the car hit this step: metal on metal sparks (render/particles.ts), and it scales the
  // puncture roll (physics/punctures.ts)
  const metal = hitIsMetal(car);
  const punctureK = takeHitFactor(car);
  const dvx = car.vx - vx0, dvy = car.vy - vy0, deltaV = Math.hypot(dvx, dvy);
  if (!(deltaV >= SCRAPE_DV)) return 0;
  if (!car.dmg) damageInit(car);
  const hurt = car as DamagedCar;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  // where it came FROM, car frame, unit
  const fore = -(dvx * cosH + dvy * sinH) / deltaV, lateral = -(-dvx * sinH + dvy * cosH) / deltaV;
  const weights = shares(fore, lateral),
    endW = Math.abs(fore) / (Math.abs(fore) + Math.abs(lateral) + 1e-6);
  let top = 0;
  for (let corner = 1; corner < 4; corner++) if (weights[corner] > weights[top]) top = corner;
  if (deltaV < DMG_FLOOR) {
    return scrape(hurt, dt, weights, endW, top);
  }
  const amt = DMG_K * (deltaV - DMG_FLOOR) ** DMG_EXP;
  // a hard hit from the SIDE may trip the car over (roll.js tripCheck): it is pushed, and rolls,
  // away from the impact
  if (Math.abs(lateral) > 0.6) car._sideKick = { dir: -Math.sign(lateral), dv: deltaV };
  hardHitCorners(hurt, amt, weights, endW, rnd, punctureK);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
  car.dmgHits = (car.dmgHits || 0) + 1;
  car.dmgFlash = 1;
  // a fresh impact can knock stuck tape off (user)
  if (car.streamers && car.streamers.length && rnd() < 0.6) car.streamers.shift();
  pushEvent(car, { c: top, amt, metal, aim: Math.atan2(vy0, vx0), speed: Math.hypot(vx0, vy0) });
  derive(hurt);
  return amt;
}
/**
 * Queues a damage event for the particles, keeping the last 12.
 * @param car the car
 * @param event the event
 */
function pushEvent(car: DamageCar, event: DamageEvent) {
  const queue = car.dmgEvents || (car.dmgEvents = []);
  queue.push(event);
  if (queue.length > 12) queue.shift();
}

const TOE = 0.008, TOE_OFF = 0.02;
/**
 * Works out car.wreck (the multipliers vehicle.ts reads) from the damage state.
 * @param car the car
 */
function derive(car: DamagedCar) {
  const dmg = car.dmg, off = car.wheelOff, air = pressureWreck(car);
  const front = (dmg[0] + dmg[1]) / 2, rear = (dmg[2] + dmg[3]) / 2;
  const offF = (off[0] ? 1 : 0) + (off[1] ? 1 : 0),
    offR = (off[2] ? 1 : 0) + (off[3] ? 1 : 0);
  car.wreck = {
    // the tyres' air sets each axle's grip (a flat 0.7, a rim 0.45), bent suspension takes 20 %
    gripF: (1 - 0.2 * front) * air.gripF * (offF ? 0.45 : 1),
    gripR: (1 - 0.2 * rear) * air.gripR * (offR ? 0.45 : 1),
    power: 1 - 0.15 * Math.max(dmg[0], dmg[1]),
    // a pull toward the harder-hit front (TOE 0.04 turned the car 40 deg in 3 s hands-off: 0.008
    // = 8 deg, a pull you correct), toward a soft tyre, and a missing wheel drags its corner
    toe: TOE * (dmg[1] - dmg[0]) + air.toe
      + TOE_OFF * ((off[1] || off[3] ? 1 : 0) - (off[0] || off[2] ? 1 : 0)),
    roll: 1 + 4 * (offF + offR) + air.roll,
    smoke: Math.max(dmg[0], dmg[1]) > 0.5,
  };
}

/**
 * One physics step of the car's systems: the stingers, the tyres' air, then metal on the ground
 * (rims, a body sliding on hard ground).
 * @param car the car
 * @param dt the step, s
 */
export function stepDamage(car: DamageCar & ScrapeCar, dt: number): void {
  // a wheel on a stinger bursts (world/stingers.ts)
  for (const tyre of tyresOnStinger(car, levelStingers(LEVEL.id))) {
    burstCorner(car, CORNER_OF_WHEEL[tyre], true);
  }
  if (!car.dmg) return;
  if (stepTyrePressure(car, dt)) derive(car as DamagedCar);
  scrapeMetal(car);
}

/**
 * ROLLOVER impacts (roll.js): the body meets the ground on a SIDE, the ROOF or back on its wheels.
 * @param car the car
 * @param kind 'side', 'roof' or 'wheels'
 * @param side +1 = +y, -1 = -y (for 'side')
 * @param weight how hard, the roll's own measure
 */
export function hitRoll(car: DamageCar, kind: string, side: number, weight: number): void {
  if (!car.dmg) damageInit(car);
  const hurt = car as DamagedCar;
  const amt = 0.1 + 0.02 * weight, corners = side > 0 ? [1, 3] : [0, 2];
  if (kind === 'roof') {
    hurt.roofDmg = Math.min(1, (hurt.roofDmg || 0) + amt * 1.4);
    for (let corner = 0; corner < 4; corner++)
      hurt.dmg[corner] = Math.min(1, hurt.dmg[corner] + amt * 0.25);
  } else if (kind === 'side') for (const corner of corners) {
    hurt.dmg[corner] = Math.min(1, hurt.dmg[corner] + amt);
    hurt.crushS[corner] = Math.min(1, hurt.crushS[corner] + amt);
  } else
    // back on its wheels: a thump
    for (let corner = 0; corner < 4; corner++)
      hurt.dmg[corner] = Math.min(1, hurt.dmg[corner] + amt * 0.3);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER * (kind === 'wheels' ? 0.5 : 1.5);
  car.dmgHits = (car.dmgHits || 0) + 1;
  pushEvent(car, { c: kind === 'side' ? corners[0] : 0, amt: amt * 1.5 });
  // metal meeting hard ground may break it (world/metalscrape.ts)
  gougeImpact(car as DamageCar & ScrapeCar);
  derive(hurt);
}
/**
 * A tyre that burst this step (physics/tyrewear.ts: heat or wear; cones: debris) becomes a puncture
 * on its corner: it leaks - at once from heat, slowly when the source set car.burstSlow (debris,
 * nails, a bush) - the HUD shows it, a reset mends it.
 * @param car the car
 * @returns true when a tyre burst this step
 */
export function applyBurst(car: DamageCar): boolean {
  const tyre = car.burstTyre, slow = !!car.burstSlow;
  if (tyre === undefined || tyre < 0) return false;
  car.burstTyre = -1;
  car.burstSlow = false;
  return burstCorner(car, CORNER_OF_WHEEL[tyre], !slow);
}
/**
 * A tyre punctures on its corner (a burst, a stinger, a slow leak): the axle's grip drops, the
 * HUD shows it, a reset mends it.
 * @param car the car
 * @param corner the damage corner
 * @param fast true for a burst (flat in half a second), false for a slow leak
 * @returns true when it was not punctured already
 */
function burstCorner(car: DamageCar, corner: number, fast: boolean): boolean {
  if (!car.dmg) damageInit(car);
  const hurt = car as DamagedCar;
  if (isPunctured(hurt, corner)) return false;
  car.dmgFlash = 1;
  // the tyre's own puff of air (physics/tyrepressure.ts), not a paint-chip hit
  startLeak(hurt, corner, fast);
  derive(hurt);
  return true;
}
/**
 * A scratch from pushing through a bush (world/bushes.ts): light damage on the corner of that
 * wheel, a light dent, a few paint chips.
 * @param car the car
 * @param tyre the wheel (vehicle.ts tyre index 0..3)
 * @param amt the damage to add, 0..1
 */
export function bushScratch(car: DamageCar, tyre: number, amt: number): void {
  if (!car.dmg) damageInit(car);
  const hurt = car as DamagedCar;
  const corner = CORNER_OF_WHEEL[tyre];
  hurt.dmg[corner] = Math.min(1, hurt.dmg[corner] + amt);
  // a light dent on that corner's side (branches push the panel in), so it shows
  hurt.crushS[corner] = Math.min(1, hurt.crushS[corner] + amt * 0.6);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
  pushEvent(car, { c: corner, amt: 0.04, scrape: true });
  derive(hurt);
}
/**
 * Is an AI car hurt badly enough to reset itself?
 * @param car the car
 * @returns true when wrecked, two tyres down or a wheel off
 */
export function tooInjured(car: DamageCar): boolean {
  const dmg = car.dmg;
  if (!dmg) return false;
  const hurt = car as DamagedCar;
  // two flat tyres or one on its rim (a slow leak still drives)
  const tyresGone = [0, 1, 2, 3].filter((corner) => isFlat(hurt, corner)).length >= 2
    || hurt.onRim.some(Boolean);
  return (dmg[0] + dmg[1] + dmg[2] + dmg[3]) / 4 > 0.6 || Math.max(...dmg) >= 0.98
    || tyresGone || hurt.wheelOff.some(Boolean);
}
