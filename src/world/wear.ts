// wear.js - the SURFACE DEGRADATION & WEAR MAP section.
import { LEVEL } from "./state.ts";
import type { SurfaceId } from "./surfaces.ts";
import { SURFACES, VERGE_W, TRAP_STEPS, SURFACE_TRAP } from "./surfaces.ts";
import { dampSurface, puddleSurface, cellDamp, dryCellLine, surfaceById, wornTo } from "./wet.ts";
import { WEATHER } from "./weather.ts";
import { carWheels } from "./wheels.ts";
import { staticCoverHere } from "./coverlookup.ts";
import { fieldLayers } from "./coverfield.ts";
import { puddleClearBy, setPassTyre } from "./puddles.ts";
import {
  packedSnowWears, passIceCell, passPackedSnowCell, passWinterSnow,
} from "./snowwear.ts";
import {
  FX1, FX0, FY1, FY0, KERB_W, KERB_H, KERB_RIDGE, KERB_RIDGE_L, RUNOFF_W, RUNOFF_ROUGH,
} from "./bounds.ts";
import { zoneAt } from "./zones.ts";
import {
  churnedTo, dampWornTo, digPace, digRuleOf, digsDry, wearHolds,
} from "./dig.ts";
import { bumpAt, slopeAt, heightAt, bankHeightAt, BUMP_STEER } from "./terrain.ts";
import { querySubtrack } from "./tyrewall.ts";
import type {
  CarBody, CoverId, Ground, Layers, Obstacle, Patch, Subtrack, Surface, WearCell,
} from "./types.ts";

// =============================================================================================
// SURFACE DEGRADATION & WEAR MAP — LAYERED, rebuilt (requirement: snow should compress to ice after
// several passes; ice should wear away with heavy braking or sliding and show the surface
// underneath; if the surface under is grass it should behave like grass and turn to mud once
// exposed and then driven over... mud turns to thick mud... puddles on any surface, ice and snow on
// any surface).
//
// A wear CELL (WEAR_CELL m square) holds two layers:
// base — the ground itself. Wears down a chain by PASSES (a wheel crossing the cell, debounced):
//            long grass -> short grass -> dirt -> mud -> thick mud. Counts in BASE_WEAR below.
// cover — something lying ON the base: 'snow', 'ice' or 'wet' (a puddle). While a cover is there
// the
//            base cannot wear — the tyre never touches it.
//              snow  compresses to ice after SNOW_TO_ICE passes.
// ice is SCRUBBED away only by a wheel that is sliding or locked over it (slip speed above
// ICE_SCRUB_MIN, metres of slip accumulated past ICE_SCRUB). Rolling over it does nothing.
//                    When it goes, the base is exposed and wears by its own rules from then on.
// wet WATER DRIES BY TYRE HEAT (requirement: puddles should only go when hot tyres or weather
// evaporate them — dry lines can still form with many passes of cold tyres but happen quicker with
// warmer tyres). Each pass adds dryness by tyre temperature (dryAmount):
// STANDING water (level puddles, meltwater): cold tyres add NOTHING; hot tyres evaporate it. DAMP
// ground (a wet zone / sector, wet tarmac): cold tyres dry a line slowly, warm ones fast.
//                    When dry it MIXES with what it lay on
// (WATER_MIX): grass / dirt -> mud, sand -> gravel, gravel -> mud; tarmac just dries. (user,
// "puddles should vanish or mix with surfaces like grass or dirt to create mud ... sand
// and water should mix to create gravel ... gravel and water make mud") Covers come from the level
// (LEVEL.covers, any shape over any surface) or from a zone whose own surface is snow/ice — those
// are treated as a cover over zone.under (default tarmac: coverfield.ts UNDER_DEFAULT), so a
// lab ice panel scrubs through to tarmac and the same rules apply everywhere.
//
// ONE rule table. MEASURED BUG fixed here: the old code had the chain written TWICE with different
// numbers (recordWearAt said long grass -> mud in 8 passes, the game's recordWearPoint said 6), and
// the only test exercised the copy the game never used (CLAUDE.md rule 18).
export const WEAR_CELL = 1.5;
export const wearMap = new Map<number, WearCell>();

// the wear map key of cell (i, j): a number, not an "i,j" string - the wheels and the ground
// heights look cells up thousands of times a frame and every string key was garbage (allocation
// profile, highway). Exact for |i|, |j| < 2^20 cells (+-1500 km at WEAR_CELL 1.5 m).
const WEAR_KEY_OFFSET = 1 << 20, WEAR_KEY_SPAN = 1 << 21;
export const wearKey = (cellI: number, cellJ: number) =>
  (cellI + WEAR_KEY_OFFSET) * WEAR_KEY_SPAN + (cellJ + WEAR_KEY_OFFSET);
