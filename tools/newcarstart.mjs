// newcarstart.mjs - A NEW CAR'S STARTING SET-UP: name the real car and the nearest existing car;
// it copies that car's ROSTER row (src/cars.ts) and fills in the real car's numbers you give, so
// the draft is ready to adjust. Writes shots/newcar/<id>/draft.ts: the ROSTER row (each field
// marked REAL or COPIED from the nearest car), its REAL_SIZE line (src/carreal.ts) and its
// REAL_FIGURES line (tools/lib/realfigures.mjs). Nothing in the game is changed: paste the row in
// behind the car's own switch, then check it with tools/newcar.mjs <id>.
// node tools/newcarstart.mjs <spec.json>       node tools/newcarstart.mjs --template (an example)
// The spec (every field but id, name, like and real optional - a field left out is COPIED):
//   id, name (the parody), like (the nearest roster car), real (the real car, year, gearbox),
//   cls, sub, kind, mass (kg), drive ('FWD' | 'RWD' | '4WD' or the front share 0..1),
//   engine { idle, low, nm, nmFrom, nmTo, kw, kwAt, redline } (src/realcars.ts realCurve),
//   gears [ratios], finalDrive, tyre [width mm, aspect %, rim in], drag [Cd, frontal area m^2],
//   size { len, wid, wheelbase, frontShare (of the weight), trackWidth } in real metres,
//   figures { topKph, zeroTo100 } (published), note
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ROSTER } from '../src/cars.ts';
import { realCurve, dragOf, tyreR } from '../src/realcars.ts';
import { realScale } from '../src/carreal.ts';

const TEMPLATE = {
  id: 'gt86-rwd', name: 'PARODY NAME (NOTES.md register first)', like: 'hatch-rwd', real: 'Toyota GT86 (2012, 6MT)',
  cls: 'road', sub: 'Sports', mass: 1230, drive: 'RWD',
  engine: { idle: 800, low: 0.6, nm: 205, nmFrom: 6400, nmTo: 6600, kw: 147, kwAt: 7000,
    redline: 7400 },
  gears: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767], finalDrive: 4.1, tyre: [215, 45, 17],
  drag: [0.27, 2.0], size: { len: 4.24, wid: 1.775, wheelbase: 2.57, frontShare: 0.53,
    trackWidth: 1.52 }, figures: { topKph: 226, zeroTo100: 7.6 },
};

if (process.argv[2] === '--template' || !process.argv[2]) {
  console.log(JSON.stringify(TEMPLATE, null, 2));
  process.exit(process.argv[2] ? 0 : 1);
}
const want = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const like = ROSTER.find((car) => car.id === want.like);
for (const [ok, message] of [[want.id && want.name && want.real, 'id, name and real are needed'],
  [like, `no roster car "${want.like}" to copy (like)`],
  [!ROSTER.some((car) => car.id === want.id), `"${want.id}" is already in the roster`]]) {
  if (!ok) {
    console.log(`newcarstart: ${message}`);
    process.exit(1);
  }
}

/** A value as the roster writes it: single quotes, spaced lists and objects. */
function sourceOf(value) {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(sourceOf).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value).map(([key, inner]) => `${key}: ${sourceOf(inner)}`)
      .join(', ')} }`;
  }
  return String(value);
}

// field -> [value, its source text, 'REAL' | 'COPIED']
const fields = new Map();
const copied = (key) => fields.set(key, [like[key], sourceOf(like[key]), 'COPIED']);
const real = (key, value, text = sourceOf(value)) => fields.set(key, [value, text, 'REAL']);
for (const key of Object.keys(like)) copied(key);
real('id', want.id);
real('name', want.name);
for (const key of ['cls', 'sub', 'kind', 'mass']) if (want[key] !== undefined) real(key, want[key]);
if (want.drive !== undefined) {
  const share = { FWD: 1, RWD: 0, '4WD': 0.5 }[want.drive] ?? Number(want.drive);
  real('drive', share);
}
if (want.engine) {
  const eng = want.engine;
  real('curve', realCurve(eng), `realCurve(${sourceOf(eng)})`);
  real('redline', eng.redline);
  real('idleRpm', eng.idle);
  // the change-up and change-down points where the nearest car has them, against its redline
  const at = (rpm) => Math.round(eng.redline * rpm / like.redline / 50) * 50;
  real('upshiftRpm', at(like.upshiftRpm));
  real('downshiftRpm', at(like.downshiftRpm));
}
if (want.gears) real('gears', want.gears);
if (want.finalDrive) real('finalDrive', want.finalDrive);
if (want.tyre) {
  const [width, aspect, rim] = want.tyre;
  real('wheelR', tyreR(width, aspect, rim), `tyreR(${width}, ${aspect}, ${rim})`);
  real('tyreWidth', width / 1000);
  real('rimIn', rim);
}
if (want.drag) real('dragC', dragOf(...want.drag), `dragOf(${want.drag.join(', ')})`);
if (want.size) {
  // the game's length to the nearest car's scale (each car kept near its old size, carreal.ts)
  const scale = realScale(like.id, like.len), size = want.size;
  const metres = (value) => Math.round(value * scale * 1000) / 1000;
  real('len', metres(size.len));
  real('wid', metres(size.wid));
  real('lf', metres(size.wheelbase * (1 - size.frontShare)));
  real('lr', metres(size.wheelbase * size.frontShare));
  if (size.trackWidth) real('trackWidth', metres(size.trackWidth));
}

const lines = [...fields].map(([key, [, text, source]]) => `    ${key}: ${text},`
  + ` // ${source === 'REAL' ? 'REAL' : `COPIED from ${like.id}`}`);
const size = want.size;
const realSize = size ? `  // ${want.real}\n  '${want.id}': { len: ${size.len}, wid: ${size.wid}, `
  + `lf: ${+(size.wheelbase * (1 - size.frontShare)).toFixed(3)}, lr: `
  + `${+(size.wheelbase * size.frontShare).toFixed(3)}, trackWidth: ${size.trackWidth} },`
  : '  // (no size given: no REAL_SIZE line; the car is drawn at its roster shape)';
const figures = want.figures || {};
const draft = `// DRAFT for ${want.id} (tools/newcarstart.mjs): ${want.real}, from ${like.id}.\n`
  + `// Paste into the places named, behind the car's own switch; then node tools/newcar.mjs `
  + `${want.id}.\n// The fields marked COPIED are the nearest car's: adjust each for the real car.\n\n`
  + `// src/cars.ts ROSTER:\n  {\n    // ${want.real}\n${lines.join('\n')}\n  },\n\n`
  + `// src/carreal.ts REAL_SIZE:\n${realSize}\n\n// tools/lib/realfigures.mjs REAL_FIGURES:\n`
  + `  '${want.id}': { real: ${sourceOf(want.real)}, topKph: ${figures.topKph ?? null}, `
  + `zeroTo100: ${figures.zeroTo100 ?? null}${want.note ? `, note: ${sourceOf(want.note)}`
    : ''} },\n`;
const out = `shots/newcar/${want.id}`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/draft.ts`, draft);
const sources = [...fields.values()].map(([, , source]) => source);
console.log(draft);
console.log(`newcarstart ${want.id}: ${sources.filter((source) => source === 'REAL').length} fields `
  + `REAL, ${sources.filter((source) => source === 'COPIED').length} COPIED from ${like.id} -> `
  + `${out}/draft.ts`);
