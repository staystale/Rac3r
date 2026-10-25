// EVENT GLOWS (?eventlights=1, world/eventlights.ts; the owner's picks 10-25): the lights the
// level's own props give off after dark, painted into the one night layer (render/light.ts) in
// its two passes - the rub-out (the dark wiped where the light is) and the tint (its colour).
//   boards        backlit: the board's face at full brightness, a faint neutral halo round it
//   marshal posts an orange beacon on the roof
//   grandstands   multi-coloured festoon bulbs along the edge facing the track
//   rally stages  multi-coloured fairy lights at the start, the finish and through villages
//   start gantry  a white light bar over the grid; the start lights glow red, then green
//   caravans      warm light spilling out round the sides (top-down: no windows to see)
//   pits          a warm lamp over each garage door / along the pit wall
// Only from dusk (the lamps' light sensor) and only what is near the screen.
import { lampsLit } from '../world/lamps.ts';
import { eventLightsOn } from '../world/eventlights.ts';
import { LEVEL, PROPS } from '../world/state.ts';
import { querySubtrack } from '../world/tyrewall.ts';
import { stageFairyLights } from '../world/lampplan.ts';
import { BOARD_H_M, BOARD_W_M } from './props/scenery.ts';
import type { Point, Prop } from '../world/types.ts';
import type { RenderCone, RenderGame } from './types.ts';

/** What the event glows paint with: the light map and its art-px mapping (light.ts). */
export interface EventPainter {
  lightCtx: CanvasRenderingContext2D;
  artX: (worldX: number) => number;
  artY: (worldY: number) => number;
  artPerMetre: () => number;
  isNear: (x: number, y: number, reach: number) => boolean;
}

// a board's backlight: the share of the dark wiped off the board, and a faint neutral halo round
// it (m, share; owner: the coloured 3 m spill lit nearby trees "weird" - a real sign barely spills)
const BOARD_LIT = 0.9, BOARD_SPILL_M = 1, BOARD_SPILL = 0.15;
// a marshal post's beacon: radius, m, brightness
const BEACON_M = 2.6, BEACON = 0.75;
// festoon bulbs: spacing along the stand's front edge, each glow's radius, m, brightness, and
// the colours they cycle through (owner: multiple colours)
const BULB_GAP_M = 1.6, BULB_M = 0.55, BULB = 0.55;
const BULB_COLOURS = ['255,70,60', '255,170,40', '255,230,90', '90,230,110', '80,160,255',
  '220,90,255'];
// the start gantry: the light bar's pool depth either side of the beam, m, and brightness; a
// start light's glow radius, m, and the seconds the green shows after the start
const BAR_DEPTH_M = 9, BAR = 0.55, START_GLOW_M = 3.2, GREEN_HOLD_S = 3, START_STEP_S = 1;
// a caravan's spill: half length and half width of the glow round it, m, and brightness
const CARAVAN_LONG_M = 4.5, CARAVAN_WIDE_M = 3, CARAVAN = 0.45;
// pit lamps: pool radius, m, brightness, and the spacing along a pit wall, m
const PIT_POOL_M = 6, PIT = 0.4, PIT_WALL_GAP_M = 22;
const WHITE = '255,255,255', AMBER = '255,150,40', WARM = '255,214,140', RED = '255,50,40',
  GREEN = '70,255,110';

const pictures = new Map<string, HTMLCanvasElement>();
const frontEdges = new WeakMap<Prop, Point[]>();

/**
 * A soft round glow of one colour, full in the middle, cached by colour.
 * @param rgb the colour, 'r,g,b'
 * @returns the picture (64 px)
 */
