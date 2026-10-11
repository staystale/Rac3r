// wear.js - the SURFACE DEGRADATION & WEAR MAP section. Moved verbatim out of lab.js.
import { LEVEL } from "./state.js";
import { SURFACES, MARK_WET, SPRAY_WET, VERGE_W, TRAP_STEPS, SURFACE_TRAP } from "./surfaces.js";
import {
  FX1, FX0, FY1, FY0, KERB_W, KERB_H, KERB_RIDGE, KERB_RIDGE_L, RUNOFF_W, RUNOFF_ROUGH,
} from "./bounds.js";
import { zoneAt } from "./zones.js";
import { bumpAt, slopeAt, heightAt, bankHeightAt, BUMP_STEER } from "./terrain.js";
import { querySubtrack } from "./tyrewall.js";

// =============================================================================================
// SURFACE DEGRADATION & WEAR MAP — LAYERED, rebuilt 2026-10-03 (user: "snow should compress to ice after
// several passes; ice should wear away with heavy braking or sliding and show the surface underneath; if
// the surface under is grass it should behave like grass and turn to mud once exposed and then driven
// over ... mud turns to thick mud ... puddles on any surface, ice and snow on any surface").
//
// A wear CELL (WEAR_CELL m square) holds two layers:
//   base   — the ground itself. Wears down a chain by PASSES (a wheel crossing the cell, debounced):
//            long grass -> short grass -> dirt -> mud -> thick mud. Counts in BASE_WEAR below.
//   cover  — something lying ON the base: 'snow', 'ice' or 'wet' (a puddle). While a cover is there the
//            base cannot wear — the tyre never touches it.
//              snow  compresses to ice after SNOW_TO_ICE passes.
//              ice   is SCRUBBED away only by a wheel that is sliding or locked over it (slip speed above
//                    ICE_SCRUB_MIN, metres of slip accumulated past ICE_SCRUB). Rolling over it does nothing.
//                    When it goes, the base is exposed and wears by its own rules from then on.
//              wet   WATER DRIES BY TYRE HEAT (user, 2026-10-03, third pass: "puddles should only go when hot tyres
//                    or weather evaporate them — dry lines can still form with many passes of cold tyres but happen
//                    quicker with warmer tyres"). Each pass adds dryness by tyre temperature (dryAmount):
//                      STANDING water (level puddles, meltwater): cold tyres add NOTHING; hot tyres evaporate it.
//                      DAMP ground (a wet zone / sector, wet tarmac): cold tyres dry a line slowly, warm ones fast.
//                    When dry it MIXES with what it lay on
//                    (WATER_MIX): grass / dirt -> mud, sand -> gravel, gravel -> mud; tarmac just dries.
//                    (user, 2026-10-03: "puddles should vanish or mix with surfaces like grass or dirt to
//                    create mud ... sand and water should mix to create gravel ... gravel and water make mud")
// Covers come from the level (LEVEL.covers, any shape over any surface) or from a zone whose own surface
// is snow/ice — those are treated as a cover over zone.under (default UNDER_DEFAULT), so a lab ice
// panel scrubs through to tarmac and the same rules apply everywhere.
//
// ONE rule table. MEASURED BUG fixed here: the old code had the chain written TWICE with different numbers
// (recordWearAt said long grass -> mud in 8 passes, the game's recordWearPoint said 6), and the only test
// exercised the copy the game never used (CLAUDE.md rule 18).
export const WEAR_CELL = 1.5;
export const wearMap = new Map();
// Cells whose surface CHANGED since the renderer last looked. The renderer bakes wear into its cached
// ground tiles and uses this to know which tiles to repaint (render.js drawGround). Drained by it.
export const wearDirty = [];
const BASE_WEAR = {             // base -> [what it becomes, passes it takes]. Cumulative from long grass: 2, 4, 6, 9.
  grassLong: ['grassShort', 2],
  grass: ['dirt', 2],
  grassShort: ['dirt', 2],
  dirt: ['mud', 2],
  mud: ['thickMud', 3],
};
export const SNOW_TO_ICE = 4;      // passes to pack snow into ice
// dryness a pass adds, by tyre temperature T. Measured in tools/wearcheck.mjs:
//   damp:     0.06 + 0.30 x heat(40..100 C)  -> cold ~17 passes, 100 C ~3 passes
//   standing: 0.35 x heat(60..120 C)          -> cold never, 90 C ~6 passes, 120 C ~3 passes
// (Before this: a puddle went in 1-3 passes of ANY tyre — PUDDLE_CHURN_CHANCE — which the user found far too easy.)
export function dryAmount(standing, T) {
  if (standing) return 0.35 * Math.max(0, Math.min(1, (T - 60) / 60));
  return 0.06 + 0.30 * Math.max(0, Math.min(1, (T - 40) / 60));
}
// (history) the rule before (user: "a happy medium — a % chance so it takes 1-3 passes"): a 40% chance per pass of
// ANY tyre, so 1-3 passes. Replaced by dryAmount above.
export const SNOW_MELT_CHANCE = 0.5;   // packed snow melts to water (else freezes to ice), per cell
export const WATER_CHURN_CHANCE = 0.4;   // per pass, standing water over a WATER_MIX base -> 1-3 passes
const WATER_MIX = {                // what a churned puddle leaves behind, by the base it lay on
  grass: 'mud', grassShort: 'mud', grassLong: 'mud', dirt: 'mud', mud: 'thickMud',
  sand: 'gravel', gravel: 'mud',
};
// 7.0, was 2.0. User, 2026-10-03: "ice should take a couple of passes before it melts unless tyres are very
// hot". MEASURED at 2.0: ONE locked-brake pass scrubbed 32 cells through. A locked pass puts ~3 m of slip into a
// cell (two wheels in line, ~1.5 m each), so 7 m takes 2-3 hard passes. Hot tyres melting it faster waits for
// the tyre-temperature model (TODO, tier 3) — it should scale THIS number down, nothing else.
export const ICE_SCRUB = 7.0;      // m of tyre slip over a cell to scrub its ice through
export const ICE_SCRUB_MIN = 2.0;  // m/s of slip below which a wheel is rolling, not scrubbing
export const COVER_IDS = { snow: 1, ice: 1, wet: 1 };
const UNDER_DEFAULT = 'tarmac';

