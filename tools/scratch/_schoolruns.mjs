// _schoolruns.mjs - THE SCHOOL BUS's TIMES (ai/trafficCtx.ts inService): with the game's clock on,
// each hour of a day and each day of the week, whether the school bus may be picked for the
// traffic, and how many of N picks it is at 08:00 on a weekday. Nothing in the game is changed.
// node tools/scratch/_schoolruns.mjs  (SCHOOLBUS=1)
import { CLOCK } from '../../src/world/clock.ts';
import { inService, VEH } from '../../src/ai/trafficCtx.ts';

const DAY = 24 * 3600;
CLOCK.isOn = true;
const row = (day) => Array.from({ length: 48 }, (_, half) => {
  CLOCK.eventS = day * DAY + half * 1800;
  return inService('skool-bus') ? '#' : '.';
}).join('');
console.log('half-hours 00:00 .. 23:30 (# = may be picked)');
for (let day = 0; day < 7; day++) console.log(`day ${day}  ${row(day)}`);
CLOCK.isOn = false;
console.log(`clock off: ${inService('skool-bus') ? 'in service' : 'never'}`);
const total = VEH.reduce((sum, [, weight]) => sum + weight, 0);
const bus = VEH.find(([vehId]) => vehId === 'skool-bus');
console.log(`its weight ${bus ? bus[1] : 0} of ${total.toFixed(2)}: 1 in ${bus ? Math.round(total / bus[1]) : '-'} of the traffic picked in its hours`);
