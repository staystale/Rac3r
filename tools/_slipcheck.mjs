// scratch: SLIP ROADS + BRIDGES (highway.js extras) over 12 km of road on 3 seeds x 3 presets. Checks: how many of each; spacing; that
// no bridge abutment / gate / solid stands on the motorway's tarmac or the verge strip the AI dodges on (hw + 0.9 m) - the FOOTPRINT,
// corners included (CLAUDE.md: never the centre); that the slip ribbon is tarmac where it starts and grass-free; nothing on a walled road.
// node tools/_slipcheck.mjs [srcDir]   (srcDir default ../src - point it at a scratch copy to test .next files)
const SRC = process.argv[2] || '../src';
const L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js'), V = await import(SRC + '/vehicle.ts');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let bad = 0; const fail = (m) => { bad++; console.log('FAIL ' + m); };
for (const preset of ['motorway', 'interstate', 'dual', 'walled']) for (const seed of [4242, 77, 1234]) {
  const lv = H.createHighway(seed, preset); lv.id = `sc-${preset}-${seed}`; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = V.makeCar('saloon-rwd'), seen = new Map(), hw = lv._hw.geo.hw;
  const tally = { slip: 0, short: 0, long: 0, side: 0, bridge: 0, river: 0, solar: 0, cow: 0, cone: 0, boat: 0 }; let wetOnRoad = 0, laneOnRoad = 0, sideMax = 0, sideOn = 0, wasSide = false;
  let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, lastSlip = null, minGap = Infinity, onRoad = 0, worst = '';
  for (let k = 0; k < 12000 / 5; k++) { s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(c, p.x, p.y, p.h); H.stepHighway(lv, c);
    for (const pr of lv.props) { if (seen.has(pr)) continue; seen.set(pr, 1);
      if (pr.kind === 'slip' && !pr.type) continue;   // a piece of the secret side road's edge lines
      if (pr.kind === 'slip') { tally.slip++; tally[pr.type]++; if (lastSlip != null) minGap = Math.min(minGap, pr._s - lastSlip); lastSlip = pr._s;
        // the slip's start must be tarmac and join the road: 3 m inside its start (on the slip), the ground is tarmac
        const [x1, y1] = pr.line[1]; const g = L.zoneSurfaceAt(x1, y1); if (g.id !== 'tarmac') fail(`${preset}/${seed} slip at ${pr._s | 0}: start is ${g.id}`); }
      if (pr.kind === 'bridge') { tally.bridge++; if (pr.cow) tally.cow++; if (pr.cone) tally.cone++; }
      if (pr.kind === 'river') { tally.river++; if (pr.boat) tally.boat++; }
      if (pr.kind === 'solarfarm') tally.solar++; }
    // (v2) the motorway's tarmac (|off| < hw - 0.3) is never water, and is never the gravel / dirt of an approach; the side road is tarmac
    if (k % 4 === 0) for (const off of [-hw + 0.3, -hw / 2, 0, hw / 2, hw - 0.3]) { const p = H.roadPose(lv, s, off), sf = L.zoneSurfaceAt(p.x, p.y); if (sf.id !== 'tarmac') laneOnRoad++; const g = L.groundAt(p.x, p.y); if (g.surface.id === 'puddle') wetOnRoad++; }
    { const P = lv._hw.pts, f = H.roadFrame(lv, H.roadPose(lv, s, 0).x, H.roadPose(lv, s, 0).y, s), pi = P.find((q) => Math.abs(q.s - s) < 2.1); if (!(pi && pi.sideOff)) wasSide = false; if (pi && pi.sideOff) { if (!wasSide) tally.side++; wasSide = true; sideOn++; sideMax = Math.max(sideMax, pi.sideOff); const p = H.roadPose(lv, s, -pi.sideOff); if (L.zoneSurfaceAt(p.x, p.y).id !== 'tarmac') fail(`${preset}/${seed} side road not tarmac at ${s | 0}`); } }
    // every SOLID's footprint (4 corners + centre) against the road: must be > hw + 0.9 off the centreline
    for (const b of lv.solids) { if (b._ck) continue; b._ck = 1; if (!['bridge', 'gate'].includes(b.kind)) continue;
      const co = Math.cos(b.rot), si = Math.sin(b.rot);
      for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = b.x + co * u * b.w / 2 - si * v * b.h / 2, y = b.y + si * u * b.w / 2 + co * v * b.h / 2, f = H.roadFrame(lv, x, y, s);
        if (f && Math.abs(f.off) < hw + 0.9) { onRoad++; worst = `${b.kind} at s ${f.s | 0}, off ${f.off.toFixed(1)} (edge ${hw.toFixed(1)})`; } } }
  }
  // every preset has them since 2026-10-06 (user: "all the types of highway should have bridges and slip roads you can take")
  if (tally.slip + tally.side < 1 || tally.bridge + tally.river < 3) fail(`${preset}/${seed}: counts ${JSON.stringify(tally)}`);
  if (wetOnRoad) fail(`${preset}/${seed}: ${wetOnRoad} motorway samples are RIVER water`);
  if (laneOnRoad) fail(`${preset}/${seed}: ${laneOnRoad} motorway samples are not tarmac (an approach / bank on the road)`);
  if (onRoad) fail(`${preset}/${seed}: ${onRoad} solid corners on the road / verge strip (e.g. ${worst})`);
  console.log(`${preset.padEnd(10)} ${seed}: ${JSON.stringify(tally)} | slips >= ${minGap === Infinity ? '-' : (minGap | 0)} m apart | solids on road ${onRoad} | side road ${sideOn * 5} m (max ${sideMax.toFixed(1)} m out)`);
}
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
