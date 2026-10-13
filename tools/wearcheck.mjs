// wearcheck.mjs — proves the LAYERED surface wear rules (lab.js, 2026-10-03) by measurement.
//
//   node tools/wearcheck.mjs        exit code 1 on any failure
//
// 1. base chain, by passes: long grass -> short grass -> dirt -> mud -> thick mud
// 2. snow packs to ice, and the base under it does not wear while covered
// 3. ROLLING over ice does not wear it; a LOCKED / SLIDING car does, and exposes the base — which then
//    wears by its own rules (lab ice sheet over grass -> grass -> dirt -> mud). Driven with the real
//    vehicle model over the real lab, not by calling the rules directly.
// 4. a puddle scales what it sits on (puddle-on-grass is LESS grippy than grass, not wet-tarmac grippy)
// 5. COVERAGE (CLAUDE.md rule 18): every surface in SURFACES has graphics in render.ts SURFACE_ART
import { readFileSync } from 'node:fs';
import { makeCar, step, reset, DT } from '../src/vehicle.ts';
import { setAidsDefault } from '../src/vehicle.ts';
// RAW physics: driver aids OFF (with TCS on, a burnout is not a burnout; with ABS on, a locked pass cannot lock).
setAidsDefault(false);
import * as L from '../src/lab.js';

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails.push(msg); };

// ---- 1. base chain (one pass every 0.5 s on a long-grass test panel)
L.setLevel('lab'); L.clearWear();
const gx = -143, gy = -106;     // the long grass panel
let t = 0;
const seq = [];
for (let i = 0; i < 10; i++) { seq.push(L.recordWearAt(gx, gy, null, (t += 500))); }
console.log('1. long grass, surface after each pass:', seq.join(' > '));
check(seq[1] === 'grassShort' && seq[3] === 'dirt' && seq[5] === 'mud' && seq[8] === 'thickMud', 'chain: short @2, dirt @4, mud @6, thick mud @9');

// ---- 2. snow cover
L.clearWear();
const sxp = -180, syp = -185;   // lab snow drift (over grass)
check(L.groundAt(sxp, syp).surface.id === 'snow', 'snow drift reads as snow');
const s2 = [];
for (let i = 0; i < 6; i++) s2.push(L.recordWearAt(sxp, syp, null, (t += 500)));
console.log('2. snow, after each pass:', s2.join(' > '));
// snow becomes ICE or MELTWATER at pass 4, by chance (user, 2026-10-03) — never before pass 4
check(s2[2] === 'snow' && (s2[3] === 'ice' || s2[3] === 'wet'), 'snow holds 3 passes, then packs to ice OR melts to water at pass 4');
// over many cells both outcomes must actually occur, roughly half each
{ let ice = 0, wet = 0; for (let k = 0; k < 40; k++) { L.clearWear(); let tt = 0; let r; for (let i = 0; i < 4; i++) r = L.recordWearAt(sxp, syp, null, (tt += 500)); if (r === 'ice') ice++; else if (r === 'wet') wet++; }
  console.log(`2b. 40 snow cells after 4 passes: ${ice} ice, ${wet} meltwater`);
  check(ice > 8 && wet > 8, 'both freezing and melting happen'); }