// ONE wear clock for the world (sim seconds), not per car. MEASURED BUG, 2026-10-03 (tools/wearcheck.mjs):
// the pass debounce used car.simTime, which starts at 0 for every new car — so after switching car, every
// cell the old car had driven over stopped counting passes until the new car's clock caught up.
let wearClock = 0;
export let wearEpoch = 0;
export function clearWear() {
  wearMap.clear();
  wearClock = 0;
  wearDirty.length = 0;
  wearEpoch++;          // tells the renderer every baked tile is out of date

}

// PRUNE THE WEAR on a streamed level (highway.js stepHighway, after each rebuild). MEASURED BUG (user, 2026-10-06: "occasionally leaves
// patches of dirt on highway levels ... after longer drives / with ai on"; tools/_wearleak.mjs): wear cells live at WORLD positions and
// were never dropped - so when the endless road was rebuilt and new ground (a field, a bridge approach, the road swinging back) came
// down over a worn cell, that cell still drove AND drew as the old dirt / mud. Spun AI chew the verge, so it showed most with AI. The map
// also grew for the whole drive, and every ground-tile repaint walks it. Drop a cell if it is farther than `far` m from (x, y) or the
// ground under it is not what it was worn FROM; its tiles are repainted (wearDirty).
export function pruneWear(x, y, far) {
  let n = 0;
  for (const [key, cell] of wearMap) {
    const cx = (cell.cx + 0.5) * WEAR_CELL, cy = (cell.cy + 0.5) * WEAR_CELL;
    let drop = (cx - x) ** 2 + (cy - y) ** 2 > far * far;
    if (!drop) { const L = layersAt(cx, cy); drop = (L.cover || L.base) !== cell.orig; }
    if (drop) { wearMap.delete(key); n++; if (cell.current !== cell.orig) { cell.current = cell.orig; wearDirty.push(cell); } }
  }
  return n;
}
export const cleanAt = (x, y) => { const L = layersAt(x, y); return L.cover || L.base; };   // tools/_wearleak.mjs: the ground with no wear

