// The GROUND PAINTER of the renderer: the floor, per-surface art and patterns, zones,
// covers, wear, bumps and the runoff ring. createGround builds ONE shared context (view,
// camera, helpers, texture cache, SURFACE_ART and the PRIM pattern primitives) and returns
// the painters render.ts calls; each painter is a module-level function that takes it.
import type { Cam, View } from "./types.ts";
import { createTextureCache } from "./textures.ts";
import type { GroundHelpers, GroundCtx } from "./ground/types.ts";
import { makePrim } from "./ground/prims.ts";
import {
  makeSurfaceArt, paintLayers, artBase, warmNextTexture, warmBladeTextures,
} from "./ground/art.ts";
import { drawFloor, drawZones, listGroundPatches } from "./ground/zones.ts";
import type { GroundPatch } from "./glpaint.ts";
import { PUDDLE_WATER, drawPatches, drawCovers } from "./ground/covers.ts";
import { drawWear, drawBumps, drawRunoff, drawDeckWear } from "./ground/wear.ts";
import { DECK_SHIFT_M, deckCellsOf } from "../world/deckwear.ts";
import { WEAR_CELL } from "../world/wear.ts";
import { LEVEL } from "../world/state.ts";
import type { Crossing } from "../world/types.ts";

/**
 * Builds the ground painter of one renderer.
 *
 * @param view the canvas, its context and size
 * @param cam the camera
 * @param helpers the renderer helpers the painters call
 * @returns the painters and the surface tables render.ts and others read
 */
export function createGround(view: View, cam: Cam, helpers: GroundHelpers) {
  const SURFACE_ART = makeSurfaceArt();
  // every surface's texture kept (each one painting: textures.ts createTextureCache)
  const groundCtx: GroundCtx = {
    view, cam, ...helpers, textures: createTextureCache(Object.keys(SURFACE_ART).length),
    SURFACE_ART,
    bladeMasks: new Map(),
    PRIM: {},
  };
  groundCtx.PRIM = makePrim(groundCtx);

  return {
    drawFloor: () => drawFloor(groundCtx),
    SURFACE_ART,
    paintLayers: (artId: string, minX: number, minY: number, maxX: number, maxY: number) =>
      paintLayers(groundCtx, artId, minX, minY, maxX, maxY),
    artBase: (artId: string, fallback: string) => artBase(groundCtx, artId, fallback),
    drawZones: () => drawZones(groundCtx),
    listGroundPatches: (list: GroundPatch[]) => listGroundPatches(groundCtx, list),
    warmNextTexture: () => warmNextTexture(groundCtx),
    warmBladeTextures: () => warmBladeTextures(groundCtx),
    // the palette blends these over each surface (tilesPalette.ts)
    PUDDLE_TINT: PUDDLE_WATER,
    drawPatches: () => drawPatches(groundCtx),
    drawCovers: () => drawCovers(groundCtx),
    drawWear: (pass?: string) => drawWear(groundCtx, pass),
    drawBumps: () => drawBumps(groundCtx),
    drawRunoff: () => drawRunoff(groundCtx),
    drawCrossingGround: (kind: Crossing['kind']) => drawCrossingGround(groundCtx, kind),
  };
}

// m: a crossing's own ground is drawn this far past its walls (a puddle's edge over a kerb)
const DECK_EDGE_M = 0.3;

/**
 * Draws each bridge's or each tunnel's own worn ground (world/deckwear.ts) with the ground's
 * looks, clipped to the way between its walls - a tunnel's to its two open cuts (its underground
 * stretch hidden).
 * @param groundCtx the shared ground painter context
 * @param kind the bridges' or the tunnels'
 */
function drawCrossingGround(groundCtx: GroundCtx, kind: Crossing['kind']) {
  const { view, toScreenX, toScreenY } = groundCtx;
  (LEVEL.crossings || []).forEach((way, index) => {
    const cells = deckCellsOf(index);
    if (way.kind !== kind || !cells.length) return;
    const least = way.minAcross - DECK_EDGE_M, most = way.maxAcross + DECK_EDGE_M;
    const corner = (along: number, across: number, first: boolean) => {
      const screenX = toScreenX(way.ax + way.dirX * along - way.dirY * across);
      const screenY = toScreenY(way.ay + way.dirY * along + way.dirX * across);
      if (first) view.ctx.moveTo(screenX, screenY);
      else view.ctx.lineTo(screenX, screenY);
    };
    view.ctx.save();
    view.ctx.beginPath();
    const spans = kind === 'tunnel' ? [[0, way.cut], [way.length - way.cut, way.length]]
      : [[0, way.length]];
    for (const [near, far] of spans) {
      corner(near, least, true);
      corner(far, least, false);
      corner(far, most, false);
      corner(near, most, false);
      view.ctx.closePath();
    }
    view.ctx.clip();
    drawDeckWear(groundCtx, cells, Math.round((index + 1) * DECK_SHIFT_M / WEAR_CELL));
    view.ctx.restore();
  });
}