// ---- 3. ice over grass, driven with the real car
function driveAcross(inputFn, y, label) {
  const car = makeCar('hatch-rwd');
  reset(car, -150, y, 0);
  car.vx = 16;
  for (let i = 0; i < 120 * 6 && car.x < -40; i++) {
    L.applyGround(car, DT);
    step(car, inputFn(car), DT);
  }
  return car;
}
const iceCells = () => [...L.wearMap.values()].filter((c) => c.orig === 'ice');
L.clearWear();
// COASTING, not on throttle: on ice even light throttle spins the driven wheels, and spinning wheels DO
// scrub (correctly) — first run of this check used throttle 0.3 and "failed" for exactly that reason.
for (let n = 0; n < 6; n++) driveAcross(() => ({ throttle: 0, brake: 0, steer: 0 }), -185, 'roll');
const rolled = iceCells();
const scrubbedByRolling = rolled.filter((c) => c.cover !== 'ice').length;
console.log(`3a. 6 rolling passes over the ice: ${rolled.length} ice cells touched, ${scrubbedByRolling} scrubbed through`);
check(rolled.length > 0 && scrubbedByRolling === 0, 'rolling over ice does NOT wear it');
// locked brakes across the ice, starting ON it (it is slippery, so the wheels lock immediately).
// USER RULE, 2026-10-03: "ice should take a couple of passes before it melts" — one pass must NOT do it.
const lockPass = () => driveAcross((car) => ({ throttle: 0, brake: car.x > -122 ? 1 : 0, steer: 0 }), -185, 'brake');
const scrubbed = () => iceCells().filter((c) => c.cover !== 'ice');
lockPass();
const afterOne = scrubbed().length;
let passes = 1;
while (scrubbed().length < 4 && passes < 8) { lockPass(); passes++; }
const exposed = scrubbed();
console.log(`3b. locked-brake passes: after 1 -> ${afterOne} cells through; first real scrub after ${passes} passes (${exposed.length} cells), showing: ${[...new Set(exposed.map((c) => c.current))].join(', ')}`);
check(afterOne === 0, 'ONE locked pass does not break the ice');
check(passes >= 2 && passes <= 4 && exposed.length >= 4, '2-4 locked passes scrub it through');
// scrubbed ice leaves MELTWATER over the grass (user, 2026-10-03: "after snow / ice water should be left")
// (fourth water pass: the scrubbing passes themselves now churn some meltwater into the grass -> mud)
check(exposed.length > 0 && exposed.some((c) => c.cover === 'wet' && c.base.startsWith('grass')) && exposed.every((c) => (c.cover === 'wet' && c.base.startsWith('grass')) || (!c.cover && /mud/i.test(c.base))), '... leaving MELTWATER over the grass beneath (or the mud it has churned into)');
const gs = exposed.length > 0 ? L.groundAt((exposed[0].cx + 0.5) * L.WEAR_CELL, (exposed[0].cy + 0.5) * L.WEAR_CELL).surface : null;
check(gs && gs.id === 'puddle' && gs.under.startsWith('grass'), 'the car now drives in a puddle on grass there');
// meltwater is STANDING water (user, 2026-10-03): cold tyres never clear it ...
for (let n = 0; n < 6; n++) driveAcross(() => ({ throttle: 0, brake: 0, steer: 0 }), -185, 'roll');
const stillWet = iceCells().filter((c) => c.cover !== 'ice');
console.log(`3c. after 6 more cold passes: ${stillWet.filter((c) => c.cover === 'wet').length} of ${stillWet.length} exposed cells still water`);
// meltwater over GRASS is churned into it by any tyre (user, 2026-10-03, fourth pass: water on soft ground -> mud)
check(stillWet.filter((c) => c.cover === 'wet').length <= stillWet.length * 0.1, 'cold tyres churn meltwater on grass away (6 passes)');
const after3 = stillWet.map((c) => c.current), cnt3 = after3.reduce((h, id) => ((h[id] = (h[id] || 0) + 1), h), {});
console.log('3d. after those passes the cells are:', JSON.stringify(cnt3));
check(after3.filter((id) => id !== 'wet').every((id) => id === 'mud' || id === 'thickMud'), 'churned meltwater on grass leaves mud');

// ---- 4. puddles scale their base
const grass = L.SURFACES.grass, tarmac = L.SURFACES.tarmac;
const pg = L.surfaceOf('grass', 'wet'), pt = L.surfaceOf('tarmac', 'wet');
console.log(`4. grip: grass ${grass.mu} -> puddle ${pg.mu.toFixed(2)}; tarmac ${tarmac.mu} -> puddle ${pt.mu.toFixed(2)}`);
check(pg.mu < grass.mu && pt.mu < tarmac.mu && pg.mu < pt.mu, 'a puddle is slipperier than what it sits on, and keeps that base\'s character');

