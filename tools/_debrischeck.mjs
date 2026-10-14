// scratch: ROADSIDE DEBRIS (cones.js DEBRIS). One object of each kind on an empty level, a car driven straight through it at 60 km/h, then
// again back through where it ended up. Expect: pallet / box break on hit 1; crate / sandbag on hit 2; bin / barrel / exhaust / bumper are
// knocked away and never break; a tarp is driven over (car speed kept). Plus: how many debris pieces the highway LITTER places per km.
// node tools/_debrischeck.mjs [srcDir]
const SRC = process.argv[2] || '../src';
const L = await import(SRC + '/lab.js'), V = await import(SRC + '/vehicle.ts'), C = await import(SRC + '/cones.js'), H = await import(SRC + '/highway.js');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const lab = L.LEVELS.find((l) => l.id === 'lab') || L.LEVELS[0]; L.setLevel(lab.id);
for (const [kind, D] of Object.entries(C.DEBRIS)) {
  L.CONES.length = 0; L.CONES.push({ kind, x: 20, y: 0, rot: 0 });
  const cones = C.createCones(); cones.reset();
  const k = cones.list[0], car = V.makeCar('saloon-rwd'); let passes = 0, vMin = 99;
  for (let pass = 0; pass < 2; pass++) {
    const y = k.y, dir = pass ? -1 : 1; V.reset(car, k.x - dir * 15, y, pass ? Math.PI : 0); car.vx = dir * 60 / 3.6; car.vy = 0;
    for (let t = 0; t < 1.5; t += V.PHYSICS_STEP_SECONDS) { cones.step(car, V.PHYSICS_STEP_SECONDS); V.step(car, { steer: 0, throttle: 0.25, brake: 0, handbrake: 0, reverse: 0 }, V.PHYSICS_STEP_SECONDS); vMin = Math.min(vMin, Math.hypot(car.vx, car.vy) * 3.6); }
    passes++;
    if (D.breaks && pass + 1 === D.breaks) ok(k.kind === D.into, `${kind}: broken into ${D.into} after hit ${pass + 1} (is ${k.kind})`);
    if (D.breaks === 2 && pass === 0) ok(k.kind === kind, `${kind}: survives hit 1 (is ${k.kind})`);
  }
  if (!D.breaks) ok(k.kind === kind && (k.moved || D.flat), `${kind}: never breaks, ${D.flat ? 'driven over' : 'knocked away'} (moved ${!!k.moved}, ${Math.hypot(k.x - 20, k.y).toFixed(1)} m)`);
  if (kind === 'tarp') ok(vMin > 50, `tarp: the car keeps its speed (slowest ${vMin.toFixed(0)} km/h)`);
}
// how much the highway litter now places
const lv = H.createHighway(4242, 'motorway'); lv.id = 'dbk'; L.LEVELS.push(lv); L.setLevel(lv.id);
const n = {}; for (const c of lv.cones) n[c.kind] = (n[c.kind] || 0) + 1;
const deb = Object.keys(C.DEBRIS).reduce((a, k) => a + (n[k] || 0), 0), km = (lv._hw.pts[lv._hw.pts.length - 1].s - lv._hw.pts[0].s) / 1000;
console.log(`highway first window (${km.toFixed(1)} km, litter 1): ${JSON.stringify(n)} -> ${(deb / km).toFixed(0)} debris / km`);
ok(deb / km > 20, 'debris is there to see (> 20 / km at the default density)');
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