// The STATIC layers at a point, before any wear: { base, cover } as surface ids.
// LEVEL.patches: [{ x, y, w, h, rot, surface }] — small ellipses of a different BASE laid on the ground
// (the Grass Track's random spots). Checked after the zone, so a patch on the road changes the road.
// Looked up through PATCH_GRID (built per level in prepareLevel), so thousands of blend patches cost the
// physics a handful of comparisons per query instead of a scan of the whole list.
export const PATCH_CELL = 6;
export let PATCH_GRID = new Map();
export const patchKey = (cx, cy) => cx * 65536 + cy;
export const zoneSurfaceAt = (x, y) => zoneAt(x, y);     // read-only, for tools/blendcheck.mjs
function patchAt(x, y) {
  if (!PATCH_GRID.size) return null;
  const list = PATCH_GRID.get(patchKey(Math.floor(x / PATCH_CELL), Math.floor(y / PATCH_CELL)));
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    let dx = x - c.x, dy = y - c.y;
    if (c.sq) { if (Math.abs(dx) <= c.w / 2 && Math.abs(dy) <= c.h / 2) return c.surface; continue; }
    if (dx * dx + dy * dy > c.w * c.w) continue;
    const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), u = dx * co + dy * si, v = -dx * si + dy * co;
    if ((u * u) / ((c.w / 2) ** 2) + (v * v) / ((c.h / 2) ** 2) <= 1) return c.surface;
  }
  return null;
}
export function layersAt(x, y) {
  const zz = zoneAt(x, y);
  // `standing`: the water here is a PUDDLE (LEVEL.covers), not a damp wet zone — they dry differently
  const z = zz.id === 'kerb' ? zz : (patchAt(x, y) || zz);   // kerbs are their own surface; patches never cover them
  let base = z.id, cover = null;
  // a snow, ice OR WET zone is a cover over its `under` (default tarmac). Wet joined 2026-10-03 (user: "wet tarmac
  // ... needs blue-ish puddles that can be removed by driving over them") — so a wet panel or wet sector now
  // DRIES where it is driven, cell by cell, leaving a dry line through it like a real drying track.
  if (COVER_IDS[base]) { cover = base; base = z.under || UNDER_DEFAULT; }
  const cv = coverAt(x, y);
  if (cv) cover = cv;
  return { base, cover, standing: !!cv };
}
// LEVEL.covers: [{ x, y, w, h, cover: 'snow'|'ice'|'wet', shape: 'rect'|'ellipse', rot }]
// share of tyre-slip heat that reaches the TYRE on loose ground (vehicle.js TYRE_HEAT). User: "off-road surfaces
// shouldn't get them up much". MEASURED: gravel drift 260 C in 14 s before -> 25 C at 30 s at 0.15.
export const HEAT_OFFROAD = 0.15;
export const COVER_SQ = 0.5;   // m, the cover grid (render.js coverCells uses the same 0.5)
export function coverAt(x, y) {
  const list = LEVEL.covers;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    // the SAME 0.5 m world-grid squares render.js coverCells draws (user rule: visuals accurate to their effects):
    // the point is tested at the centre of its square, so a cover's grip edge is exactly its drawn stepped edge
    let dx = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - c.x, dy = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - c.y;
    // CHEAP REJECT before any trig (2026-10-04, profiled: Sweaty Lamb's 40-puddle stream made coverAt 3.4 % of a lap); rotation cached
    const hx = c.w / 2, hy = c.h / 2, rr = hx > hy ? hx : hy;
    if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
    if (c.rot) { if (c._co === undefined) { c._co = Math.cos(c.rot); c._si = Math.sin(c.rot); } const co = c._co, si = c._si; const u = dx * co + dy * si; dy = -dx * si + dy * co; dx = u; }
    if (c.shape === 'ellipse' ? (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) <= 1 : Math.abs(dx) <= hx && Math.abs(dy) <= hy) { if (c.cut && coverCut(c, x, y)) continue; return c.cover; }
  }
  return null;
}
// a cover's CUT-OUT (highway.js river: no water where the motorway crosses on its parapets): in the frame of (cut.ox, cut.oy) along
// c.rot, the band |u - v tan| < e is dry. Tested at the 0.5 m square's centre, like the cover itself (render.js coverCells agrees).
export function coverCut(c, x, y) {
  const k = c.cut, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0);
  const ex = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - k.ox, ey = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - k.oy;
  const u = ex * co + ey * si, v = -ex * si + ey * co;
  return Math.abs(u - v * k.tn) < k.e;
}

// What a tyre feels for a base + cover. snow / ice replace the base outright (the tyre is on them). A
// PUDDLE does not — water on grass is not wet tarmac — it scales the base: less grip, more drag, wet
// marks and spray. Built once per base and cached, so physics gets a plain surface object.
const PUDDLE = {};
export function surfaceOf(base, cover) {
  if (!cover) return SURFACES[base] || SURFACES[UNDER_DEFAULT];
  if (cover !== 'wet') return SURFACES[cover];
  const b = SURFACES[base] || SURFACES[UNDER_DEFAULT];
  if (b.id === 'wet') return b;
  return PUDDLE[b.id] || (PUDDLE[b.id] = {
    ...b, id: 'puddle', under: b.id, label: 'PUDDLE (' + b.label + ')',
    mu: b.mu * 0.72, longK: (b.longK || 1) * 0.92, plough: (b.plough || 0) + 0.6, mark: MARK_WET, spray: SPRAY_WET,
    coolK: Math.max(0.20, b.coolK || 0),
  });
}

