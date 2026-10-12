// damage.js — CAR DAMAGE (2026-10-04). Bookkeeping on the sim step; vehicle.js reads only car.wreck (multipliers, no-op by default —
// CLAUDE.md §2 rule 6), render.ts draws the crush / dents / chips / loose wheels, hud.js the tyre diagram, the results the repair bill.
//
// USER (2026-10-04): "full damage — but limited"; "damage resets with RESET — but is COUNTED cost-wise against you, paid at the end of a
// race in Story mode — shown in Test but never charged; repairs by pits in certain events (ask when); if an AI is too injured it should
// reset"; AI take damage by the same rules. Then, after seeing v1: "not ACCURATE enough to the 1/4 of the car damaged; WHEELS don't come
// OFF in large impacts; PAINT doesn't emit; damage seems really HARD to cause and unrealistic"; "cars don't DENT — they should clearly
// dent if hit" -> v2 (this file):
//
// HOW: every collision the game resolves (walls / barriers / props, other cars, heavy objects) changes the car's velocity in one step.
// main.js snapshots the velocity around each and calls hit(): under SCRAPE_DV nothing; SCRAPE_DV..DMG_FLOOR = a SCRAPE (sliding along a
// wall or a car: light damage by speed x time on that side + paint chips); above DMG_FLOOR an IMPACT, (dv - floor)^DMG_EXP, shared over
// the four corners by where it came from. Each corner keeps HOW it was hit: crushL (end-on: shortens the car) and crushS (side-on:
// pushes the side in), so the sprite crumples the right quarter the right way. Corners: 0 front / -y, 1 front / +y, 2 rear / -y,
// 3 rear / +y (car frame: +x forward; +y = the lateral of contact.js / render.ts; the car's RIGHT).
// EFFECTS (limited): axle grip down to -20 %, power down to -15 % (front), a steering PULL toward the harder-hit front, a PUNCTURE (axle
// x0.7) from a heavy corner hit, and a WHEEL OFF from a big hit on a corner already near wrecked: that axle x0.45, a hard pull, the bare
// corner drags (rolling drag x5 per wheel). Never a DNF: the player RESETs (repairs), an AI that is tooInjured() resets itself.
// The BILL counts every hit, repaired or not.
export const DMG_FLOOR = 1.5;            // m/s of impact velocity change below which it is only a scrape (v1: 2.5 — "really hard to cause")
const SCRAPE_DV = 0.12;                  // m/s: a contact this small in one step is a car sliding along something
const DMG_K = 0.035, DMG_EXP = 1.4;      // head-on: 20 km/h ~0.15 / front corner, 35 ~0.4, 50 ~0.8, 70+ wrecked (v1 0.026: ~half that)
const SCRAPE_K = 0.008;                  // damage per (m/s x s) of scraping on the side touching: 20 m/s along a wall ~0.16 / s
const PUNCT_HIT = 0.25, PUNCT_P = 0.3;   // a single hit adding >= PUNCT_HIT to one corner may puncture it
const WHEEL_HIT = 0.4, WHEEL_AT = 0.85;  // a single hit adding >= WHEEL_HIT to a corner that ends >= WHEEL_AT tears the wheel off
export const REPAIR_PER = 1500;          // £ per 1.0 of corner damage (four wrecked corners ~ £6,000); a lost wheel +£400

export function damageInit(car) {
  car.dmg = [0, 0, 0, 0]; car.crushL = [0, 0, 0, 0]; car.crushS = [0, 0, 0, 0]; car.roofDmg = 0;
  car.punct = [false, false, false, false]; car.wheelOff = [false, false, false, false];
  car.dmgBill = car.dmgBill || 0; derive(car);
}
// RESET / RESTART / an AI's self-reset: the car is mended (the bill stays; resetBill clears it, RESTART does)
export function repair(car) { const b = car.dmgBill || 0, h = car.dmgHits || 0; damageInit(car); car.dmgBill = b; car.dmgHits = h; car._dsp = null; }
export function resetBill(car) { car.dmgBill = 0; car.dmgHits = 0; }

// the corner shares for an impact from direction (f, l) (unit, car frame, where it came FROM)
const shares = (f, l) => { const w = [[1, -1], [1, 1], [-1, -1], [-1, 1]].map(([af, al]) => Math.max(0, af * f + al * l) + 0.1), s = w[0] + w[1] + w[2] + w[3]; return w.map((x) => x / s); };