// ---- 4b. puddles only go with HOT tyres (or weather), then MIX with what they lay on (user, 2026-10-03)
L.setLevel('sandbox');
const passesToDry = (x, y, T, standing) => {
  if (standing) L.LEVEL.covers.push({ x, y, w: 6, h: 4, cover: 'wet', shape: 'ellipse' });
  L.clearWear(); let tm = 0, n = 0, left = null;
  for (; n < 60; ) { n++; left = L.recordWearAt(x, y, null, (tm += 500), T); if (left !== 'wet') break; }
  if (standing) L.LEVEL.covers.pop();
  return { n: left === 'wet' ? Infinity : n, left };
};
// SOFT bases: any tyre CHURNS a puddle into them in ~1-3 passes (user, fourth pass). Averaged over 200 puddles.
for (const [id, x, y, want] of [['sand', 110, 70, 'gravel'], ['gravel', 50, 70, 'mud'], ['grass', 40, 40, 'mud'], ['dirt', null, null, 'mud']]) {
  let pos = [x, y];
  if (x === null) {   // find a dirt spot on the sandbox
    pos = null;
    for (let gx = -200; gx < 200 && !pos; gx += 3) for (let gy = -150; gy < 150 && !pos; gy += 3) if (L.groundAt(gx, gy).surface.id === 'dirt') pos = [gx, gy];
  }
  if (!pos) { check(false, 'no dirt on the sandbox to test'); continue; }
  let sum = 0, worst = 0, left = new Set();
  for (let k = 0; k < 200; k++) { const r = passesToDry(pos[0], pos[1], 18, true); sum += r.n; worst = Math.max(worst, r.n); left.add(r.left); }
  console.log(`4b. puddle on ${id}: COLD tyres churn it in ${(sum / 200).toFixed(2)} passes on average (worst ${worst}), leaving ${[...left].join('/')}`);
  check(sum / 200 >= 1.6 && sum / 200 <= 2.4 && worst <= 3 && [...left].every((s) => s === want), `cold tyres churn a puddle on ${id} in ~1-3 passes, leaving ${want}`);
}
// HARD base: a puddle on tarmac still only goes with HOT tyres (or weather)
{
  const tx = 0, ty = 0; let pos = null;
  for (let gx = -200; gx < 200 && !pos; gx += 3) for (let gy = -150; gy < 150 && !pos; gy += 3) if (L.groundAt(gx, gy).surface.id === 'tarmac') pos = [gx, gy];
  const cold = passesToDry(pos[0], pos[1], 18, true), hot = passesToDry(pos[0], pos[1], 110, true);
  console.log(`4b. puddle on tarmac: cold ${cold.n === Infinity ? 'never (60 passes)' : cold.n}; hot 110 C ${hot.n} passes, leaving ${hot.left}`);
  check(cold.n === Infinity && hot.n <= 6 && hot.left === 'tarmac', 'a puddle on tarmac: cold never clears it, hot tyres evaporate it');
}
// damp ground (a WET zone, not a puddle): a dry line forms with cold tyres in many passes, quicker when warm
L.setLevel('lab');
const dCold = passesToDry(-96, 74, 18, false), dHot = passesToDry(-96, 74, 100, false);
console.log(`4c. lab wet panel (damp tarmac): dry line after ${dCold.n} cold passes, ${dHot.n} at 100 C`);
check(dCold.n >= 12 && dCold.n <= 25 && dHot.n <= 4, 'damp tarmac dries in ~12-25 cold passes, a few hot ones');

// ---- 5. coverage: every surface has art
const src = readFileSync(new URL('../src/render.ts', import.meta.url), 'utf8');
const art = src.slice(src.indexOf('const SURFACE_ART = {'), src.indexOf('function paintLayers'));
const missing = Object.keys(L.SURFACES).filter((id) => id !== 'lab' && id !== 'kerb' && !new RegExp(`\\b${id}: \\{`).test(art));
console.log('5. surfaces without graphics:', missing.length ? missing.join(', ') : 'none');
check(missing.length === 0, 'every surface in SURFACES has a SURFACE_ART entry');

console.log(fails.length ? `\nFAIL (${fails.length})` : '\nWear rules: all OK');
process.exitCode = fails.length ? 1 : 0;
