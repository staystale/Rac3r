import fs from 'node:fs';
let s = fs.readFileSync('TODO.md', 'utf8');
const a = '  GARAGE SPEC SHEET + tyre health under test. UNDER TEST: ?smokelinger. THEN (owner 11-03): the\n';
const b = '  (the Mini\'s 10-inch wheels with it). Then K12.\n';
const i = s.indexOf(a), j = s.indexOf(b);
if (i < 0 || j < 0) throw new Error('block');
s = s.slice(0, i) + `  GARAGE SPEC SHEET + tyre health under test. TYPESCRIPT CONVERSION DONE 11-03 (src/ is all
  TypeScript). DEFAULT 11-03 (owner: pass): smokelinger (smoke hangs, dust cannot evict it),
  aidust (AI cars near you throw smoke / dust / spray). UNDER TEST: ?jokerhint, ?realcars (REAL
  CARS, owner "anything real is fine": each car on its real counterpart - weight, engine from the
  maker's peak torque / power, gears, tyre size, 0.5 rho Cd A - and a name close to the real one;
  realcars.ts, its own measured garage table src/carstatsreal.ts; carstats REALCARS=1 measured
  most within ~5 % of the real top speed / 0-100; the Muscle runs 0-100 in 4.5 s, real ~6.5 -
  its tyres grip too well off the line). More vehicles later (owner). Then K12.
` + s.slice(j + b.length);
fs.writeFileSync('TODO.md', s);
console.log('ok');
