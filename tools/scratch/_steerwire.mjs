import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const I = 'src/input.js';
let s = fs.readFileSync(I, 'utf8');
// add import after the first import line block
s = s.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { curveSteer, stickReach } from './core/steerfeel.ts';\n`);
fs.writeFileSync(I, s);
sub(I, `    const dx = state.stick.x - state.stick.ox;
    state.steer = Math.max(-1, Math.min(1, dx / STICK_MAX));`, `    const dx = state.stick.x - state.stick.ox;
    // the player's steering feel (core/steerfeel.ts): the reach grows with speed, then the curve
    state.stickReach = stickReach(STICK_MAX, state.speed || 0);
    state.steer = curveSteer(Math.max(-1, Math.min(1, dx / state.stickReach)));`);
sub(I, `    stick: { active: false, ox: 0, oy: 0, x: 0, y: 0 },`, `    stick: { active: false, ox: 0, oy: 0, x: 0, y: 0 },
    speed: 0,                         // the player car's speed, m/s (sim.js): the stick's reach
    stickReach: STICK_MAX,            // px of thumb for full lock this frame (steerfeel.ts)`);
sub('src/game/sim.js', `  let inp = shared.input.update(wallDt);`, `  // the stick's reach follows the car's speed (core/steerfeel.ts THROW)
  if (game.car) shared.input.speed = Math.hypot(game.car.vx, game.car.vy);
  let inp = shared.input.update(wallDt);`);
const C = 'src/hud/controls.js';
sub(C, `      ctx.arc(stick.ox, stick.oy, 46, 0, Math.PI * 2);`, `      // the ring and the knob's travel follow the stick's reach (steerfeel.ts: longer at speed)
      const reach = game.input.stickReach || 38;
      ctx.arc(stick.ox, stick.oy, reach + 8, 0, Math.PI * 2);`);
sub(C, `      const dx = Math.max(-52, Math.min(52, stick.x - stick.ox));`, `      const dx = Math.max(-reach - 14, Math.min(reach + 14, stick.x - stick.ox));`);
console.log('ok');
