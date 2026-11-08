import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/sim.ts', [
  ['export function recoverCar(why) {', 'export function recoverCar(why: unknown) {'],
  ['  const inp = { ...shared.autoDrv.drive(game.car, wallDt,', '  const inp = { ...shared.autoDrv!.drive(game.car, wallDt,'],
  ['    shared.autoDrv.relocate();', '    shared.autoDrv!.relocate();'],
  ['const spot = findNearestSubtrackPoint(LEVEL.subtrack!, game.car.x, game.car.y);',
    'const spot = findNearestSubtrackPoint(LEVEL.subtrack!, game.car.x, game.car.y)!;'],
  ['export function demoInput(wallDt: number) {\n  const inp = { ...shared.demo.drive(game.car, wallDt,',
    'export function demoInput(wallDt: number) {\n  const demo = shared.demo!;   // (called only with a demo driver)\n'
    + '  const inp = { ...demo.drive(game.car, wallDt,'],
  ['    : (shared.demoHurt = { car: game.car, drv: shared.demo, hurtWait: null, hurtT: 0 });',
    '    : (shared.demoHurt = { car: game.car, drv: demo, hurtWait: null, hurtT: 0 });'],
  ['  if (shared.demoStill > 3 || shared.demo.state.lastDist > 30) {',
    "  if (shared.demoStill > 3 || ('lastDist' in demo.state && demo.state.lastDist > 30)) {"],
  ['    shared.demo.relocate();', '    demo.relocate();'],
  ['export function readFrameInput(wallDt: number) {\n  feedStickSpeed();\n  let inp = shared.input.update(wallDt);',
    'export function readFrameInput(wallDt: number): CarInput {\n  feedStickSpeed();\n'
    + '  let inp: CarInput = shared.input.update(wallDt);'],
  ['      ? { ...atPace(game.start.drv.drive(', '      ? { ...atPace(game.start.drv!.drive('],
  ['    recoverCar(err.message);', '    recoverCar((err as Error).message);'],
  ['  const hwData = LEVEL._hw;', '  const hwData = hwLevel()._hw;'],
  ['  if (LEVEL._hw.warn) game.notice = { text: LEVEL._hw.warn, at: performance.now() };',
    '  const warn = hwLevel()._hw.warn;\n  if (warn) game.notice = { text: warn, at: performance.now() };'],
  ['  game.hwDist = LEVEL._hw.driven || 0;', '  game.hwDist = hwLevel()._hw.driven || 0;'],
  ['    shared.audio.update(game.car, wallDt);', '    shared.audio.update(game.car);'],
  ["console.error('[car sim] audio.update threw:', err.message);",
    "console.error('[car sim] audio.update threw:',\n      (err as Error).message);"],
  ['    if (game.flow && game.flow.highway) game.position = game.flow.order();',
    '    const hw = hwFlow();\n    if (hw) game.position = hw.order!();'],
  ['    game.flow.step(PHYSICS_STEP_SECONDS);', '    game.flow.step!(PHYSICS_STEP_SECONDS);   // (set as the flow is made)'],
  ['    const flow = game.flow;\n    if (flow.highway\n      && flow.cdKind)',
    '    const flow = hwFlow();\n    if (flow\n      && flow.cdKind)'],
  ['          Math.ceil(flow.cd)), at:', '          Math.ceil(flow.cd!)), at:'],
]);
let s = fs.readFileSync('src/game/sim.ts', 'utf8');
s = s.replace(/import \{ ([^}]*)\} from '\.\/state\.ts';/, (m, names) => {
  const list = names.split(',').map((x) => x.trim()).filter(Boolean);
  for (const n of ['hwLevel', 'hwFlow']) if (!list.includes(n)) list.push(n);
  return `import { ${list.join(', ')} } from './state.ts';`;
});
fs.writeFileSync('src/game/sim.ts', s);
edit('src/game/state.ts', [
  ['export function hwLevel(): HwLevel {',
    '/** The race flow when it is the highway\'s (highwayrace.ts), else null. */\n'
    + 'export function hwFlow(): HwFlow | null {\n'
    + '  const flow = game.flow;\n'
    + "  return flow && 'highway' in flow && flow.highway ? flow : null;\n"
    + '}\n\n'
    + 'export function hwLevel(): HwLevel {'],
  ['  demoHurt?: { car: GameCar; drv: AiDriver | null; hurtWait: number | null; hurtT: number };',
    '  demoHurt?: HurtEntry;   // the menu demo car, hurt (game/ai.ts stepAIInjury)'],
  ['/** The race start:',
    '/** What a hurt car\'s pause-then-reset reads (an AI entry, or the menu demo car). */\n'
    + "export type HurtEntry = Pick<AiEntry, 'car' | 'drv' | 'hurtWait' | 'hurtT'>;\n\n"
    + '/** The race start:'],
]);
edit('src/game/ai.ts', [
  ['export function aiReset(entry: AiEntry) {', 'export function aiReset(entry: HurtEntry) {'],
  ['export function stepAIInjury(entry: AiEntry, dt: number) {', 'export function stepAIInjury(entry: HurtEntry, dt: number) {'],
  ["import type { AiEntry } from './state.ts';", "import type { AiEntry, HurtEntry } from './state.ts';"],
]);
edit('src/ai/types.ts', [
  ['export type TrafficVehicle = Car & Pick<AiCar, \'traffic\' | \'_trOff\' | \'_hwS\' | \'_hwf\'> & {\n'
    + '  dmg?: number[];   // damage.ts damageInit: the damage of the four corners\n',
  'export type TrafficVehicle = Car & DamageCar & Pick<AiCar, \'traffic\' | \'_trOff\' | \'_hwS\' | \'_hwf\'> & {\n'
    + '  lightsOn?: boolean;   // game/sim.ts: the field\'s headlights\n'],
  ['import type { Car, CarTelemetry } from "../vehicle.ts";',
    'import type { Car, CarTelemetry } from "../vehicle.ts";\nimport type { DamageCar } from "../damage.ts";'],
]);
edit('src/cones/coneTypes.ts', [
  ['  streamers?: Streamer[];\n  burstTyre?:', '  streamers?: Streamer[] | null;   // (null: reset)\n  burstTyre?:'],
]);
edit('src/marks.ts', [
  ['  surface: Surface; wheelSurf?: (Surface | null)[] | null;   // the ground under each wheel',
    '  surface: MarkSurface; wheelSurf?: (MarkSurface | null)[] | null;   // the ground under each wheel'],
  ['function surfaceOfWheel(car: MarkCar, under: (Surface | null)[] | null | undefined,',
    'function surfaceOfWheel(car: MarkCar, under: (MarkSurface | null)[] | null | undefined,'],
  ['function markOf(surface: Surface) {', 'function markOf(surface: MarkSurface) {'],
  ['interface MarkCar {', '/** The ground as the marks read it (the car\'s, cars.ts, or a level\'s). */\n'
    + "type MarkSurface = Pick<Surface, 'id' | 'spray'> & { mark?: Mark | null };\n\ninterface MarkCar {"],
]);
console.log('ok');
