// S-C (2026-10-07): COWS + SHEEP as loose objects. A saloon driven (kinematic, straight) through a lab sheep / cow at set speeds:
//   sheep  < 30 mph: pushed, stays a sheep        > 30 mph: pops into 'fluff' (a drive-over patch) + white puffs queued
//   cow    < 40 mph: pushed, stays upright, solid  > 40 mph: TIPS (still a cow, still solid)    the car loses speed like a bale hit
// + the highway: field animals are in the loose stream (no 'beast' props left), and a cleared field takes its animals with it.
// node tools/_animalcheck.mjs [srcDir]
const SRC = process.argv[2] || '../src';
const L = await import(SRC + '/lab.js'), C = await import(SRC + '/cones.js'), V = await import(SRC + '/vehicle.js'), H = await import(SRC + '/highway.js');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
L.setLevel('lab');
function run(kind, kmh) {
  const cs = C.createCones(); cs.reset();
  // ONE animal alone (the lab lane has a crate / bin in front of it, which the car would launch into the animal first)
  const k = cs.list.find((o) => o.kind === kind); cs.list.splice(0, cs.list.length, k); cs.rebuildGrid(); const tx = k.x, ty = k.y;
  const car = V.makeCar('saloon-rwd'); V.reset(car, tx - 12, ty, 0); const v0 = kmh / 3.6; car.vx = v0; car.vy = 0; car.yawRate = 0;
  const dt = 1 / 120; let puffs = 0;
  for (let t = 0; t < 1.6; t += dt) { car.x += car.vx * dt; car.y += car.vy * dt; cs.step(car, dt); puffs += cs.drainHits().filter((h) => h.kind === 'fluff').length; }
  return { kind: k.kind, tipped: !!k.tipped, moved: Math.hypot(k.x - tx, k.y - ty), lost: (v0 - Math.hypot(car.vx, car.vy)) * 3.6, puffs };
}
for (const [kind, kmh, want] of [['sheep', 30, 'sheep'], ['sheep', 70, 'fluff'], ['cow', 40, 'cow'], ['cow', 90, 'tipped']]) {
  const r = run(kind, kmh), s = `${kind} hit at ${kmh} km/h: now ${r.kind}${r.tipped ? ' (tipped)' : ''}, moved ${r.moved.toFixed(1)} m, car lost ${r.lost.toFixed(1)} km/h, fluff puffs ${r.puffs}`;
  if (want === 'sheep') ok(r.kind === 'sheep' && r.moved > 0.3 && r.lost < 5, s + '  (want: pushed, not popped, light)');
  if (want === 'fluff') ok(r.kind === 'fluff' && r.puffs > 0 && r.lost < 8, s + '  (want: popped into fluff, light)');
  if (want === 'cow') ok(r.kind === 'cow' && !r.tipped && r.lost > 3, s + '  (want: upright, solid - the car slows)');
  if (want === 'tipped') ok(r.kind === 'cow' && r.tipped && r.lost > 5, s + '  (want: tipped, still solid)');
}
// the bale for comparison (the user: cows "more like hay bails impact weight")
{ const cs = C.createCones(); cs.reset(); const k = cs.list.find((o) => o.kind === 'bale' && o.y > 280); cs.list.splice(0, cs.list.length, k); cs.rebuildGrid(); const car = V.makeCar('saloon-rwd'); V.reset(car, k.x - 12, k.y, 0); car.vx = 40 / 3.6; car.vy = 0; car.yawRate = 0;
  for (let t = 0; t < 1.6; t += 1 / 120) { car.x += car.vx / 120; car.y += car.vy / 120; cs.step(car, 1 / 120); }
  console.log(`     (bale at 40 km/h for comparison: car lost ${(40 - Math.hypot(car.vx, car.vy) * 3.6).toFixed(1)} km/h)`); }
// ---- highway
for (const seed of [4242, 77]) {
  const lv = H.createHighway(seed, 'motorway'); lv.id = 'ac-' + seed; L.LEVELS.push(lv); L.setLevel(lv.id);
  const car = V.makeCar('saloon-rwd'); let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, animals = lv.cones.filter((c) => c.kind === 'sheep' || c.kind === 'cow').length;
  let orphan = 0;
  for (let i = 0; i < 2000; i++) { s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(car, p.x, p.y, p.h); H.stepHighway(lv, car);
    const st = lv._hw; animals += st.looseNew.filter((c) => c.kind === 'sheep' || c.kind === 'cow').length;
    // every animal waiting to spawn must belong to a field that still has its zone
    const live = new Set(lv.zones.filter((z) => z.field != null).map((z) => z.field));
    orphan += st.looseNew.filter((c) => (c.kind === 'sheep' || c.kind === 'cow') && !live.has(c.field)).length;
    st.looseNew.length = 0; if (st.goneFields) st.goneFields.clear(); }
  ok(animals > 50 && !lv.props.some((p) => p.kind === 'beast') && orphan === 0, `highway seed ${seed}, 10 km: ${animals} animals in the loose stream, 'beast' props ${lv.props.filter((p) => p.kind === 'beast').length}, animals left in a cleared field ${orphan}`);
}
console.log(bad ? `FAIL (${bad})` : 'ALL OK');
