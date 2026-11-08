import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const F = 'src/core/fixes.ts';
let s = fs.readFileSync(F, 'utf8');
s = s.replace(/\/\/ \(The 11-01 round[\s\S]*?hwsnow - the driving root fix \(wheelspin\) and evenlap passed 11-02 and are the game now\.\)/,
`// (The 11-01 round - wheelgone, heavywet, menureset, menucar, ainumbers, markage, treenight,
// hwsnow - the driving root fix (wheelspin), evenlap, flatsize and the realism round - the K13
// dials, pedalramp, lockfade, spinmarks, smokefade, dustlinger, musclegears - passed 11-02.)`);
s = s.replace(/\/\*\* The switches under test, all off on the plain link\. \*\/\nexport const FIX = \{[\s\S]*?\n\};\n/,
`/** The switches under test, all off on the plain link. */
export const FIX = {
};
`);
fs.writeFileSync(F, s);
const T = 'src/testlist.js';
s = fs.readFileSync(T, 'utf8');
s = s.replace("  // wheel speed, real ABS) passed 2026-11-02; evenlap, flatsize passed 2026-11-02)\n",
  "  // wheel speed, real ABS) passed 2026-11-02; evenlap, flatsize passed 2026-11-02; realism (K13\n"
  + "  // dials at brake 1, lock 1, grip 0.5, power 1), pedalramp, lockfade, spinmarks, smokefade,\n"
  + "  // musclegears, dustlinger passed 2026-11-02)\n");
s = s.replace(/\n  \{\n    id: 'realism'[\s\S]*\n  \},\n\];/, '\n];');
fs.writeFileSync(T, s);
const C = 'src/cars.ts';
sub(C, `// NEW CARS. Curves are on the game's scale (the roster runs ~1.7x real torque —
// see SHARED dragC), set against the measured roster (tools/carstats.mjs), not the brochure.
`, '');
sub(C, `// Curve shape borrowed from the hatch and scaled/shifted per car (PLAN.md).
`, `// TORQUE CURVES, Nm at the crank. Curve shape borrowed from the hatch and scaled/shifted per car
// (PLAN.md). K13 (passed 11-02, ?realpower=1): the roster had run ~1.7x real torque and up to
// 3.6x real power (Muscle 1653 hp, Naffcar 2438), held back by fat drag; every curve was scaled
// to its car's real peak power (Hatch FWD 245 hp, RWD 340, Muscle 450, Naffcar 670, Mini 76, Lambo
// 610 ...) and dragC set to the real body's 0.5 rho Cd A, so the hatch and the Naffcar no longer
// share one curve with the Muscle / Hatch RWD.
`);
sub(C, `// (requirement: a BMW 3 series 2000s and a Subaru WRX classic 2005 saloon) — game units, scaled
// from the real figures as the roster is (the hatch peaks 488): an E46 330i-style straight
// six (300 Nm real, ~1.5x the hatch, smooth and flat, 6500 redline) and a GD WRX-style turbo flat
// four (300 Nm real at 3600: soft under 2500, then the boost, tailing off to 7000)`,
`// (requirement: a BMW 3 series 2000s and a Subaru WRX classic 2005 saloon): an E46 330i-style
// straight six (smooth and flat, 6500 redline) and a GD WRX-style turbo flat four (soft under
// 2500, then the boost, tailing off to 7000)`);
sub(C, `    // raised with the 3x power so the torque goes into
    gears: [3.42, 1.95, 1.22, 0.76], finalDrive: 3.31, dragC: 0.6,
                                     // wheelspin and acceleration rather than a 390 km/h top speed`,
`    // (owner 11-02: "keep the muscle car at 4 gears ... 1st shorter ... 4 being quite long"):
    // 1st 60 km/h at the redline (was 77), 4th 270 (was 205, its old top speed on the limiter)
    gears: [3.42, 1.95, 1.22, 0.76], finalDrive: 3.31, dragC: 0.6,`);
sub(C, `    // deg when braking in a turn. Real cars run 70-85% front for exactly this reason.`,
`    // deg when braking in a turn. Real cars run 70-85% front for exactly this reason. K13 (passed
    // 11-02): 0.65 front on every road car, 0.60 on single-seaters, with LOCK_SHARE 0.70
    // (wheelspin.ts) the spin under braking is gone (brakecheck 12 -> 5 of the turns).`);
console.log('ok');