// Cells whose surface CHANGED since the renderer last looked. The renderer bakes wear into its
// cached ground tiles and uses this to know which tiles to repaint (render.ts drawGround). Drained
// by it.
export const wearDirty: WearCell[] = [];
// base -> [what it becomes, passes it takes]. Cumulative from long grass: 2, 4, 6, 9.
const BASE_WEAR: Record<string, [string, number]> = {
  grassLong: ['grassShort', 2],
  grass: ['dirt', 2],
  grassShort: ['dirt', 2],
  dirt: ['mud', 2],
  mud: ['thickMud', 3],
};
export const SNOW_TO_ICE = 4;      // passes to pack snow into ice
// dampness from which wet ground wears faster, wet snow melts and wet ice scrubs in half the slip
const WET_WEAR_FROM = 0.5;
// dryness a pass adds, by tyre temperature tyreTemp. Measured in tools/wearcheck.mjs:
//   damp:     0.06 + 0.30 x heat(40..100 C)  -> cold ~17 passes, 100 C ~3 passes
//   standing: 0.35 x heat(60..120 C)          -> cold never, 90 C ~6 passes, 120 C ~3 passes
// (Before this: a puddle went in 1-3 passes of ANY tyre — PUDDLE_CHURN_CHANCE — which the user
// found far too easy.)
export function dryAmount(standing: boolean, tyreTemp: number): number {
  if (standing) return 0.35 * Math.max(0, Math.min(1, (tyreTemp - 60) / 60));
  return 0.06 + 0.30 * Math.max(0, Math.min(1, (tyreTemp - 40) / 60));
}
// (history) the rule before (requirement: a happy medium — a % chance so it takes 1-3 passes): a
// 40% chance per pass of ANY tyre, so 1-3 passes. Replaced by dryAmount above.
export const SNOW_MELT_CHANCE = 0.5;   // packed snow melts to water (else freezes to ice), per cell
// per pass, standing water over a WATER_MIX base -> 1-3 passes
export const WATER_CHURN_CHANCE = 0.4;
// what a churned puddle leaves behind, by the base it lay on
const WATER_MIX: Record<string, string> = {
  grass: 'mud', grassShort: 'mud', grassLong: 'mud', dirt: 'mud', mud: 'thickMud',
  sand: 'gravel', gravel: 'mud',
};
// 7.0, was 2.0. User: "ice should take a couple of passes before it melts unless tyres
// are very hot". MEASURED at 2.0: ONE locked-brake pass scrubbed 32 cells through. A locked pass
// puts ~3 m of slip into a cell (two wheels in line, ~1.5 m each), so 7 m takes 2-3 hard passes.
// Hot tyres melting it faster waits for the tyre-temperature model (TODO, tier 3) — it should scale
// THIS number down, nothing else.
export const ICE_SCRUB = 7.0;      // m of tyre slip over a cell to scrub its ice through
export const ICE_SCRUB_MIN = 2.0;  // m/s of slip below which a wheel is rolling, not scrubbing
export const COVER_IDS: Record<CoverId, number> & Record<string, number> = { snow: 1, ice: 1,
  wet: 1 };

// ONE wear clock for the world (sim seconds), not per car. MEASURED BUG,
// (tools/wearcheck.mjs): the pass debounce used car.simTime, which starts at 0 for every new car —
// so after switching car, every cell the old car had driven over stopped counting passes until the
// new car's clock caught up.
let wearClock = 0;
export let wearEpoch = 0;
export function clearWear(): void {
  wearMap.clear();
  wearClock = 0;
  wearDirty.length = 0;
  wearEpoch++;          // tells the renderer every baked tile is out of date

}

// PRUNE THE WEAR on a streamed level (highway.js stepHighway, after each rebuild). MEASURED BUG
// (requirement: occasionally leaves patches of dirt on highway levels... after longer drives / with
// ai on; tools/_wearleak.mjs): wear cells live at WORLD positions and were never dropped - so when
// the endless road was rebuilt and new ground (a field, a bridge approach, the road
// swinging back) came down over a worn cell, that cell still drove AND drew as the old dirt / mud.
// Spun AI chew the verge, so it showed most with AI. The map also grew for the whole drive, and
// every ground-tile repaint walks it. Drop a cell if it is farther than `far` m from (x, y) or the
// ground under it is not what it was worn FROM; its tiles are repainted (wearDirty).
export function pruneWear(x: number, y: number, far: number): number {
  let dropped = 0;
  for (const [key, cell] of wearMap) {
    const cellX = (cell.cx + 0.5) * WEAR_CELL, cellY = (cell.cy + 0.5) * WEAR_CELL;
    let drop = (cellX - x) ** 2 + (cellY - y) ** 2 > far * far;
    if (!drop) { const layers = layersAt(cellX,
      cellY); drop = (layers.cover || layers.base) !== cell.orig; }
    if (drop) {
      wearMap.delete(key);
      dropped++;
      if (cell.current !== cell.orig) {
        cell.current = cell.orig;
        wearDirty.push(cell);
      }
    }
  }
  return dropped;
}
// tools/_wearleak.mjs: the ground with no wear
export const cleanAt = (x: number, y: number): string => { const layers = layersAt(x,
  y); return layers.cover || layers.base; };

// The STATIC layers at a point, before any wear: { base, cover } as surface ids. LEVEL.patches: [{
// x, y, w, h, rot, surface }] — small ellipses of a different BASE laid on the ground (the Grass
// Track's random spots). Checked after the zone, so a patch on the road changes the road. Looked up
// through PATCH_GRID (built per level in prepareLevel), so thousands of blend patches cost the
// physics a handful of comparisons per query instead of a scan of the whole list.
export const PATCH_CELL = 6;
export let PATCH_GRID = new Map<number, Patch[]>();
// each patch's place in LEVEL.allPatches: the draw order when the painter reads PATCH_GRID
export let PATCH_ORDER = new Map<Patch, number>();
export const patchKey = (gridX: number, gridY: number): number => gridX * 65536 + gridY;
// read-only, for tools/blendcheck.mjs
export const zoneSurfaceAt = (x: number, y: number): Surface => zoneAt(x, y);
/**
 * The ground surface at a point before any cover or wear: the zone / ribbon / base, or a patch
 * over it (kerbs are their own surface; patches never cover them).
 * @param x world x, m
 * @param y world y, m
 * @returns the surface
 */
