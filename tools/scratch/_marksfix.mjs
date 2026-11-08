import fs from 'node:fs';
const p = 'src/marks.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error(a); s = s.replace(a, b); };
r('const wrapPx = (value, period) =>', 'const wrapPx = (value: number, period: number) =>');
r('  const cell = (layerPx) =>', '  const cell = (layerPx: number) =>');
r(`      state.cellT[index] = state.clock;
      state.cellStep[index] = 0;
      state.live.add(index);`, `      state.cellT[index] = state.clock!;
      state.cellStep![index] = 0;
      state.live!.add(index);`);
r(`    const step = state.cellStep[index];
    if (state.clock - state.cellT[index] < AGED_FROM_S + step * AGED_STEP_S) continue;`,
`    const step = state.cellStep![index];
    if (state.clock - state.cellT![index] < AGED_FROM_S + step * AGED_STEP_S) continue;`);
r('      state.cellStep[index] = step + 1;', '      state.cellStep![index] = step + 1;');
r('  const dry = SURFACES[surface.id];', '  const dry = (SURFACES as Record<string, Surface>)[surface.id];');
r(`    ['rr', -spec.lr, halfTrack, telem.slipSpeedR, 3],
  ]) {`, `    ['rr', -spec.lr, halfTrack, telem.slipSpeedR, 3],
  ] as [string, number, number, number, number][]) {`);
r("  const ctx = layer.getContext('2d');\n  ctx.lineCap = 'round';", "  const ctx = layer.getContext('2d')!;\n  ctx.lineCap = 'round';");
r('  /** @type {MarkState} */\n  const state = {', '  const state: MarkState = {');
r('    follow: (x, y) =>', '    follow: (x: number, y: number) =>');
r('    fade: (dt) =>', '    fade: (dt: number) =>');
r('    stamp: (wheels) =>', '    stamp: (wheels: MarkWheel[]) =>');
r('    wheelsOf: (car) =>', '    wheelsOf: (car: MarkCar) =>');
r('function listWheels(car: MarkCar) {', 'function listWheels(car: MarkCar): MarkWheel[] {');
r('  const out = [];', '  const out: MarkWheel[] = [];');
fs.writeFileSync(p, s);
console.log('ok');
