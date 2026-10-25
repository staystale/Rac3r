import { takeHitFactor } from './physics/punctures.ts';
// damage.js — CAR DAMAGE. Bookkeeping on the sim step; vehicle.js reads only
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
// the harder-hit front, a PUNCTURE (axle x0.7) from a heavy corner hit, and a WHEEL OFF from a big
// hit on a corner already near wrecked: that axle x0.45, a hard pull, the bare corner drags
// (rolling drag x5 per wheel). Never a DNF: the player RESETs (repairs), an AI that is tooInjured
// resets itself. The BILL counts every hit, repaired or not.
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

export function damageInit(car) {
  car.dmg = [0, 0, 0, 0];
  car.crushL = [0, 0, 0, 0];
  car.crushS = [0, 0, 0, 0];
  car.roofDmg = 0;
  car.punct = [false, false, false, false];
  car.wheelOff = [false, false, false, false];
  car.dmgBill = car.dmgBill || 0;
  derive(car);
}
// RESET / RESTART / an AI's self-reset: the car is mended (the bill stays; resetBill clears it,
// RESTART does)
export function repair(car) {
  const bill = car.dmgBill || 0, hits = car.dmgHits || 0;
  damageInit(car);
  car.dmgBill = bill;
  car.dmgHits = hits;
  car._dsp = null;
}
export function resetBill(car) { car.dmgBill = 0; car.dmgHits = 0; }

// the corner shares for an impact from direction (fore, lateral) (unit, car frame, where it
// came FROM)
const shares = (fore, lateral) => {
  const weights = [[1, -1], [1, 1], [-1, -1], [-1, 1]]
    .map(([alongFore, alongLat]) => Math.max(0, alongFore * fore + alongLat * lateral) + 0.1),
    total = weights[0] + weights[1] + weights[2] + weights[3];
  return weights.map((x) => x / total);
};

/**
 * A SCRAPE (a hit under DMG_FLOOR): light damage on the corners by sliding speed x time.
 * @returns {number} the damage added, 0 when too slow
 */
