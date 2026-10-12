// aifieldcheck.mjs — a whole FIELD of racing AI, node only, full contact (contact.js), from a standing grid laid out like main.js spawnAI:
// per car its persona, laps done, best lap; for the field: contact-seconds (time any pair is touching), contact EVENTS (new touches),
// overtakes (order changes on track), stuck resets, seconds off the road. Difficulty and seed decide the mix.
// node tools/aifieldcheck.mjs [level] [car] [diff 0-4] [n 1-6] [seed] [laps]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { carContact, slipstream } from '../src/contact.js';
import { hit, repair, tooInjured } from '../src/damage.js';   // DMG=1: damage on, as main.js
const DMG = !!process.env.DMG;
const { createAIDriver } = await import(process.env.AINEXT ? '../src/ai/circuit.next.js' : '../src/ai/circuit.ts'), { aiTraits } = await import('../src/ai/traits.ts');   // AINEXT=1: test a patch before it goes live
for (const k of ['SB', 'SG']) if (process.env[k] != null) globalThis['__' + k] = +process.env[k];
if (process.env.NOATK) globalThis.__NOATK = 1; if (process.env.NOCOV) globalThis.__NOCOV = 1;
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', nArg = '6', seedArg = '7', lapsArg = '3'] = process.argv.slice(2);
const N = +nArg, LAPS = +lapsArg, seed = +seedArg;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn, offLap = L.querySubtrack(sub, sp.x, sp.y).dist > sub.width / 2;
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  // GRID=new: the 2026-10-05 main.js gridPos (7 m per slot, columns +-3.2 m, counted back from the spawn); default = the old layout
  const NEW = process.env.GRID === 'new', lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8));
  const row = Math.floor(i / 2), side = NEW ? (i % 2 ? lat : -lat) : (i % 2 ? 3 : -3), bk = NEW ? i * 7 : row * 9 + (i % 2 ? 4.5 : 0);
  const d0 = NEW ? L.querySubtrack(sub, sp.x, sp.y).trackDist : total - 15;
  if (offLap) { const ch = Math.cos(sp.heading), sh = Math.sin(sp.heading); reset(car, sp.x - ch * bk - sh * side, sp.y - sh * bk + ch * side, sp.heading); }
  else { const p = L.onTrack(sub, ((d0 - bk) % total + total) % total, side, {}); reset(car, p.x, p.y, p.rot); }
  field.push({ car, drv: createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed)), prog: null, lastQ: null, laps: [], tl: 0, stuck: 0, resets: 0, off: 0 });
}
// INCIDENTS (user, 2026-10-07: "an incident should be a full crash or well off track, rubbing is racing ... small contact / track drift is ok"):
//   WELL OFF  the car's centre > INC_OFF m past the road edge (one per excursion)     SPIN   sliding > 70 deg off its heading above 5 m/s (one per 3 s)
//   BIG HIT   a car-to-car touch that STARTS at > INC_HIT m/s closing speed (rubbing and nudges are below it)     RESET  stuck / too-injured put-back
const INC_OFF = +(process.env.INC_OFF || 4), INC_HIT = +(process.env.INC_HIT || 6); const inc = { off: 0, spin: 0, hit: 0, reset: 0 };
const surf = {}; const kinds = { start: 0, noseTail: 0, side: 0 }; let nowTouch = new Set(); let t = 0, touchT = 0, events = 0, wasTouch = new Set(), overtakes = 0, order = null, passes = 0; const pairs = {};
while (t < 200 + LAPS * 120) {
  for (const f of field) {
    const c = f.car, lap = f.prog == null ? 1 : Math.max(1, Math.floor(f.prog / total) + 1);
    const v0x = c.vx, v0y = c.vy; L.barrierClamp(c); L.solidClamp(c); if (DMG) { hit(c, v0x, v0y, DT); if (tooInjured(c)) { const q = L.findNearestSubtrackPoint(sub, c.x, c.y); reset(c, q.x, q.y, q.heading); f.drv.relocate(); repair(c); f.dmgResets = (f.dmgResets || 0) + 1; inc.reset++; f.inc = (f.inc || 0) + 1; } }
    L.applyGround(c, DT);
    step(c, f.lastU = f.drv.drive(c, DT, { cars: field.filter((o) => o !== f).map((o) => o.car), lap, laps: LAPS }), DT);
    if (process.env.SURF && t > 12) { const k = c.surface.id || c.surface.name || String(c.surface.mu), S = surf[k] || (surf[k] = { t: 0, v: 0, vT: 0, brk: 0, lift: 0, under: 0, mu: c.surface.mu }), u = f.lastU || {}, sF = Math.abs(c.t.slipF || 0);
      S.t += DT; S.v += Math.hypot(c.vx, c.vy) * DT; S.vT += Math.min(95, f.drv.state.vT) * DT; if (u.brake > 0) S.brk += DT; else if ((u.throttle || 0) < 0.3) S.lift += DT; if (sF > 0.14) S.under += DT; }
    f.stuck = Math.hypot(c.vx, c.vy) < 1 ? f.stuck + DT : 0;
    if (f.drv.state.follow && t > 12) f.fol = (f.fol || 0) + DT;   // QUEUEING: seconds held to the speed of a car ahead (after the start)
    if (f.stuck > 3 || f.drv.state.giveUp) { const q = L.findNearestSubtrackPoint(sub, c.x, c.y); reset(c, q.x, q.y, q.heading); f.drv.relocate(); f.stuck = 0; f.resets++; inc.reset++; f.inc = (f.inc || 0) + 1; }
    { const vv = Math.hypot(c.vx, c.vy); if (vv > 5 && t > 2) { let a = Math.atan2(c.vy, c.vx) - c.heading; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (a > 1.22 && t - (f.spinT ?? -99) > 3) { f.spinT = t; inc.spin++; f.inc = (f.inc || 0) + 1; } } }
    const q = L.querySubtrack(sub, c.x, c.y);
    if (isFinite(q.trackDist)) {
      if (f.prog == null) f.prog = q.trackDist > total / 2 ? q.trackDist - total : q.trackDist;
      else { let dq = q.trackDist - f.lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total; const b = Math.floor(f.prog / total); f.prog += dq; if (Math.floor(f.prog / total) > b && f.prog > 0) { if (b >= 0) f.laps.push(t - f.tl); f.tl = t; } }
      f.lastQ = q.trackDist;
      if (q.dist > sub.width / 2 + 0.5) { if (process.env.OFFLOG && !f.wasOff) { const s = f.drv.state; console.log(`OFF #${f.car.spec.id.split("#")[1]} t ${t.toFixed(1)} d ${q.trackDist.toFixed(0)} v ${Math.hypot(c.vx, c.vy).toFixed(1)} vT ${s.vT.toFixed(1)} atk ${!!s.atk} cov ${!!s.cover} mist ${s.mist ? s.mist.kind : "-"} follow ${s.follow} dodge ${s.dodge.toFixed(1)}`); } f.wasOff = true; f.off += DT; } else f.wasOff = false;
      if (q.dist > sub.width / 2 + INC_OFF) { if (!f.wellOff) { f.wellOff = true; inc.off++; f.inc = (f.inc || 0) + 1; } } else if (q.dist < sub.width / 2) f.wellOff = false;
    }
  }
  if (!process.env.NODRAFT) slipstream(field.map((f) => f.car));
  const vS = DMG ? field.map((f) => [f.car.vx, f.car.vy]) : null;
  // every touching pair, classified in the REAR car's frame: NOSE-TAIL (lateral < 1.6 m) or SIDE; the first 8 s are the START
  let any = false;
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const A = field[a].car, B = field[b].car; if (Math.hypot(A.x - B.x, A.y - B.y) > 7) continue;
    if (!carContact(A, B)) continue;
    any = true; const key = a + ':' + b;
    if (!wasTouch.has(key)) { events++; if (Math.hypot(A.vx - B.vx, A.vy - B.vy) > INC_HIT) { inc.hit++; field[a].inc = (field[a].inc || 0) + 1; field[b].inc = (field[b].inc || 0) + 1; } const fa = (B.x - A.x) * Math.cos(A.heading) + (B.y - A.y) * Math.sin(A.heading), rear = fa > 0 ? A : B, front = fa > 0 ? B : A;
      const l = -(front.x - rear.x) * Math.sin(rear.heading) + (front.y - rear.y) * Math.cos(rear.heading);
      kinds[t < 8 ? 'start' : Math.abs(l) < 1.6 ? 'noseTail' : 'side']++; }
    nowTouch.add(key);
  }
  if (DMG) field.forEach((f, i) => hit(f.car, vS[i][0], vS[i][1], DT));
  if (any) touchT += DT;
  wasTouch = nowTouch; nowTouch = new Set();
  t += DT;
  // overtakes: the running order by progress, once a second
  if (Math.abs(t % 1) < DT && t > 5) { const o = field.map((f, i) => [f.prog, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]).join(','); if (order && o !== order) { const A = order.split(','), B = o.split(','); for (let k = 0; k < N; k++) if (A[k] !== B[k]) { overtakes++; break; } } order = o; }
  // PASSES: a pair swaps running order and HOLDS it 3 s (after the first 12 s, so the start's shuffle is not counted)
  if (t > 12 && Math.abs(t % 0.5) < DT) for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const k = a + ':' + b, ahead = field[a].prog > field[b].prog, P = pairs[k] || (pairs[k] = { ahead, since: t, held: ahead });
    if (ahead !== P.ahead) { P.ahead = ahead; P.since = t; }
    if (P.ahead !== P.held && t - P.since >= 3) { P.held = P.ahead; passes++; }
  }
  if (field.every((f) => f.prog != null && f.prog >= total * LAPS)) break;
}
console.log(`${lv} ${carId} diff ${d} x${N} seed ${seed}: ${t.toFixed(0)} s | contact ${touchT.toFixed(1)} s in ${events} events (${JSON.stringify(kinds)}) | order changes ${overtakes} | PASSES ${passes} | INCIDENTS ${inc.off + inc.spin + inc.hit + inc.reset} ${JSON.stringify(inc)} | FOLLOW ${field.reduce((a, f) => a + (f.fol || 0), 0).toFixed(0)} s`);
if (process.env.SURF) for (const [k, S] of Object.entries(surf).sort((x, y) => y[1].t - x[1].t)) console.log(`  SURF ${k.padEnd(11)} mu ${S.mu} | ${S.t.toFixed(0)} car-s | v ${(S.v / S.t).toFixed(1)} vs target ${(S.vT / S.t).toFixed(1)} | braking ${(100 * S.brk / S.t).toFixed(0)} % lifting ${(100 * S.lift / S.t).toFixed(0)} % front-slip>0.14 ${(100 * S.under / S.t).toFixed(0)} %`);
for (const f of field) console.log(`  #${f.car.spec.id.split('#')[1]} ${f.drv.traits.persona.padEnd(10)} pace ${f.drv.traits.pace.toFixed(3)} skill ${f.drv.traits.skill.toFixed(2)} | laps ${f.laps.length} [${f.laps.map((x) => x.toFixed(1)).join(', ')}] | off ${f.off.toFixed(1)} s | inc ${f.inc || 0} | resets ${f.resets} dmgR ${f.dmgResets || 0} bill ${Math.round(f.car.dmgBill || 0)} | near ${(f.drv.state.nearT || 0).toFixed(0)} s atk ${f.drv.state.nAtk || 0} | done ${(f.prog / total).toFixed(2)}`);
