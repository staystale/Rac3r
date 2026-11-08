import fs from 'node:fs';
function sub(path, old, nu) {
  const s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/core/fixes.ts', `  aiCool: atLoad('aicool'),
};`, `  aiCool: atLoad('aicool'),
  // ?smokeearly=1: tyre smoke from ~60 C, faint and sparse when cool, thick when hot
  smokeEarly: atLoad('smokeearly'),
  // ?airfx=1: puffs spread with age, drift on a gentle wind, are stirred by passing cars
  // (render/airflow.ts)
  airFx: atLoad('airfx'),
};`);
sub('src/render/types.ts', `  alpha?: number;   // opacity share (1 when absent): tyre smoke under ?smokefade`,
`  alpha?: number;   // opacity share (1 when absent): tyre smoke
  air?: number;   // how airborne, 0.15..1 (render/airflow.ts, ?airfx)`);
const P = 'src/render/particles.ts';
sub(P, `import type { Spray } from "../world/types.ts";`, `import type { Spray } from "../world/types.ts";
import { FIX } from '../core/fixes.ts';
import { airMove, airOf, windNow, type AirCar } from './airflow.ts';`);
sub(P, `    grow: spray.grow, rgb: spray.rgb,
    // thrown BACKWARDS`, `    grow: spray.grow, rgb: spray.rgb, air: airOf(spray),
    // thrown BACKWARDS`);
sub(P, `    puff.x += puff.vx * wallDt; puff.y += puff.vy * wallDt;
    // air drag: clods slow and settle
    puff.vx *= 1 - 2.6 * wallDt; puff.vy *= 1 - 2.6 * wallDt;`, `    puff.x += puff.vx * wallDt; puff.y += puff.vy * wallDt;
    // the air (?airfx: spread, wind, the cars' stir - render/airflow.ts), else plain drag: clods
    // slow and settle
    if (air) airMove(puff, wallDt, air, ctx.state.airCars, fxRandom);
    else { puff.vx *= 1 - 2.6 * wallDt; puff.vy *= 1 - 2.6 * wallDt; }`);
sub(P, `  const ppm = PPMz();
  for (let i = puffs.length - 1; i >= 0; i--) {
    const puff = puffs[i];`, `  const ppm = PPMz();
  const air = FIX.airFx ? windNow(puffs === ctx.state.puffs ? wallDt : 0) : null;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const puff = puffs[i];`);
sub(P, `  // AIR STREAKS along the racers in a tow`, `  // the cars stirring the air this frame (?airfx, render/airflow.ts)
  airCars: AirCar[];
  // AIR STREAKS along the racers in a tow`);
sub(P, `streaks: [], streakDebt: new Map(),`, `streaks: [], streakDebt: new Map(), airCars: [],`);
sub(P, `    addTowLines: (car: TowCar, wallDt: number) => emitStreaks(ctx, car, wallDt),`,
`    addTowLines: (car: TowCar, wallDt: number) => emitStreaks(ctx, car, wallDt),
    setAirCars: (cars: AirCar[]) => { state.airCars = cars; },`);
sub(P, `function smokeStrength(heat: number, slip: number): number {
  const heatK = SMOKE_HEAT_MIN + (1 - SMOKE_HEAT_MIN)
    * Math.min(1, (heat - SMOKE_T) / SMOKE_HEAT_SPAN);`, `function smokeStrength(heat: number, slip: number): number {
  const heatK = FIX.smokeEarly ? Math.min(1, Math.max(0, (heat - SMOKE_T_EARLY)
      / (SMOKE_T_FULL - SMOKE_T_EARLY))) ** SMOKE_EARLY_POW
    : SMOKE_HEAT_MIN + (1 - SMOKE_HEAT_MIN) * Math.min(1, (heat - SMOKE_T) / SMOKE_HEAT_SPAN);`);
sub(P, `const SMOKE_RATE = 38, SMOKE_ALPHA_MIN = 0.25, SMOKE_LINGER = 0.6;`, `const SMOKE_RATE = 38, SMOKE_ALPHA_MIN = 0.25, SMOKE_LINGER = 0.6;
// ?smokeearly=1 (owner: "can tyre smoke begin more progressively so less smoke and less opaque
// when tyres cooler but starting earlier, rather than only at like 110 C plus"): smoke from
// SMOKE_T_EARLY, its heat share rising as a curve (SMOKE_EARLY_POW) to full at SMOKE_T_FULL, the
// faintest puff SMOKE_ALPHA_EARLY: a hard slide at 80 C ~7 % of full, 110 C ~36 %, 140 C ~67 %.
const SMOKE_T_EARLY = 60, SMOKE_T_FULL = 165, SMOKE_EARLY_POW = 1.6, SMOKE_ALPHA_EARLY = 0.08;`);
sub(P, `    if (wheel.heat < SMOKE_T || wheel.slip < 1.5) continue;`,
`    if (wheel.heat < (FIX.smokeEarly ? SMOKE_T_EARLY : SMOKE_T) || wheel.slip < 1.5) continue;`);
sub(P, `      puff.alpha = SMOKE_ALPHA_MIN + (1 - SMOKE_ALPHA_MIN) * strength;`,
`      const alphaMin = FIX.smokeEarly ? SMOKE_ALPHA_EARLY : SMOKE_ALPHA_MIN;
      puff.alpha = alphaMin + (1 - alphaMin) * strength;`);
const R = 'src/render.ts';
sub(R, `  for (const car of [
    game.car,
    ...(game.ai || []).map((rival) => rival.car),`, `  const effectCars = [
    game.car,
    ...(game.ai || []).map((rival) => rival.car),`);
let r = fs.readFileSync(R, 'utf8');
const k = r.indexOf('  const effectCars = [');
const end = r.indexOf('  ]) {', k);
if (end < 0) throw new Error('render loop');
r = r.slice(0, end) + '  ];\n  ctx.setAirCars(effectCars);   // the cars stirring the air (render/airflow.ts)\n'
  + '  for (const car of effectCars) {' + r.slice(end + '  ]) {'.length);
fs.writeFileSync(R, r);
console.log('ok');