export function groundSurfaceAt(x: number, y: number): Surface {
  const zoneSurface = zoneAt(x, y);
  return zoneSurface.id === 'kerb' ? zoneSurface : (patchAt(x, y) || zoneSurface);
}
function patchAt(x: number, y: number): Surface | null {
  if (!PATCH_GRID.size) return null;
  const list = PATCH_GRID.get(patchKey(Math.floor(x / PATCH_CELL), Math.floor(y / PATCH_CELL)));
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const patch = list[i];
    let dx = x - patch.x, dy = y - patch.y;
    if (patch.sq) {
      if (Math.abs(dx) <= patch.w / 2 && Math.abs(dy) <= patch.h / 2) return patch.surface;
      continue;
    }
    if (dx * dx + dy * dy > patch.w * patch.w) continue;
    const cosRot = Math.cos(patch.rot || 0), sinRot = Math.sin(patch.rot || 0),
      localU = dx * cosRot + dy * sinRot, localV = -dx * sinRot + dy * cosRot;
    if ((localU * localU) / ((patch.w / 2) ** 2) + (localV * localV) / ((patch.h / 2) ** 2) <= 1)
      return patch.surface;
  }
  return null;
}
export function layersAt(x: number, y: number): Layers {
  // `standing`: the water here is a PUDDLE (LEVEL.covers), not a damp wet zone — they dry
  // differently
  const z = groundSurfaceAt(x, y);
  // the cover field: the level's own snow / ice / water are areas of it (coverfield.ts)
  return fieldLayers(z, z === LEVEL.base, staticCoverHere(x, y), x, y);
}
// LEVEL.covers: [{ x, y, w, h, cover: 'snow'|'ice'|'wet', shape: 'rect'|'ellipse', rot }] share of
// tyre-slip heat that reaches the TYRE on loose ground (vehicle.js TYRE_HEAT). User: "off-road
// surfaces shouldn't get them up much". MEASURED: gravel drift 260 C in 14 s before -> 25 C at 30 s
// at 0.15.
export const HEAT_OFFROAD = 0.15;
export { COVER_SQ, coverAt, coverCut } from "./coverlookup.ts";
// What a tyre feels for a base + cover. snow / ice replace the base outright (the tyre is on them).
// A PUDDLE (standing water) does not - water on grass is not wet tarmac - it is the base under
// water (wet.ts puddleSurface); a damp wet zone, and any ground in the rain, is the base DAMP
// (wet.ts dampSurface). Cached surface objects, so physics gets a plain surface.
export function surfaceOf(base: string, cover: string | null, standing = true, damp = 0): Surface {
  if (!cover) return dampSurface(surfaceById(base), damp);
  if (cover !== 'wet') return dampSurface(SURFACES[cover as SurfaceId], damp);
  return standing ? puddleSurface(surfaceById(base)) : dampSurface(surfaceById(base), 1);
}

function getCell(cellX: number, cellY: number): WearCell | null {
  const key = wearKey(cellX, cellY);
  let cell = wearMap.get(key);
  if (!cell) {
    const layers = layersAt((cellX + 0.5) * WEAR_CELL, (cellY + 0.5) * WEAR_CELL);
    // nothing in this cell can ever change: do not create it (keeps the map to cells that matter)
    if (!layers.cover && !BASE_WEAR[layers.base] && !packedSnowWears(layers.base)
      && WEATHER.wetness === 0 && !digsDry(layers.base)) return null;
    cell = { cx: cellX, cy: cellY, base: layers.base, cover: layers.cover,
      orig: layers.cover || layers.base, passes: 0, scrub: 0, dry: 0, standing: layers.standing,
      lastSeenTime: -100, fixed: layers.fixed, laid: layers.fixed ? null : layers.cover,
      area: layers.area };
    // the field's cover is not the cell's own ground: the tiles show the ground under it
    if (!layers.fixed) cell.orig = layers.base;
    cell.current = cell.orig;
    wearMap.set(key, cell);
  }
  return cell;
}
/**
 * One pass over a SNOW cell: after SNOW_TO_ICE passes it becomes ice or meltwater.
 * @param cell the wear cell (changed in place)
 */
function passSnowCell(cell: WearCell, damp: number): void {
  // MELT OR FREEZE (requirement: snow should have a chance to melt or turn to ice when driven over
  // — it should still take multiple passes). After SNOW_TO_ICE passes it becomes ICE or MELTWATER,
  // by chance.
  if (++cell.passes >= SNOW_TO_ICE) {
    // wet snow (rain on it) turns to slush / water, never packs to ice
    cell.cover = damp >= WET_WEAR_FROM || Math.random() < SNOW_MELT_CHANCE ? 'wet' : 'ice';
    cell.passes = 0;
    cell.standing = true;
    cell.dry = 0;
  }
}
/**
 * One pass over a puddle (WET cover) cell: it churns into the base or dries.
 * @param cell the wear cell (changed in place)
 * @param tyreTemp the tyre temperature (C), for the evaporation rule
 */
