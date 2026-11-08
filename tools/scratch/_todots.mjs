import fs from 'node:fs';
const p = 'TODO.md';
let s = fs.readFileSync(p, 'utf8');
const a = s.indexOf('   LEFT (6 files... see below; the highway was DONE 11-03)');
const b = s.indexOf('   FOUND on the way (behaviour kept, for the owner)');
if (a < 0 || b < 0) throw new Error('block');
s = s.slice(0, a) + `   11-03: marks, stagegen, then the GAME FLOW (state, grid, controls, rules, order, ai, loop,
   menuflow, session, sim) + main.ts - DONE: src/ is all TypeScript (no .js left). game/state.ts
   types the Game and the shared variables; proved simhash SAME, worldhash SAME, renderhash SAME
   (test-track / knobhill / highway), menucheck / inputcheck / settingscheck / uicheck /
   bundlecheck ok. One system on the way: one tape Streamer type (vehicle.ts; was three).
   LEFT for the types (not behaviour): two Surface types (cars.ts, world/types.ts) and the
   renderer's / HUD's car shapes are narrower than the traffic's and the highway flow's - loop.ts
   hands them the game with a cast. One car type later.
` + s.slice(b);
s = s.replace('- TYPESCRIPT CONVERSION: ON HOLD (owner 10-25); new code is TypeScript, old .js converted later.',
  '- TYPESCRIPT CONVERSION: DONE 11-03 (src/ is all TypeScript; Queue 2).');
fs.writeFileSync(p, s);
console.log('ok');
