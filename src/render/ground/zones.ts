// The floor and zones of the ground painter: the outside colour, the base surface or lab
// floor, the surface zones with their labels and the seams between them.
import { FLOOR, FX0, FX1, FY0, FY1, GRID } from "../../world/bounds.ts";
import { ZONES, LEVEL } from "../../world/state.ts";
import { COL } from "../../world/colours.ts";
import type { Zone } from "../../world/types.ts";
import type { SurfaceArt } from "../types.ts";
import type { GroundCtx } from "./types.ts";
import { paintLayers, artBase, surfaceTexture } from "./art.ts";
import { paintAs } from "../../world/coverfield.ts";
import type { GroundPatch } from "../glpaint.ts";

// the lab floor's glow pool: its colour at the world origin and at FLOOR_GLOW_REACH x FLOOR
const LAB_GLOW_INNER = 'rgba(255,252,246,0.55)', LAB_GLOW_OUTER = 'rgba(226,226,234,0)';
const FLOOR_GLOW_REACH = 0.9;

/** The surface the level's floor is painted as (?coverfield=1: snow ground shows what is under). */
const floorSurfaceId = () => paintAs(LEVEL.base!.id, LEVEL.base!.under, true);

/**
 * The surface a zone is painted as (?coverfield=1: a snow / ice / wet zone shows what is under it;
 * the field draws its cover).
 * @param zone the zone
 * @returns the surface id
 */
const zoneSurfaceId = (zone: Zone) => paintAs(zone.surface.id, zone.surface.under);

/**
 * The look a zone is painted with: its own art, or (a level area) what lies under it.
 * @param zone the zone
 * @returns the art id
 */
const zoneArtId = (zone: Zone) => {
  const surfaceId = zoneSurfaceId(zone);
  return surfaceId !== zone.surface.id ? surfaceId : zone.art || zone.surface.id;
};

/**
 * Paints the floor: the outside colour, then the level base surface or the lab floor.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawFloor(groundCtx: GroundCtx) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  // the GPU painted the floor, the lab floor's glow and grid included (floorPatch)
  if (view.fillsOnGpu) return;
  view.ctx.fillStyle = COL.outside;
  view.ctx.fillRect(0, 0, view.W, view.H);
  const ppm = PPMz();

  // the floor RECTANGLE (S-B): FX0..FX1 x FY0..FY1, the square +-FLOOR on every level without
  // bounds
  const floorW = (FX1 - FX0) * ppm, floorH = (FY1 - FY0) * ppm;
  if (LEVEL.base && LEVEL.base.id !== 'lab') {
    const baseId = floorSurfaceId();
    view.ctx.fillStyle = artBase(groundCtx, baseId, COL.floor);
    view.ctx.fillRect(toScreenX(FX0), toScreenY(FY0), floorW, floorH);
    view.ctx.save();
    view.ctx.translate(toScreenX(0), toScreenY(0));
    paintLayers(groundCtx, baseId, FX0, FY0, FX1, FY1);
    view.ctx.restore();
  } else {
    paintLabFloor(groundCtx, ppm, floorW, floorH);
  }
}

/**
 * Paints the lab floor: its glow pool and the on-screen grid lines.
 *
 * @param groundCtx the shared ground painter context
 * @param ppm pixels per metre
 * @param floorW floor width in pixels
 * @param floorH floor height in pixels
 */
function paintLabFloor(groundCtx: GroundCtx, ppm: number, floorW: number, floorH: number) {
  const { view, toScreenX, toScreenY } = groundCtx;
  view.ctx.fillStyle = COL.floor;
  view.ctx.fillRect(toScreenX(FX0), toScreenY(FY0), floorW, floorH);

  // a soft warm pool so a big pale floor is not dead flat. Since the ground TILES
  // it is centred on the WORLD ORIGIN (the skidpad), not on the car: tiles are painted
  // separately, so a screen-centred gradient would come out as one blotch per tile. It stays
  // UNDER the zones.
  const glow = view.ctx.createRadialGradient(
    toScreenX(0), toScreenY(0), 0, toScreenX(0), toScreenY(0), FLOOR * FLOOR_GLOW_REACH * ppm
  );
  glow.addColorStop(0, LAB_GLOW_INNER);
  glow.addColorStop(1, LAB_GLOW_OUTER);
  view.ctx.fillStyle = glow;
  view.ctx.fillRect(toScreenX(FX0), toScreenY(FY0), floorW, floorH);

  paintFloorGrid(groundCtx);
}

