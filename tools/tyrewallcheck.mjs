// tyrewallcheck.mjs — loose tyres vs walls (user, 2026-10-04: "tyres should interact with other objects like Armco — a chance to pass
// over in high-impact scenarios is ok"). Node only. On Thruston: knock tyre stacks from the Goodwood tyre wall straight at the Armco.
// (1) a slow hit (8 m/s, under OVER_V) must stay on the track side, every time; (2) a hard hit (16 m/s) goes over ~30 % of the time (cones.js OVER_CHANCE).
// Also: no Slidden Hill start-wall stack sits on the start straight. node tools/tyrewallcheck.mjs
import * as L from '../src/lab.js';
import { createCones } from '../src/cones.js';
const fails = [];
L.setLevel('thruston');
const st = L.LEVEL.subtrack, farCar = { x: 9999, y: 9999, vx: 0, vy: 0, heading: 0, yawRate: 0, spec: { len: 4, wid: 1.8, mass: 1200 } };
const offOf = (x, y) => { const q = L.querySubtrack(st, x, y), p = L.onTrack(st, q.trackDist, 0, {}); return (x - p.x) * Math.cos(p.rot + Math.PI / 2) + (y - p.y) * Math.sin(p.rot + Math.PI / 2); };
const trial = (speed) => {
  const cones = createCones(); const k = cones.list.find((c) => c.kind === 'tyrestack' && Math.abs(offOf(c.x, c.y) + 14) < 0.3 && L.querySubtrack(st, c.x, c.y).trackDist > 600);
  const q = L.querySubtrack(st, k.x, k.y), p = L.onTrack(st, q.trackDist, 0, {}), nx = -Math.cos(p.rot + Math.PI / 2), ny = -Math.sin(p.rot + Math.PI / 2);   // outward = -normal
  // ALONE: with the rest of the wall present the fired stack hit the second row and burst before reaching the rail (measured 0/80)
  cones.list.length = 0; cones.list.push(k); cones.rebuildGrid();
  k.vx = nx * speed; k.vy = ny * speed; k.moved = true;
  for (let i = 0; i < 600; i++) cones.step(farCar, 1 / 120);
  const o = offOf(k.x, k.y);
  // held = never INSIDE the rail: rail face -15.7, stack radius 0.48 -> centre >= -15.27 (the old code left it at -15.78, in the rail)
  return o < -16.3 ? 'over' : o > -15.3 ? 'held' : 'in-rail';
};
let held = 0; for (let i = 0; i < 20; i++) if (trial(8) === "held") held++;   // 8 m/s: at 5 the stack stopped 1.1 m out, short of the rail (passed on the OLD code too)
console.log(`slow hit (8 m/s, under OVER_V): held by the Armco ${held}/20`); if (held !== 20) fails.push('slow');
let over = 0; const N = 80; for (let i = 0; i < N; i++) if (trial(16) === 'over') over++;
console.log(`hard hit (16 m/s): over the Armco ${over}/${N} (${(100 * over / N).toFixed(0)} %, want ~30)`); if (over < N * 0.15 || over > N * 0.45) fails.push('hard');
L.setLevel('slidden-hill');
const S = L.LEVEL.lanes[0];
const dSeg = (x, y, P) => { let m = Infinity; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); m = Math.min(m, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return m; };
const onStart = L.LEVEL.cones.filter((c) => dSeg(c.x, c.y, S.pts) < S.width / 2 + 0.5).length;
console.log('Slidden Hill stacks on the start straight:', onStart); if (onStart) fails.push('start');
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'tyre walls: all OK');
