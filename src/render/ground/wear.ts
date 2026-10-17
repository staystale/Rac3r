// The wear of the ground painter: tyre-worn cells, speed bumps and the runoff ring
// outside the track.
import { RUNOFF_W } from "../../world/bounds.ts";
import { BUMPS, LEVEL } from "../../world/state.ts";
import { COL } from "../../world/colours.ts";
import { VERGE_W } from "../../world/surfaces.ts";
import { wearMap, WEAR_CELL } from "../../world/wear.ts";
import type { Bump } from "../../world/types.ts";
import type { WearGroup } from "../types.ts";
import type { GroundCtx } from "./types.ts";
import { speckle } from "./prims.ts";
import { paintLayers, artBase } from "./art.ts";
import { puddleWater } from "./covers.ts";

// the group key of worn cells that are now standing water over a ground (?onepuddle=1)
const PUDDLE_KEY = 'puddle|';

// Dynamic surface wear patches: grass worn to short grass, dirt, and mud Drawn ON TOP OF the
// track ribbon and ground, but UNDER the kerbs and marks! TWO PASSES around the covers. MEASURED
// BUG, (requirement: puddles on the grass track... vanish when driven over and turned dirt into
// mud): wear was drawn AFTER the covers, so every 1.5 m dirt cell turning to mud beside a puddle
// painted its square over the puddle's edge until the puddle was gone.
//   'base'  — cells that started with no cover (dirt -> mud ...): drawn UNDER the covers
//   'cover' — cells whose cover itself changed (snow packed to ice, ice scrubbed through):
//             drawn OVER

/**
 * Draws the dynamic surface wear patches: grass worn to short grass, dirt, and mud.
 *
 * @param groundCtx the shared ground painter context
 * @param pass 'base' for cells that started with no cover, 'cover' for cells whose cover changed
 * @returns how many worn cells were painted (the ground tiles remember whether they hold any)
 */
export function drawWear(groundCtx: GroundCtx, pass = 'base') {
  if (!wearMap || wearMap.size === 0) return 0;
  const groups = groupWornCells(groundCtx, pass);
  let cells = 0;
  for (const [groupKey, group] of groups) {
    paintWearGroup(groundCtx, groupKey, group);
    cells += group.r.length / 4;
  }
  return cells;
}

/**
 * Groups the visible worn cells of one pass by the surface each has become.
 *
 * @param groundCtx the shared ground painter context
 * @param pass 'base' or 'cover', as for drawWear
 * @returns the screen rectangles and world bounding box of each group, keyed by surface
 */
function groupWornCells(groundCtx: GroundCtx, pass: string) {
  const { view, toScreenX, toScreenY } = groundCtx;
  // a worn cell now LOOKS like what it has become (the same SURFACE_ART as everywhere
  // else) instead of a flat tinted square. Visible cells are grouped by surface, and each group
  // is one path: fill its base, clip to it, paint its layers once — so 1000 worn cells cost a
  // handful of draw calls.
  const groups = new Map<string, WearGroup>();
  for (const cell of wearMap.values()) {
    if (cell.current === cell.orig) continue;
    const startedCovered = cell.orig === 'snow' || cell.orig === 'ice' || cell.orig === 'wet';
    if ((pass === 'cover') !== startedCovered) continue;
    const px0 = Math.round(toScreenX(cell.cx * WEAR_CELL)),
      py0 = Math.round(toScreenY(cell.cy * WEAR_CELL));
    const px1 = Math.round(toScreenX((cell.cx + 1) * WEAR_CELL)),
      py1 = Math.round(toScreenY((cell.cy + 1) * WEAR_CELL));
    if (px1 < 0 || px0 > view.W || py1 < 0 || py0 > view.H) continue;
    // cell.current! : set right after the cell is made; water is the wet surface art, the same
    // look as a wet zone and a puddle
    const groupKey = groundCtx.onePuddle && cell.current === 'wet' ? PUDDLE_KEY + cell.base
      : cell.current!;
    let group = groups.get(groupKey);
    if (!group) groups.set(groupKey, (group = {
      r: [], bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity,
    }));
    group.r.push(px0, py0, px1 - px0, py1 - py0);
    // world bbox of the group, so its pattern is painted over these cells only. MEASURED
    // painting each group across the whole view (clip-only) cost the lab panels run
    // 236 -> 192 frames.
    group.bx0 = Math.min(group.bx0, cell.cx * WEAR_CELL);
    group.bx1 = Math.max(group.bx1, (cell.cx + 1) * WEAR_CELL);
    group.by0 = Math.min(group.by0, cell.cy * WEAR_CELL);
    group.by1 = Math.max(group.by1, (cell.cy + 1) * WEAR_CELL);
  }
  return groups;
}