function scrape(car, dt, weights, endW, top) {
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
 */
function hardHitCorners(car, amt, weights, endW, rnd, punctureK = 1) {
  for (let corner = 0; corner < 4; corner++) {
    const add = amt * weights[corner];
    car.dmg[corner] = Math.min(1, car.dmg[corner] + add);
    car.crushL[corner] = Math.min(1, car.crushL[corner] + add * endW);
    car.crushS[corner] = Math.min(1, car.crushS[corner] + add * (1 - endW));
    if (add >= PUNCT_HIT && !car.punct[corner] && rnd() < PUNCT_P * punctureK) {
      car.punct[corner] = true;
    }
    if (add >= WHEEL_HIT && car.dmg[corner] >= WHEEL_AT && !car.wheelOff[corner]) {
      car.wheelOff[corner] = true;
      car.dmgBill = (car.dmgBill || 0) + 400;
      (car.wheelSpawn || (car.wheelSpawn = [])).push(corner);
    }
  }
}

export function hit(car, vx0, vy0, dt = 1 / 120, rnd = Math.random) {
  // what the car hit this step scales the puncture roll (physics/punctures.ts)
  const punctureK = takeHitFactor(car);
  const dvx = car.vx - vx0, dvy = car.vy - vy0, deltaV = Math.hypot(dvx, dvy);
  if (!(deltaV >= SCRAPE_DV)) return 0;
  if (!car.dmg) damageInit(car);
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  // where it came FROM, car frame, unit
  const fore = -(dvx * cosH + dvy * sinH) / deltaV, lateral = -(-dvx * sinH + dvy * cosH) / deltaV;
  const weights = shares(fore, lateral),
    endW = Math.abs(fore) / (Math.abs(fore) + Math.abs(lateral) + 1e-6);
  let top = 0;
  for (let corner = 1; corner < 4; corner++) if (weights[corner] > weights[top]) top = corner;
  if (deltaV < DMG_FLOOR) {
    return scrape(car, dt, weights, endW, top);
  }
  const amt = DMG_K * (deltaV - DMG_FLOOR) ** DMG_EXP;
  // a hard hit from the SIDE may trip the car over (roll.js tripCheck): it is pushed, and rolls,
  // away from the impact
  if (Math.abs(lateral) > 0.6) car._sideKick = { dir: -Math.sign(lateral), dv: deltaV };
  hardHitCorners(car, amt, weights, endW, rnd, punctureK);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
  car.dmgHits = (car.dmgHits || 0) + 1;
  car.dmgFlash = 1;
  // a fresh impact can knock stuck tape off (user)
  if (car.streamers && car.streamers.length && rnd() < 0.6) car.streamers.shift();
  pushEvent(car, { c: top, amt });
  derive(car);
  return amt;
}
function pushEvent(car, event) {
  const queue = car.dmgEvents || (car.dmgEvents = []);
  queue.push(event);
  if (queue.length > 12) queue.shift();
}

const TOE = 0.008, TOE_OFF = 0.02;
function derive(car) {
  const dmg = car.dmg, punct = car.punct, off = car.wheelOff,
    front = (dmg[0] + dmg[1]) / 2, rear = (dmg[2] + dmg[3]) / 2;
  const offF = (off[0] ? 1 : 0) + (off[1] ? 1 : 0),
    offR = (off[2] ? 1 : 0) + (off[3] ? 1 : 0);
  car.wreck = {
    gripF: (1 - 0.2 * front) * (punct[0] || punct[1] ? 0.7 : 1) * (offF ? 0.45 : 1),
    gripR: (1 - 0.2 * rear) * (punct[2] || punct[3] ? 0.7 : 1) * (offR ? 0.45 : 1),
    power: 1 - 0.15 * Math.max(dmg[0], dmg[1]),
    // a pull toward the harder-hit front (TOE 0.04 turned the car 40 deg in 3 s hands-off: 0.008
    // = 8 deg, a pull you correct); a missing wheel drags its corner: a hard pull that way
    toe: TOE * (dmg[1] - dmg[0])
      + TOE_OFF * ((off[1] || off[3] ? 1 : 0) - (off[0] || off[2] ? 1 : 0)),
    roll: 1 + 4 * (offF + offR),
    smoke: Math.max(dmg[0], dmg[1]) > 0.5,
  };
}
// ROLLOVER impacts (roll.js): the body meets the ground on a SIDE (+1 = +y, -1 = -y), the ROOF
// or back on its wheels
export function hitRoll(car, kind, side, weight) {
  if (!car.dmg) damageInit(car);
  const amt = 0.1 + 0.02 * weight, corners = side > 0 ? [1, 3] : [0, 2];
  if (kind === 'roof') {
    car.roofDmg = Math.min(1, (car.roofDmg || 0) + amt * 1.4);
    for (let corner = 0; corner < 4; corner++)
      car.dmg[corner] = Math.min(1, car.dmg[corner] + amt * 0.25);
  } else if (kind === 'side') for (const corner of corners) {
    car.dmg[corner] = Math.min(1, car.dmg[corner] + amt);
    car.crushS[corner] = Math.min(1, car.crushS[corner] + amt);
  } else
    // back on its wheels: a thump
    for (let corner = 0; corner < 4; corner++)
      car.dmg[corner] = Math.min(1, car.dmg[corner] + amt * 0.3);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER * (kind === 'wheels' ? 0.5 : 1.5);
  car.dmgHits = (car.dmgHits || 0) + 1;
  pushEvent(car, { c: kind === 'side' ? corners[0] : 0, amt: amt * 1.5 });
  derive(car);
}
// vehicle.js tyre index (0 F+y, 1 F-y, 2 R+y, 3 R-y) -> damage corner (0 F-y, 1 F+y, 2 R-y, 3 R+y)
const CORNER_OF_TYRE = [1, 0, 3, 2];
/**
 * A tyre that burst this step (physics/tyrewear.ts: heat or wear; cones: debris) becomes a puncture
 * on its corner: the axle's grip drops, the HUD shows it, a reset mends it.
 * @param {object} car the car
 * @returns {boolean} true when a tyre burst this step
 */
export function applyBurst(car) {
  const tyre = car.burstTyre;
  if (tyre === undefined || tyre < 0) return false;
  car.burstTyre = -1;
  if (!car.dmg) damageInit(car);
  const corner = CORNER_OF_TYRE[tyre];
  if (car.punct[corner]) return false;
  car.punct[corner] = true;
  car.dmgFlash = 1;
  pushEvent(car, { c: corner, amt: 0.2 });
  derive(car);
  return true;
}
/**
 * A scratch from pushing through a bush (world/bushes.ts): light damage on the corner of that
 * wheel, a few paint chips, no dent.
 * @param {object} car the car
 * @param {number} tyre the wheel (vehicle.js tyre index 0..3)
 * @param {number} amt the damage to add, 0..1
 */
export function bushScratch(car, tyre, amt) {
  if (!car.dmg) damageInit(car);
  const corner = CORNER_OF_TYRE[tyre];
  car.dmg[corner] = Math.min(1, car.dmg[corner] + amt);
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
  pushEvent(car, { c: corner, amt: 0.04, scrape: true });
  derive(car);
}
export function tooInjured(car) {
  const dmg = car.dmg;
  if (!dmg) return false;
  return (dmg[0] + dmg[1] + dmg[2] + dmg[3]) / 4 > 0.6 || Math.max(...dmg) >= 0.98
    || car.punct.filter(Boolean).length >= 2 || car.wheelOff.some(Boolean);
}
