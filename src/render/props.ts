// The PROPS layer of the renderer: the fence, the barriers and the trackside props, each prop
// kind dispatched to its painter in render/props/, with the overhead ones drawn above the cars.
import { PROPS } from '../world/state.ts';
import type { Prop } from '../world/types.ts';
import type { Cam, View } from './types.ts';
import type { PropCtx, PropDrawer, PropsHelpers } from './props/types.ts';
import { drawPropsFence, drawPropsBarriers } from './props/fence.ts';
import { drawStreetLights } from './props/lamps.ts';
import { drawBridge, drawFootbridge } from './props/bridges.ts';
import {
  drawGarageRow,
  drawGrandstand,
  drawOfficialBox,
  drawGantry,
  drawPitWall,
  drawPylon,
} from './props/buildings.ts';
import { drawGarages, drawTower, drawHangar } from './props/structures.ts';
import {
  drawPlane,
  drawWindsock,
  drawTruck,
  drawTree,
  drawRock,
  drawCrowd,
  drawMarshal,
  drawSculpture,
  drawBlock,
  drawChevron,
  drawBale,
  drawFlag,
  drawSlipCount,
  drawGate,
  drawSolarFarm,
  drawBoard,
} from './props/scenery.ts';

/** the drawer of each prop kind (a kind with no entry is only positioned) */
const PROP_DRAWERS: Record<string, PropDrawer> = {
  grandstand: drawGrandstand,
  stadium_grandstand: drawGrandstand,
  official_box: drawOfficialBox,
  gantry: drawGantry,
  pit_wall: drawPitWall,
  pylon: drawPylon,
  garages: drawGarages,
  tower: drawTower,
  hangar: drawHangar,
  plane: drawPlane,
  windsock: drawWindsock,
  truck: drawTruck,
  tree: drawTree,
  rock: drawRock,
  crowd: drawCrowd,
  marshal: drawMarshal,
  footbridge: drawFootbridge,
  sculpture: drawSculpture,
  block: drawBlock,
  chevron: drawChevron,
  bale: drawBale,
  flag: drawFlag,
  slipcount: drawSlipCount,
  gate: drawGate,
  solarfarm: drawSolarFarm,
  board: drawBoard,
  bridge: drawBridge,
  river: drawBridge,
};

// OVERHEAD props span the track ABOVE the cars and are drawn AFTER them. MEASURED BUG (user,
// "the gantry being below cars on the naffcar track"): every prop was drawn before
// the car, so cars drove OVER the start gantry.
const OVERHEAD = new Set(['gantry', 'footbridge', 'bridge']);
/**
 * Whether a prop is on screen, with a margin by the prop's own size.
 * @param view the canvas view
 * @param prop the prop
 * @param screenX the prop's screen x
 * @param screenY the prop's screen y
 * @param ppm pixels per metre
 * @returns true when the prop is worth drawing
 */
function propVisible(view: View, prop: Prop, screenX: number, screenY: number, ppm: number) {
  // margin by the prop's own size (a fixed 150 px let a 20 m hangar pop in at the screen edge)
  const margin = Math.max(
    150,
    Math.max(prop.w || 0, prop.h || 0, prop.size || 0, prop.wid || 0, 18) * ppm * 0.75,
    (prop.reach || 0) * ppm,
  );
  return !(
    screenX < -margin ||
    screenX > view.W + margin ||
    screenY < -margin ||
    screenY > view.H + margin
  );
}

// pr.w, h, seed, label, front, back and banner are optional on Prop, but every kind
// that reads them sets them (the ! below)
/**
 * Draws the props of one layer: the ones under the cars, or the OVERHEAD ones above them.
 * @param propCtx the view, camera and painter helpers
 * @param overhead true for the overhead layer
 */
function drawPropList(propCtx: PropCtx, overhead = false) {
  const { view, PPMz, toScreenX, toScreenY, drawSlip } = propCtx;
  const ppm = PPMz();
  // the street lights: standing heads hang above the cars, fallen posts lie under them
  drawStreetLights(propCtx, ppm, overhead);
  if (!PROPS || !PROPS.length) return;
  for (const prop of PROPS) {
    // a tree's canopy hangs over the cars too
    const isOver = OVERHEAD.has(prop.kind) || prop.kind === 'tree';
    if (isOver !== overhead) continue;
    if (prop.kind === 'garagerow') {
      drawGarageRow(propCtx, prop, ppm);
      continue;
    }
    if (prop.kind === 'slip') {
      drawSlip(prop, ppm);
      continue;
    }
    const screenX = toScreenX(prop.x),
      screenY = toScreenY(prop.y);
    if (!propVisible(view, prop, screenX, screenY, ppm)) continue;
    view.ctx.save();
    view.ctx.translate(screenX, screenY);
    if (prop.rot) view.ctx.rotate(prop.rot);

    const drawer = PROP_DRAWERS[prop.kind];
    if (drawer) drawer(propCtx, prop, ppm);
    view.ctx.restore();
  }
}

/**
 * Builds the props layer: the fence, the barriers and the trackside props.
 * @param view the canvas view
 * @param cam the camera
 * @param helpers the renderer, ground and road helpers the drawers use
 * @returns the drawFence, drawBarriers and drawProps painters
 */
export function createProps(view: View, cam: Cam, helpers: PropsHelpers) {
  const propCtx: PropCtx = { view, cam, ...helpers };
  return {
    drawFence: () => drawPropsFence(propCtx),
    drawBarriers: () => drawPropsBarriers(propCtx),
    drawProps: (overhead = false) => drawPropList(propCtx, overhead),
  };
}