function passWetCell(cell: WearCell, tyreTemp: number): void {
  // CHURN vs EVAPORATE (requirement: water on dirt... should become mud when driven over).
  // MEASURED BUG: a puddle on dirt only mixed after it had DRIED, and standing water only dries
  // above 60 C, so on dirt it stayed a puddle forever. Tyres churning water INTO soft ground is
  // not evaporation: on any base with a WATER_MIX rule, every pass of ANY tyre has
  // WATER_CHURN_CHANCE to churn it (1-3 passes, the user's earlier "happy medium"). Hard ground
  // (tarmac) has nothing to churn into, so it keeps the heat / weather rule. capped: the 3rd pass
  // always churns (pure 40% measured a worst case of 9-12 passes over 200 puddles)
  if (cell.standing && WATER_MIX[cell.base]
    && (++cell.passes >= 3 || Math.random() < WATER_CHURN_CHANCE)) cell.dry = 1;
  else cell.dry += puddleClearBy(cell.standing) ?? dryAmount(cell.standing, tyreTemp);
  if (cell.dry >= 1) {
    cell.cover = null;
    cell.base = churnedTo(cell.base) || WATER_MIX[cell.base] || cell.base;
    cell.passes = 0;
    cell.dry = 0;
  }
}
/**
 * One pass over a bare cell: the base wears down its chain and the ruts deepen.
 * @param cell the wear cell (changed in place)
 */
function passBareCell(cell: WearCell, damp: number): void {
  const rule = BASE_WEAR[cell.base];
  // wet ground wears a pass sooner (owner's table: grass / dirt 2 -> 1, mud 3 -> 2)
  const need = rule ? rule[1] - (damp >= WET_WEAR_FROM ? 1 : 0) : 0;
  if (rule && ++cell.passes >= need) {
    if (!wearHolds(cell.base, damp >= WET_WEAR_FROM)) cell.base = wornTo(cell.base, rule[0]);
    cell.passes = 0;
  } else if (!rule) cell.base = dampWornTo(cell.base, damp >= WET_WEAR_FROM) || cell.base;
  digRut(cell, damp);
}
/**
 * RUTS THAT DEEPEN (step 3; user: the "vector dips" - "mud turns to thick mud / vector dips;
 * sand and gravel also have the chance to create vector dips"). A pass digs the cell down by
 * its rule's step (dig.ts) to its floor, at the pace for its dampness. It is
 * real height: the suspension feels it and gravity on its sides pulls wheels into the groove.
 * @param cell the wear cell (changed in place)
 * @param damp how damp the cell is, 0..1
 */
function digRut(cell: WearCell, damp: number): void {
  const rutRule = digRuleOf(cell.base);
  if (!rutRule || Math.random() >= rutRule.chance) return;
  const was = cell.rut || 0;
  cell.rut = Math.min(rutRule.max, was + rutRule.step * digPace(cell.base, damp >= WET_WEAR_FROM));
  // repaint the shading only when the depth crosses a 2 cm band (a repaint per pass would
  // thrash the tile cache)
  if (Math.floor(cell.rut / 0.02) !== Math.floor(was / 0.02)) wearDirty.push(cell);
}
// Apply one PASS to a cell (debounced by the caller).
function passCell(cell: WearCell, tyreTemp = 18): void {
  const damp = cellDamp(cell, wearClock);
  const wet = damp >= WET_WEAR_FROM;
  if (cell.cover === 'snow') {
    if (!passWinterSnow(cell, wet, SNOW_TO_ICE)) passSnowCell(cell, damp);
  } else if (cell.cover === 'wet') passWetCell(cell, tyreTemp);
  else if (packedSnowWears(cell.cover || cell.base)) passPackedSnowCell(cell, wet);
  else if (cell.cover === 'ice') passIceCell(cell, wet);
  else if (!cell.cover) passBareCell(cell, damp);
  // the tyre dries its line in the rain (as it dries a wet zone: dryAmount, damp ground)
  if (cell.cover !== 'wet') dryCellLine(cell, wearClock, dryAmount(false, tyreTemp));
  const now = cell.cover || cell.base;
  if (now !== cell.current) { cell.current = now; wearDirty.push(cell); }
}
// Slip scrubbing a cell's ice (metres of slip this step).
function scrubCell(cell: WearCell, slipM: number): void {
  if (cell.cover !== 'ice') return;
  cell.scrub += cellDamp(cell, wearClock) >= WET_WEAR_FROM ? slipM * 2 : slipM;
  // scrubbed ice leaves MELTWATER, not bare ground (requirement: after snow / ice water should be
  // left) — a puddle that then churns into its base by the WATER_MIX rules, so ice over grass ends
  // as mud.
  if (cell.scrub >= ICE_SCRUB) {
    cell.cover = 'wet';
    cell.standing = true;
    cell.dry = 0;
    cell.scrub = 0;
    cell.passes = 0;
    cell.current = 'wet';
    wearDirty.push(cell);
  }
}

// Kept for tools/phase1check.mjs: one pass at a point, debounced in ms. Same rules as the game.
export function recordWearAt(
  x: number, y: number, _baseIdUnused: unknown,
  timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()), tyreT = 18,
): string | null | undefined {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return null;
  if (timeMs / 1000 - cell.lastSeenTime > 0.35) passCell(cell, tyreT);
  cell.lastSeenTime = timeMs / 1000;
  return cell.current;
}

// Rut depth at a point, BILINEAR between cell centres so the groove has smooth sides (a step would
// be an infinite slope).
/**
 * The rut depth of one wear cell (0 when it is not worn).
 * @param cellI the cell column
 * @param cellJ the cell row
 * @returns the depth, m
 */
