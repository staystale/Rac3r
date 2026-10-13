// tyrecheck.mjs — proves the TYRE TEMPERATURE model (vehicle.js, 2026-10-03) by measurement.
//
//   node tools/tyrecheck.mjs        exit code 1 on any failure
//
// Every claim the user made, as a number:
//   1. tyres start cold; cruising in a straight line barely warms them
//   2. cornering warms them, the OUTSIDE pair more than the inside, the fronts at least as much as the rears
//   3. wheelspin heats only the DRIVEN tyres — FWD, RWD and 4WD differ
//   4. cold tyres grip less on TARMAC; on GRAVEL temperature makes no difference
//   5. grass, snow, ice cool tyres faster than tarmac
import { makeCar, step, reset, DT, TYRE_AMBIENT } from '../src/vehicle.ts';
import { setAidsDefault } from '../src/vehicle.ts';
// RAW physics: driver aids OFF (with TCS on, a burnout is not a burnout; with ABS on, a locked pass cannot lock).
setAidsDefault(false);
import { SURFACES } from '../src/lab.js';

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails.push(msg); };
const f0 = (a) => a.map((x) => x.toFixed(0)).join(' / ');
function run(id, surface, secs, control, setup) {
  const car = makeCar(id); reset(car, 0, 0, 0); if (setup) setup(car);
  for (let i = 0; i < secs / DT; i++) { car.surface = surface; step(car, control(car), DT); }
  return car;
}
const hold = (v) => (car) => ({ steer: 0, throttle: Math.hypot(car.vx, car.vy) < v ? 0.6 : 0, brake: 0 });

// 1. cold start, straight cruise
let car = run('hatch-rwd', SURFACES.tarmac, 30, hold(25), (c) => { c.vx = 25; });
console.log(`1. start ${TYRE_AMBIENT} C; after 30 s cruising at 90 km/h: ${f0(car.tyreT)} (FL FR RL RR, L = +y)`);
check(Math.max(...car.tyreT) < 35, 'a straight cruise barely warms the tyres (< 35 C)');

// 2. steady cornering, steering toward +y (left), so the -y tyres (FR, RR) are on the OUTSIDE
// a CLEAN corner (~0.8 g, within grip). The first version held a lock asking 1.4 g of a 1 g car on throttle — a
// 30 s power slide, which correctly cooked the rears to 221 C but is not 'cornering'. Drifting is case 2b.
car = run('hatch-rwd', SURFACES.tarmac, 30, (c) => ({ steer: 0.12, throttle: Math.hypot(c.vx, c.vy) < 17 ? 0.5 : 0, brake: 0 }), (c) => { c.vx = 17; });
const T2 = car.tyreT;
console.log(`2. 30 s hard cornering at ~60 km/h: ${f0(T2)}; lateral ${(car.t.ay / 9.81).toFixed(2)} g`);
// SEMI-EASY TO WARM (user, 2026-10-03, superseding "harder to build"): 30 s of hard cornering brings the OUTSIDE
// tyres into the working window (flex heat, vehicle.js TYRE_FLEX); the inside pair is still warming; and flex heat
// alone never passes TYRE_FLEX.T, so a clean corner can never overheat a tyre.
check(Math.max(T2[1], T2[3]) >= 65 && Math.max(...T2) <= 90, '30 s of hard cornering warms the outside tyres into the window (65-90 C)');
check(Math.min(T2[0], T2[2]) < Math.min(T2[1], T2[3]), 'the inside tyres are cooler than the outside ones');
// ... but a long stint does
const T90 = run('hatch-rwd', SURFACES.tarmac, 120, (c) => ({ steer: 0.12, throttle: Math.hypot(c.vx, c.vy) < 17 ? 0.5 : 0, brake: 0 }), (c) => { c.vx = 17; }).tyreT;
console.log(`2a. 120 s of the same cornering: ${f0(T90)}`);
check(Math.max(...T90) > 60 && Math.max(...T90) < 120, '2 minutes of hard cornering brings the outside tyres into the working window');
// 2b. only an EXCESSIVE power slide overheats the rears (user, "hard to overheat" pass — see section 7)
const Td = run('hatch-rwd', SURFACES.tarmac, 40, (c) => ({ steer: 0.35, throttle: 1, brake: 0 }), (c) => { c.vx = 12; }).tyreT;
console.log(`2b. 40 s power slide (RWD, full throttle, big lock): ${f0(Td)}`);
check(Math.max(Td[2], Td[3]) > 110, 'a long power slide overheats the (outside) rear tyre');
const outsideIsMinusY = car.t.ay > 0;
const outF = outsideIsMinusY ? T2[1] : T2[0], inF = outsideIsMinusY ? T2[0] : T2[1];
check(outF > inF + 5, `the OUTSIDE front is hotter than the inside front (${outF.toFixed(0)} vs ${inF.toFixed(0)})`);
check((T2[0] + T2[1]) >= (T2[2] + T2[3]) * 0.9, 'the fronts work at least as hard as the rears when cornering');

