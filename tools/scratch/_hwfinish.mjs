// _hwfinish.mjs - THE HIGHWAY'S FINISH (?hwfinish=1; owner 11-09: "a distance or timer to end it…
// or infinit", "Timer or distance - or get away"): the race flow (highwayrace.ts createHwFlow)
// with scripted road positions, no physics, as _flowtest.mjs. Each scenario prints when and how it
// ended and the results order; a FAIL line for anything not as meant.
// node tools/scratch/_hwfinish.mjs
import * as L from '../../src/lab.ts';
import * as H from '../../src/highway.ts';
import { createHwFlow } from '../../src/highwayrace.ts';
import { finishOf } from '../../src/highway/finish.ts';

H.addHighwayLevel();
const lv = H.createHighway(4242, 'motorway');
lv.id = 'hf';
L.LEVELS.push(lv);
L.setLevel(lv.id);
const STEP = 1 / 120, VIEW = 75;
const sRef = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s;
let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('  FAIL ' + msg); } };

/**
 * One race: you and the rivals at steady speeds (m/s) from the start line.
 * @param name the scenario
 * @param code the finish's code
 * @param speeds yours first, then each rival's
 * @param limit s to run at most
 * @returns the flow when it stopped
 */
function run(name, code, speeds, limit = 700) {
  const cars = speeds.map((v, i) => ({ spec: { id: 'car' + i }, num: i + 1, _hwf: { s: sRef } }));
  const vis = (car) => Math.abs(car._hwf.s - cars[0]._hwf.s) < VIEW;
  const flow = createHwFlow({ lv, cars: cars.map((car, i) => ({ car, player: i === 0 })),
    visible: vis, finish: finishOf(code) });
  let t = 0;
  for (; t < limit && flow.state !== 'done'; t += STEP) {
    cars.forEach((car, i) => { car._hwf.s = sRef + speeds[i] * t; });
    flow.step(STEP);
  }
  const rows = flow.results || [];
  console.log(`${name.padEnd(46)} ${flow.state === 'done' ? 'ended ' + flow.endWhy + ' at '
    + flow.t.toFixed(1) + ' s' : 'running at ' + flow.t.toFixed(0) + ' s'} | `
    + rows.map((row) => `P${row.pos} ${row.player ? 'YOU' : row.car.spec.id} ${row.done != null
      ? row.done.toFixed(1) + ' s' : (row.dist / 1000).toFixed(2) + ' km'}`).join(', '));
  return flow;
}
// 5 km: a rival 42 m/s gets there first (119 s), you at 40 (125 s), one at 35 still going
let flow = run('VS AI 5 KM: one beats you to the line', 'km5', [40, 42, 35]);
ok(flow.endWhy === 'finish' && Math.abs(flow.t - 125) < 0.2, 'ends as you cross at 125 s');
ok(flow.results[0].car.spec.id === 'car1' && Math.abs(flow.results[0].done - 119.05) < 0.2,
  'the 42 m/s rival first, its time ~119 s');
ok(flow.results[1].player && flow.results[2].done == null, 'you second, the slow one not over');
ok(flow.myPlace === 2 && Math.abs(flow.results[1].gap - 5.95) < 0.2, 'P2, +5.95 s');
// 3 min: furthest wins
flow = run('VS AI 3 MIN: furthest wins', 'min3', [40, 38, 41]);
ok(flow.endWhy === 'time' && Math.abs(flow.t - 180) < 0.1, 'ends at 180 s');
ok(flow.results[0].car.spec.id === 'car2' && flow.myPlace === 2, 'the 41 m/s rival first, you P2');
// solo
flow = run('SOLO 5 KM', 'km5', [40]);
ok(flow.endWhy === 'finish' && Math.abs(flow.results[0].done - 125) < 0.2, 'solo: over at 125 s');
flow = run('SOLO 3 MIN', 'min3', [40]);
ok(flow.endWhy === 'time' && Math.abs(flow.results[0].dist - 7200) < 10, 'solo: 7.2 km in 3 min');
flow = run('SOLO ENDLESS (never ends)', 'endless', [40], 400);
ok(flow.state !== 'done', 'endless solo runs on');
// the getaway still ends it first: both rivals 10 m/s faster, a 20 km race
flow = run('VS AI 20 KM, both rivals get away', 'km20', [40, 50, 50]);
ok(flow.endWhy === 'away' && flow.t < 60, 'CATCH THEM ends it long before the line');
// you get away from them before the line
flow = run('VS AI 20 KM, you get away', 'km20', [50, 40, 40]);
ok(flow.endWhy === 'away' && flow.myPlace === 1, 'PULLING AWAY: you win');
// endless VS AI, side by side: as before (no end)
flow = run('VS AI ENDLESS, side by side', 'endless', [40, 40.01, 39.99], 400);
ok(flow.state !== 'done' && !flow.finish, 'no finish, no end');
console.log(bad ? `${bad} FAIL` : 'all as meant');
