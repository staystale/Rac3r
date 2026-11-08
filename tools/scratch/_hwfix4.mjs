import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
sub('src/highway/hwtypes.ts', `/** Stamps a prop`, `/** A bridge over the motorway (or the river under it): a prop with its span, skew and what it
 * carries (extras.ts buildBridge). */
export type Bridge = Prop & {
  carries: string; rot: number; wid: number; skew: number;
  roadHw: number;   // the motorway's half width under it, m
};

/** Stamps a prop`);
const C = 'src/highway/cuts.ts';
let s = fs.readFileSync(C, 'utf8');
s = s.split('bridge: Prop').join('bridge: Bridge');
fs.writeFileSync(C, s);
sub(C, 'const SCENERY = {', 'const SCENERY: Record<string, number> = {');
sub(C, 'export const cutSkips = (cut, dist) =>', 'export const cutSkips = (cut: HwCut, dist: number) =>');
sub(C, 'export function sideFlush(level: HwLevel, end: number, sNext: number) {',
  'export function sideFlush(level: HwLevel, end: boolean, sNext?: number) {');
sub(C, '    state.nextBridge = Math.max(state.nextBridge, road[i].s + 150);',
  '    state.nextBridge = Math.max(state.nextBridge!, road[i].s + 150);');
sub(C, '    const pts = [];\n    for (let along = 0; along <= APP_LEN + 1e-6; along += APP_STEP) {',
  '    const pts: Point[] = [];\n    for (let along = 0; along <= APP_LEN + 1e-6; along += APP_STEP) {');
sub(C, '    const lane = { pts, width: width, surface, _s: dist };', '    const lane: Lane = { pts, width: width, surface, _s: dist };');
sub(C, '        lane._segs = null;', '        lane._segs = undefined;');
sub(C, '  bridge.appL = [APP_LEN, APP_LEN];', '  const appL = bridge.appL = [APP_LEN, APP_LEN];');
sub(C, '        bridge.appL[sideIdx] = Math.max(0, (pts.length - 1) * APP_STEP);', '        appL[sideIdx] = Math.max(0, (pts.length - 1) * APP_STEP);');
sub(C, '    riverW = bridge.ww,', '    riverW = bridge.ww!,');
sub(C, '    const water = {\n      cover: "wet",', '    const water = {\n      cover: "wet",');
s = fs.readFileSync(C, 'utf8');
s = s.replace('      cut: { ox: bridge.x, oy: bridge.y, tn: tanSkew, e: roadEdge },\n      _s: dist,\n    };',
  '      cut: { ox: bridge.x, oy: bridge.y, tn: tanSkew, e: roadEdge },\n      _s: dist,\n    } as Cover;   // x, y, w set by put below, before it is pushed');
s = s.replace('      _s: dist,\n      sv: bankSide,\n    }));', '      _s: dist,\n      sv: bankSide,\n    } as Zone));   // x, y, w set by put below');
s = s.replace('    const put = (len) => {', '    const put = (len: number) => {');
s = s.replace('    const pts = [];\n    for (let along = 0; along <= APP_LEN + 1e-6; along += 10) {',
  '    const pts: Point[] = [];\n    for (let along = 0; along <= APP_LEN + 1e-6; along += 10) {');
fs.writeFileSync(C, s);
// world types: a cover / zone tagged by the road distance; a bank's side
sub('src/world/types.ts', `  water?: boolean;   // SCENERY water`, `  _s?: number;   // highway.ts: the road distance it is dropped behind with
  water?: boolean;   // SCENERY water`);
sub('src/world/types.ts', `  field?: number;
  _s?: number;`, `  field?: number;
  _s?: number;
  sv?: number;   // highway.ts river banks: which side of the river (-1 / 1)`);
console.log('ok');
