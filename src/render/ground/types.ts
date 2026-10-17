// The shared types of the ground painter: the renderer helpers, the context every
// painter receives and the visible world rectangle.
import type { Cam, ForSide, PrimFn, SurfaceArt, View } from "../types.ts";
import { createTextureCache } from "../textures.ts";
import type { BladeMasks } from "../textures.ts";

// what createGround destructures from the renderer (forSide: a wrapper over createRoad)
export interface GroundHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  roundRect: (
    ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
    radius: number
  ) => void;
  forSide: ForSide;
  grassEnds: 'round' | 'square';
  surfaceTextures: boolean;     // default on (?tex=0 = live): pre-painted textures (textures.ts)
  shareBlades: boolean;         // blades stroked once per shape (textures.ts); ?menufast=0 off
}

// what every module-level painter shares, built once by createGround
export interface GroundCtx extends GroundHelpers {
  view: View;
  cam: Cam;
  textures: ReturnType<typeof createTextureCache>;
  // the blade masks shared by the long-grass looks (with shareBlades), else null
  bladeMasks: BladeMasks | null;
  // how each surface is painted (see makeSurfaceArt)
  SURFACE_ART: Record<string, SurfaceArt | null>;
  // the pattern layer kinds (see makePrim)
  PRIM: Record<string, PrimFn>;
}

// the visible world rectangle, in metres
export interface ViewRect {
  vx0: number;
  vx1: number;
  vy0: number;
  vy1: number;
}
