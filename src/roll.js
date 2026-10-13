// roll.js — ROLLOVERS + SIDE / ROOF SLIDES (2026-10-04). User: "the roll over system should be
// included in damage"; "can we get roll overs and side and roof slides". Backlog spec (TODO
// MASTER BACKLOG E): a chance from impact speed, landing, slide angle and surface; landing on
// things = high chance; can roll several times onto the side or the roof, then slide.
//
// car.roll = { phase: 'none' | 'rolling' | 'side' | 'roof', phi, w, still } — phi is the roll
// angle about the car's long axis (0 = on its wheels, +-PI/2 on a side, PI on the roof), w its
// rate. vehicle.reset() clears it (RESET puts you back on your wheels).
// TRIP: a car on its wheels sliding SIDEWAYS faster than V_TRIP for its ground trips over its
// leading side — soonest where the ground grabs the sliding tyres (gravel, dirt, sand, mud), late
// on grass and snow, only in a big fast spin on tarmac, never on ice — scaled by the car's static
// stability (track / 2 x cg height: tall cars go over sooner); a hard SIDE impact (damage.js
// sideKick) and a crooked LANDING can start one too. ROLLING: the rate decays at every quarter
// turn the body hits the ground (side, roof, side, wheels), each costing speed and doing side /
// roof damage (damage.js crushS / roofDmg) with paint chips; under SETTLE_W it settles onto the
// nearest of wheels / side / roof. SLIDES: no tyres — the body grinds to a stop on its own
// friction for that ground (sparks on hard ground).
// Sim time (rule 5): it moves the car; render.ts draws it (faces, sparks), main.js hands control
// back on RESET (player) or resets the AI.
// m: body height (the side face the camera sees on a rolled car)
export const ROLL_H = 1.4;
// the hatch: 1.5 / (2 x 0.52)
const SSF_REF = 1.44;
// rad/s: slower than this, it falls onto the nearest face
const SETTLE_W = 2.4;
const HALF_PI = Math.PI / 2;

// ROLL CHANCE (user, 2026-10-04): v1 rolled most slides; v2 "a % chance per floor grid cell, by
// surface"; v3 (this): "it's getting in the way of DRIFTING — keep it closer to 90 deg and to
// higher speeds; below 60 mph a low chance; long grass, sand, mud, deep mud, snow higher; dirt,
// gravel, grass medium-low; hard surfaces low, broken tarmac slightly higher than tarmac". One
// roll of the dice per CELL_M m ground cell crossed: pct (% per cell at 60 mph, square on) x
// ANGLE (0 under ANG_MIN of the slide being sideways, 1 at fully sideways) x SPEED ((v / 60
// mph)^4 under it, rising past it, cap x2.5) x the car's stability (track / 2 cg).
const PCT = {
  // high: the ground grabs a sliding car
  // (user, 2026-10-04) SAND the HIGHEST risk (it also stops a slide fastest, so its per-cell %
  // is highest), SNOW a close second
  grassLong: 5, sand: 22, mud: 5, thickMud: 7, snow: 11,
  // a GRAVEL TRAP (lab.js SURFACE_TRAP: deep, ploughing): the readiest to dig in and flip a car
  // sliding into it sideways (user)
  trap: 14,
  dirt: 2.2, gravel: 2.6, grass: 1.8, grassShort: 1.8, kerb: 1.5, puddle: 1, water: 1,
  broken: 0.9, ice: 0.3,
};
// tarmac, concrete...
const PCT_HARD = 0.5;
// ANG_MIN: sin of the slide angle (0.8 = 53 deg; full chance at 90)
const CELL_M = 2, MPH60 = 26.82, MPH39 = 17.43, ANG_MIN = 0.8;
const pctOf = (surface) => PCT[surface.id] ?? PCT_HARD;
// body friction when sliding on its side / roof
function muBody(surface) {
  const surfaceId = surface.id || '';
  if (surfaceId === 'ice') return 0.1;
  if (surfaceId === 'snow') return 0.28;
  // a trap grabs the body hardest
  if (['dirt', 'gravel', 'sand', 'mud', 'thickMud', 'trap'].includes(surfaceId))
    return surfaceId === 'trap' ? 0.85 : 0.7;
  if (surfaceId.startsWith('grass')) return 0.55;
  // metal on tarmac / concrete
  return 0.45;
}
export const rolling = (car) => !!(car.roll && car.roll.phase !== 'none');

export function startRoll(car, dir, vLat) {
  car._rolls = (car._rolls || 0) + 1;
  // a spread on the spin, and on what each ground contact takes off it (below), so a roll can end
  // on the wheels, a side or the roof
  car.roll = {
    phase: 'rolling',
    phi: 0,
    w: dir * Math.min(14, (0.95 * Math.abs(vLat) + 2) * (0.7 + 0.6 * Math.random())),
    still: 0,
  };
}