/**
 * Paints one group of worn cells: its base, clipped to the cells, then its pattern layers.
 *
 * @param groundCtx the shared ground painter context
 * @param groupKey the surface id
 * @param group the cells' screen rectangles and world bounding box
 */
function paintWearGroup(groundCtx: GroundCtx, groupKey: string, group: WearGroup) {
  const { view, toScreenX, toScreenY } = groundCtx;
    // standing water (?onepuddle=1): the ground under it, then the one puddle look over it
    const water = groupKey.startsWith(PUDDLE_KEY) ? groupKey.slice(PUDDLE_KEY.length) : null;
    const rects = group.r, artId = water ?? groupKey;
    view.ctx.save();
    view.ctx.beginPath();
    // a soft DISC per cell (radius 0.72 of the cell, so neighbours overlap) rather than a hard
    // square: worn ground then spreads as organic ruts instead of a blocky staircase
    // (photographed)
    for (let i = 0; i < rects.length; i += 4) {
      // squares in pixel art
      view.ctx.rect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
    }
    view.ctx.fillStyle = artBase(groundCtx, artId, '#6b5644');
    view.ctx.fill();
    view.ctx.clip();
    view.ctx.translate(toScreenX(0), toScreenY(0));
    paintLayers(groundCtx, artId, group.bx0, group.by0, group.bx1, group.by1);
    if (water) paintPuddleOver(groundCtx, water, group);
    view.ctx.restore();
}

/**
 * Paints the one puddle look over a group of worn cells already clipped to (?onepuddle=1): the
 * water tinted by the ground under it, then its sheen and rings.
 *
 * @param groundCtx the shared ground painter context
 * @param base the ground under the water
 * @param group the cells' world bounding box
 */
function paintPuddleOver(groundCtx: GroundCtx, base: string, group: WearGroup) {
  const { view, PPMz } = groundCtx, ppm = PPMz();
  view.ctx.fillStyle = puddleWater(base);
  view.ctx.fillRect(group.bx0 * ppm, group.by0 * ppm, (group.bx1 - group.bx0) * ppm,
    (group.by1 - group.by0) * ppm);
  paintLayers(groundCtx, 'puddle', group.bx0, group.by0, group.bx1, group.by1);
}

// BUMPS, JUMPS AND KERBS. A top-down view has no height, so a jump you cannot SEE coming is an
// unfair one — and unavoidable is a bug, not difficulty (CLAUDE.md §1). Each kind gets a shape
// that tells you what it will do: a ramp is a wedge that brightens toward a RED LIP where the
// ground stops, a table has a flat bright top and two edges, a hump is a lit dome, a kerb is the
// familiar red and white.

