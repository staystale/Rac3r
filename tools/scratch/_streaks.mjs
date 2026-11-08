import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const P = 'src/render/particles.ts';
sub(P, `  overPuffs: Puff[];
  // WHEEL SPRAY`, `  overPuffs: Puff[];
  // AIR STREAKS along the player's car in a tow (?towplus), and their fractional remainder
  streaks: Streak[];
  streakDebt: number;
  // WHEEL SPRAY`);
sub(P, `// the mutable values the particle layer keeps between frames`, `// one air streak: where its head is, how it drifts, its age and length (m), the car's heading
interface Streak { x: number; y: number; vx: number; vy: number; age: number; life: number;
  len: number; heading: number }

// the mutable values the particle layer keeps between frames`);
sub(P, `  const state: ParticleState = { puffs: [], overPuffs: [], sprayDebt: 0, smokeDebt: 0,`,
`  const state: ParticleState = { puffs: [], overPuffs: [], streaks: [], streakDebt: 0,
    sprayDebt: 0, smokeDebt: 0,`);
sub(P, `    drawOverPuffs: (wallDt: number) => renderPuffs(ctx, wallDt, state.overPuffs),`,
`    drawOverPuffs: (wallDt: number) => {
      renderPuffs(ctx, wallDt, state.overPuffs);
      renderStreaks(ctx, wallDt);
    },
    addTowLines: (car: TowCar, wallDt: number) => emitStreaks(ctx, car, wallDt),`);
sub(P, `/**
 * Build the particle layer.`, `// THE TOW CUE (?towplus, physics/wake.ts 4): thin pale streaks flow back along the player's car
// while it is in another's wake, more of them the stronger the tow (STREAK_RATE a second at the
// full DRAFT cut); the air is still, so they drift at a share of the car's speed and fall behind.
const STREAK_RATE = 26, STREAK_FULL_CUT = 0.45, STREAK_FROM = 0.06, STREAK_LIFE = 0.32;
const STREAK_LEN = 1.6, STREAK_DRIFT = 0.55, STREAK_ALPHA = 0.45, MAX_STREAKS = 40;
/** What the streaks read of a car. */
interface TowCar { x: number; y: number; vx: number; vy: number; heading: number;
  spec: { len: number; wid: number }; dragMul?: number }

/**
 * Emit this frame's air streaks for a car in a tow.
 * @param ctx particle context
 * @param car the player's car
 * @param wallDt wall-clock frame time
 */
function emitStreaks(ctx: ParticleCtx, car: TowCar, wallDt: number) {
  const state = ctx.state, cut = 1 - (car.dragMul ?? 1);
  if (cut < STREAK_FROM) { state.streakDebt = 0; return; }
  state.streakDebt += STREAK_RATE * Math.min(1, cut / STREAK_FULL_CUT) * wallDt;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  while (state.streakDebt >= 1) {
    state.streakDebt--;
    const along = (fxRandom() - 0.3) * car.spec.len;
    const side = (fxRandom() < 0.5 ? -1 : 1) * (car.spec.wid / 2 + 0.15 + fxRandom() * 0.5);
    if (state.streaks.length >= MAX_STREAKS) state.streaks.shift();
    state.streaks.push({ x: car.x + cosH * along - sinH * side, y: car.y + sinH * along + cosH
      * side, vx: car.vx * STREAK_DRIFT, vy: car.vy * STREAK_DRIFT, age: 0,
      life: STREAK_LIFE * (0.7 + fxRandom() * 0.6), len: STREAK_LEN * (0.6 + fxRandom() * 0.8),
      heading: car.heading });
  }
}

/**
 * Draw (and age) the air streaks: one-art-pixel pale lines, fading out.
 * @param ctx particle context
 * @param wallDt wall-clock frame time
 */
function renderStreaks(ctx: ParticleCtx, wallDt: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx, streaks = ctx.state.streaks;
  if (!streaks.length) return;
  const ppm = PPMz(), dpr = view.dpr;
  view.ctx.save();
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  view.ctx.strokeStyle = '#f4f6fa';
  view.ctx.lineWidth = Math.max(1, Math.round(dpr));
  for (let i = streaks.length - 1; i >= 0; i--) {
    const streak = streaks[i];
    streak.age += wallDt;
    if (streak.age >= streak.life) { streaks.splice(i, 1); continue; }
    streak.x += streak.vx * wallDt; streak.y += streak.vy * wallDt;
    view.ctx.globalAlpha = STREAK_ALPHA * (1 - streak.age / streak.life);
    const headX = Math.round(toScreenX(streak.x) * dpr), headY = Math.round(toScreenY(streak.y) * dpr);
    const back = streak.len * ppm * dpr;
    view.ctx.beginPath();
    view.ctx.moveTo(headX, headY);
    view.ctx.lineTo(Math.round(headX - Math.cos(streak.heading) * back),
      Math.round(headY - Math.sin(streak.heading) * back));
    view.ctx.stroke();
  }
  view.ctx.restore();
}

/**
 * Build the particle layer.`);
sub('src/render.ts', `  ctx.addSmoke(game.car, game.marks, wallDt);`, `  ctx.addSmoke(game.car, game.marks, wallDt);
  if (FIX.towPlus) ctx.addTowLines(game.car, wallDt);   // the tow cue (physics/wake.ts)`);
let r = fs.readFileSync('src/render.ts', 'utf8');
if (!r.includes("core/fixes.ts")) {
  r = r.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { FIX } from './core/fixes.ts';\n`);
  fs.writeFileSync('src/render.ts', r);
}
console.log('ok');
