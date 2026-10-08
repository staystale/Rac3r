// scratch (2026-10-06, user: "didnt see slip roads on dual carriage way"): how far up the road the FIRST and SECOND slip are, per
// preset x 10 seeds (km from the start). node tools/_firstslip.mjs [srcDir]
const SRC = process.argv[2] || '../src';
const L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js'), V = await import(SRC + '/vehicle.js');
for (const preset of ['motorway', 'interstate', 'dual', 'walled']) {
  const out = [];
  for (let seed = 1; seed <= 10; seed++) {
    const lv = H.createHighway(seed * 977, preset); lv.id = `fs-${preset}-${seed}`; L.LEVELS.push(lv); L.setLevel(lv.id);
    const c = V.makeCar('saloon-rwd'), s0 = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, got = []; let s = s0;
    const seen = new Set();
    for (let k = 0; k < 9000 / 5 && got.length < 2; k++) { s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(c, p.x, p.y, p.h); s -= H.stepHighway(lv, c);
      for (const pr of lv.props) if (pr.kind === 'board' && pr.blue && !seen.has(pr)) { seen.add(pr); const f = H.roadFrame(lv, pr.x, pr.y, s); if (f) got.push(((f.s - s0 + 90) / 1000).toFixed(1)); } }
    out.push(got.join('/') || '-');
  }
  console.log(`${preset.padEnd(10)} first/second slip km: ${out.join('  ')}`);
}
