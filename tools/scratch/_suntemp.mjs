// _suntemp.mjs - ?suntemp=1: a dry summer and a dry winter day from 06:00 with the clock running
// (1 s sim steps): air and track temperature every game hour, old (sun always full) vs new.
import { CLOCK, startClock, startEventClock, stepClock, sunShareNow } from '../../src/world/clock.ts';
import { WEATHER, setSunTemp, startWeather, stepWeather } from '../../src/world/weather.ts';

for (const [label, season] of [['SUMMER', 2], ['WINTER', 0]]) {
  for (const isOn of [false, true]) {
    startClock(true, season);
    CLOCK.globalS = (season * 7 + 3) * 86400;
    setSunTemp(isOn);
    startEventClock(6);
    startWeather({ mode: 'dry', season, seed: 4 });
    const row = [];
    for (let second = 0; second <= 3600; second++) {
      if (second % 150 === 0) row.push(`${Math.round(6 + second / 150) % 24}h ${WEATHER.trackC.toFixed(0)}`);
      stepClock(1, true, 0);
      stepWeather(1);
    }
    console.log(`${label} ${isOn ? 'SUN ' : 'OLD '} track: ${row.join(' ')}`);
  }
}
console.log('share at noon / 21h', (() => { startEventClock(12); return sunShareNow().toFixed(2); })());
