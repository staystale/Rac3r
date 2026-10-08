// scratch (2026-10-06, SCENERY v2): fields / hedges / villages along 15 km of each preset x 3 seeds. Checks: how many of each; NO hedge
// point and NO field corner within 4 m of the motorway edge or on the secret side road; no hedge across a bridge approach / slip lane /
// river (any hedge point inside a lane ribbon or on water); the per-step cost of stepHighway (the rebuild with fields); and that a wheel
// ON the motorway is still tarmac (a field never covers the road). node tools/_scenerycheck.mjs [srcDir]
const SRC = process.argv[2] || '../src';
const L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js'), V = await import(SRC + '/vehicle.js');
let bad = 0; const fail = (m) => { bad++; console.log('FAIL ' + m); };
for (const preset of ['motorway', 'interstate', 'dual', 'walled']) for (const seed of [4242, 77, 1234]) {
  const lv = H.createHighway(seed, preset); lv.id = `scn-${preset}-${seed}`; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = V.makeCar('saloon-rwd'), hw = lv._hw.geo.hw, seen = new Set(), T = { field: 0, wheat: 0, rapeseed: 0, plough: 0, meadow: 0, pasture: 0, yard: 0, hedge: 0, village: 0, house: 0, church: 0, beast: 0 };
  let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, near = 0, onLane = 0, worstMs = 0, totMs = 0, steps = 0, roadNot = 0, eg = '';
  for (let k = 0; k < 15000 / 5; k++) {
    s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(c, p.x, p.y, p.h);
    const t0 = performance.now(); H.stepHighway(lv, c); const ms = performance.now() - t0; worstMs = Math.max(worstMs, ms); totMs += ms; steps++;
    if (k % 6 === 0) for (const off of [-hw + 0.4, 0, hw - 0.4]) { const q = H.roadPose(lv, s, off); if (L.zoneSurfaceAt(q.x, q.y).id !== 'tarmac') roadNot++; }
    const LOOK = { wheat: 'wheat', rapeseed: 'rapeseed', plough: 'plough', pastureG: 'pasture' };
    for (const z of lv.zones) if (z.field != null && !z.hedge && !z.house && !seen.has(z)) { seen.add(z); T.field++; T[LOOK[z.art] || (z.surface.id === 'grassLong' ? 'meadow' : 'yard')]++; }
    for (const pr of lv.props) if (pr.field != null && !seen.has(pr)) { seen.add(pr); if (pr.church) { T.church++; T.village++; } else if (pr.house) T.house++; else if (pr.kind === 'beast') T.beast++; }
    if (lv.barriers.some((b) => b.kind === 'hedge')) fail(`${preset}/${seed}: a solid hedge barrier is back (hedges are long grass now)`);
    for (const b of lv.zones) if (b.hedge && !seen.has(b)) { seen.add(b); T.hedge++;
      // the long-grass border's corners + edge midpoints against the road edge, the side road, lanes and water
      const co = Math.cos(b.rot), si = Math.sin(b.rot), pts = [];
      for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) pts.push([b.x + co * u * b.w / 2 - si * v * b.h / 2, b.y + si * u * b.w / 2 + co * v * b.h / 2]);
      for (const [x, y] of pts) { const f = H.roadFrame(lv, x, y, s); if (!f) continue;
        const P = lv._hw.pts, pi = P[Math.max(0, Math.min(P.length - 1, Math.round((f.s - P[0].s) / 4)))];
        if (Math.abs(f.off) < hw + 4) { near++; eg = `hedge at s ${f.s | 0} off ${f.off.toFixed(1)}`; }
        else if (pi && pi.sideOff && f.off < 0 && Math.abs(-f.off - pi.sideOff) < 4.5) { near++; eg = `hedge on the side road at s ${f.s | 0}`; }
        const g = L.groundAt(x, y).surface.id; if (g === 'puddle' || (L.zoneSurfaceAt(x, y).id === 'tarmac' && Math.abs(f.off) > hw + 1)) { onLane++; eg = `hedge on ${g} at s ${f.s | 0} off ${f.off.toFixed(1)}`; } } }
  }
  const avg = totMs / steps;
  if (preset !== 'walled' && (T.field < 40 || T.hedge < 60)) fail(`${preset}/${seed}: too few fields ${JSON.stringify(T)}`);
  if (preset === 'walled' && T.field) fail(`${preset}/${seed}: fields on the walled road`);
  if (near) fail(`${preset}/${seed}: ${near} hedge points by the road / on the side road (e.g. ${eg})`);
  if (onLane) fail(`${preset}/${seed}: ${onLane} hedge points on a lane / water (e.g. ${eg})`);
  if (roadNot) fail(`${preset}/${seed}: ${roadNot} motorway samples not tarmac`);
  console.log(`${preset.padEnd(10)} ${seed}: ${JSON.stringify(T)} | stepHighway avg ${avg.toFixed(2)} ms, worst ${worstMs.toFixed(1)} ms | zones ${lv.zones.length} barriers ${lv.barriers.length} props ${lv.props.length}`);
}
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