function getCell(cx, cy) {
  const key = cx + ',' + cy;
  let cell = wearMap.get(key);
  if (!cell) {
    const L = layersAt((cx + 0.5) * WEAR_CELL, (cy + 0.5) * WEAR_CELL);
    // nothing in this cell can ever change: do not create it (keeps the map to cells that matter)
    if (!L.cover && !BASE_WEAR[L.base]) return null;
    cell = { cx, cy, base: L.base, cover: L.cover, orig: L.cover || L.base, passes: 0, scrub: 0, dry: 0, standing: L.standing, lastSeenTime: -100 };
    cell.current = cell.orig;
    wearMap.set(key, cell);
  }
  return cell;
}
// Apply one PASS to a cell (debounced by the caller).
function passCell(cell, T = 18) {
  if (cell.cover === 'snow') {
    // MELT OR FREEZE (user, 2026-10-03: "snow should have a chance to melt or turn to ice when driven over — it
    // should still take multiple passes"). After SNOW_TO_ICE passes it becomes ICE or MELTWATER, by chance.
    if (++cell.passes >= SNOW_TO_ICE) { cell.cover = Math.random() < SNOW_MELT_CHANCE ? 'wet' : 'ice'; cell.passes = 0; cell.standing = true; cell.dry = 0; }
  } else if (cell.cover === 'wet') {
    // CHURN vs EVAPORATE (user, 2026-10-03, fourth pass: "water on dirt ... should become mud when driven over").
    // MEASURED BUG: a puddle on dirt only mixed after it had DRIED, and standing water only dries above 60 C, so on
    // dirt it stayed a puddle forever. Tyres churning water INTO soft ground is not evaporation: on any base with a
    // WATER_MIX rule, every pass of ANY tyre has WATER_CHURN_CHANCE to churn it (1-3 passes, the user's earlier
    // "happy medium"). Hard ground (tarmac) has nothing to churn into, so it keeps the heat / weather rule.
    // capped: the 3rd pass always churns (pure 40% measured a worst case of 9-12 passes over 200 puddles)
    if (cell.standing && WATER_MIX[cell.base] && (++cell.passes >= 3 || Math.random() < WATER_CHURN_CHANCE)) cell.dry = 1;
    else cell.dry += dryAmount(cell.standing, T);
    if (cell.dry >= 1) { cell.cover = null; cell.base = WATER_MIX[cell.base] || cell.base; cell.passes = 0; cell.dry = 0; }
  } else if (!cell.cover) {
    const rule = BASE_WEAR[cell.base];
    if (rule && ++cell.passes >= rule[1]) { cell.base = rule[0]; cell.passes = 0; }
    // RUTS THAT DEEPEN (step 3; user: the "vector dips" — "mud turns to thick mud / vector dips; sand and gravel also
    // have the chance to create vector dips"). A pass digs the cell down by RUT[base].step (sand / gravel by chance) to
    // its max. It is real height: the suspension feels it and gravity on its sides pulls wheels into the groove.
    const r = RUT[cell.base];
    if (r && Math.random() < r.chance) {
      const was = cell.rut || 0;
      cell.rut = Math.min(r.max, was + r.step);
      // repaint the shading only when the depth crosses a 2 cm band (a repaint per pass would thrash the tile cache)
      if (Math.floor(cell.rut / 0.02) !== Math.floor(was / 0.02)) wearDirty.push(cell);
    }
  }
  const now = cell.cover || cell.base;
  if (now !== cell.current) { cell.current = now; wearDirty.push(cell); }
}
// Slip scrubbing a cell's ice (metres of slip this step).
function scrubCell(cell, slipM) {
  if (cell.cover !== 'ice') return;
  cell.scrub += slipM;
  // scrubbed ice leaves MELTWATER, not bare ground (user, 2026-10-03: "after snow / ice water should be left") —
  // a puddle that then churns into its base by the WATER_MIX rules, so ice over grass ends as mud.
  if (cell.scrub >= ICE_SCRUB) { cell.cover = 'wet'; cell.standing = true; cell.dry = 0; cell.scrub = 0; cell.passes = 0; cell.current = 'wet'; wearDirty.push(cell); }
}