/**
 * Strokes the world-grid lines that are on screen, clipped to the floor rectangle.
 *
 * @param groundCtx the shared ground painter context
 */
function paintFloorGrid(groundCtx: GroundCtx) {
  const { view, cam, PPMz, toScreenX, toScreenY } = groundCtx;
  // grid — only the lines actually on screen
  const gridX0 = Math.floor((cam.x - view.W / 2 / PPMz()) / GRID) * GRID;
  const gridX1 = cam.x + view.W / 2 / PPMz();
  const gridY0 = Math.floor((cam.y - view.H / 2 / PPMz()) / GRID) * GRID;
  const gridY1 = cam.y + view.H / 2 / PPMz();
  view.ctx.strokeStyle = COL.grid;
  view.ctx.lineWidth = 1;
  view.ctx.beginPath();
  for (let x = gridX0; x <= gridX1; x += GRID) {
    if (x < FX0 || x > FX1) continue;
    const lineX = Math.round(toScreenX(x)) + 0.5;
    view.ctx.moveTo(lineX, toScreenY(Math.max(FY0, gridY0 - GRID)));
    view.ctx.lineTo(lineX, toScreenY(Math.min(FY1, gridY1 + GRID)));
  }
  for (let y = gridY0; y <= gridY1; y += GRID) {
    if (y < FY0 || y > FY1) continue;
    const lineY = Math.round(toScreenY(y)) + 0.5;
    view.ctx.moveTo(toScreenX(Math.max(FX0, gridX0 - GRID)), lineY);
    view.ctx.lineTo(toScreenX(Math.min(FX1, gridX1 + GRID)), lineY);
  }
  view.ctx.stroke();
}

// EVERY PATCH OF SURFACE, from the same ZONES list the physics reads — so what you see is by
// construction what you drive on, with no second copy of the layout to drift out of step. (That
// drift is exactly the bug that cost me an afternoon in the ground sampling earlier today.)
//
// Drawn back to front, so the first-hit-wins order in lab.js is honoured visually too: a panel
// laid ON a quadrant is listed first and must therefore be painted LAST.

/**
 * Paints every zone of the level, back to front, then the quarter seams.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawZones(groundCtx: GroundCtx) {
  const { SURFACE_ART } = groundCtx;
  for (let i = ZONES.length - 1; i >= 0; i--) {
    const zone = ZONES[i];
    // zone.art: drawn as another look (a wheat field drives as long grass)
    const artId = zoneArtId(zone), art = SURFACE_ART[artId];
    if (!art) continue;
    if (!isZoneOnScreen(groundCtx, zone)) continue;
    // the GPU painted the fills: only the rims and labels lie over them
    if (groundCtx.view.fillsOnGpu) {
      if (zone.rounded) paintRoundedZoneRim(groundCtx, zone);
      else if (!zone.rot && zone.boxed) paintBoxedZoneLabel(groundCtx, zone);
      continue;
    }
    if (zone.rounded) paintRoundedZone(groundCtx, zone, art);
    else if (zone.rot) paintRotatedZone(groundCtx, zone, artId, art);
    else paintPlainZone(groundCtx, zone, artId, art);
  }
  // A soft seam where the quarters meet, so the join reads as a real transition and not a UI
  // edge.
  if (LEVEL.seams) paintSeams(groundCtx);
}

/**
 * Tells whether a zone's ROTATED footprint touches the screen.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 * @param marginPx how far off screen still counts as on it, css px
 * @returns true when it is on screen
 */
function isZoneOnScreen(groundCtx: GroundCtx, zone: Zone, marginPx = 0) {
  const { view, toScreenX, toScreenY } = groundCtx;
  // off screen? On the ROTATED footprint. MEASURED BUG (requirement: the old runway bugs in and out
  // of existence): this tested the unrotated w x h box, so a long thin rotated runway (432 x 22 m
  // at -22 deg) was skipped by every ground tile more than 11 m from its
  // centre line — painted in some tiles, missing in others, changing as tiles reloaded.
  const cosAbs = Math.abs(Math.cos(zone.rot || 0)), sinAbs = Math.abs(Math.sin(zone.rot || 0));
  const extentX = (zone.w / 2) * cosAbs + (zone.h / 2) * sinAbs,
    extentY = (zone.w / 2) * sinAbs + (zone.h / 2) * cosAbs;
  if (
    toScreenX(zone.x - extentX) > view.W + marginPx || toScreenX(zone.x + extentX) < -marginPx ||
    toScreenY(zone.y - extentY) > view.H + marginPx || toScreenY(zone.y + extentY) < -marginPx
  ) return false;
  return true;
}

