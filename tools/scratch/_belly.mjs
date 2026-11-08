import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [['  resetIn: atLoad(\'resetin\'),\n};', `  resetIn: atLoad('resetin'),
  // ?belly=1: GROUND CLEARANCE in soft ground - the car sinks into mud / sand and its ruts; what
  // is deeper than its ride height drags its underside (world/wear.ts bellyDepth, physics/tyres.ts)
  belly: atLoad('belly'),
};`]]);
edit('src/vehicle.ts', [['  slopeLong?: number; slopeLat?: number; slopeYaw?: number;',
  '  slopeLong?: number; slopeLat?: number; slopeYaw?: number;\n'
  + '  bellyDepth?: number;   // ?belly: m of the underside in the ground (world/wear.ts)']]);
edit('src/world/types.ts', [['export interface CarBody {\n  x: number;', 'export interface CarBody {\n  bellyDepth?: number;   // ?belly (world/wear.ts bellyDepth)\n  x: number;']]);
// wear.ts: how deep the underside is
edit('src/world/wear.ts', [
  ['  if (car.air > 0) { car.slopeLong = 0; car.slopeLat = 0; car.slopeYaw = 0; }\n  else applySlopeForces(car, cosH, sinH);',
    '  if (car.air > 0) { car.slopeLong = 0; car.slopeLat = 0; car.slopeYaw = 0; }\n  else applySlopeForces(car, cosH, sinH);\n'
    + '  car.bellyDepth = FIX.belly && !(car.air > 0) ? bellyDepth(car, cosH, sinH) : 0;'],
  ['// The fence is the one hard constraint out here, because a barrier IS one.',
    `// ?belly (owner 11-03: "can suspension travel / ground clearance affect mud's drag?"): a car SINKS
// into soft ground by BELLY_SINK (the wheels' contact under its top), and further by the ruts its
// wheels run in, against the ground between them (the ridge, sampled at the centre). What that
// takes past its ride height (spec.rideH) is its UNDERSIDE in the ground: physics/tyres.ts drags it.
// Suspension travel, when it comes, will take clearance away as the springs squat.
const BELLY_SINK: Record<string, number> = { mud: 0.06, thickMud: 0.12, sand: 0.06 };

/**
 * How deep the car's underside is in the ground (?belly), m.
 * @param car the car body
 * @param cosH cos of the car heading
 * @param sinH sin of the car heading
 * @returns m (0: clear)
 */
function bellyDepth(car: CarBody, cosH: number, sinH: number): number {
  const sink = BELLY_SINK[car.surface ? car.surface.id : ''] || 0;
  const spec = car.spec, hw2 = (spec.trackWidth || 1.5) / 2;
  let ruts = 0;
  for (const [axleX, side] of [[spec.lf, 1], [spec.lf, -1], [-spec.lr, 1], [-spec.lr, -1]]) {
    ruts += rutAt(car.x + cosH * axleX - sinH * hw2 * side, car.y + sinH * axleX + cosH * hw2 * side) / 4;
  }
  const ridge = ruts - rutAt(car.x, car.y);
  return Math.max(0, sink + Math.max(0, ridge) - (spec.rideH ?? 0.14));
}

// The fence is the one hard constraint out here, because a barrier IS one.`],
]);
let w = fs.readFileSync('src/world/wear.ts', 'utf8');
w = w.replace('import { LEVEL } from "./state.ts";', 'import { LEVEL } from "./state.ts";\nimport { FIX } from "../core/fixes.ts";');
fs.writeFileSync('src/world/wear.ts', w);
// tyres.ts: the underside ploughs
edit('src/physics/tyres.ts', [
  ['    * (carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1);',
    '    * (carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1)\n'
    + '    // ?belly: the underside in the ground ploughs too, by how deep (beached at BELLY_FULL_M)\n'
    + '    + (FIX.belly ? BELLY_PLOUGH * Math.min(1, (car.bellyDepth || 0) / BELLY_FULL_M) : 0);'],
  ['const PLOUGH_CRAWL = 0.55;', 'const PLOUGH_CRAWL = 0.55;\n\n'
    + '// ?belly: the plough of an underside dragged through the ground, at full depth (BELLY_FULL_M of\n'
    + '// it in the ground: beached - on top of mud\'s own 0.35 a 2WD car stops dead)\n'
    + 'const BELLY_PLOUGH = 2.4, BELLY_FULL_M = 0.12;'],
  ["import { wornGrip } from './tyrewear.ts';", "import { wornGrip } from './tyrewear.ts';\nimport { FIX } from '../core/fixes.ts';"],
]);
console.log('ok');