// Kept for tools/phase1check.mjs: one pass at a point, debounced in ms. Same rules as the game.
export function recordWearAt(x, y, _baseIdUnused, timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()), tyreT = 18) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return null;
  if (timeMs / 1000 - cell.lastSeenTime > 0.35) passCell(cell, tyreT);
  cell.lastSeenTime = timeMs / 1000;
  return cell.current;
}

// RUT depth per soft base: m per pass, cap, and the chance a pass digs at all.
const RUT = {
  mud: { step: 0.025, max: 0.15, chance: 1 },
  thickMud: { step: 0.03, max: 0.22, chance: 1 },
  sand: { step: 0.02, max: 0.12, chance: 0.5 },
  gravel: { step: 0.015, max: 0.08, chance: 0.35 },
};
// Rut depth at a point, BILINEAR between cell centres so the groove has smooth sides (a step would be an infinite slope).
export function rutAt(x, y) {
  if (wearMap.size === 0) return 0;
  const fx = x / WEAR_CELL - 0.5, fy = y / WEAR_CELL - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const d = (a, b) => { const c = wearMap.get(a + ',' + b); return c && c.rut ? c.rut : 0; };
  const d00 = d(i, j), d10 = d(i + 1, j), d01 = d(i, j + 1), d11 = d(i + 1, j + 1);
  if (!(d00 || d10 || d01 || d11)) return 0;
  return (d00 * (1 - tx) + d10 * tx) * (1 - ty) + (d01 * (1 - tx) + d11 * tx) * ty;
}

export function getWornSurface(x, y) {
  if (wearMap.size === 0) return null;
  const cell = wearMap.get(Math.floor(x / WEAR_CELL) + ',' + Math.floor(y / WEAR_CELL));
  return cell ? surfaceOf(cell.base, cell.cover) : null;
}

// Height noise for a surface, from its own `rough`. Two incommensurate frequencies so it does not read
// as a sine wave, and long enough wavelengths to survive a 120 Hz sim at 45 m/s without aliasing.
function roughAt(x, y, rough) {
  if (!rough) return 0;
  return rough * (Math.sin(x * 0.9) * Math.sin(y * 1.2) + 0.6 * Math.sin(x * 2.1 + y * 1.7));
}

// THE GROUND under a point: its height in metres and what it grips like. Everything about the world's
// surface is this one function; main.js reads it and vehicle.js integrates over it.
export function groundAt(x, y) {
  // e = metres past the floor edge (negative inside); on the square it is max(|x|, |y|) - FLOOR, as before (S-B: any rectangle)
  const ex = Math.max(x - FX1, FX0 - x), ey = Math.max(y - FY1, FY0 - y), e = ex > ey ? ex : ey;

  // --- on the floor: whatever zone you are standing in, plus any bumps laid on top of it
  if (e <= -KERB_W) {
    const worn = getWornSurface(x, y);
    let s = worn;
    if (!s) { const L = layersAt(x, y); s = surfaceOf(L.base, L.cover); }
    return { h: roughAt(x, y, s.rough) + bumpAt(x, y), surface: s };
  }

  // --- THE KERB. A HUMP, not a step: zero at the inner lip, KERB_H at the crest, back to zero at the
  // outer edge. sin^2 so both ends are smooth — a discontinuity here is an infinite ground velocity,
  // and the suspension would answer with an infinite load.
  if (e <= 0) {
    const d = (e + KERB_W) / KERB_W;
    const s = Math.sin(Math.PI * d);
    // ridges run ALONG the edge, so their phase comes from whichever axis is not the dominant one
    const along = ex > ey ? y : x;
    return {
      h: KERB_H * s * s + KERB_RIDGE * s * Math.sin((along / KERB_RIDGE_L) * Math.PI * 2),
      surface: SURFACES.kerb,
    };
  }

  // --- the grass verge: your one chance to gather it up
  if (e <= VERGE_W) {
    return { h: roughAt(x, y, SURFACES.grass.rough), surface: SURFACES.grass };
  }

  // --- the gravel trap, graded deeper toward the fence
  const deep = Math.min(1, (e - VERGE_W) / (RUNOFF_W - VERGE_W));
  const band = Math.min(TRAP_STEPS - 1, Math.floor(deep * TRAP_STEPS));
  return { h: roughAt(x, y, RUNOFF_ROUGH), surface: SURFACE_TRAP[band] };
}