/**
 * Draws the bumps, jumps and kerbs that are near the screen.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawBumps(groundCtx: GroundCtx) {
  const { view, cam, PPMz } = groundCtx;
  const ppm = PPMz();
  for (const bump of BUMPS) {
    if (
      Math.abs(bump.x - cam.x) * ppm > view.W / 2 + 200 ||
      Math.abs(bump.y - cam.y) * ppm > view.H / 2 + 200
    ) continue;
    paintBump(groundCtx, bump, ppm);
  }
}

/**
 * Paints one bump in its own rotated frame: a kerb's stripes or a ramp's red lip.
 *
 * @param groundCtx the shared ground painter context
 * @param bump the bump to paint
 * @param ppm pixels per metre
 */
function paintBump(groundCtx: GroundCtx, bump: Bump, ppm: number) {
  const { view, toScreenX, toScreenY } = groundCtx;
    view.ctx.save();
    view.ctx.translate(toScreenX(bump.x), toScreenY(bump.y));
    view.ctx.rotate(bump.rot || 0);
    // TERRAIN SHAPES ARE SHOWN BY HILL-SHADING NOW (step 3; user chose "rebuild the
    // old jumps as terrain" and "pixel hill-shading"). The hand-drawn dome / wedge / table art
    // went: photographed together with the shading it read as two layers of mud. Kept: the KERB
    // (it is paint, not height) and the ramp's RED LIP — the ground really does fall away there,
    // which no shading can show, and a jump you cannot see coming is unfair (CLAUDE.md §1). kerb
    // and ramp bumps always have len and wid (the ! below)
    if (bump.kind === 'kerb') {
      const stripes = Math.max(2, Math.round(bump.len! / 2.4));
      for (let i = 0; i < stripes; i++) {
        view.ctx.fillStyle = i % 2 ? COL.kerbB : COL.kerbA;
        view.ctx.fillRect(
          (-bump.len! / 2 + (i * bump.len!) / stripes) * ppm, (-bump.wid! / 2) * ppm,
          (bump.len! / stripes) * ppm + 1, bump.wid! * ppm
        );
      }
      view.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      view.ctx.fillRect((-bump.len! / 2) * ppm, -0.3 * ppm, bump.len! * ppm, 0.6 * ppm);
    } else if (bump.kind === 'ramp') {
      view.ctx.fillStyle = 'rgba(214,69,60,0.85)';
      view.ctx.fillRect(
        (bump.len! / 2 - 0.6) * ppm, (-bump.wid! / 2) * ppm, 0.6 * ppm, bump.wid! * ppm
      );
    }
    view.ctx.restore();
}

/**
 * Draws the runoff ring: the grass verge and the gravel trap round the floor.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawRunoff(groundCtx: GroundCtx) {
  const { view, forSide } = groundCtx;
  // the lab's border ring is drawn along the WHOLE world edge: 100 km a side on the highway
  if (LEVEL.endless) return;
  for (let i = 0; i < 4; i++) forSide(i, (ppm, dist, halfLen) => {
    // along: the side plus both corners; out: the fence
    const alongEnd = halfLen + RUNOFF_W, outEnd = dist + RUNOFF_W;
    // GRASS VERGE first — the strip between the kerb and the gravel where you can still save it.
    view.ctx.fillStyle = COL.grass;
    view.ctx.fillRect(-alongEnd * ppm, dist * ppm, alongEnd * 2 * ppm, VERGE_W * ppm);
    speckle(groundCtx, -alongEnd, dist, alongEnd, dist + VERGE_W, COL.grassDark, 0.8, 0.16);
    // then the TRAP: the full width of the side, plus the corner so the ring closes with no seam.
    view.ctx.fillStyle = COL.gravel;
    view.ctx.fillRect(
      -alongEnd * ppm, (dist + VERGE_W) * ppm, alongEnd * 2 * ppm, (RUNOFF_W - VERGE_W) * ppm
    );
    speckle(groundCtx, -alongEnd, dist + VERGE_W, alongEnd, outEnd, COL.gravelGrit, 0.85, 0.15);
    speckle(groundCtx, -alongEnd, dist + VERGE_W, alongEnd, outEnd, COL.gravelDark, 2.4, 0.24);
  });
}