function glowPicture(rgb: string): HTMLCanvasElement {
  let picture = pictures.get(rgb);
  if (!picture) {
    picture = document.createElement('canvas');
    picture.width = picture.height = 64;
    const ctx = picture.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(0.45, `rgba(${rgb},0.45)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    pictures.set(rgb, picture);
  }
  return picture;
}

/**
 * One glow at a world point: white in the rub-out pass, its colour in the tint pass.
 * @param painter the light map
 * @param isTint the tint pass
 * @param x world x, m
 * @param y world y, m
 * @param radiusM its radius, m (an ellipse: radiusM along rot, wideM across)
 * @param rgb its colour
 * @param level its brightness, 0..1
 * @param shape the ellipse's other radius, m, and its direction, radians
 * @param shape.wideM the radius across
 * @param shape.rot the direction of radiusM
 */
function glow(painter: EventPainter, isTint: boolean, x: number, y: number, radiusM: number,
    rgb: string, level: number, shape: { wideM?: number; rot?: number } = {}): void {
  const { lightCtx, artPerMetre } = painter, scale = artPerMetre();
  const artPx = painter.artX(x), artPy = painter.artY(y), long = radiusM * scale;
  if (!painter.isNear(artPx, artPy, long)) return;
  const wide = (shape.wideM ?? radiusM) * scale, rot = shape.rot || 0;
  lightCtx.globalAlpha = level;
  lightCtx.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), artPx, artPy);
  lightCtx.drawImage(glowPicture(isTint ? rgb : WHITE), -long, -wide, 2 * long, 2 * wide);
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * A backlit board: the board's face shows at full brightness in its own colours (rub-out), with
 * a faint neutral halo just round it.
 * @param painter the light map
 * @param isTint the tint pass
 * @param prop the board
 */
function boardLight(painter: EventPainter, isTint: boolean, prop: Prop): void {
  const rot = prop.rot || 0;
  glow(painter, isTint, prop.x, prop.y, BOARD_W_M / 2 + BOARD_SPILL_M, WHITE, BOARD_SPILL,
    { wideM: BOARD_H_M / 2 + BOARD_SPILL_M, rot });
  if (isTint) return;
  const { lightCtx, artPerMetre } = painter, scale = artPerMetre();
  const artPx = painter.artX(prop.x), artPy = painter.artY(prop.y);
  if (!painter.isNear(artPx, artPy, BOARD_W_M * scale)) return;
  lightCtx.globalAlpha = BOARD_LIT;
  lightCtx.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), artPx, artPy);
  lightCtx.fillStyle = '#fff';
  lightCtx.fillRect(-BOARD_W_M * scale / 2, -BOARD_H_M * scale / 2, BOARD_W_M * scale,
    BOARD_H_M * scale);
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * A grandstand's front edge (the long side nearer the track), as two world points; worked out
 * once per stand.
 * @param prop the grandstand
 * @returns the edge's ends
 */
function frontEdge(prop: Prop): Point[] {
  let edge = frontEdges.get(prop);
  if (!edge) {
    const rot = prop.rot || 0, cos = Math.cos(rot), sin = Math.sin(rot);
    const halfW = (prop.w || 36) / 2, halfH = (prop.h || 7.5) / 2;
    const pointAt = (along: number, across: number): Point =>
      [prop.x + cos * along - sin * across, prop.y + sin * along + cos * across];
    const sides = [halfH, -halfH].map((across) =>
      [pointAt(-halfW, across), pointAt(halfW, across)]);
    const gapOf = (side: Point[]) => {
      if (!LEVEL.subtrack) return 0;
      const mid: Point = [(side[0][0] + side[1][0]) / 2, (side[0][1] + side[1][1]) / 2];
      return querySubtrack(LEVEL.subtrack, mid[0], mid[1]).dist;
    };
    edge = gapOf(sides[0]) <= gapOf(sides[1]) ? sides[0] : sides[1];
    frontEdges.set(prop, edge);
  }
  return edge;
}

/**
 * Festoon bulbs along a string from one end to the other, cycling through the colours (a
 * grandstand's front edge, a rally stage's fairy lights).
 * @param painter the light map
 * @param isTint the tint pass
 * @param ends the string's two ends
 */
function festoon(painter: EventPainter, isTint: boolean, ends: Point[]): void {
  const [[fromX, fromY], [toX, toY]] = ends, length = Math.hypot(toX - fromX, toY - fromY);
  const reach = (length / 2 + 2) * painter.artPerMetre();
  if (!painter.isNear(painter.artX((fromX + toX) / 2), painter.artY((fromY + toY) / 2), reach)) {
    return;
  }
  const count = Math.max(2, Math.round(length / BULB_GAP_M));
  for (let i = 0; i <= count; i++) {
    const share = i / count;
    glow(painter, isTint, fromX + (toX - fromX) * share, fromY + (toY - fromY) * share, BULB_M,
      BULB_COLOURS[i % BULB_COLOURS.length], BULB);
  }
}

/**
 * A fairy-light string whose bulbs are already placed (world/lampplan.ts: following the road
 * edge), cycling through the colours.
 * @param painter the light map
 * @param isTint the tint pass
 * @param bulbs the bulbs' places
 */
function fairyString(painter: EventPainter, isTint: boolean, bulbs: Point[]): void {
  if (!bulbs.length) return;
  const [firstX, firstY] = bulbs[0], [lastX, lastY] = bulbs[bulbs.length - 1];
  const reach = (Math.hypot(lastX - firstX, lastY - firstY) / 2 + 6) * painter.artPerMetre();
  if (!painter.isNear(painter.artX((firstX + lastX) / 2), painter.artY((firstY + lastY) / 2),
    reach)) return;
  bulbs.forEach(([x, y], i) => glow(painter, isTint, x, y, BULB_M,
    BULB_COLOURS[i % BULB_COLOURS.length], BULB));
}

/**
 * The start gantry: a white light bar over the grid, and its start lights glowing - reds one a
 * second while the start is held, then all green for a few seconds.
 * @param painter the light map
 * @param isTint the tint pass
 * @param prop the gantry
 * @param game the game (its start)
 */
function gantryLights(painter: EventPainter, isTint: boolean, prop: Prop, game: RenderGame) {
  const rot = prop.rot || 0, width = prop.wid || 26;
  glow(painter, isTint, prop.x, prop.y, width / 2 + 2, WHITE, BAR,
    { wideM: BAR_DEPTH_M, rot });
  const start = game.start;
  if (!start || !start.on || LEVEL.endless) return;
  const sinceGreen = start.t - start.tGreen;
  const isGreen = start.green && sinceGreen < GREEN_HOLD_S;
  const reds = start.green ? 0 : Math.min(3, Math.floor(start.t / START_STEP_S));
  if (!isGreen && !reds) return;
  const cos = Math.cos(rot), sin = Math.sin(rot), spacing = width / 8;
  const pods = isGreen ? [-2, -1, 0, 1, 2] : [-1, 0, 1].slice(0, reds);
  for (const pod of pods) {
    glow(painter, isTint, prop.x + cos * pod * spacing, prop.y + sin * pod * spacing,
      START_GLOW_M, isGreen ? GREEN : RED, 0.9);
  }
}

/**
 * Pit lamps: one over each garage door of a garage row (between its front points), or along a
 * pit wall.
 * @param painter the light map
 * @param isTint the tint pass
 * @param prop the garage row or pit wall
 */
function pitLamps(painter: EventPainter, isTint: boolean, prop: Prop): void {
  if (prop.kind === 'garagerow' && prop.front) {
    for (let i = 0; i + 1 < prop.front.length; i++) {
      const [fromX, fromY] = prop.front[i], [nextX, nextY] = prop.front[i + 1];
      glow(painter, isTint, (fromX + nextX) / 2, (fromY + nextY) / 2, PIT_POOL_M, WARM, PIT);
    }
    return;
  }
  const length = prop.len || 220, rot = prop.rot || 0;
  for (let along = -length / 2 + PIT_WALL_GAP_M / 2; along < length / 2; along += PIT_WALL_GAP_M) {
    glow(painter, isTint, prop.x + Math.cos(rot) * along, prop.y + Math.sin(rot) * along,
      PIT_POOL_M, WARM, PIT);
  }
}

/**
 * The level's props' lights.
 * @param painter the light map
 * @param isTint the tint pass
 * @param game the game drawn
 */
function propLights(painter: EventPainter, isTint: boolean, game: RenderGame): void {
  for (const prop of PROPS || []) {
    const kind = prop.kind;
    if (kind === 'board') boardLight(painter, isTint, prop);
    else if (kind === 'marshal') glow(painter, isTint, prop.x, prop.y, BEACON_M, AMBER, BEACON);
    else if (kind === 'grandstand' || kind === 'stadium_grandstand') {
      festoon(painter, isTint, frontEdge(prop));
    }
    else if (kind === 'gantry') gantryLights(painter, isTint, prop, game);
    else if (kind === 'garagerow' || kind === 'pit_wall') pitLamps(painter, isTint, prop);
  }
}

/**
 * Light spilling round the caravans (loose objects: it follows them where they are pushed).
 * @param painter the light map
 * @param isTint the tint pass
 * @param cones the loose objects
 */
function caravanLights(painter: EventPainter, isTint: boolean, cones: RenderCone[]): void {
  for (const cone of cones) {
    if (cone.kind !== 'caravan') continue;
    glow(painter, isTint, cone.x, cone.y, CARAVAN_LONG_M, WARM, CARAVAN,
      { wideM: CARAVAN_WIDE_M, rot: cone.ang || 0 });
  }
}

/**
 * Paints the event lights into the night layer, in its rub-out or its tint pass (from dusk;
 * ?eventlights=1).
 * @param painter the light map
 * @param isTint the tint pass
 * @param game the game drawn
 */
export function drawEventGlows(painter: EventPainter, isTint: boolean, game: RenderGame): void {
  if (!eventLightsOn() || !lampsLit()) return;
  propLights(painter, isTint, game);
  for (const bulbs of stageFairyLights(LEVEL)) fairyString(painter, isTint, bulbs);
  caravanLights(painter, isTint, game.cones.list);
  painter.lightCtx.globalAlpha = 1;
}