export function carWheels(car) {
  const s = car.spec;
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const hw = (s.trackWidth || 1.5) / 2;
  const fx = car.x + c * s.lf, fy = car.y + sn * s.lf;
  const rx = car.x - c * s.lr, ry = car.y - sn * s.lr;
  return [
    { x: fx - sn * hw, y: fy + c * hw }, // FL
    { x: fx + sn * hw, y: fy - c * hw }, // FR
    { x: rx - sn * hw, y: ry + c * hw }, // RL
    { x: rx + sn * hw, y: ry - c * hw }, // RR
  ];
}

// A HOT tyre (above HOT_TYRE) over snow or water counts its pass TWICE with HOT_EXTRA_CHANCE — it melts and
// dries faster. On ice the slip it scrubs with is multiplied by heatScrub (see stepWear).
const HOT_TYRE = 80, HOT_EXTRA_CHANCE = 0.5;
function recordWearPoint(x, y, simTime, tyreT = 0) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return;
  if (simTime - cell.lastSeenTime > 0.35) {
    passCell(cell, tyreT);
    // a hot tyre packs / melts SNOW faster (water now dries by temperature inside passCell)
    if (tyreT > HOT_TYRE && cell.cover === 'snow' && Math.random() < HOT_EXTRA_CHANCE) passCell(cell, tyreT);
  }
  cell.lastSeenTime = simTime;
}

// carWheels() order is FL, FR, RL, RR with L = +lateral; vehicle.js indexes tyres the same way (0..3).
const TYRE_OF_WHEEL = [0, 1, 2, 3];
export function stepWear(car, dt) {
  wearClock += dt;
  if (Math.hypot(car.vx, car.vy) < 0.6) return;
  const curr = carWheels(car);
  if (!car.prevWheels) car.prevWheels = curr;
  const t = car.t;
  // A JUMP is not a tyre path (MEASURED BUG, 2026-10-06, "dirt in the road"; tools/_dirtroad.mjs): highway traffic out of view is moved
  // KINEMATICALLY (traffic.js, no applyGround), so prevWheels went stale and the first physical step after it woke swept one straight
  // line of wear from where it fell asleep, often across the carriageway. Same for any teleport. 3 m in one step = 360 m/s at 120 Hz.
  if (Math.hypot(curr[0].x - car.prevWheels[0].x, curr[0].y - car.prevWheels[0].y) > 3) { car.prevWheels = curr; return; }
  for (let i = 0; i < 4; i++) {
    const p0 = car.prevWheels[i];
    const p1 = curr[i];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    // Interpolate continuously along each tyre's swept path: zero gaps even at high speed
    const steps = Math.max(1, Math.ceil(dist / (WEAR_CELL * 0.45)));
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      recordWearPoint(p0.x + dx * k, p0.y + dy * k, wearClock, car.tyreT ? car.tyreT[TYRE_OF_WHEEL[i]] : 0);
    }
    // ICE SCRUB: only a wheel that is actually sliding or locked wears ice (front axle = wheels 0,1)
    const slip = i < 2 ? t.slipSpeedF : t.slipSpeedR;
    if (slip > ICE_SCRUB_MIN) {
      const cell = getCell(Math.floor(p1.x / WEAR_CELL), Math.floor(p1.y / WEAR_CELL));
      // hot rubber melts ice faster: x1 at 60 C, x2 at 90 C, x3 at 120 C
      // x1 at 60 C rising to x1.67 at 120 C (was x3: user, "hot tyres melt ice too easily")
      const heatScrub = car.tyreT ? 1 + Math.min(1, Math.max(0, (car.tyreT[TYRE_OF_WHEEL[i]] - 60) / 90)) : 1;
      if (cell) scrubCell(cell, slip * dt * heatScrub);
    }
  }
  car.prevWheels = curr;
}

