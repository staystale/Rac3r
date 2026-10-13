// scratch (2026-10-06, dirt on the highway road): after every window rebuild, sample the CARRIAGEWAY (|off| < half width - 0.3, every
// 2 m along, 5 across) and count points whose static ground (lab.js cleanAt) is not tarmac - grouped by what it is and by where along
// the window (behind the car / ahead) - plus the wear-making rule: a cell is only created where cleanAt can wear. node tools/_roadground.mjs [preset]
const PRESET = process.argv[2] || 'motorway';
const L = await import('../src/lab.js'), H = await import('../src/highway.js'), V = await import('../src/vehicle.ts');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let total = 0, bad = 0; const by = {}, eg = [];
for (const seed of [4242, 77, 1234]) {
  const lv = H.createHighway(seed, PRESET); lv.id = `rg-${seed}`; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = V.makeCar('saloon-rwd'), hw = lv._hw.geo.hw;
  let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s;
  for (let k = 0; k < 12000 / 5; k++) {
    s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(c, p.x, p.y, p.h);
    const ds = H.stepHighway(lv, c); s -= ds;
    if (!ds) continue;
    const sp = H.roadSpan(lv);
    for (let q = sp.s0 + 2; q < sp.s1 - 2; q += 2) for (const f of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const o = H.roadPose(lv, q, f * (hw - 0.3)); const g = L.cleanAt(o.x, o.y), z = L.zoneSurfaceAt(o.x, o.y).id; total++;
      if (g === 'tarmac') continue;
      bad++; const where = q < s ? 'behind' : 'ahead', key = `${g}/zone ${z}/${where}`; by[key] = (by[key] || 0) + 1;
      if (eg.length < 12) eg.push(`seed ${seed} s ${q | 0} (car ${s | 0}, window ${sp.s0 | 0}..${sp.s1 | 0}) off ${(f * (hw - 0.3)).toFixed(1)}: ${g} zone ${z}`);
    }
  }
}
console.log(`${PRESET}: carriageway samples ${total}, not tarmac ${bad}`);
for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log('  ', n, k);
for (const e of eg) console.log('  e.g.', e);
console.log(bad ? 'ROAD NOT TARMAC' : 'ALL OK');
