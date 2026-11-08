import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [
  ["  jokerHint: atLoad('jokerhint'),\n",
    "  jokerHint: atLoad('jokerhint'),\n"
    + '  // ?puffpool=1: a full puff pool lets go of the puffs off screen, then the AI\'s farthest from\n'
    + '  // you, before yours; twice the room (render/particles.ts)\n'
    + "  puffPool: atLoad('puffpool'),\n"],
]);
edit('src/render/types.ts', [
  ['  air?: number;   // how airborne, 0.15..1 (render/airflow.ts)\n}',
    '  air?: number;   // how airborne, 0.15..1 (render/airflow.ts)\n'
    + '  ai?: boolean;   // thrown by an AI car (?puffpool: let go of before yours)\n}'],
]);
edit('src/render.ts', [
  ['    ctx.addSpray(car, game.marks, wallDt);\n    ctx.addSmoke(car, game.marks, wallDt);\n  }',
    '    ctx.addSpray(car, game.marks, wallDt, true);\n    ctx.addSmoke(car, game.marks, wallDt, true);\n  }'],
]);
edit('src/render/particles.ts', [
  ['import { SPRITE_PPM, fxRandom } from "./shared.ts";',
    'import { SPRITE_PPM, fxRandom } from "./shared.ts";\nimport { FIX } from \'../core/fixes.ts\';'],
  ['  carDebts: Map<object, [number, number]>;\n',
    '  carDebts: Map<object, [number, number]>;\n'
    + '  // the car throwing now is an AI car (its puffs are let go of first: ?puffpool)\n'
    + '  aiThrowing: boolean;\n'],
  ['// 220 -> 320: room for the long dust trails (11-02)\nconst MAX_PUFFS = 320;',
    '// 220 -> 320: room for the long dust trails (11-02); ?puffpool: 640 (the AI cars throw too)\n'
    + 'const MAX_PUFFS = FIX.puffPool ? 640 : 320;'],
  ['  if (puffs.length >= MAX_PUFFS) dropOldest(puffs, spray.rgb);   // cap (§4)',
    '  if (puffs.length >= MAX_PUFFS) makeRoom(ctx, puffs, spray.rgb);   // cap (§4)'],
  ['    grow: spray.grow, rgb: spray.rgb, air: airOf(spray),\n',
    '    grow: spray.grow, rgb: spray.rgb, air: airOf(spray),\n'
    + '    ...(ctx.state.aiThrowing ? { ai: true } : {}),\n'],
  ['/**\n * Throw one puff into the pool, dropping the oldest when it is full.',
    '// ?puffpool=1 (owner 11-03: "dust / smoke trails still seem to vanish some times"). MEASURED\n'
    + '// (tools/scratch/_pool.mjs): since the AI cars near you throw too, their dust filled the pools\n'
    + '// and each new puff threw out one of YOURS before its time - 7 AI on gravel cut 68 % of your\n'
    + '// dust and 51 % of your smoke short, 3 on sand 61 % / 38 %. So a full pool lets go of the\n'
    + '// puff you would miss least: one off the screen (the farthest), else the AI\'s farthest from\n'
    + '// the camera, and only then the oldest of the new one\'s kind; and it has twice the room.\n'
    + '\n'
    + '/**\n'
    + ' * Make room in a full pool (?puffpool: off screen first, then the AI\'s, then the oldest).\n'
    + ' * @param ctx particle context (the camera and screen)\n'
    + ' * @param puffs the pool, oldest first\n'
    + ' * @param rgb the new puff\'s colour (its kind)\n'
    + ' */\n'
    + 'function makeRoom(ctx: ParticleCtx, puffs: Puff[], rgb: string): void {\n'
    + '  if (!FIX.puffPool) { dropOldest(puffs, rgb); return; }\n'
    + '  const { view, cam, toScreenX, toScreenY } = ctx, ppm = ctx.PPMz();\n'
    + '  let offAt = -1, offFar = -1, aiAt = -1, aiFar = -1;\n'
    + '  for (let i = 0; i < puffs.length; i++) {\n'
    + '    const puff = puffs[i], far = (puff.x - cam.x) ** 2 + (puff.y - cam.y) ** 2;\n'
    + '    const edge = (puff.r0 + puff.grow) * ppm, sx = toScreenX(puff.x), sy = toScreenY(puff.y);\n'
    + '    if (sx < -edge || sy < -edge || sx > view.W + edge || sy > view.H + edge) {\n'
    + '      if (far > offFar) { offFar = far; offAt = i; }\n'
    + '    } else if (puff.ai && far > aiFar) { aiFar = far; aiAt = i; }\n'
    + '  }\n'
    + '  const drop = offAt >= 0 ? offAt : aiAt;\n'
    + '  if (drop >= 0) puffs.splice(drop, 1);\n'
    + '  else dropOldest(puffs, rgb);\n'
    + '}\n'
    + '\n'
    + '/**\n * Throw one puff into the pool, dropping the oldest when it is full.'],
  ['function withCarDebts(state: ParticleState, car: object, emit: () => void): void {\n'
    + '  const debts = state.carDebts.get(car) || [0, 0];\n'
    + '  [state.sprayDebt, state.smokeDebt] = debts;\n'
    + '  emit();\n',
  'function withCarDebts(state: ParticleState, car: object, emit: () => void, ai = false): void {\n'
    + '  const debts = state.carDebts.get(car) || [0, 0];\n'
    + '  [state.sprayDebt, state.smokeDebt] = debts;\n'
    + '  state.aiThrowing = ai;\n'
    + '  emit();\n'
    + '  state.aiThrowing = false;\n'],
  [' * @param emit the emitter\n */\nfunction withCarDebts',
    ' * @param emit the emitter\n * @param ai an AI car (its puffs marked: ?puffpool)\n */\nfunction withCarDebts'],
  ['    sprayDebt: 0, smokeDebt: 0, carDebts: new Map(),\n',
    '    sprayDebt: 0, smokeDebt: 0, carDebts: new Map(), aiThrowing: false,\n'],
  ['    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>\n'
    + '      withCarDebts(state, car, () => emitSpray(ctx, car, marks, wallDt)),\n'
    + '    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number) =>\n'
    + '      withCarDebts(state, car, () => emitTyreSmoke(ctx, car, marks, wallDt)),\n',
  '    addSpray: (car: ParticleCar, marks: RenderMarks, wallDt: number, ai = false) =>\n'
    + '      withCarDebts(state, car, () => emitSpray(ctx, car, marks, wallDt), ai),\n'
    + '    addSmoke: (car: ParticleCar, marks: RenderMarks, wallDt: number, ai = false) =>\n'
    + '      withCarDebts(state, car, () => emitTyreSmoke(ctx, car, marks, wallDt), ai),\n'],
]);
console.log('ok');