// Put the ground under the car. Lives HERE, not in main.js, so the game and every harness run the
// identical code — MEASURED BUG, 2026-09-28: tools/kerbcheck.mjs had its own copy, the field names
// changed under it, and it cheerfully reported load 1.00 at every speed from 3 to 42 m/s. Identical
// outcomes across different inputs is CLAUDE.md rule 1, and it was my own instrument lying again.
//
// Sampled AT EACH AXLE, not at the centre. A 2.6 m wheelbase over a 3.5 m kerb means the front is
// cresting while the rear is still climbing, and that phase difference is the whole character of riding
// a kerb — one end light while the other still grips. One sample point would average it away.
// LOCAL LOOKUP HINT (2026-10-04, AI stage 1: applyGround made 34 track lookups per car per physics step — slope, bump steer, camber,
// kerbs — each a fresh grid search; with 6 cars that was a third of the frame). The car is looked up ONCE; the samples around it search
// only the 21 segments either side of its nearest one, and that answer is used only when the point is ON the road (within half width +
// 3 m) — then no other part of the lap can be nearer (legs are >= 33 m apart on every level). Anything else gets the full search.
export let qsHintSub = null, qsHint = -1;
export function applyGround(car, dt) {
  const st0 = LEVEL.subtrack;
  if (st0) { const q0 = querySubtrack(st0, car.x, car.y); qsHintSub = q0.seg != null ? st0 : null; qsHint = q0.seg ?? -1; }
  try { applyGroundInner(car, dt); } finally { qsHintSub = null; qsHint = -1; }
}
function applyGroundInner(car, dt) {
  const s = car.spec;
  const c = Math.cos(car.heading), sn = Math.sin(car.heading);
  const fx = car.x + c * s.lf, fy = car.y + sn * s.lf;
  const rx = car.x - c * s.lr, ry = car.y - sn * s.lr;
  const gF = groundAt(fx, fy);
  const gR = groundAt(rx, ry);
  // The true discrete derivative, so driving ALONG a ridged kerb shakes the car for exactly the same
  // reason crossing one does. There is no separate "rumble" code anywhere, and there should not be.
  // FIRST STEP AFTER A RESET (user, 2026-10-04: "resetting on terrain causes the car to get stuck when pulling away"). reset() zeroes the
  // ground + suspension heights, so on a hill the first derivative read the whole hill as one step: MEASURED a reset 7.5 m up Sweaty
  // Lamb launched the car 106 m into the air (Slidden Hill 67 m; Castle Cum's 1.1 m crest 1.1 s of air). Now the first step after a reset
  // puts the ground AND the body at the local height with no vertical speed.
  if (!car.groundInit) { car.groundF = gF.h; car.groundR = gR.h; car.zF = gF.h; car.zR = gR.h; car.zvF = 0; car.zvR = 0; car.groundInit = true; }
  car.groundVF = (gF.h - car.groundF) / dt; car.groundF = gF.h;
  car.groundVR = (gR.h - car.groundR) / dt; car.groundR = gR.h;
  car.surface = gR.surface;      // grip is still one number for the car; per-axle grip is a later job

  // Corner banking physics (PLAN.md §3): on banked turns (e.g. Naffcar), the slope hauls the car inward
  // SLOPE FORCE (step 3, 2026-10-03; user: "vector dips ... push in all 8 directions, out and in"). Gravity along the
  // smooth terrain: F = -m g grad(h), world frame -> body frame. Bumps push OUT, dips and banking pull IN/DOWN. Only on
  // the ground (an airborne car falls straight). Replaces the old bank FORCE, which pushed 0.3 g to the car's left
  // anywhere past |x| 130 — grass included (fixed earlier today); banking is now real height (bankHeightAt).
  car.bankLatForce = 0; car.bankLoadFactor = 1.0;
  if (car.air > 0) { car.slopeLong = 0; car.slopeLat = 0; car.slopeYaw = 0; }
  else {
    // PER AXLE, under each wheel (ruts: sampled at the centre the car sits on the ridge between two grooves and is pushed
    // sideways; at the wheels each side is pulled back into its own groove). Each axle carries its static share of the
    // weight, and the two axles' sideways pushes act at the axles — so an off-centre whoop or dip under the FRONT wheels
    // tugs the nose toward the dip / away from the hump (user, 2026-10-03: "dips and whoops should gently affect steering").
    const hw2 = (s.trackWidth || 1.5) / 2, ps = -sn, pc = c, L2 = s.lf + s.lr;
    const mg = s.mass * car.mods.mass * 9.81;
    let Flong = 0, Flat = 0, Mz = 0;
    for (const [ax, share, arm] of [[s.lf, s.lr / L2, s.lf], [-s.lr, s.lf / L2, -s.lr]]) {
      let gx = 0, gy = 0;
      for (const sd of [1, -1]) { const q = slopeAt(car.x + c * ax + ps * hw2 * sd, car.y + sn * ax + pc * hw2 * sd); gx += q.gx / 2; gy += q.gy / 2; }
      const gmag = Math.hypot(gx, gy), k = gmag > 1 ? 1 / gmag : 1;          // cap at 45 deg
      const Fwx = -mg * share * gx * k, Fwy = -mg * share * gy * k;
      const fl = Fwx * c + Fwy * sn, ft = -Fwx * sn + Fwy * c;
      Flong += fl; Flat += ft; Mz += arm * ft;                                // lateral push x lever arm = yaw
    }
    // BUMP STEER: the front wheel that drops (into a dip, or off the far side of a whoop) tugs the nose toward its side —
    // the tramlining a real car's steering does. +y is the car's right, and a right turn is positive yaw, so a LOWER right
    // wheel (hL > hR) adds positive yaw. Strength BUMP_STEER x front weight x height difference (m).
    // banking excluded: a steady cross-slope is not a bump, and the slope push already slides you down it
    const hAt = (x, y) => heightAt(x, y) - bankHeightAt(x, y);
    const hR = hAt(car.x + c * s.lf + ps * hw2, car.y + sn * s.lf + pc * hw2);
    const hL = hAt(car.x + c * s.lf - ps * hw2, car.y + sn * s.lf - pc * hw2);
    // BUMPS ONLY, never an even slope (user, 2026-10-03: "I think the bowl on the lab is broken"): on the bowl wall the
    // left / right difference was PERMANENT and dragged the nose toward the middle the whole way round. Subtract what a
    // flat plane with the local slope would give, so a steady cross-slope (bowl, hill, banking) reads zero.
    const gF = slopeAt(car.x + c * s.lf, car.y + sn * s.lf);
    const plane = -2 * hw2 * (gF.gx * ps + gF.gy * pc);                   // hL - hR on a flat tilted plane
    Mz += BUMP_STEER.k * mg * (s.lr / L2) * Math.max(-0.4, Math.min(0.4, (hL - hR) - plane));
    car.slopeLong = Flong; car.slopeLat = Flat; car.slopeYaw = Mz;
  }

  // Dynamic surface wear: continuous swept tyre paths for all 4 wheels
  stepWear(car, dt);
}

