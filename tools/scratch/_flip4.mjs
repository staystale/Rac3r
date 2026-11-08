import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/physics/wheelspin.ts', `// LOCK FADE (passed 11-02): rubber sliding on tarmac grips less the faster it slides (it skates on its own
// melt): a locked`, `// LOCK FADE (passed 11-02): rubber sliding on tarmac grips less the faster it slides (it
// skates on its own melt): a locked`);
sub('src/render/particles.ts', `// SMOKE STRENGTH (passed 11-02; owner: smoke "should perhaps have its amount and opacity controlled by speed /
// tyre heat"; with`, `// SMOKE STRENGTH (passed 11-02; owner: smoke "should perhaps have its amount and opacity
// controlled by speed / tyre heat"; with`);
