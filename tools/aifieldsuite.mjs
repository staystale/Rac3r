// aifieldsuite.mjs — aifieldcheck over 4 circuits x 6 seeds, in parallel; prints each run + the totals (passes, contact s / events,
// resets, off-road s). The stage-3 racecraft benchmark. node tools/aifieldsuite.mjs [diff 0-4] [car] [laps]
import { execFile } from 'node:child_process';
const [d = '2', car = 'hatch-rwd', laps = '3'] = process.argv.slice(2);
const runs = [];
for (const lv of ['thruston', 'castle-cum', 'brands-snatch', 'naffcar']) for (const s of (process.env.SEEDS || '7,3,11,5,19,23').split(',').map(Number)) runs.push([lv, s]);
const one = ([lv, s]) => new Promise((res) => execFile('node', ['tools/aifieldcheck.mjs', lv, car, d, '6', String(s), laps], { maxBuffer: 1e7 }, (e, out) => res(out || String(e))));
const outs = [];
for (let i = 0; i < runs.length; i += 6) outs.push(...await Promise.all(runs.slice(i, i + 6).map(one)));
let P = 0, C = 0, E = 0, R = 0, O = 0, F = 0, I = 0; const IK = { off: 0, spin: 0, hit: 0, reset: 0 }; const K = { start: 0, noseTail: 0, side: 0 };
for (const o of outs) {
  const head = o.split('\n')[0]; console.log(head);
  { const m = head.match(/\((\{.*?\})\)/); if (m) { const k = JSON.parse(m[1]); for (const x in K) K[x] += k[x]; } }
  { const m = head.match(/INCIDENTS (\d+) (\{.*?\})/); if (m) { I += +m[1]; const k = JSON.parse(m[2]); for (const x in IK) IK[x] += k[x]; } }
  F += +(head.match(/FOLLOW (\d+)/) || [0, 0])[1]; P += +(head.match(/PASSES (\d+)/) || [0, 0])[1]; C += +(head.match(/contact ([\d.]+) s/) || [0, 0])[1]; E += +(head.match(/in (\d+) events/) || [0, 0])[1];
  for (const l of o.split('\n').slice(1)) { R += +(l.match(/resets (\d+)/) || [0, 0])[1]; O += +(l.match(/off ([\d.]+) s/) || [0, 0])[1]; }
}
console.log(`INCIDENTS diff ${d}: ${I} in ${outs.length} races = ${(I / outs.length).toFixed(1)} per race (${JSON.stringify(IK)})`);
console.log(`TOTAL diff ${d}: passes ${P} | contact ${C.toFixed(1)} s / ${E} events | resets ${R} | off-road ${O.toFixed(0)} car-s | following ${F} car-s | kinds ${JSON.stringify(K)}`);