// call each sim step while the car is on its wheels (after vehicle.step)
export function tripCheck(car, dt, rnd = Math.random) {
  if (rolling(car)) return false;
  // per-car cg (cars.js)
  const spec = car.spec, ssf = (spec.trackWidth || 1.5) / (2 * (spec.cg || spec.cgH || 0.52)),
    stability = ssf / SSF_REF;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading),
    vLat = -car.vx * sinH + car.vy * cosH;
  // a hard side impact (damage.js) or a crooked landing
  const kick = car._sideKick;
  car._sideKick = null;
  if (kick && kick.dv > 7 * stability
    && rnd() < Math.min(0.6, (kick.dv - 7 * stability) / 10)) {
    startRoll(car, kick.dir, kick.dv);
    return true;
  }
  const landed = !(car.air > 0) && (car._airT || 0) > 0.35;
  car._airT = car.air > 0 ? (car._airT || 0) + dt : 0;
  // a CROOKED LANDING (user, 2026-10-04, after Killder's jump: "a little easy to roll over on
  // landing"): was 30 % for any landing with 4 m/s sideways; now only a properly sideways one,
  // 6+ m/s and a slide angle past 30 deg, up to 20 % at 12 m/s, x the car's stability
  if (landed) {
    const landSpeed = Math.hypot(car.vx, car.vy),
      side = landSpeed > 1 ? Math.abs(vLat) / landSpeed : 0;
    if (Math.abs(vLat) > 6 && side > 0.5
      && rnd() < 0.2 * Math.min(1, (Math.abs(vLat) - 6) / 6) * Math.min(1.6, 1 / stability)) {
      startRoll(car, Math.sign(vLat), Math.abs(vLat));
      return true;
    }
  }
  if (car.air > 0) return false;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 8) return false;
  const side = Math.abs(vLat) / speed;
  // a drift angle: never
  if (side < ANG_MIN) return false;
  // one check per ground cell crossed
  const cell = Math.floor(car.x / CELL_M) * 73856093 ^ Math.floor(car.y / CELL_M) * 19349663;
  if (cell === car._tripCell) return false;
  car._tripCell = cell;
  // (user: "still exist under 60 mph, diminishing to ZERO at ~39 mph"; was (v / 60 mph)^4, never
  // quite zero)
  const ang = (side - ANG_MIN) / (1 - ANG_MIN),
    spd = speed < MPH39 ? 0
    : speed < MPH60 ? ((speed - MPH39) / (MPH60 - MPH39)) ** 2
      : Math.min(2.5, 1 + (speed - MPH60) / 9);
  const chance = (pctOf(car.surface || {}) / 100) * ang * spd * Math.min(1.6, 1 / stability);
  if (rnd() < chance) {
    startRoll(car, Math.sign(vLat), Math.abs(vLat));
    return true;
  }
  return false;
}

// one sim step of a rolling / overturned car (instead of vehicle.step). onHit(kind, side) for the
// damage (main.js -> damage.js)
export function stepRoll(car, dt, onHit) {
  const state = car.roll, surface = car.surface || {}, gravity = 9.81,
    speed = Math.hypot(car.vx, car.vy);
  if (state.phase === 'rolling') {
    const was = Math.floor(state.phi / HALF_PI + 1e-9 * Math.sign(state.w));
    state.phi += state.w * dt;
    const now = Math.floor(state.phi / HALF_PI + 1e-9 * Math.sign(state.w));
    if (now !== was) {   // a quarter turn: the body meets the ground on its next face
      // 1 / 3 a side, 2 the roof, 0 the wheels
      const face = ((Math.round(state.phi / HALF_PI) % 4) + 4) % 4;
      state.w *= 0.6 + 0.2 * Math.random();
      car.vx *= 0.86;
      car.vy *= 0.86;
      // rolling toward +y lands on its +y side first
      if (onHit) onHit(
        face === 2 ? 'roof' : face === 0 ? 'wheels' : 'side',
        face === 1 ? 1 : -1,
        Math.abs(state.w),
      );
    }
    if (Math.abs(state.w) < SETTLE_W) {
      // fall onto the nearest face
      const target = Math.round(state.phi / HALF_PI) * HALF_PI;
      state.w += ((target - state.phi) * 30 - state.w * 7) * dt;
      if (Math.abs(target - state.phi) < 0.03 && Math.abs(state.w) < 0.3) {
        const face = ((Math.round(target / HALF_PI) % 4) + 4) % 4;
        state.phi = face * HALF_PI;
        state.w = 0;
        state.phase = face === 0 ? 'none' : face === 2 ? 'roof' : 'side';
        if (state.phase === 'none') { car.roll = null; return; }
      }
    }
  }
  // the body slides on whatever it is lying on (while rolling: mostly in the air, little drag)
  const friction = state.phase === 'rolling' ? 0.25 : muBody(surface);
  if (speed > 0.01) {
    const slow = Math.min(speed, friction * gravity * dt);
    car.vx -= car.vx / speed * slow;
    car.vy -= car.vy / speed * slow;
  }
  car.yawRate *= Math.exp(-(state.phase === 'rolling' ? 0.8 : 2.5) * dt);
  car.heading += car.yawRate * dt;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // sparks only on hard ground (a trap is not: it was mu 0.45 = 'metal on tarmac')
  car.sparks = state.phase !== 'rolling' && speed > 3 && !!surface.hard;
  state.still = speed < 0.8 ? state.still + dt : 0;
  if (car.t) { car.t.vLong = speed; }
  car.rpm = Math.max(800, (car.rpm || 800) - 3000 * dt);
}