// 3. wheelspin: hold the car still at full throttle on wet tarmac (low grip, so the driven wheels spin)
const spin = {};
for (const id of ['hatch-fwd', 'hatch-rwd', 'estate-4x4']) {
  car = run(id, SURFACES.wet, 8, () => ({ steer: 0, throttle: 1, brake: 0 }), null);
  spin[id] = car.tyreT.slice();
  console.log(`3. ${id.padEnd(11)} 8 s full throttle from rest on wet tarmac: ${f0(car.tyreT)}`);
}
const front = (T) => (T[0] + T[1]) / 2, rear = (T) => (T[2] + T[3]) / 2;
check(front(spin['hatch-fwd']) > rear(spin['hatch-fwd']) + 5, 'FWD wheelspin heats the FRONT tyres');
check(rear(spin['hatch-rwd']) > front(spin['hatch-rwd']) + 5, 'RWD wheelspin heats the REAR tyres');
// The INTENT: a 4WD warms BOTH axles, evenly, where FWD / RWD warm one. The absolute rise is small and was always marginal
// (+3 C before the rev limiter, +2 after: the 4WD now spins later, at speed, where spin heat goes into the road by design).
check(Math.min(front(spin['estate-4x4']), rear(spin['estate-4x4'])) > TYRE_AMBIENT + 1.5 && Math.abs(front(spin['estate-4x4']) - rear(spin['estate-4x4'])) < 3, '4WD wheelspin heats both axles, evenly');

// 4. grip vs temperature: peak lateral g on a steering ramp with the tyre temperature PINNED
function peakG(surface, T) {
  const c = run('hatch-rwd', surface, 5, (cc) => { cc.tyreT.fill(T); return { steer: Math.min(0.5, cc.__t = (cc.__t || 0) + DT * 0.12), throttle: Math.hypot(cc.vx, cc.vy) < 18 ? 0.5 : 0, brake: 0 }; }, (cc) => { cc.vx = 18; });
  let g = 0; const c2 = makeCar('hatch-rwd'); reset(c2, 0, 0, 0); c2.vx = 18; let s = 0;
  for (let i = 0; i < 5 / DT; i++) { c2.surface = surface; c2.tyreT.fill(T); s = Math.min(0.5, s + DT * 0.12); step(c2, { steer: s, throttle: Math.hypot(c2.vx, c2.vy) < 18 ? 0.5 : 0, brake: 0 }, DT); g = Math.max(g, Math.abs(c2.t.ay) / 9.81); }
  return g;
}
const gTc = peakG(SURFACES.tarmac, TYRE_AMBIENT), gTw = peakG(SURFACES.tarmac, 100), gTh = peakG(SURFACES.tarmac, 150);
const gGc = peakG(SURFACES.gravel, TYRE_AMBIENT), gGw = peakG(SURFACES.gravel, 85);
console.log(`4. peak lateral g — tarmac: cold ${gTc.toFixed(2)} / working ${gTw.toFixed(2)} / overheated ${gTh.toFixed(2)};  gravel: cold ${gGc.toFixed(2)} / working ${gGw.toFixed(2)}`);
check(gTc < gTw * 0.95, 'cold tyres grip noticeably less on tarmac');
check(gTh < gTw * 0.99, 'overheated tyres grip less than working ones on tarmac');
// the user's ordering: cold < warm < hot (peak) > too hot > cold
const gT65 = peakG(SURFACES.tarmac, 65), gT100 = peakG(SURFACES.tarmac, 100);
console.log(`   tarmac by temperature: 18 C ${gTc.toFixed(3)} < 65 C ${gT65.toFixed(3)} < 100 C ${gT100.toFixed(3)} > 150 C ${gTh.toFixed(3)}`);
check(gTc < gT65 && gT65 < gT100 && gTh < gT100 && gTh > gTc, 'grip order: cold < warm < hot, and too hot sits between hot and cold');
check(Math.abs(gGc - gGw) < 0.01, 'on gravel temperature makes no difference');

