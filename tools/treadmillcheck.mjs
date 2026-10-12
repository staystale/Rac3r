// treadmillcheck.mjs — HIGHWAY v2 (the treadmill, src/highway.js): does the road always climb the screen, join smoothly, stay bounded,
// and does the guard put a reversing car back? A bench driver drives N km per preset; then a scripted reverse.
// node tools/treadmillcheck.mjs [km] [car] [file]   (file: ../src/highway.next.js to test a patch before it goes live)
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/autodrive.js';
import { createCones } from '../src/cones.js';
const KM = +(process.argv[2] || 10), carId = process.argv[3] || 'saloon-rwd';
const H = await import(process.argv[4] || '../src/highway.js');
const deg = (r) => (r * 180 / Math.PI).toFixed(1);
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
for (const preset of Object.keys(H.HW_PRESETS)) {
  const lv = H.createHighway(4242 + preset.length, preset); lv.id = 'hw-' + preset; L.LEVELS.push(lv); L.setLevel(lv.id);
  const car = makeCar(carId); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
  // the LOOSE ROADSIDE (cones / tyres / stacks / chevrons) streamed exactly as main.js does it
  const cfg = lv._cfg, geo = H.laneGeo(cfg);
  const cones = createCones(); cones.reset(); let maxLoose = cones.list.length, chev = 0, chevWrong = 0, inLane = 0, looseAll = 0, objMs = 0;
  const audit = (objs) => { for (const o of objs) { looseAll++; const q = L.querySubtrack(lv.subtrack, o.x, o.y), pt = lv.subtrack.pts[q.seg ?? 0];
    const offN = pt ? (o.x - pt.x) * pt.nx + (o.y - pt.y) * pt.ny : 0;
    if (o.kind === 'chevron') { chev++;
      // GEOMETRY, not the curv field: the real heading change over +-30 m; the board must sit on the side AWAY from the turn and its
      // arrows (+x after rot, as render.ts draws them) must point INTO the turn
      const hp = lv._hw.pts, j = hp.findIndex((p) => p.s >= o._s), a = hp[Math.max(0, j - 6)], m = hp[j], b = hp[Math.min(hp.length - 1, j + 6)];
      const h1 = Math.atan2(m.y - a.y, m.x - a.x), h2 = Math.atan2(b.y - m.y, b.x - m.x), turn = Math.sign(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
      const inX = -Math.sin(h1) * turn, inY = Math.cos(h1) * turn;   // unit vector towards the inside of the bend
      const side = (o.x - m.x) * inX + (o.y - m.y) * inY, rr = o.rot ?? o.ang, arrow = Math.cos(rr) * inX + Math.sin(rr) * inY;   // live objects (the first window) carry it as ang
      if (!(side < 0 && arrow > 0.8)) { chevWrong++; if (process.env.CHEVDBG) console.log(`    chev s ${o._s.toFixed(0)} curv ${(m.curv * 1e4).toFixed(2)}e-4 turn ${turn} dh ${((h2 - h1) * 57.3).toFixed(2)} deg side ${side.toFixed(1)} arrow ${arrow.toFixed(2)}`); } }
    // a driving lane = between the hard shoulder line and the right edge (the shoulder itself may hold litter / a cone taper)
    else if (offN > -geo.hw + cfg.shoulder + 0.2 && offN < geo.hw - 0.2) inLane++; } };
  audit(cones.list);
  let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, off = 0, worstOff = 0, rb = 0, rbMax = 0, maxProps = 0, maxPts = 0, vSum = 0, n = 0;
  let maxDev = 0, maxTurn = 0, maxDk = 0, maxK = 0, lastPt = null, behindMin = Infinity, aheadMin = Infinity;
  while (lv._hw.driven < KM * 1000 && t < KM * 200) {
    if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
    L.applyGround(car, DT); step(car, drv.drive(car, DT), DT); t += DT;
    const q = L.querySubtrack(sub, car.x, car.y);
    if (q.dist > sub.width / 2) off += DT; worstOff = Math.max(worstOff, isFinite(q.dist) ? q.dist - sub.width / 2 : 999);
    const t0 = performance.now(), ds = H.stepHighway(lv, car), ms = performance.now() - t0;
    if (ds) { rb++; rbMax = Math.max(rbMax, ms); }
    { const hw = lv._hw, t1 = performance.now(); if (hw.looseNew.length) { audit(hw.looseNew); cones.spawn(hw.looseNew); hw.looseNew.length = 0; }
      if (hw.looseCut != null) { const s0 = hw.looseCut; cones.cull((k) => k._s == null || k._s >= s0); hw.looseCut = null; }
      cones.step(car, DT); objMs += performance.now() - t1; maxLoose = Math.max(maxLoose, cones.list.length);
      // what the PLAYER SEES: loose objects within the ~170 m view (+-85 m of the car), sampled every 5 s
      if (process.env.VIEWDBG && Math.round(t / DT) % Math.round(5 / DT) === 0) { const near = cones.list.filter((k) => Math.hypot(k.x - car.x, k.y - car.y) < 85);
        console.log(`    t ${t.toFixed(0)} s: ${near.length} in view [${['tyre', 'cone', 'tyrestack', 'chevron'].map((kd) => kd + ' ' + near.filter((k) => k.kind === kd).length).join(', ')}] of ${cones.list.length} live`); } }
    if (H.highwayGuard(lv, car, DT)) { console.log('  guard fired while bench driving at', (lv._hw.driven | 0), 'm'); fails++; break; }
    const P = lv._hw.pts, st = lv._hw;
    // the window's reach either side of the car (must stay far past the view, ~170 m max)
    behindMin = Math.min(behindMin, st.q.s - P[0].s); aheadMin = Math.min(aheadMin, P[P.length - 1].s - st.q.s);
    maxProps = Math.max(maxProps, lv.props.length); maxPts = Math.max(maxPts, P.length);
    vSum += Math.hypot(car.vx, car.vy); n++;
  }
  // GEOMETRY of everything generated, point by point (heading off straight up, turn per step, curvature + its jump between steps)
  const P = lv._hw.pts; let k0 = null;
  for (let i = 1; i < P.length - 1; i++) {
    const h0 = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x), h1 = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x);
    const dev = Math.abs(Math.atan2(Math.sin(h1 + Math.PI / 2), Math.cos(h1 + Math.PI / 2))), turn = Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)));
    const k = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) / 4;
    maxDev = Math.max(maxDev, dev); maxTurn = Math.max(maxTurn, turn); maxK = Math.max(maxK, Math.abs(k)); if (k0 !== null) maxDk = Math.max(maxDk, Math.abs(k - k0)); k0 = k;
  }
  console.log(`\n${preset}: ${cfg.lanes} lanes x ${cfg.laneW} m = road ${geo.width.toFixed(1)} m; lane centres ${geo.centres.map((c) => c.toFixed(2)).join(' ')}`);
  console.log(`  ${carId}: ${(lv._hw.driven / 1000).toFixed(2)} km in ${t.toFixed(0)} s (avg ${(vSum / n * 3.6).toFixed(0)} km/h) | off ${off.toFixed(1)} s, worst ${worstOff.toFixed(1)} m`);
  console.log(`  last window: max off straight-up ${deg(maxDev)} deg (limit ${cfg.maxDeg}) | tightest R ${(1 / maxK).toFixed(0)} m | max curvature jump/step ${maxDk.toExponential(1)} (1/R) | max turn/step ${deg(maxTurn)} deg`);
  console.log(`  window: >= ${behindMin.toFixed(0)} m behind / ${aheadMin.toFixed(0)} m ahead of the car | rebuilds ${rb}, worst ${rbMax.toFixed(1)} ms | max props ${maxProps}, pts ${maxPts}`);
  console.log(`  loose roadside: ${looseAll} placed over the drive (${chev} chevrons), live max ${maxLoose}, now ${cones.list.length} | cones.step + stream ${(objMs / n * 1000).toFixed(0)} us/step avg`);
  check(off < 0.5, `${preset}: bench driver stays on the road`);
  if (!cfg.walls) {
    check(chev > 0 && chevWrong === 0, `${preset}: chevrons on the OUTSIDE of bends (${chev} placed, ${chevWrong} on the inside)`);
    check(inLane === 0, `${preset}: no litter in a driving lane (${inLane})`);
    check(maxLoose < 900, `${preset}: loose objects bounded (max ${maxLoose} live)`);
  } else check(looseAll === 0, `${preset}: walled road has no litter (${looseAll})`);
  check(maxDev * 180 / Math.PI <= cfg.maxDeg + 1, `${preset}: road always within ${cfg.maxDeg} deg of straight up`);
  // K_RATE 5e-5 /m = 2e-4 per 4 m sample; + a little for the sampled-heading estimate
  check(maxDk < 2.6e-4, `${preset}: curvature continuous (no step in steering between 4 m samples)`);
  check(behindMin > 250 && aheadMin > 600, `${preset}: road kept well past the view both ways (view <= ~170 m)`);
  // REVERSE: stop, then back down the road -> the guard must fire within ~2 s and the respawn must be ON the road, facing up it
  car.vx = 0; car.vy = 0; let fired = null, tr = 0;
  for (; tr < 6 && !fired; tr += DT) { L.applyGround(car, DT); step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 1 }, DT); H.stepHighway(lv, car); fired = H.highwayGuard(lv, car, DT); }
  const r = fired ? H.highwayRespawn(lv) : null, rq = r ? L.querySubtrack(lv.subtrack, r.x, r.y) : null;
  check(!!fired && tr < 3, `${preset}: reversing -> "${fired}" after ${tr.toFixed(2)} s`);
  check(!!rq && rq.dist < geo.width / 2 && Math.abs(Math.atan2(Math.sin(r.h + Math.PI / 2), Math.cos(r.h + Math.PI / 2))) < cfg.maxDeg * Math.PI / 180 + 0.05, `${preset}: respawn on the road (${rq ? rq.dist.toFixed(1) : '-'} m from centre), facing up the screen`);
  // GOING WIDE: parked 20 m past the edge -> a countdown (st.warn), no reset for ~10 s (user, 2026-10-06: longer), then the reset; back on the road cancels it
  if (!cfg.walls) {
    reset(car, r.x, r.y, r.h); H.stepHighway(lv, car); H.highwayGuard(lv, car, DT);
    const q = lv._hw.q, nx = -q.dy, ny = q.dx;
    car.x += nx * (geo.hw + 24); car.y += ny * (geo.hw + 24); car.vx = 0; car.vy = 0;   // 24: on a bend the parked car sits nearer the road (interstate measured 15.3 m out from a 20 m push) - past OFF_NEAR 16
    let tw = 0, out = null, warn = null; for (; tw < 12 && !out; tw += DT) { H.stepHighway(lv, car); out = H.highwayGuard(lv, car, DT); warn = warn || lv._hw.warn; }
    check(!!warn && out === 'OFF THE MOTORWAY — RESET' && tw > 9.5 && tw < 10.5, `${preset}: 20 m wide -> countdown "${warn}", reset after ${tw.toFixed(2)} s`);
    reset(car, r.x, r.y, r.h); H.stepHighway(lv, car); H.highwayGuard(lv, car, DT);
    car.x += nx * (geo.hw + 20); car.y += ny * (geo.hw + 20); for (let k = 0; k < 360; k++) { H.stepHighway(lv, car); H.highwayGuard(lv, car, DT); }
    car.x = r.x; car.y = r.y; H.stepHighway(lv, car); const back = H.highwayGuard(lv, car, DT);
    check(!back && !lv._hw.warn && lv._hw.offT === 0, `${preset}: back on the road after 3 s out -> countdown cancelled`);
  } else check(lv.barriers.filter((b) => b.kind === cfg.walls).length > 10, `${preset}: continuous ${cfg.walls}s both sides (${lv.barriers.filter((b) => b.kind === cfg.walls).length} pieces in the window)`);
}
console.log(fails ? `\n${fails} FAIL(S)` : '\nALL OK');