function depthAt(cellI: number, cellJ: number): number {
  const neighbour = wearMap.get(wearKey(cellI, cellJ));
  return neighbour && neighbour.rut ? neighbour.rut : 0;
}
export function rutAt(x: number, y: number): number {
  if (wearMap.size === 0) return 0;
  const gridX = x / WEAR_CELL - 0.5, gridY = y / WEAR_CELL - 0.5;
  const i = Math.floor(gridX), j = Math.floor(gridY), fracX = gridX - i, fracY = gridY - j;
  const d00 = depthAt(i, j), d10 = depthAt(i + 1, j), d01 = depthAt(i, j + 1), d11 = depthAt(i + 1,
    j + 1);
  if (!(d00 || d10 || d01 || d11)) return 0;
  return (d00 * (1 - fracX) + d10 * fracX) * (1 - fracY)
    + (d01 * (1 - fracX) + d11 * fracX) * fracY;
}

export function getWornSurface(x: number, y: number): Surface | null {
  if (wearMap.size === 0) return null;
  const cell = wearMap.get(wearKey(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL)));
  return cell ? surfaceOf(cell.base, cell.cover, cell.standing, cellDamp(cell, wearClock)) : null;
}

// Height noise for a surface, from its own `rough`. Two incommensurate frequencies so it does not
// read as a sine wave, and long enough wavelengths to survive a 120 Hz sim at 45 m/s without
// aliasing.
function roughAt(x: number, y: number, rough: number): number {
  if (!rough) return 0;
  return rough * (Math.sin(x * 0.9) * Math.sin(y * 1.2) + 0.6 * Math.sin(x * 2.1 + y * 1.7));
}

// THE GROUND under a point: its height in metres and what it grips like. Everything about the
// world's surface is this one function; main.js reads it and vehicle.js integrates over it.
export function groundAt(x: number, y: number): Ground {
  // e = metres past the floor edge (negative inside); on the square it is max(|x|, |y|) - FLOOR, as
  // before (S-B: any rectangle)
  const overX = Math.max(x - FX1, FX0 - x), overY = Math.max(y - FY1, FY0 - y),
    over = overX > overY ? overX : overY;

  // --- on the floor: whatever zone you are standing in, plus any bumps laid on top of it
  if (over <= -KERB_W) {
    const worn = getWornSurface(x, y);
    let surface = worn;
    if (!surface) {
      const layers = layersAt(x, y);
      surface = surfaceOf(layers.base, layers.cover, layers.standing, WEATHER.wetness);
    }
    return { h: roughAt(x, y, surface.rough) + bumpAt(x, y), surface: surface };
  }

  // --- THE KERB. A HUMP, not a step: zero at the inner lip, KERB_H at the crest, back to zero at
  // the outer edge. sin^2 so both ends are smooth — a discontinuity here is an infinite ground
  // velocity, and the suspension would answer with an infinite load.
  if (over <= 0) {
    const depth = (over + KERB_W) / KERB_W;
    const hump = Math.sin(Math.PI * depth);
    // ridges run ALONG the edge, so their phase comes from whichever axis is not the dominant one
    const along = overX > overY ? y : x;
    return {
      h: KERB_H * hump * hump + KERB_RIDGE * hump * Math.sin((along / KERB_RIDGE_L) * Math.PI * 2),
      surface: dampSurface(SURFACES.kerb, WEATHER.wetness),
    };
  }

  // --- the grass verge: your one chance to gather it up
  if (over <= VERGE_W) {
    return { h: roughAt(x, y, SURFACES.grass.rough),
      surface: dampSurface(SURFACES.grass, WEATHER.wetness) };
  }

  // --- the gravel trap, graded deeper toward the fence
  const deep = Math.min(1, (over - VERGE_W) / (RUNOFF_W - VERGE_W));
  const band = Math.min(TRAP_STEPS - 1, Math.floor(deep * TRAP_STEPS));
  return { h: roughAt(x, y, RUNOFF_ROUGH),
    surface: dampSurface(SURFACE_TRAP[band], WEATHER.wetness) };
}

// A HOT tyre (above HOT_TYRE) over snow or water counts its pass TWICE with HOT_EXTRA_CHANCE — it
// melts and dries faster. On ice the slip it scrubs with is multiplied by heatScrub (see stepWear).
const HOT_TYRE = 80, HOT_EXTRA_CHANCE = 0.5;
// m/s of slip from which a wheel is SLIDING, not driving (?slidewear=1: its passes count twice)
const SLIDE_WEAR_MIN = 4;
let slideWear = false;
export function setSlideWear(enabled: boolean): void { slideWear = enabled; }
function recordWearPoint(x: number, y: number, simTime: number, tyreT = 0, sliding = false): void {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL));
  if (!cell) return;
  if (simTime - cell.lastSeenTime > 0.35) {
    passCell(cell, tyreT);
    // ?slidewear=1: a sliding (crashing, spinning, drifting) wheel tears the ground: its pass
    // counts twice
    if (sliding) passCell(cell, tyreT);
    // a hot tyre packs / melts SNOW faster (water now dries by temperature inside passCell)
    if (tyreT > HOT_TYRE && cell.cover === 'snow' && Math.random() < HOT_EXTRA_CHANCE)
      passCell(cell, tyreT);
  }
  cell.lastSeenTime = simTime;
}

