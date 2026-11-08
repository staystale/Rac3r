import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/hud/hudtypes.ts', [
  ['  id: string; player?: boolean; car?: HudCar;\n  lapDone: number;',
    '  player?: boolean; car?: HudCar;\n  lapDone?: number;'],
  ['laps done; the finish time once home', 'laps done (a lap race); the finish time once home'],
]);
edit('src/hud/laps.ts', [
  ['player.lapDone + 1)', 'player.lapDone! + 1)'],
]);
edit('src/damage.ts', [
  ['  _dsp?: unknown;', "  _dsp?: RenderCar['_dsp'];   // the damaged sprite (render/cardamage.ts)"],
]);
let d = fs.readFileSync('src/damage.ts', 'utf8');
d = d.replace(/(\nimport [^\n]*\n)(?!import)/, "$1import type { RenderCar } from './render/types.ts';\n");
fs.writeFileSync('src/damage.ts', d);
edit('src/game/loop.ts', [
  [' * @param {{frameMs: number, meterSim: number, drawT0: number}} frame this frame\'s timings\n */\nexport function drawMeter(frame: Frame) {',
    ' * @param frame this frame\'s timings\n */\nexport function drawMeter(frame: Frame & { drawT0: number }) {'],
  ['    shared.meter.add({', '    shared.meter!.add({   // (drawn only with the meter on)'],
  ["dist: LEVEL._hw ? game.hwDist : 0 });", "dist: LEVEL._hw ? game.hwDist ?? 0 : 0 });"],
  ['    shared.meter.draw(shared.renderer.ctx,', '    shared.meter!.draw(shared.renderer.ctx,'],
  [' * @param {{frameMs: number, meterSim: number}} frame this frame\'s timings', ' * @param frame this frame\'s timings'],
  ['function reportFrame(frame: Frame, draw, tiles, slide) {',
    'function reportFrame(frame: Frame, draw: number, tiles: number, slide: number) {'],
  ['  shared.reporter.add([', '  shared.reporter!.add([   // (called only with the reporter on)'],
  [' * @param {{now: number, wallDt: number, frameMs: number, meterSim: number}} frame this frame',
    ' * @param frame this frame'],
  ['  const aiKeep = [];', '  const aiKeep: [{ x: number; y: number; heading: number }, number, number, number][] = [];'],
]);
let l = fs.readFileSync('src/game/loop.ts', 'utf8');
// the frame's timings (one place)
l = l.replace('\n/**\n * The fixed-step sim loop:', '\n/** One animation frame\'s timings (ms; wallDt in s). */\n'
  + 'export interface Frame { now: number; wallDt: number; frameMs: number; meterSim: number }\n'
  + '\n/**\n * The fixed-step sim loop:');
if (!l.includes('export interface Frame')) throw new Error('Frame');
fs.writeFileSync('src/game/loop.ts', l);
edit('src/game/sim.ts', [
  ['export function stepTrafficContacts(tcars: GameCar[]) {', 'export function stepTrafficContacts(tcars: TrafficVehicle[]) {'],
  ['export function stepLooseCones(tcars: GameCar[]) {', 'export function stepLooseCones(tcars: TrafficVehicle[]) {'],
  ['export function stepTyreMarks(tcars: GameCar[]) {', 'export function stepTyreMarks(tcars: TrafficVehicle[]) {'],
]);
let s = fs.readFileSync('src/game/sim.ts', 'utf8');
if (!s.includes('TrafficVehicle }')) {
  s = s.replace(/(\nimport [^\n]*\n)(?!import)/, "$1import type { TrafficVehicle } from '../ai/types.ts';\n");
  fs.writeFileSync('src/game/sim.ts', s);
}
console.log('ok');
