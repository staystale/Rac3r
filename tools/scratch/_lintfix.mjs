import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/ai/types.ts', [["export type TrafficVehicle = Car & DamageCar & Pick<AiCar, 'traffic' | '_trOff' | '_hwS' | '_hwf'> & {",
  "export type TrafficVehicle = Car & DamageCar\n  & Pick<AiCar, 'traffic' | '_trOff' | '_hwS' | '_hwf'> & {"]]);
edit('src/game/menuflow.ts', [['    if (level && level.endless && opts.road) setHighwayPreset(level as unknown as HwLevel, opts.road);',
  '    if (level && level.endless && opts.road)\n      setHighwayPreset(level as unknown as HwLevel, opts.road);']]);
edit('src/game/rules.ts', [['  return querySubtrack(LEVEL.subtrack!, crossX, crossY).dist > LEVEL.subtrack!.width / 2 + JOKER_ROAD;',
  '  const sub = LEVEL.subtrack!;\n  return querySubtrack(sub, crossX, crossY).dist > sub.width / 2 + JOKER_ROAD;']]);
edit('src/game/sim.ts', [
  ["import type { GameCar } from './state.ts';\n", ''],
  [' * Engine and tyre sound, fenced off so a throw can never stop the frame.\n * @param wallDt the clamped wall-clock frame time, in seconds\n */\nexport function updateAudio(wallDt: number) {',
    ' * Engine and tyre sound, fenced off so a throw can never stop the frame.\n */\nexport function updateAudio() {'],
  ['    const hw = hwFlow();\n    if (hw) game.position = hw.order!();', '    const hwRace = hwFlow();\n    if (hwRace) game.position = hwRace.order!();'],
]);
edit('src/game/loop.ts', [['  updateAudio(wallDt);', '  updateAudio();']]);
console.log('ok');