// carWheels order is FL, FR, RL, RR with L = +lateral; vehicle.js indexes tyres the same way
// (0..3).
const TYRE_OF_WHEEL = [0, 1, 2, 3];
export function stepWear(car: CarBody, dt: number): void {
  wearClock += dt;
  if (Math.hypot(car.vx, car.vy) < 0.6) return;
  const curr = carWheels(car);
  if (!car.prevWheels) car.prevWheels = curr;
  const telemetry = car.t;
  setPassTyre(car.spec.tyre);
  // A JUMP is not a tyre path (MEASURED BUG, "dirt in the road"; tools/_dirtroad.mjs):
  // highway traffic out of view is moved KINEMATICALLY (traffic.js, no applyGround), so prevWheels
  // went stale and the first physical step after it woke swept one straight line of wear from where
  // it fell asleep, often across the carriageway. Same for any teleport. 3 m in one step = 360 m/s
  // at 120 Hz.
  if (Math.hypot(curr[0].x - car.prevWheels[0].x,
    curr[0].y - car.prevWheels[0].y) > 3) { car.prevWheels = curr; return; }
  for (let i = 0; i < 4; i++) {
    const prevWheel = car.prevWheels[i];
    const currWheel = curr[i];
    const dx = currWheel.x - prevWheel.x, dy = currWheel.y - prevWheel.y;
    const dist = Math.hypot(dx, dy);
    // Interpolate continuously along each tyre's swept path: zero gaps even at high speed
    const steps = Math.max(1, Math.ceil(dist / (WEAR_CELL * 0.45)));
    const slip = i < 2 ? telemetry.slipSpeedF : telemetry.slipSpeedR;
    const sliding = slideWear && slip > SLIDE_WEAR_MIN;
    for (let step = 0; step <= steps; step++) {
      const frac = step / steps;
      recordWearPoint(prevWheel.x + dx * frac, prevWheel.y + dy * frac, wearClock,
        car.tyreT ? car.tyreT[TYRE_OF_WHEEL[i]] : 0, sliding);
    }
    // ICE SCRUB: only a wheel that is actually sliding or locked wears ice (front axle = wheels
    // 0,1)
    if (slip > ICE_SCRUB_MIN) {
      const cell = getCell(Math.floor(currWheel.x / WEAR_CELL),
        Math.floor(currWheel.y / WEAR_CELL));
      // hot rubber melts ice faster: x1 at 60 C, x2 at 90 C, x3 at 120 C
      // x1 at 60 C rising to x1.67 at 120 C (was x3: hot tyres melted ice too easily)
      const heatScrub = car.tyreT ? 1 + Math.min(1, Math.max(0,
        (car.tyreT[TYRE_OF_WHEEL[i]] - 60) / 90)) : 1;
      if (cell) scrubCell(cell, slip * dt * heatScrub);
    }
  }
  car.prevWheels = curr;
}

// Put the ground under the car. Lives HERE, not in main.js, so the game and every harness run the
// identical code — MEASURED BUG: tools/kerbcheck.mjs had its own copy, the field names
// changed under it, and it cheerfully reported load 1.00 at every speed from 3 to 42 m/s. Identical
// outcomes across different inputs is CLAUDE.md rule 1, and it was my own instrument lying again.
//
// Sampled AT EACH AXLE, not at the centre. A 2.6 m wheelbase over a 3.5 m kerb means the front is
// cresting while the rear is still climbing, and that phase difference is the whole character of
// riding a kerb — one end light while the other still grips. One sample point would average it
// away. LOCAL LOOKUP HINT (AI stage 1: applyGround made 34 track lookups per car per
// physics step — slope, bump steer, camber, kerbs — each a fresh grid search; with 6 cars that was
// a third of the frame). The car is looked up ONCE; the samples around it search only the 21
// segments either side of its nearest one, and that answer is used only when the point is ON the
// road (within half width + 3 m) — then no other part of the lap can be nearer (legs are >= 33 m
// apart on every level). Anything else gets the full search.
export let qsHintSub: Subtrack | null = null, qsHint = -1;
export function applyGround(car: CarBody, dt: number): void {
  const st0 = LEVEL.subtrack;
  if (st0) { const hit = querySubtrack(st0, car.x,
    car.y); qsHintSub = hit.seg != null ? st0 : null; qsHint = hit.seg ?? -1; }
  try { applyGroundInner(car, dt); } finally { qsHintSub = null; qsHint = -1; }
}
// FEWER GROUND LOOKUPS (the default since 2026-10-17, owner approved; ?groundlookup=0 = the old
// ~22). Every car asks for the smooth ground
// height ~22 times a physics step (120 a second): a central-difference slope (4 heights) under each
// of the 4 wheels, 2 more heights for the bump steer and 4 for the front axle's slope - mostly
// overlapping questions (MEASURED: Brands, 5 cars, CPU x4, applyGround 2.1 s in 15 s). With the
// switch each wheel's slope is a forward difference from its own height plus one step along x and
// one along y (3 heights), the bump steer reuses the two front wheels' heights, and the front
// axle's slope is the mean of its two wheels' slopes: 12 heights a step. The same STEP, so a slope
// is the same plane read 0.15 m off the wheel; on an even slope the answer is identical.
const LOOKUP_STEP = 0.3;   // m, slopeAt's step
// on here too, so the headless tools drive the same physics as the game
let fewerLookups = true;
/**
 * Turns the fewer ground lookups on or off (main.js, from ?groundlookup; tools for an A/B).
 * @param fewer true for 12 height lookups a step instead of ~22
 */
export function setGroundLookup(fewer: boolean): void { fewerLookups = fewer; }
// one wheel's smooth height and slope (fewer lookups), reused: no allocation per step
const wheelGround = { h: 0, gx: 0, gy: 0 };
// the front wheels' bank-free heights and the front axle's slope, kept for the bump steer
const frontWheels = { right: 0, left: 0, gx: 0, gy: 0 };
/**
 * One wheel's smooth height and its slope from 3 lookups (forward differences), into wheelGround.
 * @param x world x, m
 * @param y world y, m
 */