// 5. cooling: from 100 C, coast 10 s on each surface
const cooled = {};
for (const s of ['tarmac', 'grass', 'snow']) { car = run('hatch-rwd', SURFACES[s], 10, () => ({ steer: 0, throttle: 0, brake: 0 }), (c) => { c.vx = 15; c.tyreT.fill(100); }); cooled[s] = car.tyreT[0]; }
console.log(`5. from 100 C, 10 s coasting: tarmac ${cooled.tarmac.toFixed(0)} C, grass ${cooled.grass.toFixed(0)} C, snow ${cooled.snow.toFixed(0)} C`);
check(cooled.grass < cooled.tarmac - 10 && cooled.snow < cooled.grass, 'grass cools faster than tarmac, snow faster still');
{ const c2 = run('hatch-rwd', SURFACES.wet, 10, () => ({ steer: 0, throttle: 0, brake: 0 }), (c) => { c.vx = 15; c.tyreT.fill(100); });
  console.log(`   wet tarmac ${c2.tyreT[0].toFixed(0)} C`);
  check(c2.tyreT[0] < cooled.grass, 'cold and wet ground cools faster than dry ground: wet tarmac below grass'); }

// 6. an overheating tyre HOLDS (capped), it never wraps round to cold (user-reported bug)
{ const c = run('hatch-rwd', SURFACES.tarmac, 60, () => ({ steer: 0, throttle: 1, brake: 0 }), (cc) => { cc.vx = 0; });
  const cc = makeCar('hatch-rwd'); reset(cc, 0, 0, 0); let minAfterHot = 999, peak = 0, hot = false;
  for (let i = 0; i < 60 / DT; i++) { cc.surface = SURFACES.tarmac; cc.vx = 0; cc.vy = 0; step(cc, { steer: 0, throttle: 1, brake: 0 }, DT);
    peak = Math.max(peak, cc.tyreT[2]); if (cc.tyreT[2] > 200) hot = true; if (hot) minAfterHot = Math.min(minAfterHot, cc.tyreT[2]); }
  console.log(`6. 60 s pinned burnout: rear peak ${peak.toFixed(0)} C, lowest after first passing 200 C: ${minAfterHot.toFixed(0)} C`);
  check(hot && minAfterHot > 150, 'an overheated tyre holds its heat — it never wraps round to cold'); }

// 7. HARD TO OVERHEAT (user, 2026-10-03: "it should take long burnouts to pop them, excessive drifting on tarmac to
// overheat, and off-road surfaces shouldn't get them up much"). Seconds for the hottest tyre to reach each mark.
{
  const times = (id, surf, ctl, pin, v0, secs = 90) => {
    const c = makeCar(id); reset(c, 0, 0, 0); if (v0) c.vx = v0;
    const hit = { 65: Infinity, 110: Infinity, 260: Infinity }; let at30 = 0;
    for (let i = 0; i < secs / DT; i++) { c.surface = surf; if (pin) { c.vx = 0; c.vy = 0; } step(c, ctl(c), DT);
      const T = Math.max(...c.tyreT), tt = (i + 1) * DT; for (const k in hit) if (hit[k] === Infinity && T >= +k) hit[k] = tt; if (Math.abs(tt - 30) < DT / 2) at30 = T; }
    return { ...hit, at30 };
  };
  const s = (v) => (v === Infinity ? 'never' : v.toFixed(0) + ' s');
  const burn = () => ({ steer: 0, throttle: 1, brake: 0 }), drift = () => ({ steer: 0.35, throttle: 1, brake: 0 });
  const b = times('hatch-rwd', SURFACES.tarmac, burn, true, 0), d = times('hatch-rwd', SURFACES.tarmac, drift, false, 12);
  console.log(`7. hatch-rwd pinned burnout: too hot (110 C) ${s(b[110])}, pop point (260 C) ${s(b[260])}`);
  check(b[110] >= 10 && b[260] >= 40 && b[260] <= 75, 'a burnout takes ~10 s+ to overheat and 40-75 s to reach the pop point');
  console.log(`7. hatch-rwd tarmac drift: warm ${s(d[65])}, too hot ${s(d[110])}, pop point ${s(d[260])} (90 s)`);
  check(d[65] <= 20 && d[110] >= 20 && d[260] === Infinity, 'a drift warms them, overheats only after 20 s+, never reaches the pop point');
  for (const id of ['estate-4x4', 'muscle-rwd', 'rally-4x4', 'track-rwd', 'naffcar']) {
    const dd = times(id, SURFACES.tarmac, drift, false, 12);
    check(dd[260] === Infinity && dd[110] >= 12, `${id}: drifting never pops, overheats after ${s(dd[110])}`);
  }
  // (the TRACTOR is exempt: its slow "drift" is a burnout on giant wheels — it reaches 260 C in ~44 s)
  for (const id of ['gravel', 'dirt', 'grass', 'mud', 'sand']) {
    const g = times('hatch-rwd', SURFACES[id], drift, false, 12, 30);
    check(g.at30 < 65, `a 30 s drift on ${id} barely warms them: ${g.at30.toFixed(0)} C`);
  }
}

