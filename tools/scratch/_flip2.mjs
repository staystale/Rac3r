import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const W = 'src/physics/wheelspin.ts';
sub(W, '// ?lockfade=1: rubber sliding', '// LOCK FADE (passed 11-02): rubber sliding');
sub(W, " * The share of a sliding tyre's grip kept at a sliding speed (?lockfade).", " * The share of a sliding tyre's grip kept at a sliding speed.");
sub(W, `/**
 * A locked or spinning tyre's grip share, moved toward the real one by ?reallock (realism.ts).
 * @param slideGrip the car's share
 * @returns the share used
 */
function lockGrip(slideGrip: number): number {
  return DIAL.lock ? slideGrip + (LOCK_REAL - slideGrip) * DIAL.lock : slideGrip;
}
`, `// A locked or spinning tyre's grip as a share of its peak on dry tarmac (K13, passed 11-02: a real
// tyre keeps ~0.70; the car's slideGrip 0.85 made a locked stop only 4 % longer than ABS). A
// fitted tyre's own slide factor still scales it.
const LOCK_SHARE = 0.70;
`);
sub(W, '    sgLong: lockGrip(sgLat * (carSpec.tyre && carSpec.tyre.slide || 1)) };', '    sgLong: LOCK_SHARE * (carSpec.tyre && carSpec.tyre.slide || 1) };');
sub(W, "import { DIAL, LOCK_REAL } from '../realism.ts';\n", '');
const L = 'src/ai/line.ts';
sub(L, 'import { realGripK } from "../realism.ts";\n', '');
sub(L, `  // (?realgrip: the measured numbers scaled with the tyres until they are re-measured)
  const gripK = realGripK(carId), gripG = (stats.gripG || spec.mu * 0.9) * gripK,
    brakeG = stats.brake100 ? (27.78 * 27.78) / (2 * stats.brake100) / GRAVITY * gripK
      : gripG * 0.8;`, `  const gripG = stats.gripG || spec.mu * 0.9,
    brakeG = stats.brake100 ? (27.78 * 27.78) / (2 * stats.brake100) / GRAVITY : gripG * 0.8;`);
const C = 'src/cars.ts';
sub(C, "import { applyRealism } from './realism.ts';\n", '');
sub(C, '  applyRealism(out);   // the K13 test dials (realism.ts), nothing with them off\n', '');
console.log('ok');
