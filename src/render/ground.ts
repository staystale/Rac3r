// The GROUND PAINTER of the renderer: the floor, per-surface art and patterns, zones,
// covers, wear, bumps and the runoff ring. createGround builds ONE shared context (view,
// camera, helpers, texture cache, SURFACE_ART and the PRIM pattern primitives) and returns
// the painters render.ts calls; each painter is a module-level function that takes it.
import type { Cam, View } from "./types.ts";
import { createTextureCache } from "./textures.ts";
import type { GroundHelpers, GroundCtx } from "./ground/types.ts";
import { makePrim } from "./ground/prims.ts";
import { makeSurfaceArt, paintLayers, artBase } from "./ground/art.ts";
import { drawFloor, drawZones } from "./ground/zones.ts";
import { PUDDLE_TINT, drawPatches, drawCovers } from "./ground/covers.ts";
import { drawWear, drawBumps, drawRunoff } from "./ground/wear.ts";

/**
 * Builds the ground painter of one renderer.
 *
 * @param view the canvas, its context and size
 * @param cam the camera
 * @param helpers the renderer helpers the painters call
 * @returns the painters and the surface tables render.ts and others read
 */
export function createGround(view: View, cam: Cam, helpers: GroundHelpers) {
  const groundCtx: GroundCtx = {
    view, cam, ...helpers, textures: createTextureCache(), SURFACE_ART: makeSurfaceArt(),
    PRIM: {},
  };
  groundCtx.PRIM = makePrim(groundCtx);
  const { SURFACE_ART } = groundCtx;

  return {
    drawFloor: () => drawFloor(groundCtx),
    SURFACE_ART,
    paintLayers: (artId: string, minX: number, minY: number, maxX: number, maxY: number) =>
      paintLayers(groundCtx, artId, minX, minY, maxX, maxY),
    artBase: (artId: string, fallback: string) => artBase(groundCtx, artId, fallback),
    drawZones: () => drawZones(groundCtx),
    PUDDLE_TINT,
    drawPatches: () => drawPatches(groundCtx),
    drawCovers: () => drawCovers(groundCtx),
    drawWear: (pass?: string) => drawWear(groundCtx, pass),
    drawBumps: () => drawBumps(groundCtx),
    drawRunoff: () => drawRunoff(groundCtx),
  };
}