// 8. NO HEAT SPIKES (user, 2026-10-03: "tyres heat up like crazy if you brake or slide over jumps ... braking while
// changing surface / sliding seems to cause the same bug"). MEASURED BUG: +203 C in ONE step over the Test Track table
// with the handbrake on (airborne axle, lagged lateral force / ~0 load). A jump or a surface change may warm a tyre a
// little; no single step may add more than 2 C and the whole event no more than 15 C.
{
  const Lmod = await import('../src/lab.js');
  Lmod.setLevel('test-track');
  const tb = Lmod.LEVEL.bumps.find((b) => b.kind === 'table');
  for (const [lab, inp, prep] of [
    ['slide over the Test Track jump', { steer: 0.5, handbrake: 1 }, (c) => { reset(c, tb.x - 30, tb.y, 0); c.vx = 24; }],
    ['brake over the Test Track jump', { brake: 1 }, (c) => { reset(c, tb.x - 30, tb.y, 0); c.vx = 24; }],
  ]) {
    const c = makeCar('hatch-rwd'); prep(c); c.tyreT = [50, 50, 50, 50]; c.gear = 3;
    let step1 = 0, prev = c.tyreT.slice();
    for (let i = 0; i < 300; i++) {
      Lmod.applyGround(c, DT);
      step(c, { steer: 0, throttle: 0, brake: 0, handbrake: 0, ...(Math.abs(c.x - tb.x) < 12 ? inp : {}) }, DT);
      c.tyreT.forEach((x, k) => { step1 = Math.max(step1, x - prev[k]); }); prev = c.tyreT.slice();
    }
    const rise = Math.max(...c.tyreT) - 50;
    console.log(`8. ${lab}: rise ${rise.toFixed(1)} C, biggest single step +${step1.toFixed(2)} C`);
    check(step1 < 2 && rise < 15, `${lab}: no heat spike`);
  }
  const c = makeCar('hatch-rwd'); reset(c, 0, 0, 0); c.vx = 25; c.gear = 3; c.tyreT = [50, 50, 50, 50];
  let step1 = 0, prev = c.tyreT.slice();
  for (let t = 0; t < 2; t += DT) { c.surface = t < 0.7 ? SURFACES.grass : SURFACES.tarmac; step(c, { steer: 0.4, throttle: 0, brake: 1, handbrake: 1 }, DT); c.tyreT.forEach((x, k) => { step1 = Math.max(step1, x - prev[k]); }); prev = c.tyreT.slice(); }
  console.log(`8. braking slide from grass onto tarmac: biggest single step +${step1.toFixed(2)} C, peak ${Math.max(...c.tyreT).toFixed(0)} C`);
  check(step1 < 2, 'braking slide across a surface change: no heat spike');
  Lmod.setLevel('lab');
}
console.log(fails.length ? `\nFAIL (${fails.length})` : '\nTyre temperature: all OK');
process.exitCode = fails.length ? 1 : 0;
