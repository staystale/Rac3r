import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const T = 'src/physics/tyrepressure.ts';
sub(T, `// grip of an axle by its softest tyre: a flat one 0.7 (the old puncture), a rim 0.45 (as a lost
// wheel)
const FLAT_GRIP = 0.7, RIM_GRIP = 0.45;
// the steady pull of a soft tyre toward its side (rad of toe at flat; front, rear), and the
// extra rolling drag (share of the car's) of a flat wheel / a rim
const PULL_FRONT = 0.012, PULL_REAR = 0.005, DRAG_FLAT = 0.75, DRAG_RIM = 1.5;
const GRAVITY = 9.81;
// ?flatgrip=1 (owner 11-02:`, `// the steady pull of a soft tyre toward its side (rad of toe at flat; front, rear)
const PULL_FRONT = 0.012, PULL_REAR = 0.005;
const GRAVITY = 9.81;
// FLAT GRIP (passed 11-02; owner:`);
sub(T, `// hardly pull away on one flat rear). A flat tyre keeps FLAT_GRIP_REAL of its grip, an axle's grip
// is the MEAN of its two tyres (was the softer one's), and a flat wheel / a rim drags at its own`,
`// hardly pull away on one flat rear). A flat tyre keeps FLAT_GRIP of its grip (was 0.7), a rim
// RIM_GRIP; an axle's grip is the MEAN of its two tyres (was the softer one's: one flat made the
// whole axle slippy), and a flat wheel / a rim drags at its own`);
sub(T, `// (vehicle.ts). The symmetric DRAG_FLAT / DRAG_RIM are left out under it.
const FLAT_GRIP_REAL = 0.9, CRR_FLAT = 0.12, CRR_RIM = 0.18;`, `// (vehicle.ts). (Was a symmetric extra rolling drag, 0.75 / 1.5 x the car's.)
const FLAT_GRIP = 0.9, RIM_GRIP = 0.45, CRR_FLAT = 0.12, CRR_RIM = 0.18;`);
sub(T, `  const flat = FIX.flatGrip ? FLAT_GRIP_REAL : FLAT_GRIP;
  return isOnRim ? RIM_GRIP : 1 - (1 - flat) * (1 - pressure);`, `  return isOnRim ? RIM_GRIP : 1 - (1 - FLAT_GRIP) * (1 - pressure);`);
sub(T, ` * What the tyres' air adds to car.wreck. flatDrag / flatYaw (?flatgrip): the soft wheels' extra`,
` * What the tyres' air adds to car.wreck. flatDrag / flatYaw: the soft wheels' extra`);
sub(T, `  gripF: number; gripR: number; toe: number; roll: number; flatDrag: number; flatYaw: number;`,
`  gripF: number; gripR: number; toe: number; flatDrag: number; flatYaw: number;`);
sub(T, ` * The axles' grip (by the softer tyre), the pull toward soft tyres plus the burst kick, and the
 * extra rolling drag.`, ` * The axles' grip (the mean of their tyres), the pull toward soft tyres plus the burst kick,
 * and the soft wheels' one-sided rolling drag.`);
sub(T, `  let toe = car.tyreKick || 0, roll = 0, flatDrag = 0, flatYaw = 0;`, `  let toe = car.tyreKick || 0, flatDrag = 0, flatYaw = 0;`);
sub(T, `    if (!FIX.flatGrip) { roll += rim[corner] ? DRAG_RIM : DRAG_FLAT * soft; continue; }
`, '');
sub(T, `  const axle = FIX.flatGrip ? (left: number, right: number) => (left + right) / 2 : Math.min;
  return { gripF: axle(grip[0], grip[1]), gripR: axle(grip[2], grip[3]), toe, roll, flatDrag,
    flatYaw };`, `  return { gripF: (grip[0] + grip[1]) / 2, gripR: (grip[2] + grip[3]) / 2, toe, flatDrag,
    flatYaw };`);
sub(T, `import { FIX } from '../core/fixes.ts';\n`, '');
sub('src/damage.ts', `    roll: 1 + 4 * (offF + offR) + air.roll,`, `    roll: 1 + 4 * (offF + offR),`);
sub('src/damage.ts', `    // the tyres' air sets each axle's grip (a flat 0.7, a rim 0.45), bent suspension takes 20 %`,
`    // the tyres' air sets each axle's grip (the mean of a flat 0.9, a rim 0.45, a full 1), bent
    // suspension takes 20 %`);
const V = 'src/vehicle.ts';
let s = fs.readFileSync(V, 'utf8');
s = s.replaceAll('(?flatgrip)', '').replaceAll('  // ?flatgrip: soft wheels', '  // soft wheels');
fs.writeFileSync(V, s);
const H = 'src/physics/tyreheat.ts';
sub(H, `      * (FIX.heatEase ? HEAT_EASE : 1);`, `      * HEAT_EASE;`);
sub(H, `// ?heatease=1 (owner 11-02:`, `// HEAT EASE (passed 11-02; owner:`);
sub(H, `import { FIX } from '../core/fixes.ts';\n`, '');
const P = 'src/render/particles.ts';
sub(P, `  return FIX.smokeOver && share && fxRandom() < share ? state.overPuffs : state.puffs;`,
`  return share && fxRandom() < share ? state.overPuffs : state.puffs;`);
sub(P, ` * The pool a puff goes in: a share of them over the cars (?smokeover), else under them.`,
` * The pool a puff goes in: a share of them over the cars, else under them.`);
sub(P, `// ?smokeover=1 (owner: "can some`, `// SMOKE OVER (passed 11-02; owner: "can some`);
sub(P, `import { FIX } from '../core/fixes.ts';\n`, '');
sub('src/world/surfaces.ts', `?smokeover=1 (owner:`, `Smoke over (passed 11-02; owner:`);
sub('src/world/types.ts', `(?smokeover: fine dry dust)`, `(fine dry dust)`);
const F = 'src/core/fixes.ts';
s = fs.readFileSync(F, 'utf8');
s = s.replace(/export const FIX = \{[\s\S]*?\n\};/, 'export const FIX = {\n};');
s = s.replace('dustlinger, musclegears - passed 11-02.)', 'dustlinger, musclegears - and smokeover,\n// heatease, flatgrip passed 11-02.)');
fs.writeFileSync(F, s);
const L = 'src/testlist.js';
s = fs.readFileSync(L, 'utf8');
s = s.replace('  // musclegears, dustlinger passed 2026-11-02)\n', '  // musclegears, dustlinger passed 2026-11-02; smokeover, heatease, flatgrip passed 2026-11-02)\n');
s = s.replace(/\n  \{\n    id: 'smokeover'[\s\S]*\n  \},\n\];/, '\n];');
fs.writeFileSync(L, s);
console.log('ok');
