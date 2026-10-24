// _rainease.mjs - how a shower builds (world/weather.ts): rain every 2 s after a real change of
// weather in SEASON mode (dry -> rain / heavy): the two-stage ease (it was one stage: 0.125 at 2 s).
// node tools/scratch/_rainease.mjs
import { WEATHER, startWeather, stepWeather } from '../../src/world/weather.ts';
for (const blend of [true]) {
  for (let seed = 1; seed < 400; seed++) {
    startWeather({ mode: 'season', season: 3, seed });
    if (WEATHER.kind !== 'dry') continue;
    let steps = 0;
    while (WEATHER.kind === 'dry' && steps < 120 * 400) { stepWeather(1 / 120); steps++; }
    if (WEATHER.kind !== 'heavy') continue;
    const row = [];
    for (let s = 0; s <= 40; s++) {
      if (s % 2 === 0) row.push(WEATHER.rain.toFixed(3));
      for (let i = 0; i < 120; i++) stepWeather(1 / 120);
    }
    console.log(blend ? 'two-stage' : 'one-stage', 'seed', seed, row.join(' '));
    break;
  }
}
