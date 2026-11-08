import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/input.js', '// ?pedalramp=1: 0.75 -> 1.5 (owner: "increase the throttle and brake control ramp timing")\nconst THR_RAMP = FIX.pedalRamp ? 1.5 : 0.75;',
  '// 0.75 -> 1.5 (owner 11-02: "increase the throttle and brake control ramp timing"; passed)\nconst THR_RAMP = 1.5;');
sub('src/input.js', '// ?pedalramp=1: 0.25 -> 1.0 (the same ask: holding brakes harder and harder, not a stamp)\nconst BRAKE_RAMP = FIX.pedalRamp ? 1.0 : 0.25;',
  '// 0.25 -> 1.0 (the same ask: holding brakes harder and harder, not a stamp; passed 11-02)\nconst BRAKE_RAMP = 1.0;');
sub('src/physics/tyreheat.ts', '// SPIN HEAT (?spinmarks=1;', '// SPIN HEAT (passed 11-02;');
sub('src/physics/tyreheat.ts', "/** Whether an axle's tyres take the lock / spin heat (?spinmarks adds spinning). */\nconst hotScrub = (axleState: AxleForce, locked: boolean) =>\n  locked || (FIX.spinMarks && axleState.spinning);",
  "/** Whether an axle's tyres take the lock / spin heat: locked or spinning. */\nconst hotScrub = (axleState: AxleForce, locked: boolean) => locked || axleState.spinning;");
sub('src/physics/tyreheat.ts', 'const sat = FIX.spinMarks && axleState.spinning ? SPIN_SAT', 'const sat = axleState.spinning ? SPIN_SAT');
sub('src/marks.js', "  // ?spinmarks=1: a cold tyre slipping still lays rubber, COLD_MARK of a warm one's at most\n  const warm = loose ? 1 : FIX.spinMarks ? COLD_MARK + (1 - COLD_MARK) * heatShare : heatShare;",
  "  // a cold tyre slipping still lays rubber, COLD_MARK of a warm one's at most\n  const warm = loose ? 1 : COLD_MARK + (1 - COLD_MARK) * heatShare;");
sub('src/render/particles.ts', '// ?dustlinger=1: room for the longer dust trails\nconst MAX_PUFFS = FIX.dustLinger ? 320 : 220;', '// 220 -> 320: room for the long dust trails (11-02)\nconst MAX_PUFFS = 320;');
sub('src/render/particles.ts', '// ?smokefade=1 (owner:', '// SMOKE STRENGTH (passed 11-02; owner:');
sub('src/render/particles.ts', `    const strength = FIX.smokeFade ? smokeStrength(wheel.heat, wheel.slip) : 0;
    state.smokeDebt += FIX.smokeFade ? strength * SMOKE_RATE * wallDt
      : Math.min(1, (wheel.heat - SMOKE_T) / 40 + 0.3) * Math.min(1, wheel.slip / 6) * 40 * wallDt;
    while (state.smokeDebt >= 1) { state.smokeDebt--;
      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5);
      if (FIX.smokeFade) {
        const puff = state.puffs[state.puffs.length - 1];
        puff.alpha = SMOKE_ALPHA_MIN + (1 - SMOKE_ALPHA_MIN) * strength;
        puff.life *= 1 + SMOKE_LINGER * strength;
      } }`, `    const strength = smokeStrength(wheel.heat, wheel.slip);
    state.smokeDebt += strength * SMOKE_RATE * wallDt;
    while (state.smokeDebt >= 1) { state.smokeDebt--;
      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5);
      const puff = state.puffs[state.puffs.length - 1];
      puff.alpha = SMOKE_ALPHA_MIN + (1 - SMOKE_ALPHA_MIN) * strength;
      puff.life *= 1 + SMOKE_LINGER * strength;
    }`);
let s = fs.readFileSync('src/world/surfaces.ts', 'utf8');
const i = s.indexOf('// ?dustlinger=1 (owner:'), j = s.indexOf('const SPRAY_GRAVEL');
s = s.slice(0, i) + `// DUST (passed 11-02; owner: "sand and gravels dust linger longer / be slightly more of it like
// real life"): real dry dust hangs for seconds in a long trail; gravel, dirt and sand were gone in
// 0.55-0.85 s. Life x2.5, rate x1.3, bloom x1.5 on all three.
` + s.slice(j);
const rep = (a, b) => { if (!s.includes(a)) throw new Error('surf ' + a); s = s.replace(a, b); };
rep("const SPRAY_GRAVEL: Spray = dust({ rgb: '222,210,184', size: 0.22, rate: 62, lift: 5.2,\n  life: 0.55, grow: 0.60 });",
  "const SPRAY_GRAVEL: Spray = { rgb: '222,210,184', size: 0.22, rate: 81, lift: 5.2, life: 1.38,\n  grow: 0.90 };");
rep("const SPRAY_DIRT:   Spray = dust({ rgb: '190,160,122', size: 0.22, rate: 66, lift: 4.8,\n  life: 0.60, grow: 0.70 });",
  "const SPRAY_DIRT:   Spray = { rgb: '190,160,122', size: 0.22, rate: 86, lift: 4.8, life: 1.50,\n  grow: 1.05 };");
rep("const SPRAY_SAND:   Spray = dust({ rgb: '244,230,200', size: 0.20, rate: 70, lift: 3.8,\n  life: 0.85, grow: 0.95 });",
  "const SPRAY_SAND:   Spray = { rgb: '244,230,200', size: 0.20, rate: 91, lift: 3.8, life: 2.13,\n  grow: 1.43 };");
if (s.includes('dust(')) throw new Error('dust left');
rep('import { FIX } from "../core/fixes.ts";\n', '');
fs.writeFileSync('src/world/surfaces.ts', s);
sub('src/physics/wheelspin.ts', '  const sgLong = FIX.lockFade ? law.sgLong * slideFade(wheelU - law.vx) : law.sgLong;', '  const sgLong = law.sgLong * slideFade(wheelU - law.vx);');
console.log('ok');