export function hit(car, vx0, vy0, dt = 1 / 120, rnd = Math.random) {
  const dvx = car.vx - vx0, dvy = car.vy - vy0, dv = Math.hypot(dvx, dvy);
  if (!(dv >= SCRAPE_DV)) return 0;
  if (!car.dmg) damageInit(car);
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
  const f = -(dvx * ch + dvy * sh) / dv, l = -(-dvx * sh + dvy * ch) / dv;   // where it came FROM, car frame, unit
  const w = shares(f, l), endW = Math.abs(f) / (Math.abs(f) + Math.abs(l) + 1e-6);
  let top = 0; for (let c = 1; c < 4; c++) if (w[c] > w[top]) top = c;
  if (dv < DMG_FLOOR) {
    // SCRAPE: light damage by sliding speed x time on the side touching, a few paint chips now and then (rate-limited)
    const v = Math.hypot(car.vx, car.vy); if (v < 3) return 0;
    const amt = SCRAPE_K * v * dt;
    for (let c = 0; c < 4; c++) { const add = amt * w[c] * 1.6; car.dmg[c] = Math.min(1, car.dmg[c] + add); car.crushS[c] = Math.min(1, car.crushS[c] + add * (1 - endW)); car.crushL[c] = Math.min(1, car.crushL[c] + add * endW); }
    car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER;
    car._scrapeT = (car._scrapeT || 0) + dt;
    if (car._scrapeT > 0.06) { car._scrapeT = 0; pushEvent(car, { c: top, amt: 0.04, scrape: true }); }
    derive(car); return amt;
  }
  const amt = DMG_K * (dv - DMG_FLOOR) ** DMG_EXP;
  // a hard hit from the SIDE may trip the car over (roll.js tripCheck): it is pushed, and rolls, away from the impact
  if (Math.abs(l) > 0.6) car._sideKick = { dir: -Math.sign(l), dv };
  for (let c = 0; c < 4; c++) {
    const add = amt * w[c];
    car.dmg[c] = Math.min(1, car.dmg[c] + add);
    car.crushL[c] = Math.min(1, car.crushL[c] + add * endW); car.crushS[c] = Math.min(1, car.crushS[c] + add * (1 - endW));
    if (add >= PUNCT_HIT && !car.punct[c] && rnd() < PUNCT_P) car.punct[c] = true;
    if (add >= WHEEL_HIT && car.dmg[c] >= WHEEL_AT && !car.wheelOff[c]) {
      car.wheelOff[c] = true; car.dmgBill = (car.dmgBill || 0) + 400; (car.wheelSpawn || (car.wheelSpawn = [])).push(c);
    }
  }
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER; car.dmgHits = (car.dmgHits || 0) + 1;
  car.dmgFlash = 1;
  if (car.streamers && car.streamers.length && rnd() < 0.6) car.streamers.shift();   // a fresh impact can knock stuck tape off (user)
  pushEvent(car, { c: top, amt });
  derive(car);
  return amt;
}
function pushEvent(car, e) { const q = car.dmgEvents || (car.dmgEvents = []); q.push(e); if (q.length > 12) q.shift(); }

const TOE = 0.008, TOE_OFF = 0.02;
function derive(car) {
  const d = car.dmg, p = car.punct, o = car.wheelOff, front = (d[0] + d[1]) / 2, rear = (d[2] + d[3]) / 2;
  const offF = (o[0] ? 1 : 0) + (o[1] ? 1 : 0), offR = (o[2] ? 1 : 0) + (o[3] ? 1 : 0);
  car.wreck = {
    gripF: (1 - 0.2 * front) * (p[0] || p[1] ? 0.7 : 1) * (offF ? 0.45 : 1),
    gripR: (1 - 0.2 * rear) * (p[2] || p[3] ? 0.7 : 1) * (offR ? 0.45 : 1),
    power: 1 - 0.15 * Math.max(d[0], d[1]),
    // a pull toward the harder-hit front (TOE 0.04 turned the car 40 deg in 3 s hands-off: 0.008 = 8 deg, a pull you correct); a
    // missing wheel drags its corner: a hard pull that way
    toe: TOE * (d[1] - d[0]) + TOE_OFF * ((o[1] || o[3] ? 1 : 0) - (o[0] || o[2] ? 1 : 0)),
    roll: 1 + 4 * (offF + offR),
    smoke: Math.max(d[0], d[1]) > 0.5,
  };
}
// ROLLOVER impacts (roll.js): the body meets the ground on a SIDE (+1 = +y, -1 = -y), the ROOF or back on its wheels
export function hitRoll(car, kind, side, w) {
  if (!car.dmg) damageInit(car);
  const amt = 0.1 + 0.02 * w, cs = side > 0 ? [1, 3] : [0, 2];
  if (kind === 'roof') { car.roofDmg = Math.min(1, (car.roofDmg || 0) + amt * 1.4); for (let c = 0; c < 4; c++) car.dmg[c] = Math.min(1, car.dmg[c] + amt * 0.25); }
  else if (kind === 'side') for (const c of cs) { car.dmg[c] = Math.min(1, car.dmg[c] + amt); car.crushS[c] = Math.min(1, car.crushS[c] + amt); }
  else for (let c = 0; c < 4; c++) car.dmg[c] = Math.min(1, car.dmg[c] + amt * 0.3);   // back on its wheels: a thump
  car.dmgBill = (car.dmgBill || 0) + amt * REPAIR_PER * (kind === 'wheels' ? 0.5 : 1.5); car.dmgHits = (car.dmgHits || 0) + 1;
  pushEvent(car, { c: kind === 'side' ? cs[0] : 0, amt: amt * 1.5 });
  derive(car);
}
export function tooInjured(car) {
  const d = car.dmg; if (!d) return false;
  return (d[0] + d[1] + d[2] + d[3]) / 4 > 0.6 || Math.max(...d) >= 0.98 || car.punct.filter(Boolean).length >= 2 || car.wheelOff.some(Boolean);
}
