// _pullaway.mjs - A11 (owner: "pulling away appears even when not in first place sometimes"): the
// highway race flow (highwayrace.ts createHwFlow) with scripted road positions, no physics, as
// _flowtest.mjs. Reports how long PULLING AWAY ('behind') shows while you are NOT first (by the
// script's true positions: a rival with no road frame is still where the script put it).
// node tools/scratch/_pullaway.mjs   (before the fix: 2 s, 3.25 s and 2 s while not first)
import * as L from '../../src/lab.js';
import * as H from '../../src/highway.js';
import { createHwFlow } from '../../src/highwayrace.ts';


H.addHighwayLevel();
const lv = H.createHighway(4242, 'motorway');
lv.id = 'pa';
L.LEVELS.push(lv);
L.setLevel(lv.id);
const STEP = 1 / 120, VIEW = 75;

/**
 * One scenario: you at 40 m/s; the rivals placed by the script each step (null = no road frame).
 * @param {string} name the scenario
 * @param {(t: number) => (number|null)[]} gapsAt each rival's gap to you at t (m; null: no frame)
 * @param {number} secs how long
 * @param {(t: number) => number} [truthOf] where rival 0 really is while it has no road frame
 */
function run(name, gapsAt, secs = 30, truthOf = null) {
  const me = { spec: {}, _hwf: { s: 0 } };
  const rivals = gapsAt(0).map(() => ({ spec: {}, _hwf: { s: 0 } }));
  const visible = (car) => !!car._hwf && Math.abs(car._hwf.s - me._hwf.s) < VIEW;
  const flow = createHwFlow({ lv, cars: [{ car: me, player: true },
    ...rivals.map((car) => ({ car }))], visible });
  let wrongS = 0, firstWrong = null, truth = [];
  for (let t = 0; t < secs && flow.state !== 'done'; t += STEP) {
    me._hwf.s = 1000 + t * 40;
    const gaps = gapsAt(t);
    gaps.forEach((gap, i) => {
      if (gap === null) delete rivals[i]._hwf;
      else rivals[i]._hwf = { s: me._hwf.s + gap };
      if (gap !== null) truth[i] = gap;
      else if (i === 0 && truthOf) truth[i] = truthOf(t);
    });
    flow.step(STEP);
    if (flow.cdKind === 'behind' && truth.some((gap) => gap > 0)) {
      wrongS += STEP;
      firstWrong ??= t;
    }
  }
  console.log(`${name.padEnd(52)} PULLING AWAY while not first: ${wrongS.toFixed(2)} s`
    + (firstWrong === null ? '' : ` (from t ${firstWrong.toFixed(1)})`) + `; ended ${flow.state}`);
}

// you lead, both rivals drop off screen behind; at t 14 one comes back past you (a fast AI)
run('leading, then a rival passes you at t 7', (t) => [t < 7 ? -100 : 20, -120]);
// a rival 50 m AHEAD crashes off the road at t 6 (no road frame) and stops there: you pass it
// 1.25 s later, so from then on you ARE first (the truth below)
const offRoad = (t) => (t >= 6 && t < 9 ? null : 50);
run('a rival ahead goes off the road at t 6 and stops', (t) => [offRoad(t), -120], 30,
  (t) => 50 - (t - 6) * 40);
// a rival 50 m ahead is put back (reset) for one step at t 6, still ahead
run('a rival ahead is reset for one step at t 6', (t) => [t >= 6 && t < 6 + 1 / 120 ? null : 50,
  -120]);
// you lead by a long way and a rival ahead... (control: you really are first)
run('control: you are first all the time', () => [-100, -120]);
