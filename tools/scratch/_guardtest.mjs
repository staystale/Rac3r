// scratch (2026-10-06, v2 slips): the TREADMILL GUARD on the new roads. On the secret side road = on the road (no countdown, no reset);
// up a long slip = the countdown waits, and driving on past OFF_HARD ends it as "EXIT TAKEN"; on plain grass the countdown runs as before.
// node tools/_guardtest.mjs [srcDir]
const SRC = process.argv[2] || '../../src';
const L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js'), V = await import(SRC + '/vehicle.ts');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
for (const seed of [4242, 77, 1234, 9001]) for (const want of ['side', 'slip']) {
  // a FRESH level per check, driven (teleported) up the left lane until the feature is 40-300 m ahead, then tested straight away
  const lv = H.createHighway(seed, 'motorway'); lv.id = `gt-${seed}-${want}`; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = V.makeCar('saloon-rwd'), P = () => lv._hw.pts; let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, side = null, slip = null;
  const sit = (x, y, h) => { V.reset(c, x, y, h); c.vx = Math.cos(h) * 20; c.vy = Math.sin(h) * 20; };
  for (let k = 0; k < 4000 && !side && !slip; k++) { s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); sit(p.x, p.y, p.h); H.stepHighway(lv, c); H.highwayGuard(lv, c, 1 / 120);
    if (want === 'side') { const q = P().find((q) => q.sideOff > lv._hw.geo.hw + 10 && q.s > s + 40 && q.s < s + 300); if (q) side = q.s; }
    else { const pr = lv.props.find((pr) => { if (pr.kind !== 'slip' || pr.type !== 'long') return false; const f = H.roadFrame(lv, pr.x, pr.y, s); return f.s > s + 40 && f.s < s + 300; }); if (pr) slip = pr; } }
  if (want === 'side' && !side) { console.log(`--   seed ${seed}: no side road in 20 km`); continue; }
  if (want === 'slip' && !slip) { console.log(`--   seed ${seed}: no long slip in 20 km`); continue; }
  if (want === 'side') {
    // drive 120 m along the side road (sideOff changes along it: read it at each step)
    let worst = null, warned = 0;
    for (let d = 0; d < 120; d += 0.25) { const ss = side + d, q = P().find((q) => Math.abs(q.s - ss) <= 2); const p = H.roadPose(lv, ss, -(q && q.sideOff || 0)); sit(p.x, p.y, p.h); H.stepHighway(lv, c); const w = H.highwayGuard(lv, c, 1 / 120) || worst; worst = w; if (lv._hw.warn) warned++; }
    ok(!worst && !warned, `seed ${seed}: 120 m on the side road -> reset ${worst || 'none'}, countdown frames ${warned}`);
  }
  else {
    // up the slip at 20 m/s: along its line, then on past its end over the grass
    let why = null, warned = 0, t = 0; const Lp = slip.line;
    for (let k = 1; k < Lp.length && !why; k++) for (let u = 0; u < 1 && !why; u += 0.02) { const x = Lp[k - 1][0] + (Lp[k][0] - Lp[k - 1][0]) * u, y = Lp[k - 1][1] + (Lp[k][1] - Lp[k - 1][1]) * u, h = Math.atan2(Lp[k][1] - Lp[k - 1][1], Lp[k][0] - Lp[k - 1][0]); sit(x, y, h); H.stepHighway(lv, c); why = H.highwayGuard(lv, c, 1 / 120); t += 1 / 120; if (lv._hw.warn) warned++; }
    const off = H.roadFrame(lv, Lp[Lp.length - 1][0], Lp[Lp.length - 1][1], null).off;
    ok(!warned, `seed ${seed}: up a ${slip.len | 0} m slip (ends ${Math.abs(off).toFixed(0)} m out) -> countdown frames ${warned}, reset ${why || 'none'}`);
  }
}
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
