import fs from 'node:fs';
const P = 'src/render/particles.ts';
let s = fs.readFileSync(P, 'utf8');
const old = `      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5,
        overShare(state, SMOKE_OVER));
      const puff = state.puffs[state.puffs.length - 1];`;
if (!s.includes(old)) throw new Error('x');
s = s.replace(old, `      const pool = overShare(state, SMOKE_OVER);
      emitPuff(ctx, wheel.x, wheel.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5, pool);
      const puff = pool[pool.length - 1];`);
fs.writeFileSync(P, s);
