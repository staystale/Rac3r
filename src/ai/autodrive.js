// autodrive.js — the SCRIPTED DRIVER, in the game. Moved out of tools/lapdriver.mjs (2026-10-03, menus) so one driver
// serves three jobs: the lap-time benchmark (tools/lapdriver.mjs imports this), the live demo lap behind the main menu,
// and the seed of the AI drivers (roadmap D1). One copy, so the bench always measures what the demo and the AI drive.
//
// The driver (history in tools/lapdriver.mjs and ENGINE.md): a STANLEY controller on the subtrack centreline for steering,
// and a target speed from the tightest radius ahead and the grip of the surface there, v = sqrt(K_GRIP * mu * g * R),
// with a braking allowance; it brakes firmly (gain 1.0) with a 35% floor while steering, and feathers the throttle by feel.
import { groundAt } from "../world/wear.ts";
import { GRAVITY } from '../cars.js';

const K_GRIP = 0.40;     // fraction of the theoretical cornering speed it uses — a careful, CONSISTENT driver
const K_DECEL = 0.30;    // fraction of mu*g it plans to brake at

export function createAutoDriver(subtrack) {
  const pts = subtrack.pts, total = subtrack.totalDist;
  // binary search (2026-10-04: the linear scan was 12 % of a frame with 5 AI drivers)
  const at = (d) => { d = ((d % total) + total) % total; let lo = 0, hi = pts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].dist <= d) lo = m; else hi = m - 1; } return pts[lo]; };
  const radiusAt = (d) => { let dh = at(d + 4).heading - at(d - 4).heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); return 8 / Math.max(1e-4, Math.abs(dh)); };
  const st = { d: null, travelled: 0, lastDist: 0, vT: 60 };

  // Returns { steer, throttle, brake, handbrake } for this step, and keeps progress (st.d, st.travelled).
  function drive(car) {
    if (st.d === null) {
      // start at the nearest centreline point
      let bd = Infinity; for (const p of pts) { const q = (p.x - car.x) ** 2 + (p.y - car.y) ** 2; if (q < bd) { bd = q; st.d = p.dist; } }
    }
    // PROGRESS: nearest point in a window just behind / ahead (see lapdriver history: querySubtrack froze off the road)
    let best = null, bd = Infinity;
    for (const p of pts) {
      let ahead = p.dist - st.d; if (ahead < -total / 2) ahead += total; if (ahead > total / 2) ahead -= total;
      if (ahead < -5 || ahead > 40) continue;
      const dist2 = (p.x - car.x) ** 2 + (p.y - car.y) ** 2;
      if (dist2 < bd) { bd = dist2; best = p; }
    }
    if (best) { let dd = best.dist - st.d; if (dd < -total / 2) dd += total; if (dd > 0) st.travelled += dd; st.d = best.dist; }
    st.lastDist = Math.sqrt(bd);
    const v = Math.hypot(car.vx, car.vy);
    // STANLEY steering at the front axle
    const fx = car.x + Math.cos(car.heading) * car.spec.lf, fy = car.y + Math.sin(car.heading) * car.spec.lf;
    let fb = best || at(st.d), fbd = Infinity;
    for (const p2 of pts) { let ah = p2.dist - st.d; if (ah < -total / 2) ah += total; if (ah > total / 2) ah -= total; if (ah < -3 || ah > 12) continue;
      const q2 = (p2.x - fx) ** 2 + (p2.y - fy) ** 2; if (q2 < fbd) { fbd = q2; fb = p2; } }
    const ahead = at(fb.dist + 2 + v * 0.15);
    let psi = ahead.heading - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = (fx - fb.x) * fb.nx + (fy - fb.y) * fb.ny;
    const deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (car.yawRate - v * Math.tan(car.delta) / car.spec.L);
    const muHere = car.surface.mu * car.spec.mu;
    const LOCK = car.spec.steerMax || 0.56;
    const cap = Math.min(1, (1.6 * car.spec.L * muHere * GRAVITY / Math.max(4, v * v)) / LOCK + 0.02);
    const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
    // SPEED: the slowest corner in the next stretch, at the grip of the surface there
    let vT = 60;
    for (let a = 5; a < 20 + v * 2.2; a += 4) {
      const p = at(st.d + a), mu = groundAt(p.x, p.y).surface.mu * car.spec.mu;
      const vCorner = Math.sqrt(K_GRIP * mu * GRAVITY * radiusAt(st.d + a));
      vT = Math.min(vT, Math.sqrt(vCorner * vCorner + 2 * K_DECEL * mu * GRAVITY * a));
    }
    st.vT = vT;
    const slideR = Math.abs(car.t.slipR), feel = Math.max(0, 1 - Math.max(0, slideR - 0.06) / 0.10) * (car.t.spinR || car.t.spinF ? 0.5 : 1);
    const throttle = v < vT ? Math.min(1, (vT - v) * 0.5) * feel : 0;
    const brake = v > vT + 0.5 ? Math.min(1, (v - vT) * 1.0) * Math.max(0.35, 1 - Math.abs(steer) / 0.25) : 0;
    return { steer, throttle, brake, handbrake: 0 };
  }
  return { drive, state: st, total };
}
