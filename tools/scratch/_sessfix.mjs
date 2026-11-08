import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/session.ts', [
  ["import type { GameCar } from './state.ts';",
    "import type { GameCar, PlaceCar } from './state.ts';\nimport type { TrackPoint } from '../world/types.ts';"],
  [' * @param {{dist: number}} closestPt the nearest track point', ' * @param closestPt the nearest track point'],
  ['export function advanceTrackProgress(closestPt, car: GameCar, total) {',
    'export function advanceTrackProgress(closestPt: TrackPoint, car: GameCar, total: number) {'],
  ['export function stepLapTiming(curDist, total, speed) {',
    'export function stepLapTiming(curDist: number, total: number, speed: number) {'],
  ['function resetOnJoker(place) {', 'function resetOnJoker(place: PlaceCar) {'],
  ['function resetOnCircuit(place) {', 'function resetOnCircuit(place: PlaceCar) {'],
  ['  const resetKeepingTyres = (car, x, y, heading) => {',
    '  const resetKeepingTyres = (car: GameCar, x: number, y: number, heading: number) => {'],
  ['const carKey = (car) =>', 'const carKey = (car: GameCar) =>'],
  ['    return createHwFlow({ lv: LEVEL,', '    return createHwFlow({ lv: hwLevel(),'],
  ["LEVEL.endless && shared.mode !== 'menu' ? LEVEL : null,", "LEVEL.endless && shared.mode !== 'menu' ? hwLevel() : null,"],
]);
let ss = fs.readFileSync('src/game/session.ts', 'utf8');
if (!/import \{[^}]*hwLevel/.test(ss)) {
  ss = ss.replace("import { shared, game } from './state.ts';", "import { shared, game, hwLevel } from './state.ts';");
  if (!ss.includes('hwLevel }')) throw new Error('session hwLevel import');
  fs.writeFileSync('src/game/session.ts', ss);
}
edit('src/game/menuflow.ts', [
  ['    set: (pieceId, shown) => {', '    set: (pieceId: string, shown: boolean) => {'],
  ['    if (level && level.endless && opts.road) setHighwayPreset(level, opts.road);',
    '    if (level && level.endless && opts.road) setHighwayPreset(level as unknown as HwLevel, opts.road);'],
  ['  shared.menu.pause({', '  shared.menu!.pause({   // (the pause button is the menu\'s)'],
  ['const thumbs = {};', 'const thumbs: Record<string, HTMLCanvasElement> = {};'],
  ['  shared.menu.results(flow,', '  shared.menu.results(flow as ResultsFlow,'],
  ["import type { Level } from '../world/types.ts';",
    "import type { Level } from '../world/types.ts';\nimport type { HwLevel } from '../highway/hwtypes.ts';\n"
    + "import type { ResultsFlow } from '../menu/menutypes.ts';\nimport type { LaunchOpts } from './state.ts';"],
]);
edit('src/menu/thumbcache.ts', [
  ['export function hasSavedThumbs(build: string): boolean {', 'export function hasSavedThumbs(build: string | null): boolean {'],
  ['export async function saveThumbs(build: string,', 'export async function saveThumbs(build: string | null,'],
]);
edit('src/game/state.ts', [
  ['  weatherPlan: { mode: string; season: number; [field: string]: unknown } | null;',
    '  weatherPlan: WeatherPlan | null;'],
  ["import type { HwLevel } from '../highway/hwtypes.ts';",
    "import type { HwLevel } from '../highway/hwtypes.ts';\n"
    + "import type { WeatherMode, WeatherPlan } from '../world/weather.ts';"],
  ['/** A circuit / stage AI driver (ai/circuit.ts). */',
    '/** Puts a car down at a spot, facing a heading (a reset). */\n'
    + 'export type PlaceCar = (car: GameCar, x: number, y: number, heading: number) => void;\n\n'
    + '/** A launch\'s options (menu/setup.ts LAUNCH; window.__game.launch for the tools). */\n'
    + 'export interface LaunchOpts {\n'
    + '  ai?: number; diff?: number; aiCars?: string;   // opponents, their difficulty, their cars\n'
    + '  rx?: boolean; laps?: number;   // the RX race; laps (0 = practice)\n'
    + '  road?: string | null; traffic?: number; litter?: number;   // the endless highway\n'
    + '  weather?: { mode: WeatherMode; season: number }; time?: number | null;   // the conditions\n'
    + '  livery?: { paint?: string; trim?: string; num?: number } | null; tyre?: string;   // garage\n'
    + '}\n\n'
    + '/** A circuit / stage AI driver (ai/circuit.ts). */'],
]);
console.log('ok');
