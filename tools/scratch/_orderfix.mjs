import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/order.ts', [
  ["import type { GameCar } from './state.ts';",
    "import type { GameCar, CutRun, FormKeeper } from './state.ts';\n"
    + "import type { CarInput } from '../vehicle.ts';"],
  ['export const startAtOf = (car) =>', 'export const startAtOf = (car: GameCar) =>'],
  ['export const carHeld = (car) =>', 'export const carHeld = (car: GameCar) =>'],
  ['export function atPace(out, car: GameCar) {', 'export function atPace(out: CarInput, car: GameCar) {'],
  ['export function formationWant(car: GameCar, slot: number, keeper) {',
    'export function formationWant(car: GameCar, slot: number, keeper: FormKeeper) {'],
  ['  keeper.formDrv ??= createAutoDriver(LEVEL.subtrack);', '  keeper.formDrv ??= createAutoDriver(LEVEL.subtrack!);'],
  ['    game.poleCar || game.car, LEVEL.subtrack, ROLL_PACE);', '    game.poleCar || game.car, LEVEL.subtrack!, ROLL_PACE);'],
  ['  let delta = along - car._lastQ;', '  let delta = along - car._lastQ!;   // (set with _prog)'],
  [' * @param {{gain: number}} cut the finished excursion\n */\nexport function penaliseCut(car: GameCar, cut) {',
    ' * @param cut the finished excursion\n */\nexport function penaliseCut(car: GameCar, cut: CutRun) {'],
  [' * @param {{q: number, prog: number}} cut the finished excursion\n */\nexport function putBackCut(car: GameCar, cut) {\n'
    + '  const point = onTrack(LEVEL.subtrack!, cut.q, 0, {});',
  ' * @param cut the finished excursion\n */\nexport function putBackCut(car: GameCar, cut: CutRun) {\n'
    + '  const point = onTrack(LEVEL.subtrack!, cut.q!, 0, {});'],
  ['    shared.lastOnTrack = { dist: cut.q, off: 0 };', '    shared.lastOnTrack = { dist: cut.q!, off: 0 };'],
  [' * @param {{dist: number}} near the car\'s nearest-road query', ' * @param near the car\'s nearest-road query'],
  ['export function trackCut(car: GameCar, near, delta) {',
    'export function trackCut(car: GameCar, near: { dist: number }, delta: number) {'],
  ['Math.round(cut.q)]);', 'Math.round(cut.q!)]);'],
  ['    key = (car) => (car._prog === undefined', '    key = (car: GameCar) => (car._prog === undefined'],
]);
edit('src/game/state.ts', [
  ['  _cut?: { gain: number; prog?: number; q?: number } | null;   // a track cut in progress',
    '  _cut?: CutRun | null;   // a track cut in progress'],
  ['/** A circuit / stage AI driver (ai/circuit.ts). */',
    '/** A track cut in progress (game/order.ts): the progress gained; where it left the road. */\n'
    + 'export interface CutRun { gain: number; prog?: number; q?: number }\n\n'
    + '/** Keeps a car\'s scripted formation driver (the start, or an AI entry: order.ts formationWant). */\n'
    + 'export interface FormKeeper { formDrv?: ReturnType<typeof createAutoDriver> }\n\n'
    + '/** A circuit / stage AI driver (ai/circuit.ts). */'],
  ['export interface AiEntry {', 'export interface AiEntry extends FormKeeper {'],
  ['export interface GameStart {\n  on: boolean; t: number; tGreen: number; green: boolean; rolling?: boolean;\n'
    + '  drv?: { drive: (car: GameCar, dt: number, ctx: object) => CarInput };\n  [field: string]: unknown;\n}',
  'export interface GameStart extends FormKeeper {\n'
    + '  on: boolean; t: number; tGreen: number; green: boolean; rolling?: boolean;\n'
    + '  tGreen0?: number;   // the green as first set (a stage\'s later starters count from it)\n'
    + '  drv?: AiDriver | null;   // the highway\'s player driver until the green\n'
    + '  prevD?: number | null;   // the pole car\'s distance last step (the rolling start\'s line)\n}'],
  ['  autoDrv: ReturnType<typeof createAutoDriver> | null;', '  autoDrv: AiDriver | null;'],
]);
console.log('ok');