function sampleWheelGround(x: number, y: number): void {
  const height = bumpAt(x, y, true);
  wheelGround.h = height;
  wheelGround.gx = (bumpAt(x + LOOKUP_STEP, y, true) - height) / LOOKUP_STEP;
  wheelGround.gy = (bumpAt(x, y + LOOKUP_STEP, true) - height) / LOOKUP_STEP;
}

/**
 * The slope force (and bump steer) on a grounded car, set into slopeLong / slopeLat / slopeYaw.
 * @param car the car body (slope fields are written)
 * @param cosH cos of the car heading
 * @param sinH sin of the car heading
 */
function applySlopeForces(car: CarBody, cosH: number, sinH: number): void {
  const spec = car.spec;
  // PER AXLE, under each wheel (ruts: sampled at the centre the car sits on the ridge between two
  // grooves and is pushed sideways; at the wheels each side is pulled back into its own groove).
  // Each axle carries its static share of the weight, and the two axles' sideways pushes act at
  // the axles — so an off-centre whoop or dip under the FRONT wheels tugs the nose toward the dip
  // / away from the hump (requirement: dips and whoops should gently affect steering).
  const hw2 = (spec.trackWidth || 1.5) / 2, perpSin = -sinH, perpCos = cosH,
    wheelbase = spec.lf + spec.lr;
  const weight = spec.mass * car.mods.mass * 9.81;
  let Flong = 0, Flat = 0, yawMoment = 0;
  for (const [axleX, share, arm] of [[spec.lf, spec.lr / wheelbase, spec.lf], [-spec.lr,
    spec.lf / wheelbase, -spec.lr]]) {
    let slopeX = 0, slopeY = 0;
    for (const side of [1, -1]) {
      const wheelX = car.x + cosH * axleX + perpSin * hw2 * side,
        wheelY = car.y + sinH * axleX + perpCos * hw2 * side;
      if (fewerLookups) {
        sampleWheelGround(wheelX, wheelY);
        slopeX += wheelGround.gx / 2;
        slopeY += wheelGround.gy / 2;
        // side +1 is the car's right (the bump steer's heightRight)
        const bankFree = wheelGround.h - bankHeightAt(wheelX, wheelY);
        if (arm > 0 && side > 0) frontWheels.right = bankFree;
        else if (arm > 0) frontWheels.left = bankFree;
      } else {
        const slope = slopeAt(wheelX, wheelY);
        slopeX += slope.gx / 2;
        slopeY += slope.gy / 2;
      }
    }
    if (arm > 0) { frontWheels.gx = slopeX; frontWheels.gy = slopeY; }
    // cap at 45 deg
    const gmag = Math.hypot(slopeX, slopeY), slopeScale = gmag > 1 ? 1 / gmag : 1;
    const Fwx = -weight * share * slopeX * slopeScale,
      Fwy = -weight * share * slopeY * slopeScale;
    const forceLong = Fwx * cosH + Fwy * sinH, forceLat = -Fwx * sinH + Fwy * cosH;
    // lateral push x lever arm = yaw
    Flong += forceLong; Flat += forceLat; yawMoment += arm * forceLat;
  }
  yawMoment += bumpSteerYaw(car, cosH, sinH, weight);
  car.slopeLong = Flong; car.slopeLat = Flat; car.slopeYaw = yawMoment;
}

/**
 * BUMP STEER: the front wheel that drops (into a dip, or off the far side of a whoop) tugs the
 * nose toward its side — the tramlining a real car's steering does. +y is the car's right, and
 * a right turn is positive yaw, so a LOWER right wheel (hL > hR) adds positive yaw. Strength
 * BUMP_STEER x front weight x height difference (m). banking excluded: a steady cross-slope is
 * not a bump, and the slope push already slides you down it. With fewer lookups the heights and
 * the front slope come from the slope pass (frontWheels).
 * @param car the car body
 * @param cosH cos of the car heading
 * @param sinH sin of the car heading
 * @param weight the car's weight, N
 * @returns the yaw moment, N m
 */
