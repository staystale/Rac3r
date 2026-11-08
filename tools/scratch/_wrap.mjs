import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/physics/tyreheat.ts', `// HEAT EASE (passed 11-02; owner: "tyres maybe heat up a tiny bit too easily"): slip and flex heat x
// HEAT_EASE; cooling as before`, `// HEAT EASE (passed 11-02; owner: "tyres maybe heat up a tiny bit too easily"): slip and flex
// heat x HEAT_EASE; cooling as before`);
sub('src/render/particles.ts', `// SMOKE OVER (passed 11-02; owner: "can some of the tyre smoke go over the players car"): this share of the
// smoke puffs drift`, `// SMOKE OVER (passed 11-02; owner: "can some of the tyre smoke go over the players car"): this
// share of the smoke puffs drift`);
sub('src/world/surfaces.ts', `// 0.55-0.85 s. Life x2.5, rate x1.3, bloom x1.5 on all three. Smoke over (passed 11-02; owner: "can some of
// the tyre smoke`, `// 0.55-0.85 s. Life x2.5, rate x1.3, bloom x1.5 on all three. Smoke over (passed 11-02; owner:
// "can some of the tyre smoke`);
