// propcheck.mjs — no SOLID prop on any road, on EVERY level (user, 2026-10-04: a truck across Brands GP, a hut across the road at Druids).
// Samples each solid box (LEVEL.solids) on a 1 m grid; reports any sample inside the road (half width - 0.5). Gantries / footbridges
// span the road by design and are skipped. A solid stands on the ground: at a crossover (world/trackunder.ts) the road below - an
// underpass's lintel over it - is not its road.
// And no loose object or other light ON A LIGHT (owner 11-12: "Tyres placed over lights on birds mess"): every light - the level's own
// floodlight pylons (props, not solids) and the lamp plan's (world/lampplan.ts) - by its drawn footprint (a pylon's base and heads
// LAMP_FLOOD_M round, a street light's post LAMP_STREET_M) against every loose object's (the level's and the corner floodlights' tyre
// rings, each its own radius) and every other light's. node tools/propcheck.mjs
import * as L from '../src/lab.ts';
import { planLamps, cornerTyres } from '../src/world/lampplan.ts';

// m: a pylon's drawn footprint round its foot (render/props/buildings.ts drawPylon: its base 0.9 m, its heads to 0.75 m, its shadow);
// a street light's post; a loose object's radius by kind (cones.ts radiusOf), else LOOSE_M
const LAMP_FLOOD_M = 1.2, LAMP_STREET_M = 0.3, LOOSE_M = 0.5;
const LOOSE_R = { tyrestack: 0.48, tyre: 0.42, flag: 0.35, bale: 0.8, cone: 0.27, caravan: 2.4, podium: 1.7, banger: 2.1 };

/** Every light of the current level with its footprint radius. */
function levelLights() {
  const own = (L.LEVEL.props || []).filter((prop) => prop.kind === 'pylon').map((prop) => ({ x: prop.x, y: prop.y, r: LAMP_FLOOD_M, kind: 'pylon' }));
  const plan = planLamps(L.LEVEL).map((lamp) => ({ x: lamp.x, y: lamp.y, r: lamp.kind === 'floodlight' ? LAMP_FLOOD_M : LAMP_STREET_M, kind: lamp.kind }));
  return [...own, ...plan];
}

/** What stands on a light of the current level: a list of "kind on light at x,y". */
function onLights() {
  const lights = levelLights(), out = [];
  const loose = [...(L.LEVEL.cones || []), ...cornerTyres(L.LEVEL)];
  for (const light of lights) {
    for (const obj of loose)
      if (Math.hypot(obj.x - light.x, obj.y - light.y) < light.r + (LOOSE_R[obj.kind || 'cone'] ?? LOOSE_M))
        out.push(`${obj.kind || 'cone'} on a ${light.kind} at ${light.x.toFixed(0)},${light.y.toFixed(0)}`);
    for (const other of lights)
      if (other !== light && other.x >= light.x && Math.hypot(other.x - light.x, other.y - light.y) < light.r + other.r)
        out.push(`${other.kind} on a ${light.kind} at ${light.x.toFixed(0)},${light.y.toFixed(0)}`);
  }
  return out;
}

let bad = 0, overLights = 0;
for (const lv of L.LEVELS) {
  L.setLevel(lv.id); const st = L.LEVEL.subtrack; if (!st) continue; const hw = st.width / 2, hits = [];
  for (const b of L.LEVEL.solids || []) {
    if (b.kind === 'gantry' || b.kind === 'footbridge') continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot); let hit = false;
    for (let u = -b.w / 2; u <= b.w / 2 + 1e-6 && !hit; u += Math.min(1, b.w / 2 || 1)) for (let v = -b.h / 2; v <= b.h / 2 + 1e-6 && !hit; v += Math.min(1, b.h / 2 || 1))
      if (L.onGroundQuery(() => L.querySubtrack(st, b.x + c * u - s * v, b.y + s * u + c * v)).dist < hw - 0.5) hit = true;
    if (hit) hits.push(b.kind);
  }
  const lit = onLights();
  if (hits.length) bad += hits.length;
  overLights += lit.length;
  console.log((hits.length || lit.length ? 'FAIL ' : 'OK   ') + lv.id.padEnd(20), hits.length ? hits.join(' ') : '',
    lit.length ? `${lit.length} on a light: ${lit.slice(0, 4).join('; ')}` : '');
}
console.log(bad ? `FAILED: ${bad} solid props on a road` : 'props: all clear of the road');
console.log(overLights ? `FAILED: ${overLights} things on a light` : 'lights: nothing stands on one');
if (bad || overLights) process.exitCode = 1;
