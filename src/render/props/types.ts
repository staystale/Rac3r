// The shared types of the props painters: the helpers, the per-frame context, the bridge
// geometry and the drawer signature.
import type { Prop } from '../../world/types.ts';
import type { Cam, ForSide, View } from '../types.ts';

// what createProps destructures from the renderer, the ground painter and the road painter
export interface PropsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  roundRect: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => void;
  forSide: ForSide;
  drawSlip: (prop: Prop, ppm: number) => void;
}

/** the view, camera and painter helpers every prop drawer reads */
export interface PropCtx extends PropsHelpers {
  view: View;
  cam: Cam;
}

/** what the bridge drawers share: the deck geometry, the wall clock and the painter */
export interface BridgeGeom {
  ppm: number;
  paint: (x: number, y: number, width: number, height: number, col: string) => void;
  half: number;
  seed: number;
  negEnd: number;
  posEnd: number;
  trackLen: number;
  clock: number;
  along: (speed: number, slot: number, gap: number, draw: (x: number) => void) => void;
  deckWid: number;
}

/** a prop drawer: paints one prop in its local frame (origin at the prop, rotated) */
export type PropDrawer = (propCtx: PropCtx, prop: Prop, ppm: number) => void;