// The fence is the one hard constraint out here, because a barrier IS one.
// PREVENTS WEDGING: bounds against car corners rather than center point, prevents body
// from penetrating the fence, zeroes penetrating velocity with elastic rebound, and damps snagging yaw.
export function fenceClamp(car) {
  const s = car.spec;
  const reach = Math.max(s.wid, s.len) * 0.48;
  // per side (S-B: the floor is a rectangle): the fence is RUNOFF_W past each floor edge
  for (const k of ['x', 'y']) {
    const lo = (k === 'x' ? FX0 : FY0) - RUNOFF_W + reach, hi = (k === 'x' ? FX1 : FY1) + RUNOFF_W - reach;
    if (car[k] > hi || car[k] < lo) {
      const sgn = car[k] > hi ? 1 : -1;
      car[k] = sgn > 0 ? hi : lo;
      const v = k === 'x' ? 'vx' : 'vy';
      if (car[v] * sgn > 0) {
        car[v] = -car[v] * 0.35;
        car.yawRate *= 0.65;     // kill corner pivot snagging
      }
    }
  }
}

// Solid impactable obstacle collision (grandstands, pit divider walls, marshal towers)
export function obstacleClamp(car) {
  if (!LEVEL.obstacles || !LEVEL.obstacles.length) return;
  const s = car.spec;
  const reachX = s.len * 0.45, reachY = s.wid * 0.45;

  for (let i = 0; i < LEVEL.obstacles.length; i++) {
    const ob = LEVEL.obstacles[i];
    const halfW = ob.w / 2, halfH = ob.h / 2;
    const minX = ob.x - halfW - reachX;
    const maxX = ob.x + halfW + reachX;
    const minY = ob.y - halfH - reachY;
    const maxY = ob.y + halfH + reachY;

    if (car.x > minX && car.x < maxX && car.y > minY && car.y < maxY) {
      const penLeft = car.x - minX;
      const penRight = maxX - car.x;
      const penTop = car.y - minY;
      const penBottom = maxY - car.y;
      const minPen = Math.min(penLeft, penRight, penTop, penBottom);

      if (minPen === penLeft) {
        car.x = minX;
        if (car.vx > 0) car.vx = -car.vx * 0.35;
      } else if (minPen === penRight) {
        car.x = maxX;
        if (car.vx < 0) car.vx = -car.vx * 0.35;
      } else if (minPen === penTop) {
        car.y = minY;
        if (car.vy > 0) car.vy = -car.vy * 0.35;
      } else {
        car.y = maxY;
        if (car.vy < 0) car.vy = -car.vy * 0.35;
      }
      car.yawRate *= 0.50;
      const sp = Math.hypot(car.vx, car.vy);
      car.shake = Math.min(1.0, (car.shake || 0) + sp * 0.12);
    }
  }
}

export function resetPATCH_GRID() { PATCH_GRID = new Map(); }
