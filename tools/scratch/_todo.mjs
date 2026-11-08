import fs from 'node:fs';
let s = fs.readFileSync('TODO.md', 'utf8');
const old = `UNDER TEST: the K13 realism dials ?realbrake ?reallock ?realgrip
  ?realpower (realism.ts, 0 = now, 1 = real; my picks 1 / 1 / 0.5 / 1, owner "ok"). On the
  owner's values: write them into the roster, delete realism.ts, re-run carstats. Then K12.`;
if (!s.includes(old)) throw new Error('todo');
s = s.replace(old, `DEFAULT 11-02 (owner: "all test passed"): the K13
  realism dials at brake 1, lock 1, grip 0.5, power 1 written into the roster (cars.ts: real
  torque curves, real drag, front brake share 0.65 / single-seaters 0.60, mu halfway to real;
  wheelspin.ts LOCK_SHARE 0.70; realism.ts deleted; carstats re-measured, the same as the dials
  measured: hatch 0-100 6.8 s, muscle 5.8 / 265 km/h, Mini 9.9 / 171); pedalramp (throttle 1.5 s,
  brake 1.0 s), lockfade, spinmarks, smokefade (+ the burnout round), dustlinger, musclegears;
  flatsize (11-02, earlier). Then the owner's round of 11-02 evening (see K21-K27), then K12.`);
fs.writeFileSync('TODO.md', s);
