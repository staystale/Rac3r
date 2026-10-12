// roll.js — ROLLOVERS + SIDE / ROOF SLIDES (2026-10-04). User: "the roll over system should be included in damage"; "can we get roll
// overs and side and roof slides". Backlog spec (TODO MASTER BACKLOG E): a chance from impact speed, landing, slide angle and surface;
// landing on things = high chance; can roll several times onto the side or the roof, then slide.
//
// car.roll = { phase: 'none' | 'rolling' | 'side' | 'roof', phi, w, still } — phi is the roll angle about the car's long axis (0 = on its
// wheels, +-PI/2 on a side, PI on the roof), w its rate. vehicle.reset() clears it (RESET puts you back on your wheels).
// TRIP: a car on its wheels sliding SIDEWAYS faster than V_TRIP for its ground trips over its leading side — soonest where the ground
// grabs the sliding tyres (gravel, dirt, sand, mud), late on grass and snow, only in a big fast spin on tarmac, never on ice — scaled by
// the car's static stability (track / 2 x cg height: tall cars go over sooner); a hard SIDE impact (damage.js sideKick) and a crooked
// LANDING can start one too. ROLLING: the rate decays at every quarter turn the body hits the ground (side, roof, side, wheels), each
// costing speed and doing side / roof damage (damage.js crushS / roofDmg) with paint chips; under SETTLE_W it settles onto the nearest
// of wheels / side / roof. SLIDES: no tyres — the body grinds to a stop on its own friction for that ground (sparks on hard ground).
// Sim time (rule 5): it moves the car; render.ts draws it (faces, sparks), main.js hands control back on RESET (player) or resets the AI.
export const ROLL_H = 1.4;                    // m: body height (the side face the camera sees on a rolled car)
const SSF_REF = 1.44;                         // the hatch: 1.5 / (2 x 0.52)
const SETTLE_W = 2.4;                         // rad/s: slower than this, it falls onto the nearest face
const HALF_PI = Math.PI / 2;

// ROLL CHANCE (user, 2026-10-04): v1 rolled most slides; v2 "a % chance per floor grid cell, by surface"; v3 (this): "it's getting in the way
// of DRIFTING — keep it closer to 90 deg and to higher speeds; below 60 mph a low chance; long grass, sand, mud, deep mud, snow higher;
// dirt, gravel, grass medium-low; hard surfaces low, broken tarmac slightly higher than tarmac". One roll of the dice per CELL_M m ground
// cell crossed: pct (% per cell at 60 mph, square on) x ANGLE (0 under ANG_MIN of the slide being sideways, 1 at fully sideways) x SPEED
// ((v / 60 mph)^4 under it, rising past it, cap x2.5) x the car's stability (track / 2 cg).
const PCT = {
  grassLong: 5, sand: 22, mud: 5, thickMud: 7, snow: 11,   // (user, 2026-10-04) SAND the HIGHEST risk (it also stops a slide fastest, so its per-cell % is highest), SNOW a close second                       // high: the ground grabs a sliding car
  trap: 14,   // a GRAVEL TRAP (lab.js SURFACE_TRAP: deep, ploughing): the readiest to dig in and flip a car sliding into it sideways (user)
  dirt: 2.2, gravel: 2.6, grass: 1.8, grassShort: 1.8, kerb: 1.5, puddle: 1, water: 1,
  broken: 0.9, ice: 0.3,
};
const PCT_HARD = 0.5;                       // tarmac, concrete...
const CELL_M = 2, MPH60 = 26.82, MPH39 = 17.43, ANG_MIN = 0.8;   // ANG_MIN: sin of the slide angle (0.8 = 53 deg; full chance at 90)
const pctOf = (S) => PCT[S.id] ?? PCT_HARD;
// body friction when sliding on its side / roof
function muBody(S) {
  const id = S.id || '';
  if (id === 'ice') return 0.1;
  if (id === 'snow') return 0.28;
  if (['dirt', 'gravel', 'sand', 'mud', 'thickMud', 'trap'].includes(id)) return id === 'trap' ? 0.85 : 0.7;   // a trap grabs the body hardest
  if (id.startsWith('grass')) return 0.55;
  return 0.45;                                                                 // metal on tarmac / concrete
}
export const rolling = (car) => !!(car.roll && car.roll.phase !== 'none');

export function startRoll(car, dir, vLat) {
  car._rolls = (car._rolls || 0) + 1;
  // a spread on the spin, and on what each ground contact takes off it (below), so a roll can end on the wheels, a side or the roof
  car.roll = { phase: 'rolling', phi: 0, w: dir * Math.min(14, (0.95 * Math.abs(vLat) + 2) * (0.7 + 0.6 * Math.random())), still: 0 };
}