/**
 * Paints a rounded panel: its tarmac apron, the surface art clipped inside, rim and label.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 * @param art the zone's surface art
 */
function paintRoundedZone(groundCtx: GroundCtx, zone: Zone, art: SurfaceArt) {
  const { view, PPMz, toScreenX, toScreenY, roundRect } = groundCtx;
  const ppm = PPMz();
  const left = zone.x - zone.w / 2, top = zone.y - zone.h / 2;
  const rad = Math.min(5 * ppm, zone.w * ppm * 0.15);
  // Outer asphalt perimeter apron
  view.ctx.fillStyle = COL.tarmac;
  view.ctx.beginPath();
  // the apron is PHYSICAL tarmac (lab.js PAD_APRON, zoneAt) — change the two together
  roundRect(
    view.ctx, toScreenX(left - 1.2), toScreenY(top - 1.2),
    (zone.w + 2.4) * ppm, (zone.h + 2.4) * ppm, rad + 1.2 * ppm
  );
  view.ctx.fill();

  view.ctx.save();
  view.ctx.beginPath();
  roundRect(view.ctx, toScreenX(left), toScreenY(top), zone.w * ppm, zone.h * ppm, rad);
  view.ctx.fillStyle = art.base;
  view.ctx.fill();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, zoneSurfaceId(zone), left, top, left + zone.w, top + zone.h);
  view.ctx.restore();
  paintRoundedZoneRim(groundCtx, zone);
}

/**
 * Paints the white rim and the label of a rounded panel.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 */
function paintRoundedZoneRim(groundCtx: GroundCtx, zone: Zone) {
  const { view, PPMz, toScreenX, toScreenY, roundRect } = groundCtx;
  const ppm = PPMz();
  const left = zone.x - zone.w / 2, top = zone.y - zone.h / 2;
  const rad = Math.min(5 * ppm, zone.w * ppm * 0.15);
  view.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  view.ctx.lineWidth = Math.max(1, 0.20 * ppm);
  view.ctx.beginPath();
  roundRect(view.ctx, toScreenX(left), toScreenY(top), zone.w * ppm, zone.h * ppm, rad);
  view.ctx.stroke();

  const fontPx = 3.2 * ppm;
  if (fontPx > 7) {
    view.ctx.font = `700 ${Math.round(fontPx)}px ui-sans-serif, system-ui, sans-serif`;
    view.ctx.textAlign = 'center';
    view.ctx.textBaseline = 'middle';
    view.ctx.fillStyle = 'rgba(255,255,255,0.75)';
    // a labelled zone
    view.ctx.fillText(zone.surface.label!, toScreenX(zone.x), toScreenY(top + 4.5));
  }
}

/**
 * Paints a rotated zone: clipped in its own frame, the texture over its bounding box.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 * @param artId the SURFACE_ART key
 * @param art the zone's surface art
 */
