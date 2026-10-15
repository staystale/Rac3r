// scratch: SPEED CAMERAS (highway.js speedCamera). A car is carried up the road at a set speed for 14 km (4+ gantries): under 70 mph
// = never caught; 90 mph = caught at every gantry, once each, fine 100 + 10 x 20 = $300; 200 mph = the x2 band. node tools/_camcheck.mjs [hwPath]
const HP = process.argv[2] || '../../src/highway.js';
const L = await import('../../src/lab.js'), H = await import(HP), V = await import('../../src/vehicle.ts');
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
for (const mph of [65, 90, 200]) {
  const lv = H.createHighway(4242, 'motorway'); lv.id = 'cam' + mph; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = V.makeCar('saloon-rwd'), v = mph / 2.23694, dt = 1 / 120;
  let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, gantries = new Set(), hits = [];
  for (let t = 0; s < 14300; t += dt) { s += v * dt; const p = H.roadPose(lv, s, lv._hw.geo.centres[1]); V.reset(c, p.x, p.y, p.h); c.vx = Math.cos(p.h) * v; c.vy = Math.sin(p.h) * v;
    H.stepHighway(lv, c); for (const pr of lv.props) if (pr.kind === 'gantry') gantries.add(pr); const r = H.speedCamera(lv, c); if (r) hits.push(r); }
  const passed = [...gantries].filter((g) => g._camHit).length;
  console.log(`  ${mph} mph: gantries seen ${gantries.size}, passed ${passed}, caught ${hits.length}${hits[0] ? ` (${hits[0].kmh} km/h, ${hits[0].mph} mph, fine $${hits[0].fine})` : ''}`);
  if (mph < 70) ok(hits.length === 0 && passed >= 4, `${mph} mph: under the limit, never caught (${passed} gantries passed)`);
  else ok(hits.length === passed && passed >= 4, `${mph} mph: caught once at each of ${passed} gantries`);
  if (mph === 90) ok(hits[0] && hits[0].fine === 300, `90 mph: fine $300 (got ${hits[0] && hits[0].fine})`);
  if (mph === 200) ok(hits[0] && hits[0].fine === 2800, `200 mph: x2 band, fine $2800 (got ${hits[0] && hits[0].fine})`);
}
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