// call each sim step while the car is on its wheels (after vehicle.step)
export function tripCheck(car, dt, rnd = Math.random) {
  if (rolling(car)) return false;
  const s = car.spec, ssf = (s.trackWidth || 1.5) / (2 * (s.cg || s.cgH || 0.52)), k = ssf / SSF_REF;   // per-car cg (cars.js)
  const ch = Math.cos(car.heading), sh = Math.sin(car.heading), vLat = -car.vx * sh + car.vy * ch;
  // a hard side impact (damage.js) or a crooked landing
  const kick = car._sideKick; car._sideKick = null;
  if (kick && kick.dv > 7 * k && rnd() < Math.min(0.6, (kick.dv - 7 * k) / 10)) { startRoll(car, kick.dir, kick.dv); return true; }
  const landed = !(car.air > 0) && (car._airT || 0) > 0.35;
  car._airT = car.air > 0 ? (car._airT || 0) + dt : 0;
  // a CROOKED LANDING (user, 2026-10-04, after Killder's jump: "a little easy to roll over on landing"): was 30 % for any landing with
  // 4 m/s sideways; now only a properly sideways one, 6+ m/s and a slide angle past 30 deg, up to 20 % at 12 m/s, x the car's stability
  if (landed) { const vv = Math.hypot(car.vx, car.vy), side = vv > 1 ? Math.abs(vLat) / vv : 0;
    if (Math.abs(vLat) > 6 && side > 0.5 && rnd() < 0.2 * Math.min(1, (Math.abs(vLat) - 6) / 6) * Math.min(1.6, 1 / k)) { startRoll(car, Math.sign(vLat), Math.abs(vLat)); return true; } }
  if (car.air > 0) return false;
  const v = Math.hypot(car.vx, car.vy); if (v < 8) return false;
  const side = Math.abs(vLat) / v; if (side < ANG_MIN) return false;              // a drift angle: never
  // one check per ground cell crossed
  const cell = Math.floor(car.x / CELL_M) * 73856093 ^ Math.floor(car.y / CELL_M) * 19349663;
  if (cell === car._tripCell) return false;
  car._tripCell = cell;
  const ang = (side - ANG_MIN) / (1 - ANG_MIN), spd = v < MPH39 ? 0 : v < MPH60 ? ((v - MPH39) / (MPH60 - MPH39)) ** 2 : Math.min(2.5, 1 + (v - MPH60) / 9);   // (user: "still exist under 60 mph, diminishing to ZERO at ~39 mph"; was (v / 60 mph)^4, never quite zero)
  const p = (pctOf(car.surface || {}) / 100) * ang * spd * Math.min(1.6, 1 / k);
  if (rnd() < p) { startRoll(car, Math.sign(vLat), Math.abs(vLat)); return true; }
  return false;
}

// one sim step of a rolling / overturned car (instead of vehicle.step). onHit(kind, side) for the damage (main.js -> damage.js)
export function stepRoll(car, dt, onHit) {
  const R = car.roll, S = car.surface || {}, g = 9.81, v = Math.hypot(car.vx, car.vy);
  if (R.phase === 'rolling') {
    const was = Math.floor(R.phi / HALF_PI + 1e-9 * Math.sign(R.w));
    R.phi += R.w * dt;
    const now = Math.floor(R.phi / HALF_PI + 1e-9 * Math.sign(R.w));
    if (now !== was) {   // a quarter turn: the body meets the ground on its next face
      const q = ((Math.round(R.phi / HALF_PI) % 4) + 4) % 4;   // 1 / 3 a side, 2 the roof, 0 the wheels
      R.w *= 0.6 + 0.2 * Math.random(); car.vx *= 0.86; car.vy *= 0.86;
      if (onHit) onHit(q === 2 ? 'roof' : q === 0 ? 'wheels' : 'side', q === 1 ? 1 : -1, Math.abs(R.w));   // rolling toward +y lands on its +y side first
    }
    if (Math.abs(R.w) < SETTLE_W) {
      // fall onto the nearest face
      const target = Math.round(R.phi / HALF_PI) * HALF_PI;
      R.w += ((target - R.phi) * 30 - R.w * 7) * dt;
      if (Math.abs(target - R.phi) < 0.03 && Math.abs(R.w) < 0.3) {
        const q = ((Math.round(target / HALF_PI) % 4) + 4) % 4;
        R.phi = q * HALF_PI; R.w = 0;
        R.phase = q === 0 ? 'none' : q === 2 ? 'roof' : 'side';
        if (R.phase === 'none') { car.roll = null; return; }
      }
    }
  }
  // the body slides on whatever it is lying on (while rolling: mostly in the air, little drag)
  const mu = R.phase === 'rolling' ? 0.25 : muBody(S);
  if (v > 0.01) { const dv = Math.min(v, mu * g * dt); car.vx -= car.vx / v * dv; car.vy -= car.vy / v * dv; }
  car.yawRate *= Math.exp(-(R.phase === 'rolling' ? 0.8 : 2.5) * dt);
  car.heading += car.yawRate * dt;
  car.x += car.vx * dt; car.y += car.vy * dt;
  car.sparks = R.phase !== 'rolling' && v > 3 && !!S.hard;   // sparks only on hard ground (a trap is not: it was mu 0.45 = 'metal on tarmac')
  R.still = v < 0.8 ? R.still + dt : 0;
  if (car.t) { car.t.vLong = v; }
  car.rpm = Math.max(800, (car.rpm || 800) - 3000 * dt);
}
