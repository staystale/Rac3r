import fs from 'node:fs';
const p = 'src/stagegen.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error(a); s = s.replace(a, b); };
r('interface Part { len: number; rad: number; ang: number }', 'interface Part { len?: number; rad: number; ang?: number }');
r('    const partLen = part.rad ? Math.abs(part.ang) * part.rad : part.len,', '    const partLen = part.rad ? Math.abs(part.ang!) * part.rad : part.len!,');
r('            stepTurn = part.rad ? part.ang / steps : 0;', '            stepTurn = part.rad ? part.ang! / steps : 0;');
r('function chooseStageRoad(seed: number, themeSpec: ThemeSpec, style: string, target: number, attempt: number) {\n  let road = null;',
  'function chooseStageRoad(seed: number, themeSpec: ThemeSpec, style: string, target: number,\n  attempt: number | null) {\n  let road: ReturnType<typeof growRoad> | null = null;');
r('  const { road, used } = chooseStageRoad(seed, themeSpec, style, target, attempt);',
  '  const chosen = chooseStageRoad(seed, themeSpec, style, target, attempt), used = chosen.used;\n  const road = chosen.road!;   // one of the attempts always lays a road');
s = s.replace(/function buildStageSectors\(rand: \(\) => number, theme: string, finishS: number, roadS: ([^,]+), snowRoad: boolean\)/,
  'function buildStageSectors(rand: () => number, theme: string, finishS: number, roadS: $1, snowRoad: string | null)');
s = s.replace('const NAMES = {', 'const NAMES: Record<string, string[][]> = {');
s = s.split('SURFACES[snowPatchOf(snowRoad)]').join('(SURFACES as Record<string, Surface>)[snowPatchOf(snowRoad)]');
s = s.split('    roadS = SURFACES[snowRoad || themeSpec.road];').join('    roadS = (SURFACES as Record<string, Surface>)[(snowRoad || themeSpec.road)!];');
s = s.split('    base: SURFACES[themeSpec.base], subtrack: sub, camber: {').join('    base: (SURFACES as Record<string, Surface>)[themeSpec.base], subtrack: sub, camber: {');
r("        [runD + 34, halfWidth + 14, { kind: 'truck', col: '#c8302c' }]] as\n        [number, number, Partial<Prop>][]) {",
  "        [runD + 34, halfWidth + 14, { kind: 'truck', col: '#c8302c' }]] as\n        [number, number, Omit<Prop, 'x' | 'y'>][]) {");
r("    gen: { ...GEN_DEFAULT }, _build: () => genStage(GEN_DEFAULT) });",
  "    gen: { ...GEN_DEFAULT }, _build: () => genStage(GEN_DEFAULT) } as Level);   // built on first use");
r("          { id: stageId, name: setStage.name, fixed: true }),\n      });",
  "          { id: stageId, name: setStage.name, fixed: true }),\n      } as Level);   // built on first use (load.ts buildLevel)");
fs.writeFileSync(p, s);
console.log('ok');
