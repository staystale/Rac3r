// S-B (2026-10-06): THE LAB EXTENSION. node tools/_labcheck.mjs
//   1. THE OLD SQUARE IS UNTOUCHED: every 3 m sample of the old lab (surface + height; tools/_labbase.mjs wrote it BEFORE the change)
//      is the same, and every old cone is still there. Only the old SOUTH kerb strip (now floor) may differ.
//   2. COVERAGE (rule 18): every surface but kerb has a crash lane, every loose-object kind sits at the end of one, each lane is its
//      own surface end to end, its objects are on it, and they spawn in the game's object list.
//   3. THE EDGE follows the rectangle (kerb / verge / trap / fence on the new south side; the others unchanged).
//   4. OFF-ROAD AREA: all its surfaces present, natural terrain moves the grass, the big hill is 2+ m.
//   5. OTHER LEVELS keep their square.
import { readFileSync } from 'node:fs';
const L = await import('../src/lab.js'), C = await import('../src/cones.js'), V = await import('../src/vehicle.ts');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const g = (x, y) => L.groundAt(x, y).surface.id;
L.setLevel('lab');
// ---- 1
const base = JSON.parse(readFileSync(new URL('../shots/look/sb-base/lab-ground.json', import.meta.url), 'utf8'));
let i = 0, diff = 0, diffEdge = 0, edgeBad = 0; const eg = [];
for (let x = -255; x <= 255; x += 3) for (let y = -255; y <= 250; y += 3) {
  const q = L.groundAt(x, y), now = q.surface.id + ':' + q.h.toFixed(4), was = base.g[i++];
  if (now === was) continue;
  if (y >= 256 - 3.5 - 1) { diffEdge++; if (!['lab', 'tarmac'].includes(q.surface.id)) edgeBad++; continue; }
  diff++; if (eg.length < 5) eg.push(`(${x}, ${y}) was ${was} now ${now}`);
}
ok(diff === 0, `old square: ${base.g.length} samples, ${diff} changed away from the old south edge${eg.length ? ' e.g. ' + eg.join(' | ') : ''}`);
ok(edgeBad === 0, `the old south kerb strip (${diffEdge} samples changed) is now plain floor: ${edgeBad} not lab / tarmac`);
const now = new Set(L.LEVEL.cones.map((c) => `${c.kind || 'cone'}@${(+c.x).toFixed(2)},${(+c.y).toFixed(2)}`));
const lost = base.cones.filter((c) => !now.has(c));
ok(lost.length === 0, `all ${base.cones.length} old cones still in place (${lost.length} missing)`);
// ---- 2
const laneIds = L.LAB_LANES.map((l) => l.id), noLane = Object.keys(L.SURFACES).filter((id) => id !== 'kerb' && !laneIds.includes(id));
ok(noLane.length === 0, `every surface has a crash lane: ${laneIds.length} lanes${noLane.length ? ', missing ' + noLane.join(', ') : ''}`);
const KINDS = ['cone', 'tyre', 'tyrestack', 'bale', 'banger', 'caravan', 'podium', 'chevron', 'flag', 'tapepost', 'sheep', 'cow', ...Object.keys(C.DEBRIS)];
const laneKinds = new Set(L.LAB_LANES.flatMap((l) => l.kinds)), noKind = KINDS.filter((k) => !laneKinds.has(k));
ok(noKind.length === 0, `every loose-object kind (${KINDS.length}) sits at the end of a lane${noKind.length ? ', missing ' + noKind.join(', ') : ''}`);
let laneBad = 0;
for (const l of L.LAB_LANES) {
  let wrong = 0; for (let x = -240; x <= 210; x += 5) for (const dy of [-5, 0, 5]) { const s = L.groundAt(x, l.y + dy).surface;
    // a WET zone is a puddle cover over tarmac (lab.js layersAt / surfaceOf: id 'puddle'), the same as the lab's wet panel - it dries where driven
    if (s.id !== l.id && !(l.id === 'wet' && s.id === 'puddle' && s.under === 'tarmac')) wrong++; }
  const objs = L.LEVEL.cones.filter((c) => Math.abs(c.y - l.y) < 7 && c.x > 150 && c.y > 290), off = objs.filter((c) => Math.abs(c.y - l.y) > 5.5);
  if (wrong || !objs.length || off.length) { laneBad++; console.log(`     lane ${l.id}: ${wrong} samples not ${l.id}, ${objs.length} objects, ${off.length} off the lane`); }
}
ok(laneBad === 0, `each of the ${L.LAB_LANES.length} lanes is one surface end to end with its objects on it (${L.LEVEL.cones.length - base.cones.length} new objects)`);
const cs = C.createCones(); cs.reset(); const by = {}; for (const k of cs.list) if (k.y > 280) by[k.kind] = (by[k.kind] || 0) + 1;
ok(KINDS.every((k) => by[k] > 0), `spawned in the game's object list: ${Object.entries(by).map(([k, n]) => k + ' ' + n).join(', ')}`);
// ---- 3
ok(g(0, 738) === 'kerb' && g(0, 745) === 'grass' && g(0, 770).startsWith('trap'), `new south edge: kerb 738 (${g(0, 738)}), verge 745 (${g(0, 745)}), trap 770 (${g(0, 770)})`);
ok(g(0, -258) === 'kerb' && g(258, 0) === 'kerb' && g(-258, 600) === 'kerb' && g(258, 600) === 'kerb', `kerb north (${g(0, -258)}), east (${g(258, 0)}), long sides at y 600 (${g(-258, 600)} / ${g(258, 600)})`);
{ const car = V.makeCar('saloon-rwd'); V.reset(car, 0, 800, Math.PI / 2); car.vy = 20; L.fenceClamp(car); const lim = 740 + L.RUNOFF_W;
  ok(car.y <= lim && car.y > lim - 4 && car.vy < 0, `fence clamps at the new south fence (y ${car.y.toFixed(1)}, fence ${lim}, vy ${car.vy.toFixed(1)})`);
  V.reset(car, 0, 600, 0); L.fenceClamp(car); ok(car.y === 600, `no fence across the extension (y 600 stays ${car.y})`); }
{ const k = cs.list.find((o) => o.kind === 'cone' && o.y > 290); k.y = 900; k.vy = 5; k.moved = true; cs.step(V.makeCar('saloon-rwd'), 1 / 120);
  ok(k.y <= 740, `a loose object flung south is kept on the floor (y ${k.y.toFixed(1)})`); }
// ---- 4
const ids = new Set(); for (let x = -245; x <= 245; x += 4) for (let y = 552; y <= 728; y += 4) ids.add(g(x, y));
ok(['grass', 'grassLong', 'dirt', 'mud', 'thickMud', 'sand', 'gravel'].every((s) => ids.has(s)), `off-road surfaces: ${[...ids].join(', ')}`);
let hmin = 99, hmax = -99; for (let x = -100; x <= 40; x += 1) { const h = L.heightAt(x, 580); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
ok(hmax - hmin > 0.15, `natural terrain on the grass: the ground moves ${(hmax - hmin).toFixed(2)} m along 140 m`);
let top = 0; for (let x = 100; x <= 160; x += 1) top = Math.max(top, L.heightAt(x, 676)); ok(top > 2, `the big hill reaches ${top.toFixed(2)} m`);
// ---- 5
L.setLevel('test-track'); ok(L.FY1 === 260 && L.FX0 === -260, `test-track keeps its square (${L.FX0}..${L.FX1} x ${L.FY0}..${L.FY1})`);
L.setLevel('lab'); ok(L.FY1 === 740, 'back on the lab: the rectangle again');
console.log(bad ? `FAIL (${bad})` : 'ALL OK');
