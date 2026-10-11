// pacesuite.mjs — the highway AI A/B: hwracecheck on 3 road seeds x 3 difficulties (Mobile / Realish / Real), traffic 100 %, run in
// PARALLEL child processes, then ONE table: pace (mean, % under 130, passes per km) + safety (racer-racer / racer-traffic contact steps,
// off-road car-steps, wrecks). A single 45 s race is too noisy to tune on (2026-10-06: one knob moved a seed +30 km/h and another -30).
// node tools/pacesuite.mjs [label] [seconds]     (HWT='{"aB":0.55}' passes through to every run)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [LABEL = 'run', T = '45'] = process.argv.slice(2);
const SEEDS = (process.env.PSEEDS || '4242,77,1234').split(',').map(Number), DIFFS = [0, 2, 4];
const one = (seed, d) => new Promise((res) => {
  let out = '';
  const p = spawn(process.execPath, ['tools/hwracecheck.mjs', T, String(d), '1', 'motorway', String(seed)], { env: process.env });
  p.stdout.on('data', (b) => (out += b)); p.stderr.on('data', (b) => (out += b));
  p.on('close', () => res({ seed, d, out }));
});
const runs = await Promise.all(SEEDS.flatMap((s) => DIFFS.map((d) => one(s, d))));
const num = (re, s) => { const m = s.match(re); return m ? +m[1] : NaN; };
let lines = [`pacesuite ${LABEL} | HWT ${process.env.HWT || '{}'} | ${T} s, traffic 1, motorway`], tot = { mean: 0, slow: 0, ppk: 0, rr: 0, rt: 0, off: 0, far: 0, bad: 0 };
for (const r of runs) {
  const P = r.out.split('\n').find((l) => l.startsWith('PACE')) || '', C = r.out.split('\n').find((l) => l.includes('contacts:')) || '';
  const row = { mean: num(/mean (\d+)/, P), slow: num(/<130 (\d+)%/, P), ppk: num(/passes ([\d.]+)/, P), rr: num(/racer-racer (\d+)/, C), rt: num(/racer-traffic (\d+)/, C), off: num(/off-road car-steps (\d+)/, C), far: num(/far off (\d+)/, C) };
  const wreck = (C.match(/wrecked racers (\S+)/) || [])[1], bad = (Number.isNaN(row.far) ? row.off : row.far) >= 120 || (wreck && wreck !== 'none') || Number.isNaN(row.mean);
  for (const k of ['mean', 'slow', 'ppk', 'rr', 'rt', 'off', 'far']) tot[k] += row[k] || 0; if (bad) tot.bad++;
  lines.push(`${bad ? 'BAD ' : '    '}seed ${String(r.seed).padStart(4)} d${r.d}: mean ${row.mean} km/h | <130 ${row.slow}% | passes ${row.ppk}/km | contacts rr ${row.rr} rt ${row.rt} | off ${row.off} far ${row.far} | wrecked ${wreck}${Number.isNaN(row.mean) ? ' | ERROR ' + r.out.slice(-200) : ''}`);
}
const n = runs.length;
lines.push(`TOTAL ${LABEL}: mean ${(tot.mean / n).toFixed(1)} km/h | <130 ${(tot.slow / n).toFixed(0)}% | passes ${(tot.ppk / n).toFixed(1)}/km | rr ${tot.rr} rt ${tot.rt} | off ${tot.off} far ${tot.far} | BAD (far off >= 120 or wreck) runs ${tot.bad}/${n}`);
console.log(lines.join('\n'));
mkdirSync('shots/look', { recursive: true });
writeFileSync(`shots/look/suite-${LABEL}.txt`, lines.join('\n') + '\n');
