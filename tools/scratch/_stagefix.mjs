import fs from 'node:fs';
const p = 'src/stagegen.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b, all) => {
  if (!s.includes(a)) throw new Error(a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
};
r('const rng = (seed) =>', 'const rng = (seed: number) =>');
r('    const point = grow.points.pop(), bucket = grow.occ.get(roadKey(point.x, point.y));\n    bucket.splice(bucket.indexOf(point), 1);',
  '    const point = grow.points.pop()!, bucket = grow.occ.get(roadKey(point.x, point.y))!;\n    bucket.splice(bucket.indexOf(point), 1);');
r('  const last = stack.pop();', '  const last = stack.pop()!;');
r('  const stack = [];', '  const stack: Laid[] = [];');
r(/function makeRoadElement\(rand: \(\) => number, themeSpec: ThemeSpec, kind: string\) \{/.source.replace(/\\/g, ''),
  'function makeRoadElement(rand: () => number, themeSpec: ThemeSpec, kind: string): Part[] {');
r('function buildStageTerrain(rand: () => number, theme: string, kit: ReturnType<typeof trackKit>, corners, FIN: number) {\n  const bumps = [];',
  'function buildStageTerrain(rand: () => number, theme: string, kit: ReturnType<typeof trackKit>,\n  corners: CurvedKerb[], FIN: number) {\n  const bumps: Bump[] = [];');
r('  const straights = [];', '  const straights: number[][] = [];');
r('  const marks = [];', '  const marks: [number, string][] = [];');
r('function dressCornerOutside(dress: Dress, corner, out, sharp) {', 'function dressCornerOutside(dress: Dress, corner: CurvedKerb, out: number, sharp: boolean) {');
r('function dressSharpCorner(dress: Dress, turn, mid, out) {', 'function dressSharpCorner(dress: Dress, turn: number, mid: number, out: number) {');
r('function dressStageCorners(dress: Dress, corners) {', 'function dressStageCorners(dress: Dress, corners: CurvedKerb[]) {');
r('function dressStageMarks(dress: Dress, marks) {', 'function dressStageMarks(dress: Dress, marks: [number, string][]) {');
r("        [runD + 34, halfWidth + 14, { kind: 'truck', col: '#c8302c' }]]) {",
  "        [runD + 34, halfWidth + 14, { kind: 'truck', col: '#c8302c' }]] as\n        [number, number, Partial<Prop>][]) {");
r("  const fill = { forest: [520, 0], snow: [320, 30], alpine: [140, 110], desert: [110, 170] }[theme];",
  "  const fill = ({ forest: [520, 0], snow: [320, 30], alpine: [140, 110], desert: [110, 170] } as\n    Record<string, number[]>)[theme];");
r("  for (let treeIdx = 0; treeIdx < fill[0]; treeIdx++) {", "  for (let treeIdx = 0; treeIdx < fill![0]; treeIdx++) {");
r("  for (let rockIdx = 0; rockIdx < fill[1]; rockIdx++) {", "  for (let rockIdx = 0; rockIdx < fill![1]; rockIdx++) {");
r("          .includes(prop.kind) || (prop.kind === 'block' && prop.w > 10) ? true : kit",
  "          .includes(prop.kind) || (prop.kind === 'block' && prop.w! > 10) ? true : kit");
r(`export function genStage({ seed = 1001, theme: string = 'forest', len = 'medium', style: string = 'mixed',
    attempt: number = null } = {}) {`, `export function genStage({ seed = 1001, theme = 'forest', len = 'medium', style = 'mixed',
    attempt = null }: { seed?: number; theme?: string; len?: string; style?: string;
    attempt?: number | null } = {}): Level {`);
r("  const pts = [...main, ...runUp].map((point) => [point.x, point.y]), ghostIdx = main.length - 1;",
  "  const pts = [...main, ...runUp].map((point): Point => [point.x, point.y]),\n    ghostIdx = main.length - 1;");
fs.writeFileSync(p, s);
console.log('ok');
