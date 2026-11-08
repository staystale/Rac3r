import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
sub('src/highway/hwtypes.ts', `/** The dressing context`, `/** The player's car as the highway reads it. */
export interface HwCar { x: number; y: number; vx: number; vy: number }

/** The dressing context`);
sub('src/highway/road.ts', `export function locate(state: HwState, x: number, y: number) {`,
  `/** Where a point is along the road: the nearest point's index, distance, offset, direction. */
export type RoadLoc = ReturnType<typeof locate>;
export function locate(state: HwState, x: number, y: number) {`);
sub('src/highway/presets.ts', 'export const HW_PRESETS = {', 'export const HW_PRESETS: Record<string, HwCfg> = {');
let p = fs.readFileSync('src/highway/presets.ts', 'utf8');
p = p.replace('import { lcg } from "../core/random.ts";', 'import { lcg } from "../core/random.ts";\nimport type { HwCfg } from "./hwtypes.ts";');
p = p.replace('export const HW_NAMES = {', 'export const HW_NAMES: Record<string, string> = {');
fs.writeFileSync('src/highway/presets.ts', p);
const H = 'src/highway.ts';
let s = fs.readFileSync(H, 'utf8');
s = s.split('onTrack(level.subtrack, ').join('onTrack(level.subtrack!, ');
s = s.replace('  dress(level, state.dressed, road.length, state.looseNew);', '  dress(level, state.dressed, road.length, state.looseNew!);');
s = s.replace(`  const keep = (obj) => obj._s == null || obj._s >= startDist;
  for (const listKey of ["props", "bumps", "barriers", "lanes", "zones", "lamps"]) {
    const list = level[listKey],
      kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);
  }`, `  const keep = (obj: { _s?: number }) => obj._s == null || obj._s >= startDist;
  const dropBehind = <T extends { _s?: number }>(list: T[]) => {
    const kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);
  };
  dropBehind(level.props); dropBehind(level.bumps); dropBehind(level.barriers);
  dropBehind(level.lanes); dropBehind(level.zones); dropBehind(level.lamps);`);
s = s.replace(`  for (const listKey of ["keep", "cuts"]) {
    const list = state[listKey],
      kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);`, `  for (const list of [state.keep, state.cuts] as { _s?: number }[][]) {
    const kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);`);
s = s.replace(/function (checkWrongWay|measureOffRoad)\(state: HwState, loc, /g, 'function $1(state: HwState, loc: RoadLoc, ');
s = s.replace('function stepOffCountdown(state: HwState, out, onLane, dt: number) {', 'function stepOffCountdown(state: HwState, out: number, onLane: boolean, dt: number) {');
s = s.replace(`    spawn: { x: 0, y: 0, heading: 0 },
  };
  resetHighway(level);`, `    spawn: { x: 0, y: 0, heading: 0 },
  } as unknown as HwLevel;   // its road state (_hw) is built by resetHighway just below
  resetHighway(level);`);
s = s.replace('  LEVELS.push(createHighway(4242, QUERY_PRESET || \'motorway\'));', '  LEVELS.push(createHighway(4242, QUERY_PRESET || \'motorway\') as unknown as Level);');
fs.writeFileSync(H, s);
sub('src/world/types.ts', `  _flash?: number;   // render/props/buildings.ts reads it`, `  _camHit?: number;   // highway.ts: a speed-camera gantry already passed (1)
  _flash?: number;   // render/props/buildings.ts reads it`);
console.log('ok');
