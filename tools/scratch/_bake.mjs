// _bake.mjs - write the K13 dials (brake 1, lock 1, grip 0.5, power 1) into cars.ts
import fs from 'node:fs';
const file = new URL('../../src/cars.ts', import.meta.url);
let src = fs.readFileSync(file, 'utf8');
const REAL = {
  'hatch-fwd': [1.42, 0.95, 345, 245, 0.42], 'hatch-rwd': [1.40, 0.97, 345, 340, 0.42],
  'saloon-rwd': [1.43, 1.00, 548, 480, 0.40], 'wrz-awd': [1.46, 0.95, 564, 300, 0.48],
  'estate-4x4': [1.38, 0.92, 349, 350, 0.46], 'muscle-rwd': [1.36, 0.95, 1653, 450, 0.60],
  'rally-4x4': [1.54, 1.10, 662, 500, 0.48], 'track-rwd': [1.80, 1.80, 818, 1000, 0.90],
  'naffcar': [1.59, 1.40, 2438, 670, 0.54], 'tractor': [1.28, 0.70, 1441, 350, 2.9],
  'mini-fwd': [1.39, 0.80, 126, 76, 0.41], 'lambo-awd': [1.57, 1.08, 1078, 610, 0.43],
  'mikra-r1': [1.43, 1.00, 189, 120, 0.44], 'kit-2l': [1.47, 1.15, 562, 280, 0.44],
  'rx-super': [1.54, 1.20, 1005, 600, 0.60], 'banger-f2': [1.36, 1.00, 392, 200, 0.66],
  'grass-special': [1.41, 1.10, 372, 300, 0.65], 'drift-s13': [1.39, 1.05, 663, 600, 0.42],
  'f2-rwd': [1.71, 1.80, 657, 620, 0.66],
};
const curves = {};
src.replace(/const (CURVE_\w+): Curve\s*=\s*(\[[\s\S]*?\]\]);/g, (m, name, body) => {
  curves[name] = JSON.parse(body.replace(/\s+/g, ' ')); return m;
});
const fmtCurve = (name, pts) => {
  let line = `const ${name}: Curve = [`, out = [];
  const parts = pts.map(([r, t]) => `[${r}, ${t}]`);
  let cur = line;
  parts.forEach((p, i) => {
    const add = p + (i < parts.length - 1 ? ', ' : ']];');
    if ((cur + add).trimEnd().length > 99) { out.push(cur.trimEnd()); cur = '  '; }
    cur += add;
  });
  out.push(cur.replace(/\]\]\];$/, ']];'));
  return out.join('\n');
};
const used = {};   // curve name -> [car ids]
const rows = src.split(/\n  \{\n/);
for (const row of rows) {
  const id = (row.match(/id: '([\w-]+)'/) || [])[1];
  const cv = (row.match(/curve: (CURVE_\w+)/) || [])[1];
  if (id && cv) (used[cv] ||= []).push(id);
}
const newCurves = {};
const rename = { 'hatch-rwd': 'CURVE_HATCH_RWD', 'naffcar': 'CURVE_NAFFCAR' };
for (const [cv, ids] of Object.entries(used)) {
  for (const id of ids) {
    const r = REAL[id]; const k = r[3] / r[2];
    const name = rename[id] || cv;
    newCurves[name] = curves[cv].map(([rpm, t]) => [rpm, Math.round(t * k)]);
  }
}
// curve constants
src = src.replace(/const (CURVE_\w+): Curve\s*=\s*(\[[\s\S]*?\]\]);/g, (m, name) => {
  let s = fmtCurve(name, newCurves[name]);
  if (name === 'CURVE_HATCH') s += '\n' + fmtCurve('CURVE_HATCH_RWD', newCurves.CURVE_HATCH_RWD);
  if (name === 'CURVE_MUSCLE') s += '\n' + fmtCurve('CURVE_NAFFCAR', newCurves.CURVE_NAFFCAR);
  return s;
});
// rows
src = src.replace(/\n  \{\n([\s\S]*?)\n  \},/g, (m, body) => {
  const id = (body.match(/id: '([\w-]+)'/) || [])[1];
  if (!id || !REAL[id]) return m;
  const r = REAL[id]; const single = /cls: 'single'/.test(body);
  body = body.replace(/brakeBiasF: [\d.]+/, `brakeBiasF: ${single ? '0.60' : '0.65'}`);
  body = body.replace(/ mu: ([\d.]+)/, (_, mu) => {
    const v = Number(mu) * (1 + (r[1] / r[0] - 1) * 0.5);
    return ` mu: ${Number(v.toFixed(2))}`;
  });
  body = body.replace(/dragC: [\d.]+/, `dragC: ${r[4]}`);
  if (rename[id]) body = body.replace(/curve: CURVE_\w+/, `curve: ${rename[id]}`);
  if (id === 'muscle-rwd') body = body.replace(/gears: \[[^\]]*\]/, 'gears: [3.42, 1.95, 1.22, 0.76]');
  return `\n  {\n${body}\n  },`;
});
fs.writeFileSync(file, src);
console.log(Object.keys(newCurves).join(' '));
