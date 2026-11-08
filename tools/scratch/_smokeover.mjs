import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/core/fixes.ts', `export const FIX = {
};`, `export const FIX = {
  // ?smokeover=1: some tyre smoke and gravel / dirt / sand dust drifts over the cars (particles.ts)
  smokeOver: atLoad('smokeover'),
};`);
sub('src/world/types.ts', `  life: number;
  grow: number;
}`, `  life: number;
  grow: number;
  over?: number;   // the share of its puffs drawn over the cars (?smokeover: fine dry dust)
}`);
const S = 'src/world/surfaces.ts';
sub(S, `// 0.55-0.85 s. Life x2.5, rate x1.3, bloom x1.5 on all three.
`, `// 0.55-0.85 s. Life x2.5, rate x1.3, bloom x1.5 on all three. ?smokeover=1 (owner: "can some of
// the tyre smoke go over the players car and same for sand / gravel / dirt dust"): DUST_OVER of
// their puffs drift over the cars (particles.ts emitSpray).
const DUST_OVER = 0.3;
`);
sub(S, `rate: 81, lift: 5.2, life: 1.38,
  grow: 0.90 };`, `rate: 81, lift: 5.2, life: 1.38,
  grow: 0.90, over: DUST_OVER };`);
sub(S, `rate: 86, lift: 4.8, life: 1.50,
  grow: 1.05 };`, `rate: 86, lift: 4.8, life: 1.50,
  grow: 1.05, over: DUST_OVER };`);
sub(S, `rate: 91, lift: 3.8, life: 2.13,
  grow: 1.43 };`, `rate: 91, lift: 3.8, life: 2.13,
  grow: 1.43, over: DUST_OVER };`);
const P = 'src/render/particles.ts';
sub(P, `import { emitEngineSmoke,`, `import { FIX } from '../core/fixes.ts';
import { emitEngineSmoke,`);
sub(P, `    if (wheel.spray) emitPuff(ctx, wheel.x, wheel.y, car.vx, car.vy, wheel.spray, 0.4 + work);`,
`    if (wheel.spray) {
      emitPuff(ctx, wheel.x, wheel.y, car.vx, car.vy, wheel.spray, 0.4 + work,
        overShare(state, wheel.spray.over));
    }`);
sub(P, `      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5);`,
`      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5,
        overShare(state, SMOKE_OVER));`);
sub(P, `const SMOKE_RATE = 38, SMOKE_ALPHA_MIN = 0.25, SMOKE_LINGER = 0.6;`,
`const SMOKE_RATE = 38, SMOKE_ALPHA_MIN = 0.25, SMOKE_LINGER = 0.6;
// ?smokeover=1 (owner: "can some of the tyre smoke go over the players car"): this share of the
// smoke puffs drift OVER the cars (the bonnet-steam pool), the rest under them as before
const SMOKE_OVER = 0.35;

/**
 * The pool a puff goes in: a share of them over the cars (?smokeover), else under them.
 * @param state the particle state
 * @param share the share over the cars (none: all under)
 * @returns the pool
 */
function overShare(state: ParticleState, share: number | undefined): Puff[] {
  return FIX.smokeOver && share && fxRandom() < share ? state.overPuffs : state.puffs;
}`);
