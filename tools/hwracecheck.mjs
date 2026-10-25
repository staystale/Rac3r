// hwracecheck.mjs — VS AI on the ENDLESS HIGHWAY (src/highwayrace.ts), headless, the way main.js runs it: a rolling start (everyone held at
// ROLL pace behind the lights, green at HW_GREEN), then 5 AI + the "player" (driven by the same racer, at a set difficulty) race up the
// motorway through TRAFFIC with full contact + damage. Measures: grid overlaps, cars off the road, racer-racer / racer-traffic contacts,
// wrecks, lane changes, speeds, the gaps that open, and the flow's END countdown (a fake screen of +-VIEW m).
// node tools/hwracecheck.mjs [seconds] [diff 0-4] [traffic 0-1.5] [preset]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { createTraffic } from '../src/traffic.ts';
import { carContacts, carContact } from '../src/contact.js';
import { hit, tooInjured } from '../src/damage.ts';
import { aiTraits } from '../src/ai/traits.ts';
import { createAIDriver } from '../src/ai/circuit.ts';
import { createHwFlow, hwFrames, hwGrid, hwGridSpan, HW_GREEN } from '../src/highwayrace.ts';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const [T = 90, DIFF = 2, DENS = 0.6, PRESET = 'motorway', SEED = 4242] = process.argv.slice(2).map((a, i) => (i < 3 || i === 4 ? +a : a));
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
let r = 777 + SEED - 4242; const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
const lv = H.createHighway(SEED, PRESET); lv.id = 'hr'; L.LEVELS.push(lv); L.setLevel(lv.id);
const N = 6, cars = [], drv = [];
for (let k = 0; k < N; k++) { const c = makeCar('saloon-rwd'); c.num = k + 1; c.absOn = c.tcsOn = true; const g = hwGrid(lv, k); reset(c, g.x, g.y, g.h); cars.push(c); drv.push(createAIDriver(lv, aiTraits(DIFF, k, N, 99))); }
const me = cars[2];   // the "player": slot 2
let overlap = 0; for (let i = 0; i < N; i++) for (let k = i + 1; k < N; k++) if (carContact(cars[i], cars[k])) overlap++;
H.stepHighway(lv, me);
const tr = createTraffic({ rnd }); tr.reset(lv, DENS); const [gA, gB] = hwGridSpan(lv, N); const cleared = tr.clearSpan(gA, gB);
const VIEW = 75;   // a phone screen at speed: ~+-75 m along the road of you
const vis = (c) => c._hwf && me._hwf && Math.abs(c._hwf.s - me._hwf.s) < VIEW;
const flow = createHwFlow({ lv, cars: cars.map((c) => ({ car: c, player: c === me })), visible: vis });
let farOff = 0; let t = 0, off = 0, rr = 0, rt = 0, wreck = new Set(), lc = 0, vMax = 0, gapMax = 0, cdSeen = new Set(), ms = 0, n = 0, laneOf = cars.map(() => null), ended = null;
const ROLL = 16;
// PACE (HANDOVER 3, user 2026-10-06: "ai ... slow, waits, doesnt weave around traffic"): per racer, from 5 s after the green - mean /
// min speed, % of the time under 130 km/h, mean speed with no traffic within 150 m ahead (free road: the corner cap), % of the time STUCK
// (traffic < 40 m ahead in its path and not > 15 km/h quicker than it), and traffic cars PASSED per km (ahead -> behind, 3 m hysteresis)
const PACE_T0 = HW_GREEN + 5, pace = cars.map(() => ({ lim: { follow: 0, emerg: 0, corner: 0, feather: 0, full: 0, other: 0 }, fo: { racer: 0, traffic: 0, freeLine: 0, freeOut: 0, gap: 0, dv: 0, better: 0, reach: 0, mid: 0, cost: 0, stepped: 0, mirror: 0 }, n: 0, sum: 0, slow: 0, min: 999, free: 0, freeN: 0, stuck: 0, s0: null, s1: 0, pass: 0, rk: new Map() }));
while (t < T) {
  hwFrames(lv, [...cars, ...tr.cars]);
  const t0 = performance.now();
  const green = t >= HW_GREEN;
  for (let k = 0; k < N; k++) { const c = cars[k], others = [...cars.filter((o) => o !== c), ...tr.cars];
    let w = drv[k].drive(c, PHYSICS_STEP_SECONDS, { cars: others, hold: !green });
    if (t >= PACE_T0) { const d = drv[k].state.dbg, Lm = pace[k].lim, va = c._hwf ? c._hwf.v : 0;
      if (!d) Lm.other++; else if (d.brakeX > 0) Lm.emerg++; else if (d.vFollow < d.vCorner - 0.5 && d.vT - va < 2.5) { Lm.follow++; const F = pace[k].fo, B = d.fol;
        if (B && B.o) { if (cars.includes(B.o)) F.racer++; else F.traffic++; F.gap += B.gap; F.dv += (B.o._hwf ? B.o._hwf.v : 0) * 3.6; }
        const wy = drv[k].state.why; if (wy && Math.abs(wy.off - wy.chosen) > 1 && wy.raw > wy.chosenRaw + 10) { F.better++; F[wy.why]++; }
        const fr = drv[k].state.free; if (fr) { F.freeLine++; if (Math.abs(fr.off - c._hwf.off) > 2.5 + 0 * va) F.freeOut++; } } else if (d.vT - va < 2.5) Lm.corner++;
      else if (w.throttle >= 0.999) Lm.full++; else if (w.throttle >= d.thrCap * d.feel - 1e-6) Lm.feather++; else Lm.other++; }
    if (!green) { const v = Math.hypot(c.vx, c.vy); w = { ...w, throttle: v > ROLL ? 0 : Math.min(w.throttle, 0.55), brake: Math.max(w.brake, v > ROLL + 2 ? 0.25 : 0) }; }
    const v0x = c.vx, v0y = c.vy; L.barrierClamp(c); L.solidClamp(c); hit(c, v0x, v0y); L.applyGround(c, PHYSICS_STEP_SECONDS); step(c, w, PHYSICS_STEP_SECONDS);
    if (process.env.HRTRACE && +process.env.HRTRACE === c.num && Math.round(t / PHYSICS_STEP_SECONDS) % 30 === 0 && t > +(process.env.HRT0 || 0) && t < +(process.env.HRT1 || 1e9)) { const f = c._hwf, P = lv._hw.pts, i = Math.round((f.s - P[0].s) / 4);
      console.log(`      #${c.num} t ${t.toFixed(2)} v ${(Math.hypot(c.vx, c.vy) * 3.6).toFixed(0)} off ${f.off.toFixed(2)} line ${drv[k].state.line.toFixed(2)} tgt ${drv[k].state.tgt.toFixed(2)} curv ${(P[i].curv * 1e4).toFixed(1)}e-4 steer ${w.steer.toFixed(3)} thr ${w.throttle.toFixed(2)} brk ${w.brake.toFixed(2)} slipF ${c.t.slipF.toFixed(3)} slipR ${c.t.slipR.toFixed(3)} yaw ${c.yawRate.toFixed(3)} need ${(f.v * P[i].curv).toFixed(3)} delta ${c.delta.toFixed(3)} | near ${[...cars, ...tr.cars].filter((o) => o !== c && o._hwf && Math.abs(o._hwf.s - f.s) < 40).map((o) => `${o.num && cars.includes(o) ? '#' + o.num : 'T'}[ds ${(o._hwf.s - f.s).toFixed(1)} off ${o._hwf.off.toFixed(1)} v ${(o._hwf.v * 3.6).toFixed(0)}]`).join(' ')}`); }
    const ln = Math.round(drv[k].state.line / 3.65); if (laneOf[k] != null && ln !== laneOf[k]) lc++; laneOf[k] = ln; }
  H.stepHighway(lv, me);
  tr.step(PHYSICS_STEP_SECONDS, { player: me, others: cars.filter((c) => c !== me), visible: (x, y, s) => me._hwf && Math.abs(s - me._hwf.s) < VIEW });
  const all = [...cars, ...tr.cars], v0 = all.map((c) => [c.vx, c.vy]);
  for (let i = 0; i < N; i++) for (let k = 0; k < all.length; k++) if (k !== i && (k > i || k >= N) && carContact(cars[i], all[k])) { if (k < N) rr++; else rt++; }
  all.forEach((c, i) => hit(c, v0[i][0], v0[i][1]));
  if (t >= PACE_T0) cars.forEach((c, k) => { const f = c._hwf, P = pace[k]; if (!f) return; const v = Math.hypot(c.vx, c.vy) * 3.6;
    if (P.s0 == null) P.s0 = f.s; P.s1 = f.s; P.n++; P.sum += v; if (v < 130) P.slow++; P.min = Math.min(P.min, v);
    let near = Infinity, stuck = false;
    for (const o of tr.cars) { const g = o._hwf; if (!g) continue; const ds = g.s - f.s;
      if (ds > 0) near = Math.min(near, ds);
      if (ds > 0 && ds < 40 && Math.abs(g.off - f.off) < 2.5 && v < g.v * 3.6 + 15) stuck = true;
      const was = P.rk.get(o); if (ds > 3) P.rk.set(o, 1); else if (ds < -3) { if (was === 1) P.pass++; P.rk.set(o, -1); } }
    if (near > 150) { P.free += v; P.freeN++; } if (stuck) P.stuck++; });
  ms += performance.now() - t0; n++;
  // (only cars within 400 m of you: once the race is over the field spreads out and a car > 450 m back falls off the road window)
  for (const c of cars) { const f = c._hwf; if (f && me._hwf && Math.abs(f.s - me._hwf.s) < 400 && Math.abs(f.off) > lv._hw.geo.hw + 3) farOff++;
    if (f && me._hwf && Math.abs(f.s - me._hwf.s) < 400 && Math.abs(f.off) > lv._hw.geo.hw + 0.5) { off++;
      if (process.env.HRDBG && !c._dbg) { c._dbg = 1; const P = lv._hw.pts, i = Math.round((f.s - P[0].s) / 4); let kx = 0; for (let j = i - 30; j < i + 5; j++) if (P[j]) kx = Math.max(kx, Math.abs(P[j].curv));
        console.log(`    OFF #${c.num} t ${t.toFixed(1)}: v ${(Math.hypot(c.vx, c.vy) * 3.6).toFixed(0)} off ${f.off.toFixed(1)} ds-from-you ${(f.s - me._hwf.s).toFixed(0)} | tightest R behind ${(1 / kx).toFixed(0)} m | slipR ${c.t.slipR.toFixed(2)} slipF ${c.t.slipF?.toFixed?.(2)} | dmg ${(c.dmg || []).map((d) => d.toFixed(2))} | window ${(f.s - P[0].s).toFixed(0)}..${(P[P.length - 1].s - f.s).toFixed(0)}`); } } if (tooInjured(c) && f && me._hwf && Math.abs(f.s - me._hwf.s) < 400) wreck.add(c.num); vMax = Math.max(vMax, Math.hypot(c.vx, c.vy)); }
  if (green) { flow.step(PHYSICS_STEP_SECONDS); if (flow.cdKind) cdSeen.add(flow.cdKind); if (flow.state === 'done' && !ended) ended = { t, kind: [...cdSeen].pop(), place: flow.myPlace }; }
  const ss = cars.map((c) => (c._hwf ? c._hwf.s : 0)); gapMax = Math.max(gapMax, Math.max(...ss) - Math.min(...ss));
  if (Math.round(t / PHYSICS_STEP_SECONDS) % Math.round(15 / PHYSICS_STEP_SECONDS) === 0) console.log(`  t ${t.toFixed(0)}s: v ${cars.map((c) => Math.round(Math.hypot(c.vx, c.vy) * 3.6)).join(' ')} km/h | ahead of you ${cars.map((c) => Math.round((c._hwf ? c._hwf.s : 0) - (me._hwf ? me._hwf.s : 0))).join(' ')} m | lines ${drv.map((d) => d.state.lane).join('')} | traffic ${tr.cars.length} | flow ${flow.state} ${flow.cdKind || ''} ${flow.cd != null ? flow.cd.toFixed(1) : ''}`);
  t += PHYSICS_STEP_SECONDS;
}
console.log(`${PRESET} diff ${DIFF} traffic ${DENS}: ${T} s | grid overlaps ${overlap}, traffic cleared off the grid ${cleared} | top speed ${(vMax * 3.6).toFixed(0)} km/h | spread ${gapMax.toFixed(0)} m | lane changes ${lc} | ${(ms / n * 1000).toFixed(0)} us/step`);
console.log(`  contacts: racer-racer ${rr} steps, racer-traffic ${rt} steps | wrecked racers ${[...wreck].join(',') || 'none'} | off-road car-steps ${off} (far off ${farOff}) | countdowns seen ${[...cdSeen].join(',') || 'none'} | ended ${ended ? JSON.stringify(ended) : 'no'}`);
{ const pc = (a, b) => (b ? (100 * a / b).toFixed(0) : '-'), row = (P) => ({ mean: P.sum / Math.max(1, P.n), min: P.min, slow: P.slow / Math.max(1, P.n), free: P.freeN ? P.free / P.freeN : NaN, stuck: P.stuck / Math.max(1, P.n), ppk: P.pass / Math.max(0.1, (P.s1 - P.s0) / 1000) });
  const R = pace.map(row), avg = (k) => R.reduce((a, r) => a + (Number.isNaN(r[k]) ? 0 : r[k]), 0) / Math.max(1, R.filter((r) => !Number.isNaN(r[k])).length);
  pace.forEach((P, k) => console.log(`  pace #${cars[k].num}${cars[k] === me ? '(you)' : '     '}: mean ${R[k].mean.toFixed(0)} min ${R[k].min.toFixed(0)} km/h | <130 ${pc(P.slow, P.n)}% | free-road ${R[k].free.toFixed(0)} km/h (${pc(P.freeN, P.n)}% of time) | stuck ${pc(P.stuck, P.n)}% | passes ${R[k].ppk.toFixed(1)}/km | limit ${Object.entries(P.lim).map(([a, b]) => a + ' ' + pc(b, P.n)).join(' ')}`));
  pace.forEach((P, k) => { const F = P.fo, nf = Math.max(1, P.lim.follow); console.log(`    #${cars[k].num} following: a racer ${pc(F.racer, nf)}% traffic ${pc(F.traffic, nf)}% | mean gap ${(F.gap / nf).toFixed(0)} m at ${(F.dv / nf).toFixed(0)} km/h | an open line existed ${pc(F.freeLine, nf)}% (> 2.5 m across: ${pc(F.freeOut, nf)}%) | a >10 m better line passed up ${pc(F.better, nf)}% (reach ${pc(F.reach, nf)} mid ${pc(F.mid, nf)} cost ${pc(F.cost, nf)})`); });
  console.log(`PACE ${PRESET} d${DIFF} tr${DENS} seed ${SEED}: mean ${avg('mean').toFixed(0)} km/h | min ${Math.min(...R.map((r) => r.min)).toFixed(0)} | <130 ${(avg('slow') * 100).toFixed(0)}% | free-road ${avg('free').toFixed(0)} | stuck ${(avg('stuck') * 100).toFixed(0)}% | passes ${avg('ppk').toFixed(1)}/km`); }
check(overlap === 0, 'grid: no two cars overlap');
check(off < 120, `racers stay on the road (${off} car-steps off)`);
check(wreck.size === 0, `no racer wrecked (${[...wreck].join(',') || 'none'})`);
check(lc > 5, `racers change lines (${lc})`);
check(vMax * 3.6 > 150, `racers get going (top ${(vMax * 3.6).toFixed(0)} km/h)`);
console.log(fails ? `\n${fails} FAIL(S)` : '\nALL OK');
if (fails) process.exitCode = 1;