function paintRotatedZone(
  groundCtx: GroundCtx, zone: Zone, artId: string, art: SurfaceArt
) {
  const { view, cam, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  // ROTATED zone: clip in the zone's frame, then step back to the world frame (the clip
  // stays) and paint the texture over the zone's bounding box, so it lines up with the ground
  // exactly where zoneAt says the surface is.
  const reach = Math.hypot(zone.w, zone.h) / 2;
  if (
    toScreenX(zone.x + reach) < 0 || toScreenX(zone.x - reach) > view.W ||
    toScreenY(zone.y + reach) < 0 || toScreenY(zone.y - reach) > view.H
  ) return;
  view.ctx.save();
  view.ctx.translate(toScreenX(zone.x), toScreenY(zone.y));
  view.ctx.rotate(zone.rot!);
  view.ctx.beginPath();
  view.ctx.rect((-zone.w / 2) * ppm, (-zone.h / 2) * ppm, zone.w * ppm, zone.h * ppm);
  view.ctx.fillStyle = art.base;
  view.ctx.fill();
  view.ctx.clip();
  view.ctx.rotate(-zone.rot!);
  view.ctx.translate(-toScreenX(zone.x), -toScreenY(zone.y));
  view.ctx.translate(toScreenX(0), toScreenY(0));
  // only the part IN VIEW (in a tile: the tile). MEASURED: once the culling fix
  // let the 432 m runway into every tile it crosses, each tile repainted its whole 430 m
  // square of texture — ground tile 22 -> 26 ms, slow frames 71 -> ~90.
  const vx0 = cam.x - view.W / 2 / ppm, vy0 = cam.y - view.H / 2 / ppm;
  paintLayers(
    groundCtx, artId, Math.max(zone.x - reach, vx0), Math.max(zone.y - reach, vy0),
    Math.min(zone.x + reach, vx0 + view.W / ppm),
    Math.min(zone.y + reach, vy0 + view.H / ppm)
  );
  view.ctx.restore();
}

/**
 * Paints an unrotated zone: its base colour and surface art clipped to the rectangle.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 * @param artId the SURFACE_ART key
 * @param art the zone's surface art
 */
function paintPlainZone(
  groundCtx: GroundCtx, zone: Zone, artId: string, art: SurfaceArt
) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  const left = zone.x - zone.w / 2, top = zone.y - zone.h / 2;
  view.ctx.save();
  view.ctx.beginPath();
  view.ctx.rect(toScreenX(left), toScreenY(top), zone.w * ppm, zone.h * ppm);
  view.ctx.fillStyle = art.base;
  view.ctx.fill();
  // so the texture cannot spill outside the region the physics uses
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, zoneSurfaceId(zone), left, top, left + zone.w, top + zone.h);
  view.ctx.restore();
  if (zone.boxed) paintBoxedZoneLabel(groundCtx, zone);
}

/**
 * Paints the rim and the full name of a boxed test panel.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone being painted
 */
function paintBoxedZoneLabel(groundCtx: GroundCtx, zone: Zone) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  const left = zone.x - zone.w / 2, top = zone.y - zone.h / 2;
  // `boxed` marks a deliberate TEST PANEL: give it a rim and paint its FULL NAME on.
  view.ctx.strokeStyle = 'rgba(40,42,50,0.35)';
  view.ctx.lineWidth = Math.max(1, 0.25 * ppm);
  view.ctx.strokeRect(toScreenX(left), toScreenY(top), zone.w * ppm, zone.h * ppm);
  const fontPx = 3.4 * ppm;
  if (fontPx > 7) {
    view.ctx.font = `700 ${Math.round(fontPx)}px ui-sans-serif, system-ui, sans-serif`;
    view.ctx.textAlign = 'center';
    view.ctx.textBaseline = 'middle';
    view.ctx.fillStyle = 'rgba(30,32,40,0.32)';
    // a boxed panel is labelled
    view.ctx.fillText(zone.surface.label!, toScreenX(zone.x), toScreenY(top + 5.5));
  }
}

/**
 * Strokes the soft seam lines where the old square's quarters meet.
 *
 * @param groundCtx the shared ground painter context
 */
function paintSeams(groundCtx: GroundCtx) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  view.ctx.strokeStyle = 'rgba(80,80,92,0.20)';
  view.ctx.lineWidth = Math.max(1, 0.3 * ppm);
  view.ctx.beginPath();
  // the old square's quarters only (S-B: the lab's extension south of FLOOR is one floor, no
  // quarter seam)
  view.ctx.moveTo(toScreenX(-FLOOR), toScreenY(0));
  view.ctx.lineTo(toScreenX(FLOOR), toScreenY(0));
  view.ctx.moveTo(toScreenX(0), toScreenY(-FLOOR));
  view.ctx.lineTo(toScreenX(0), toScreenY(FLOOR));
  view.ctx.stroke();
}

// zones this far off screen (m) are still listed: the apron of a rounded panel reaches 1.2 m
const PATCH_MARGIN_M = 2;

// a patch with no surface, no grid and no glow: every list entry is reset to it before use
const EMPTY_PATCH: GroundPatch = {
  x: 0, y: 0, w: 0, h: 0, rot: 0, radius: 0, base: '#000', texture: null,
  gridSpacing: 0, gridColour: '#000', glowRadius: 0, glowInner: '#0000', glowOuter: '#0000',
};

