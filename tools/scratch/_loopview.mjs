import fs from 'node:fs';
const p = 'src/game/loop.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error(a); s = s.split(a).join(b); };
r('    shared.renderer.frame(game, frame.wallDt, frame.now / 1000);',
  '    shared.renderer.frame(game as unknown as RenderGame, frame.wallDt, frame.now / 1000);');
r('      shared.hud.draw(shared.renderer.ctx, game, shared.renderer.W, shared.renderer.H,',
  '      shared.hud.draw(shared.renderer.ctx, game as unknown as HudGame, shared.renderer.W,\n        shared.renderer.H,');
r("import type { CarInput } from '../vehicle.ts';",
  "import type { CarInput } from '../vehicle.ts';\n"
  + "// (cast: the renderer's and the HUD's car shapes are narrower than the traffic's and the\n"
  + "// highway flow's - one car type is TODO.md work)\n"
  + "import type { RenderGame } from '../render/types.ts';\nimport type { HudGame } from '../hud/hudtypes.ts';");
fs.writeFileSync(p, s);
console.log('ok');
