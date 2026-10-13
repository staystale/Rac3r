// trafficcheck.mjs — HIGHWAY TRAFFIC (src/traffic.ts), headless. A SCRIPTED player (kinematic: placed on its lane each step, so the
// test is about the traffic, not a driver) runs phases: FAST (140 km/h, outer lane), SLOW (70 km/h, left lane: traffic passes it),
// STOPPED on the hard shoulder, then FAST again. Measures, per preset and density: traffic-on-traffic CONTACTS (they must not crash
// into each other), cars POPPING IN / OUT inside the view, traffic off the carriageway, lane changes, recycles, and the step cost.
// node tools/trafficcheck.mjs [density 0..1.5] [seconds per phase]
import { makeCar, DT } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { createTraffic } from '../src/traffic.ts';
import { carContact } from '../src/contact.js';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const DENS = +(process.argv[2] || 1), PH = +(process.argv[3] || 60);
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
// the VIEW, as main.js gives it: the treadmill camera puts you ~3/4 down the screen. Worst case = zoomed right out in portrait
// (ZOOM_MIN 0.3 x 22 px/m on 844 px = 128 m tall): ~100 m ahead, ~35 m behind, +-30 m sideways
const VIEW_AHEAD = 100, VIEW_BEHIND = 35, VIEW_SIDE = 30;
for (const preset of ['motorway', 'interstate', 'dual']) {
  let s0 = 4242 + preset.length * 7; let r = s0; const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const lv = H.createHighway(s0, preset); lv.id = 'tf-' + preset; L.LEVELS.push(lv); L.setLevel(lv.id);
  const geo = H.laneGeo(lv._cfg), C = geo.centres, me = makeCar('saloon-rwd');
  const tr = createTraffic({ rnd });
  let pS = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, pOff = C[0], pV = 0;
  const place = () => { const p = H.roadPose(lv, pS, pOff); me.x = p.x; me.y = p.y; me.heading = p.h; me.vx = Math.cos(p.h) * pV; me.vy = Math.sin(p.h) * pV; };
  place(); H.stepHighway(lv, me); tr.reset(lv, DENS);
  const vis = (x, y, s) => { const ds = s - pS; if (ds < -VIEW_BEHIND || ds > VIEW_AHEAD) return false; const f = H.roadFrame(lv, x, y, s); return !f || Math.abs(f.off - pOff) < VIEW_SIDE; };
  const inView = (c) => { const f = H.roadFrame(lv, c.x, c.y, c._tS); c._tS = f && f.s; return f && vis(c.x, c.y, f.s); };
  let contacts = 0, contactCars = new Set(), popIn = 0, popOut = 0, offRoad = 0, lanes = 0, ms = 0, n = 0, minLive = Infinity, maxLive = 0, vSum = 0, vN = 0, wrecks = 0;
  let prev = new Map(tr.cars.map((c) => [c, inView(c)]));
  const phases = [['fast', 140 / 3.6, C.length - 1], ['slow', 70 / 3.6, 0], ['stopped', 0, -1], ['fast again', 140 / 3.6, C.length - 1]];
  for (const [name, v, lane] of phases) {
    const target = lane < 0 ? -geo.hw + lv._cfg.shoulder / 2 : C[lane];
    for (let t = 0; t < PH; t += DT) {
      // the player: speed + lane eased in (a lane change over ~2 s), then placed
      pV += Math.max(-6 * DT, Math.min(4 * DT, v - pV)); pOff += Math.max(-1.8 * DT, Math.min(1.8 * DT, target - pOff)); pS += pV * DT; place();
      const ds = H.stepHighway(lv, me);
      const t0 = performance.now(); tr.step(DT, { player: me, others: [], visible: vis }); ms += performance.now() - t0; n++;
      // traffic vs traffic (resolved, as main.js does with carContacts) — every touch counted
      const cs = tr.cars;
      for (let i = 0; i < cs.length; i++) for (let k = i + 1; k < cs.length; k++) if (carContact(cs[i], cs[k])) { contacts++;
        if (process.env.TFDBG && !contactCars.has(cs[i])) { const d = (c) => { const tt = tr.list.find((q) => q.car === c); return `s ${(tt.s - pS).toFixed(1)} off ${tt.off.toFixed(2)} lane ${tt.lane}->${tt.laneT} laneOff ${tt.laneOff.toFixed(2)} v ${(tt.vAl * 3.6).toFixed(0)} want ${(tt.vWant * 3.6).toFixed(0)} ind ${tt.indT.toFixed(2)} kin ${!!tt.kin}`; };
          console.log(`    CONTACT ${name} t ${t.toFixed(1)}: A ${d(cs[i])} | B ${d(cs[k])}`); }
        contactCars.add(cs[i]); contactCars.add(cs[k]); }
      minLive = Math.min(minLive, cs.length); maxLive = Math.max(maxLive, cs.length);
      const now = new Map();
      for (const c of cs) { const iv = inView(c); now.set(c, iv); if (!prev.has(c) && iv) popIn++; }
      for (const [c, iv] of prev) if (!now.has(c) && iv) popOut++;
      prev = now;
      for (const tt of tr.list) if (!tt.parked) { if (Math.abs(tt.off) > geo.hw + 0.3) { offRoad++; if (process.env.TFDBG && !tt._dbgOff) { tt._dbgOff = 1; console.log(`    OFF ${name} t ${t.toFixed(1)}: s ${(tt.s - pS).toFixed(1)} off ${tt.off.toFixed(2)} laneOff ${tt.laneOff.toFixed(2)} lane ${tt.lane}->${tt.laneT} v ${(tt.vAl * 3.6).toFixed(0)} phys ${tt.phys} kin ${tt.kin} wreck ${tt.wreck} heading-err ${(Math.atan2(tt.car.vy, tt.car.vx) * 57.3).toFixed(0)} | player off ${pOff.toFixed(2)}`); } }
        if (tt.wreck) { wrecks++; if (process.env.TFDBG && !tt._dbgW) { tt._dbgW = 1; console.log(`    WRECK ${name} t ${t.toFixed(1)}: s ${(tt.s - pS).toFixed(1)} off ${tt.off.toFixed(2)} dmg ${tt.car.dmg.map((d) => d.toFixed(2))} roll ${!!(tt.car.roll && tt.car.roll.phase !== 'none')} v ${(Math.hypot(tt.car.vx, tt.car.vy) * 3.6).toFixed(0)}`); } } vSum += Math.hypot(tt.car.vx, tt.car.vy); vN++; }
      if (Math.round(t / DT) % 120 === 0) lanes = tr.list.reduce((a, tt) => a + (tt.laneT !== tt.lane ? 1 : 0), lanes);
    }
    const st = tr.stats();
    console.log(`  ${preset} after ${name}: live ${st.live}/${st.want}, placed ${st.placed}, recycled ${st.recycled}, forced in view ${st.visHits} | contacts so far ${contacts} (${contactCars.size} cars)`);
  }
  const st = tr.stats();
  console.log(`${preset} @ density ${DENS}: ${C.length} lanes, ${st.want} cars | live ${minLive}-${maxLive} | avg traffic speed ${(vSum / Math.max(1, vN) * 3.6).toFixed(0)} km/h | lane-change samples ${lanes} | ${(ms / n * 1000).toFixed(0)} us/step`);
  check(contacts === 0, `${preset}: traffic never hits traffic (${contacts} contact steps, ${contactCars.size} cars)`);
  check(popIn === 0 && popOut === 0, `${preset}: no car appears / vanishes in view (in ${popIn}, out ${popOut})`);
  check(offRoad === 0, `${preset}: traffic stays on the carriageway (${offRoad} car-steps off)`);
  check(wrecks === 0, `${preset}: no traffic wrecked itself (${wrecks} car-steps)`);
  check(st.recycled > 10, `${preset}: cars recycled (${st.recycled})`);
  check(lanes > 0, `${preset}: lane changes happen (${lanes} samples)`);
  check(ms / n < 0.25, `${preset}: step cost ${(ms / n * 1000).toFixed(0)} us`);
}
console.log(fails ? `\n${fails} FAIL(S)` : '\nALL OK');
