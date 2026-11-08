// _reactab.mjs - R1 (?aireact) A/B: aifieldcheck on 4 circuits x 6 seeds, off and on; per track the
// mean best lap, mean race lap, passes, incidents, contact s. node tools/scratch/_reactab.mjs [diff] [car]
import { execFile } from 'node:child_process';
const [d = '4', car = 'hatch-rwd'] = process.argv.slice(2);
const LV = ['thruston', 'castle-cum', 'brands-snatch', 'naffcar'], SEEDS = (process.env.SEEDS || '7,3,11,5,19,23').split(',').map(Number);
const one = (lv, s, on) => new Promise((res) => execFile('node', ['tools/aifieldcheck.mjs', lv, car, d, '6', String(s), '3'],
  { maxBuffer: 1e7, env: { ...process.env, [process.env.TOGGLE || 'AIREACT']: on ? '1' : '' } }, (e, out) => res({ lv, on, out: out || String(e) })));
const jobs = []; for (const on of [0, 1]) for (const lv of LV) for (const s of SEEDS) jobs.push([lv, s, on]);
const outs = []; for (let i = 0; i < jobs.length; i += 6) outs.push(...await Promise.all(jobs.slice(i, i + 6).map((j) => one(...j))));
const T = {};
for (const { lv, on, out } of outs) {
  const k = lv + (on ? ' ON ' : ' off'), t = T[k] || (T[k] = { best: [], all: [], passes: 0, inc: 0, contact: 0 });
  const [head, ...rest] = out.split('\n');
  t.passes += +(head.match(/PASSES (\d+)/) || [0, 0])[1]; t.inc += +(head.match(/INCIDENTS (\d+)/) || [0, 0])[1];
  t.contact += +(head.match(/contact ([\d.]+) s/) || [0, 0])[1];
  for (const l of rest) { t.off = (t.off || 0) + +(l.match(/off ([d.]+) s/) || [0, 0])[1]; const m = l.match(/laps \d+ \[([\d., ]+)\]/); if (m) { const v = m[1].split(',').map(Number); t.best.push(Math.min(...v)); t.all.push(...v); } }
}
const mean = (x) => (x.reduce((s, v) => s + v, 0) / x.length).toFixed(2);
const sum = { ON: { inc: 0, contact: 0, off: 0, passes: 0, all: [] }, off: { inc: 0, contact: 0, off: 0, passes: 0, all: [] } };
for (const k of Object.keys(T)) { const g = sum[k.endsWith('ON ') ? 'ON' : 'off'], t = T[k]; g.inc += t.inc; g.contact += t.contact; g.off += t.off || 0; g.passes += t.passes; }
process.on('exit', () => { for (const g of ['off', 'ON']) console.log(`TOTAL ${g.padEnd(3)} incidents ${sum[g].inc} | contact ${sum[g].contact.toFixed(0)} s | off-road ${sum[g].off.toFixed(0)} car-s | passes ${sum[g].passes}`); });
for (const k of Object.keys(T).sort()) { const t = T[k]; console.log(`${k.padEnd(18)} best ${mean(t.best)} race-lap ${mean(t.all)} | passes ${t.passes} | incidents ${t.inc} | contact ${t.contact.toFixed(0)} s | off-road ${(t.off || 0).toFixed(0)} car-s`); }