/**
 * The next reusable patch of the list (the list grows once, then is reused every frame).
 *
 * @param list the patch list
 * @param count how many are in use
 * @returns the patch at index count, reset to a plain square of no surface
 */
function nextPatch(list: GroundPatch[], count: number): GroundPatch {
  if (!list[count]) list[count] = { ...EMPTY_PATCH };
  return Object.assign(list[count], EMPTY_PATCH);
}

/**
 * Sets a patch's surface: its base colour and texture (none while patterns are off).
 *
 * @param groundCtx the shared ground painter context
 * @param patch the patch
 * @param base the base colour
 * @param layersId the SURFACE_ART key of the pattern layers
 */
function setPatchSurface(groundCtx: GroundCtx, patch: GroundPatch, base: string,
    layersId: string) {
  const art = groundCtx.SURFACE_ART[layersId];
  patch.base = base;
  patch.texture = art && !groundCtx.view.noPatterns
    ? surfaceTexture(groundCtx, layersId, art) : null;
}

/**
 * The floor as a patch: the level base surface, or the lab floor with its glow and grid.
 *
 * @param groundCtx the shared ground painter context
 * @param patch the patch to fill
 */
function floorPatch(groundCtx: GroundCtx, patch: GroundPatch) {
  Object.assign(patch, { x: (FX0 + FX1) / 2, y: (FY0 + FY1) / 2, w: FX1 - FX0, h: FY1 - FY0 });
  if (LEVEL.base && LEVEL.base.id !== 'lab') {
    const baseId = floorSurfaceId();
    setPatchSurface(groundCtx, patch, artBase(groundCtx, baseId, COL.floor), baseId);
    return;
  }
  Object.assign(patch, {
    base: COL.floor, gridSpacing: GRID, gridColour: COL.grid,
    glowRadius: FLOOR * FLOOR_GLOW_REACH, glowInner: LAB_GLOW_INNER, glowOuter: LAB_GLOW_OUTER,
  });
}

/**
 * The patches of one zone, as drawZones paints its fills: a rounded panel's tarmac apron, then
 * the zone. The pattern layers follow drawZones too: a rotated zone uses its art id, the others
 * the surface's own.
 *
 * @param groundCtx the shared ground painter context
 * @param zone the zone
 * @param list the patch list
 * @param count how many are in use
 * @returns how many are in use after the zone's
 */
function zonePatches(groundCtx: GroundCtx, zone: Zone, list: GroundPatch[], count: number) {
  const artId = zoneArtId(zone), art = groundCtx.SURFACE_ART[artId];
  // the margin covers the sub-pixel camera shift and a rounded panel's apron
  if (!art || !isZoneOnScreen(groundCtx, zone, PATCH_MARGIN_M * groundCtx.PPMz())) return count;
  const radius = zone.rounded ? Math.min(5, zone.w * 0.15) : 0;
  if (zone.rounded) {
    // the apron is PHYSICAL tarmac (lab.js PAD_APRON, zoneAt): change the two together
    Object.assign(nextPatch(list, count++), {
      x: zone.x, y: zone.y, w: zone.w + 2.4, h: zone.h + 2.4, radius: radius + 1.2,
      base: COL.tarmac,
    });
  }
  const patch = nextPatch(list, count++);
  Object.assign(patch, { x: zone.x, y: zone.y, w: zone.w, h: zone.h, rot: zone.rot || 0, radius });
  setPatchSurface(groundCtx, patch, art.base,
    zone.rot && !zone.rounded ? artId : zoneSurfaceId(zone));
  return count;
}

/**
 * Lists the floor and every zone as GPU ground patches, back to front, in the order drawFloor
 * and drawZones paint them (glpaint.ts draws them; it skips what is off screen).
 *
 * @param groundCtx the shared ground painter context
 * @param list the patch list, reused between frames
 * @returns how many patches of the list are in use
 */
export function listGroundPatches(groundCtx: GroundCtx, list: GroundPatch[]) {
  let count = 0;
  floorPatch(groundCtx, nextPatch(list, count++));
  for (let i = ZONES.length - 1; i >= 0; i--) count = zonePatches(groundCtx, ZONES[i], list, count);
  return count;
}
