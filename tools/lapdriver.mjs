// lapdriver.mjs — a SCRIPTED DRIVER that laps any circuit level headlessly (CLAUDE.md §8: "the lap-time
// benchmark is the instrument this whole game is built on"). Added 2026-10-03 to prove the rebuilt Surface
// Sandbox is a drivable lap, and to give every later tuning question a number.
//
//   node tools/lapdriver.mjs                    sandbox, hatch-rwd
//   node tools/lapdriver.mjs test-track rally-4x4
//
// The driver: pure pursuit on the track centreline (look-ahead grows with speed), and a target speed from
// the tightest radius in the next stretch and the grip of the surface there: v = sqrt(k * mu * g * R).
// It is deliberately a careful driver, not a fast one — what matters is that it is CONSISTENT, so two runs
// with different cars or mods are comparable. Reports lap time, top speed, time off the road, worst
// excursion, and seconds spent on each surface.
// VERIFY BEFORE TRUSTING (CLAUDE.md rule 15): it fails loudly if it leaves the road for long or never
// completes the lap — a driver that understeers into every wall prices everything wrongly.
import { makeCar, step, reset, DT } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/ai/autodrive.ts';

const levelId = process.argv[2] || 'sandbox', carId = process.argv[3] || 'hatch-rwd';
L.setLevel(levelId);
const lv = L.LEVEL, st = lv.subtrack;
if (!st) { console.log(levelId, 'has no circuit'); process.exit(1); }
const total = st.totalDist, hw = st.width / 2;
// THE DRIVER LIVES IN src/ai/autodrive.ts since 2026-10-03 (menus): one copy for the bench, the menu demo lap and the AI seed.
// Its measured history (Stanley steering, firm braking, throttle by feel) is in that file's header and in the HISTORY
// block at the bottom of this one.
const car = makeCar(carId);
reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
const drv = createAutoDriver(st);
let t = 0, offT = 0, worst = 0, vmax = 0;
const onSurf = {};
const LIMIT = 600;        // s
while (drv.state.travelled < total && t < LIMIT) {
  L.applyGround(car, DT);
  const v = Math.hypot(car.vx, car.vy);
  step(car, drv.drive(car), DT);
  t += DT; vmax = Math.max(vmax, v);
  const off = drv.state.lastDist - hw; if (off > 0) offT += DT; worst = Math.max(worst, off);
  const sid = car.surface.id; onSurf[sid] = (onSurf[sid] || 0) + DT;
}
const travelled = drv.state.travelled;
const done = travelled >= total;
console.log(`${levelId} / ${carId}: ${done ? 'LAP ' + t.toFixed(1) + ' s' : 'DID NOT FINISH (' + travelled.toFixed(0) + ' of ' + total.toFixed(0) + ' m in ' + t.toFixed(0) + ' s)'} | top ${(vmax * 3.6).toFixed(0)} km/h | off the road ${offT.toFixed(1)} s, worst ${worst.toFixed(1)} m beyond the edge`);
console.log('  seconds per surface:', Object.entries(onSurf).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
const ok = done && offT < 3 && worst < 4;
console.log(ok ? '  OK — a drivable lap' : '  FAIL — the driver could not lap cleanly; check the track before trusting any number from it');
process.exitCode = ok ? 0 : 1;

/* HISTORY — the driver body that lived here until 2026-10-03, kept for its measured comments:
const pts = st.pts, total = st.totalDist, hw = st.width / 2;
const at = (d) => { d = ((d % total) + total) % total; let p = pts[0]; for (const q of pts) if (q.dist <= d) p = q; return p; };
// radius of the track around d, from heading change over 8 m
const radiusAt = (d) => { let dh = at(d + 4).heading - at(d - 4).heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); return 8 / Math.max(1e-4, Math.abs(dh)); };
const K_GRIP = 0.40;
const K_DECEL = 0.30;     // fraction of mu*g the driver PLANS to brake at, so braking is done before the corner      // fraction of the theoretical cornering speed the careful driver uses

const car = makeCar(carId);
reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let d = (L.querySubtrack(st, car.x, car.y).trackDist), travelled = 0, t = 0, offT = 0, worst = 0, vmax = 0;
const onSurf = {};
const LIMIT = 600;        // s
while (travelled < total && t < LIMIT) {
  L.applyGround(car, DT);
  // PROGRESS: the nearest track point in a window just behind / ahead of where we were. MEASURED BUG in the
  // first version: it used querySubtrack, which returns dist Infinity once the car is more than a few
  // metres off the road — progress froze and the driver chased a point it had already passed.
  let best = null, bd = Infinity;
  for (const p of pts) {
    let ahead = p.dist - d; if (ahead < -total / 2) ahead += total; if (ahead > total / 2) ahead -= total;
    if (ahead < -5 || ahead > 40) continue;
    const dist2 = (p.x - car.x) ** 2 + (p.y - car.y) ** 2;
    if (dist2 < bd) { bd = dist2; best = p; }
  }
  if (best) { let dd = best.dist - d; if (dd < -total / 2) dd += total; if (dd > 0) travelled += dd; d = best.dist; }
  const q = { dist: Math.sqrt(bd) };
  const v = Math.hypot(car.vx, car.vy);
  // steering: pure pursuit to a point ahead on the centreline
  // CAPPED BY SPEED. MEASURED BUG in the first version: gain 2.2 with no cap put full lock on at 27 m/s,
  // spun the car at the first corner of every track. A corner of radius R needs ~L/R rad of lock; at speed
  // that is a few degrees, so the cap shrinks with v.
  // STANLEY CONTROLLER (Stanford 'Stanley', 2005): steer = heading error to the path tangent + atan(k * cross-
  // track error / v), measured at the FRONT AXLE. MEASURED: proportional-on-heading and pure-pursuit laws both
  // weaved and spun the RWD hatch on the Test Track; Stanley corrects position without chasing a far point.
  const fx = car.x + Math.cos(car.heading) * car.spec.lf, fy = car.y + Math.sin(car.heading) * car.spec.lf;
  let fb = best || at(d), fbd = Infinity;
  for (const p2 of pts) { let ah = p2.dist - d; if (ah < -total / 2) ah += total; if (ah > total / 2) ah -= total; if (ah < -3 || ah > 12) continue;
    const q2 = (p2.x - fx) ** 2 + (p2.y - fy) ** 2; if (q2 < fbd) { fbd = q2; fb = p2; } }
  const ahead = at(fb.dist + 2 + v * 0.15);                 // a short preview of the tangent smooths corner entry
  let psi = ahead.heading - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  const cross = (fx - fb.x) * fb.nx + (fy - fb.y) * fb.ny;    // + = we are toward +n of the line
  const deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (car.yawRate - v * Math.tan(car.delta) / car.spec.L);
  const muHere = car.surface.mu * car.spec.mu;
  const cap = Math.min(1, (1.6 * car.spec.L * muHere * GRAVITY / Math.max(4, v * v)) / 0.56 + 0.02);
  const steer = Math.max(-cap, Math.min(cap, deltaS / 0.56));
  const err = psi, tp = ahead, look = 0;
  // speed: the slowest corner in the next stretch, at the grip of the surface there
  let vT = 60;
  for (let a = 5; a < 20 + v * 2.2; a += 4) {
    const p = at(d + a), mu = L.groundAt(p.x, p.y).surface.mu * car.spec.mu;
    const vCorner = Math.sqrt(K_GRIP * mu * GRAVITY * radiusAt(d + a));
    // allow for braking distance to reach it (at a fraction of the grip)
    vT = Math.min(vT, Math.sqrt(vCorner * vCorner + 2 * K_DECEL * mu * GRAVITY * a));
  }
  // BRAKE IN A STRAIGHT LINE. MEASURED BUG: braking mid-corner at the limit spun the RWD hatch at Test Track
  // T1 (rear slip 30 deg at 90 km/h) — a careful driver only LIFTS once the wheel is turned.
  // THROTTLE BY FEEL: backs off as the rear slides or the driven wheels spin. MEASURED BUG: full throttle in
  // the sand esses spun the RWD hatch (rear slip 54 deg at 37 km/h) — the only failure in the first 918 m.
  const slideR = Math.abs(car.t.slipR), feel = Math.max(0, 1 - Math.max(0, slideR - 0.06) / 0.10) * (car.t.spinR || car.t.spinF ? 0.5 : 1);
  const throttle = v < vT ? Math.min(1, (vT - v) * 0.5) * feel : 0;
  // FIRMER BRAKING (2026-10-03, step 2). MEASURED: with gain 0.3 and NO braking once steer > 0.25 the driver could not
  // follow its own plan (planned 5.3 m/s2, delivered ~4) and entered corners 10-25 km/h over its own target — that,
  // not the car, was the Naffcar V8's 12.7 s off on Naffcar Speedway (now 0.0). Gain 1.0, and a 35% floor so it can
  // still trail-brake in long sweepers. Test Track track-rwd 19.3 -> 7.4 s off; muscle 7.5 -> 10.1; naffcar 15.1 -> 14.4:
  // there the Stanley cross-track term tightens the line (~42 m radius demanded in a ~100 m corner) — a DRIVER
  // limitation, not yet proven to be the car. Do not trust Test Track numbers for those three cars until that is fixed.
  const brake = v > vT + 0.5 ? Math.min(1, (v - vT) * 1.0) * Math.max(0.35, 1 - Math.abs(steer) / 0.25) : 0;
  step(car, { steer, throttle, brake, handbrake: false }, DT);
  t += DT; vmax = Math.max(vmax, v);
  const off = q.dist - hw; if (off > 0) offT += DT; worst = Math.max(worst, off);
  const sid = car.surface.id; onSurf[sid] = (onSurf[sid] || 0) + DT;
}

*/