function bumpSteerYaw(car: CarBody, cosH: number, sinH: number, weight: number): number {
  const spec = car.spec, hw2 = (spec.trackWidth || 1.5) / 2, perpSin = -sinH, perpCos = cosH;
  let heightRight = frontWheels.right, heightLeft = frontWheels.left;
  let slopeX = frontWheels.gx, slopeY = frontWheels.gy;
  if (!fewerLookups) {
    const hAt = (x: number, y: number): number => heightAt(x, y) - bankHeightAt(x, y);
    heightRight = hAt(car.x + cosH * spec.lf + perpSin * hw2,
      car.y + sinH * spec.lf + perpCos * hw2);
    heightLeft = hAt(car.x + cosH * spec.lf - perpSin * hw2,
      car.y + sinH * spec.lf - perpCos * hw2);
    // BUMPS ONLY, never an even slope (requirement: I think the bowl on the lab is broken): on
    // the bowl wall the left / right difference was PERMANENT and dragged the nose toward the
    // middle the whole way round. Subtract what a flat plane with the local slope would give, so
    // a steady cross-slope (bowl, hill, banking) reads zero.
    const frontSlope = slopeAt(car.x + cosH * spec.lf, car.y + sinH * spec.lf);
    slopeX = frontSlope.gx;
    slopeY = frontSlope.gy;
  }
  // hL - hR on a flat tilted plane
  const plane = -2 * hw2 * (slopeX * perpSin + slopeY * perpCos);
  return BUMP_STEER.k * weight * (spec.lr / (spec.lf + spec.lr)) * Math.max(-0.4, Math.min(0.4,
    (heightLeft - heightRight) - plane));
}
function applyGroundInner(car: CarBody, dt: number): void {
  const spec = car.spec;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const frontX = car.x + cosH * spec.lf, frontY = car.y + sinH * spec.lf;
  const rearX = car.x - cosH * spec.lr, rearY = car.y - sinH * spec.lr;
  const frontGround = groundAt(frontX, frontY);
  const rearGround = groundAt(rearX, rearY);
  // The true discrete derivative, so driving ALONG a ridged kerb shakes the car for exactly the
  // same reason crossing one does. There is no separate "rumble" code anywhere, and there should
  // not be. FIRST STEP AFTER A RESET (requirement: resetting on terrain causes the car to get stuck
  // when pulling away). reset zeroes the ground + suspension heights, so on a hill the first
  // derivative read the whole hill as one step: MEASURED a reset 7.5 m up Sweaty Lamb
  // launched the car 106 m into the air (Slidden Hill 67 m; Castle Cum's 1.1 m crest 1.1 s of air).
  // Now the first step after a reset puts the ground AND the body at the local height with no
  // vertical speed.
  if (!car.groundInit) {
    car.groundF = frontGround.h;
    car.groundR = rearGround.h;
    car.zF = frontGround.h;
    car.zR = rearGround.h;
    car.zvF = 0;
    car.zvR = 0;
    car.groundInit = true;
  }
  car.groundVF = (frontGround.h - car.groundF) / dt; car.groundF = frontGround.h;
  car.groundVR = (rearGround.h - car.groundR) / dt; car.groundR = rearGround.h;
  // grip is still one number for the car; per-axle grip is a later job
  car.surface = rearGround.surface;

  // Corner banking physics (PLAN.md §3): on banked turns (e.g. Naffcar), the slope hauls the car
  // inward SLOPE FORCE (step 3; requirement: vector dips... push in all 8 directions, out and in).
  // Gravity along the smooth terrain: F = -m g grad(h), world frame -> body frame. Bumps push OUT,
  // dips and banking pull IN/DOWN. Only on the ground (an airborne car falls straight).
  // Replaces the old bank FORCE, which pushed 0.3 g to the car's left anywhere past |x| 130 — grass
  // included (fixed earlier today); banking is now real height (bankHeightAt).
  car.bankLatForce = 0; car.bankLoadFactor = 1.0;
  if (car.air > 0) { car.slopeLong = 0; car.slopeLat = 0; car.slopeYaw = 0; }
  else applySlopeForces(car, cosH, sinH);

  // Dynamic surface wear: continuous swept tyre paths for all 4 wheels
  stepWear(car, dt);
}

// The fence is the one hard constraint out here, because a barrier IS one.
// PREVENTS WEDGING: bounds against car corners rather than center point, prevents body
// from penetrating the fence, zeroes penetrating velocity with elastic rebound, and damps snagging
// yaw.
export function fenceClamp(car: CarBody): void {
  const spec = car.spec;
  const reach = Math.max(spec.wid, spec.len) * 0.48;
  // per side (S-B: the floor is a rectangle): the fence is RUNOFF_W past each floor edge
  for (const axis of ['x', 'y'] as const) {
    const lower = (axis === 'x' ? FX0 : FY0) - RUNOFF_W + reach,
      upper = (axis === 'x' ? FX1 : FY1) + RUNOFF_W - reach;
    if (car[axis] > upper || car[axis] < lower) {
      const sgn = car[axis] > upper ? 1 : -1;
      car[axis] = sgn > 0 ? upper : lower;
      const velKey = axis === 'x' ? 'vx' : 'vy';
      if (car[velKey] * sgn > 0) {
        car[velKey] = -car[velKey] * 0.35;
        car.yawRate *= 0.65;     // kill corner pivot snagging
      }
    }
  }
}

/**
 * Push the car out of one solid obstacle (grandstand, pit wall, marshal tower) if it is inside,
 * bouncing it off the side of least penetration.
 * @param car the car body
 * @param obstacle the obstacle rectangle
 * @param reachX how far the car reaches along x
 * @param reachY how far the car reaches along y
 */
function pushOutOfObstacle(
  car: CarBody, obstacle: Obstacle, reachX: number, reachY: number,
): void {
  const halfW = obstacle.w / 2, halfH = obstacle.h / 2;
  const minX = obstacle.x - halfW - reachX;
  const maxX = obstacle.x + halfW + reachX;
  const minY = obstacle.y - halfH - reachY;
  const maxY = obstacle.y + halfH + reachY;

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
    const speed = Math.hypot(car.vx, car.vy);
    car.shake = Math.min(1.0, (car.shake || 0) + speed * 0.12);
  }
}
// Solid impactable obstacle collision (grandstands, pit divider walls, marshal towers)
export function obstacleClamp(car: CarBody): void {
  if (!LEVEL.obstacles || !LEVEL.obstacles.length) return;
  const spec = car.spec;
  const reachX = spec.len * 0.45, reachY = spec.wid * 0.45;

  for (let i = 0; i < LEVEL.obstacles.length; i++)
    pushOutOfObstacle(car, LEVEL.obstacles[i], reachX, reachY);
}

export function resetPATCH_GRID(): void {
  PATCH_GRID = new Map();
  PATCH_ORDER = new Map();
}
