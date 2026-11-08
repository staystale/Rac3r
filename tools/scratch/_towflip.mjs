import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const P = 'src/render/particles.ts';
sub(P, `// THE TOW CUE (?towplus, physics/wake.ts 4): thin pale streaks flow back along the player's car
// while it is in another's wake, more of them the stronger the tow (STREAK_RATE a second at the
// full DRAFT cut); the air is still, so they drift at a share of the car's speed and fall behind.
const STREAK_RATE = 26, STREAK_FULL_CUT = 0.45, STREAK_FROM = 0.06, STREAK_LIFE = 0.32;
const STREAK_LEN = 1.6, STREAK_DRIFT = 0.55, STREAK_ALPHA = 0.45, MAX_STREAKS = 40;`,
`// THE TOW CUE (physics/wake.ts 4): thin pale streaks flow back along any racer in another's wake
// (the AI in yours too: owner "it should show on ai cars when they are slipstreaming you"); the
// air is still, so they drift at a share of the car's speed and fall behind. Round 2 (owner: "some
// shorter some longer and more see thru with distance and less lines, more and less see thru
// closer to the lead car"): the tow's strength (its cut over STREAK_FULL_CUT) sets how many
// (STREAK_RATE x strength^1.5 a second) and how solid (STREAK_ALPHA_FAR .. _NEAR); lengths run
// STREAK_LEN x 0.3 .. 1.7.
const STREAK_RATE = 30, STREAK_FULL_CUT = 0.4, STREAK_FROM = 0.05, STREAK_LIFE = 0.32;
const STREAK_LEN = 1.6, STREAK_DRIFT = 0.55, MAX_STREAKS = 90;
const STREAK_ALPHA_FAR = 0.1, STREAK_ALPHA_NEAR = 0.55;`);
sub(P, ` * Emit this frame's air streaks for a car in a tow.
 * @param ctx particle context
 * @param car the player's car`, ` * Emit this frame's air streaks for a car in a tow.
 * @param ctx particle context
 * @param car a racer`);
sub(P, `  if (cut < STREAK_FROM) { state.streakDebt = 0; return; }
  state.streakDebt += STREAK_RATE * Math.min(1, cut / STREAK_FULL_CUT) * wallDt;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  while (state.streakDebt >= 1) {
    state.streakDebt--;`, `  if (cut < STREAK_FROM) { state.streakDebt.delete(car); return; }
  const strength = Math.min(1, cut / STREAK_FULL_CUT);
  let debt = (state.streakDebt.get(car) || 0) + STREAK_RATE * strength ** 1.5 * wallDt;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const alpha = STREAK_ALPHA_FAR + (STREAK_ALPHA_NEAR - STREAK_ALPHA_FAR) * strength;
  for (; debt >= 1; debt--) {`);
sub(P, `      life: STREAK_LIFE * (0.7 + fxRandom() * 0.6), len: STREAK_LEN * (0.6 + fxRandom() * 0.8),
      heading: car.heading });
  }
}`, `      life: STREAK_LIFE * (0.7 + fxRandom() * 0.6), len: STREAK_LEN * (0.3 + fxRandom() * 1.4),
      heading: car.heading, alpha });
  }
  state.streakDebt.set(car, debt);
}`);
sub(P, `    view.ctx.globalAlpha = STREAK_ALPHA * (1 - streak.age / streak.life);`, `    view.ctx.globalAlpha = streak.alpha * (1 - streak.age / streak.life);`);
sub(P, `  len: number; heading: number }`, `  len: number; heading: number; alpha: number }`);
sub(P, `  // AIR STREAKS along the player's car in a tow (?towplus), and their fractional remainder
  streaks: Streak[];
  streakDebt: number;`, `  // AIR STREAKS along the racers in a tow, and each car's fractional remainder
  streaks: Streak[];
  streakDebt: Map<object, number>;`);
sub(P, `streaks: [], streakDebt: 0,`, `streaks: [], streakDebt: new Map(),`);
const R = 'src/render.ts';
sub(R, `  if (FIX.towPlus) ctx.addTowLines(game.car, wallDt);   // the tow cue (physics/wake.ts)
`, '');
sub(R, `    ctx.addEngineSmoke(car, wallDt);
    ctx.addChips(car);`, `    ctx.addEngineSmoke(car, wallDt);
    ctx.addTowLines(car, wallDt);   // the tow cue (physics/wake.ts)
    ctx.addChips(car);`);
sub(R, `import { FIX } from './core/fixes.ts';\n`, '');
// physics flip
const S = 'src/game/sim.js';
sub(S, `    if (game.ai.length) (FIX.towPlus ? wakeStep : slipstream)(racers);`, `    if (game.ai.length) wakeStep(racers);`);
sub(S, `import { carContacts, slipstream } from '../contact.js';`, `import { carContacts } from '../contact.js';`);
sub(S, `import { FIX } from '../core/fixes.ts';\n`, '');
let c = fs.readFileSync('src/contact.js', 'utf8');
const i = c.indexOf('// SLIPSTREAM (AI stage 3)'), j = c.indexOf('    car.dragMul = 1 - cut;\n  }\n}', i);
if (i < 0 || j < 0) throw new Error('contact');
c = c.slice(0, i).replace(/\n+$/, '\n') + c.slice(j + '    car.dragMul = 1 - cut;\n  }\n}'.length);
fs.writeFileSync('src/contact.js', c);
const W = 'src/physics/wake.ts';
sub(W, `// physics/wake.ts - THE WAKE (?towplus=1; owner 11-02, "you can do 1-4 behind a single switch":
// the slipstream ideas). Replaces contact.js slipstream under the switch and keeps its tow (a car`,
`// physics/wake.ts - THE WAKE (towplus, passed 11-02; owner: "you can do 1-4 behind a single
// switch": the slipstream ideas). Replaced contact.js slipstream (AI stage 3) and keeps its tow (a car`);
sub('src/physics/loads.ts', `(physics/wake.ts, ?towplus)`, `(physics/wake.ts)`);
sub('src/ai/racecraft.ts', `(contact.js slipstream)`, `(physics/wake.ts)`);
sub('src/ai/types.ts', `// contact.js: the slipstream (1 = no tow)`, `// physics/wake.ts: the tow (1 = no tow)`);
sub('src/vehicle.ts', `// set by contact.js (the slipstream)`, `// set by physics/wake.ts (the tow)`);
sub('src/vehicle.ts', `// dragMul: the slipstream (contact.js), 1 when alone`, `// dragMul: the tow (physics/wake.ts), 1 when alone`);
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
f = f.replace(/export const FIX = \{[\s\S]*?\n\};/, 'export const FIX = {\n};');
f = f.replace('heatease, flatgrip passed 11-02.)', 'heatease, flatgrip, towplus passed 11-02.)');
fs.writeFileSync('src/core/fixes.ts', f);
let t = fs.readFileSync('src/testlist.js', 'utf8');
t = t.replace(/\n  \{\n    id: 'towplus'[\s\S]*?\n  \},/, '');
t = t.replace('curve + reach at speed) passed 2026-11-02, kept as player settings)', 'curve + reach at speed) passed 2026-11-02, kept as player settings; towplus (the wake)\n  // passed 2026-11-02)');
fs.writeFileSync('src/testlist.js', t);
console.log('ok');
