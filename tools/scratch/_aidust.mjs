import fs from 'node:fs';
function sub(path, a, b) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  fs.writeFileSync(path, s.replace(a, () => b));
}
sub('src/core/fixes.ts', `  jokerHint: atLoad('jokerhint'),`, `  jokerHint: atLoad('jokerhint'),
  // ?aidust=1: AI cars near you throw tyre smoke, dust and spray too (render.ts, particles.ts)
  aiDust: atLoad('aidust'),`);
const P = 'src/render/particles.ts';
sub(P, `  sprayDebt: number;
  smokeDebt: number;`, `  sprayDebt: number;
  smokeDebt: number;
  // ?aidust: each car's own fractional remainders (several cars throw now)
  carDebts: Map<object, [number, number]>;`);
sub(P, `    sprayDebt: 0, smokeDebt: 0,`, `    sprayDebt: 0, smokeDebt: 0, carDebts: new Map(),`);
sub(P, `    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitSpray(ctx, car, marks, wallDt),
    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      emitTyreSmoke(ctx, car, marks, wallDt),`, `    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      withCarDebts(state, car, () => emitSpray(ctx, car, marks, wallDt)),
    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>
      withCarDebts(state, car, () => emitTyreSmoke(ctx, car, marks, wallDt)),`);
sub(P, `/**
 * Build the particle layer.`, `/**
 * Runs an emitter with this car's own spray / smoke remainders (?aidust: several cars throw, and
 * one shared remainder would hand one car's half-puff to the next); without the switch, as before.
 * @param state the particle state
 * @param car the car
 * @param emit the emitter
 */
function withCarDebts(state: ParticleState, car: object, emit: () => void): void {
  if (!FIX.aiDust) { emit(); return; }
  const debts = state.carDebts.get(car) || [0, 0];
  [state.sprayDebt, state.smokeDebt] = debts;
  emit();
  state.carDebts.set(car, [state.sprayDebt, state.smokeDebt]);
}

/**
 * Build the particle layer.`);
const R = 'src/render.ts';
sub(R, `  ctx.addSmoke(game.car, game.marks, wallDt);`, `  ctx.addSmoke(game.car, game.marks, wallDt);
  // ?aidust=1 (owner 11-03: "yes" - AI cars throw no smoke or dust): the AI cars near you too
  if (FIX.aiDust) {
    for (const rival of game.ai || []) {
      const car = rival.car;
      if (Math.abs(car.x - game.car.x) > AI_DUST_M || Math.abs(car.y - game.car.y) > AI_DUST_M) continue;
      ctx.addSpray(car, game.marks, wallDt);
      ctx.addSmoke(car, game.marks, wallDt);
    }
  }`);
let r = fs.readFileSync(R, 'utf8');
if (!r.includes("core/fixes.ts")) {
  r = r.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { FIX } from './core/fixes.ts';\n`);
}
r = r.replace(/(\nfunction drawEffects\()/, `\n// m from the player's car: the AI cars that throw smoke and dust (?aidust; off screen beyond)
const AI_DUST_M = 90;
$1`);
fs.writeFileSync(R, r);
console.log('ok');
