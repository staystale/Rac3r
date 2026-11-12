// WHERE A TUNNEL LETS A CAR'S LIGHT FALL (the night layer's clips, render/light.ts): a car in a
// tunnel lights only its own cut - between its walls' faces and the open ground past its mouths,
// less what is hidden (a straight one's underground stretch, a bent one's slats) - clipToCut; a
// car outside a slatted (bent) tunnel - before its mouth, past it, beside its walls - lights none
// of its cover's slats, which stand over the tunnel road - clipOffCovers (a cover out of its
// light's reach costs one box test).
import { LEVEL } from '../world/state.ts';
import { crossingOf } from '../world/crossinggeo.ts';
import { lineBox, isBeyondBox } from '../world/venuegeo.ts';
import type { LineBox } from '../world/venuegeo.ts';
import type { Crossing, Point } from '../world/types.ts';
import type { RenderCar } from './types.ts';

/** How far a car's light reaches, m: from its centre (lightM), a headlight beam (beamM). */
export interface LightReach { lightM: number; beamM: number }

const COVER_BOXES = new WeakMap<Crossing, LineBox>();

/**
 * The box round a tunnel's cover: every slat's outline, cached per crossing.
 * @param way the tunnel (its hidden outlines)
 * @returns the box
 */
function coverBox(way: Crossing): LineBox {
  let box = COVER_BOXES.get(way);
  if (!box) {
    box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const outline of way.hidden || []) {
      const slat = lineBox(outline);
      box.minX = Math.min(box.minX, slat.minX);
      box.minY = Math.min(box.minY, slat.minY);
      box.maxX = Math.max(box.maxX, slat.maxX);
      box.maxY = Math.max(box.maxY, slat.maxY);
    }
    COVER_BOXES.set(way, box);
  }
  return box;
}

/**
 * Clips a light map off the slats of every slatted cover a car outside it could light. Saves the
 * context when it clips (the caller restores it).
 * @param ctx the light map's context (identity transform after)
 * @param car the car, not in a tunnel
 * @param toX world x to the map's px
 * @param toY world y to the map's px
 * @param reachM how far its light reaches from its centre, m
 * @returns true when it clipped
 */
export function clipOffCovers(ctx: CanvasRenderingContext2D, car: RenderCar,
  toX: (x: number) => number, toY: (y: number) => number, reachM: number): boolean {
  let isClipping = false;
  for (const way of LEVEL.crossings || []) {
    if (!way.hidden || isBeyondBox(coverBox(way), car.x, car.y, reachM)) continue;
    if (!isClipping) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      isClipping = true;
    }
    for (const outline of way.hidden) {
      outline.forEach(([x, y], i) => {
        if (i) ctx.lineTo(toX(x), toY(y));
        else ctx.moveTo(toX(x), toY(y));
      });
      ctx.closePath();
    }
  }
  // (the map less the slats: each slat's outline inside the map's rectangle)
  if (isClipping) ctx.clip('evenodd');
  return isClipping;
}

// m a tunnel's wall's line lies outside its face (world/crossings.ts WALL_HALF_M): a bent tunnel's
// walls are its only outline of the road
const WALL_LINE_M = 0.45;

/**
 * A car in a tunnel lights only its own open cut (owner: the light came through the portal's walls,
 * its lintel, the slats and the ground beyond): the light map clipped to the way between its walls'
 * faces (a straight one's and, past its mouths, the open ground a beam reaches), less
 * its hidden stretch - under the ground from lintel to lintel, or under a bent tunnel's slats.
 * Saves the context when it clips (the caller restores it).
 * @param ctx the light map's context (identity transform)
 * @param car the car
 * @param toX world x to the map's px
 * @param toY world y to the map's px
 * @param reach the light's reach: lightM from the car's centre, beamM a beam's, m
 * @returns true when it clipped
 */
export function clipToCut(ctx: CanvasRenderingContext2D, car: RenderCar,
  toX: (x: number) => number, toY: (y: number) => number, reach: LightReach): boolean {
  const way = crossingOf(car);
  // (a car outside a tunnel lights no slatted cover's slats)
  if (!way || way.kind !== 'tunnel') return clipOffCovers(ctx, car, toX, toY, reach.lightM);
  const point = ([x, y]: Point, first: boolean) => {
    if (first) ctx.moveTo(toX(x), toY(y));
    else ctx.lineTo(toX(x), toY(y));
  };
  const onWay = (along: number, across: number): Point => [way.ax + way.dirX * along - way.dirY
    * across, way.ay + way.dirY * along + way.dirX * across];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  if (way.hidden) {
    // (a bent tunnel: between its walls' faces, each wall point moved in toward the other's)
    const [left, right] = way.walls.map((wall) => wall.pts as Point[]);
    const face = (pts: Point[], other: Point[]) => pts.map(([x, y], i): Point => {
      const dx = other[i][0] - x, dy = other[i][1] - y, gap = Math.hypot(dx, dy) || 1;
      return [x + dx / gap * WALL_LINE_M, y + dy / gap * WALL_LINE_M];
    });
    const faces = [...face(left, right), ...face(right, left).reverse()];
    faces.forEach((pts, i) => point(pts, !i));
    ctx.closePath();
    // (the walls and, as a straight one's, the open ground past each mouth a beam reaches, wound
    // as the walls, clipped first - then the slats off that: in one even-odd path a slat's end out
    // past a wall was inside the slat and outside the walls, so it was lit)
    const wound = Math.sign(signedArea(faces));
    const ends = faces.length / 2, open = 2 * reach.beamM;
    traceMouthOpen(point, [faces[0], faces[faces.length - 1]],
      [faces[1], faces[faces.length - 2]], wound, open);
    traceMouthOpen(point, [faces[ends - 1], faces[ends]], [faces[ends - 2], faces[ends + 1]],
      wound, open);
    ctx.clip('nonzero');
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const outline of way.hidden) {
      outline.forEach((pts, i) => point(pts, !i));
      ctx.closePath();
    }
    ctx.clip('evenodd');
    return true;
  }
  // (a straight one, nonzero: the way between its walls and, past each mouth, the open ground a
  // beam reaches - wound one way - less its hidden stretch, wound the other)
  const open = 2 * reach.beamM;
  traceWayQuad(point, onWay, [0, way.length, way.minAcross, way.maxAcross], 1);
  traceWayQuad(point, onWay, [-open, 0, -open, open], 1);
  traceWayQuad(point, onWay, [way.length, way.length + open, -open, open], 1);
  traceWayQuad(point, onWay, [way.cut, way.length - way.cut, way.minAcross, way.maxAcross], -1);
  ctx.clip('nonzero');
  return true;
}

/**
 * Adds one quad of a way's frame to the path: m along from near to far, across from low to high
 * (left open: a clip closes every subpath).
 * @param point adds a world point to the path (moveTo for the first)
 * @param onWay a way's along / across, m, to the world point
 * @param span [near, far, low, high], m
 * @param wound 1 one way round, -1 the other (a nonzero clip: -1 cuts it out of a 1)
 */
function traceWayQuad(point: (at: Point, first: boolean) => void,
  onWay: (along: number, across: number) => Point, span: number[], wound: number) {
  const [near, far, low, high] = span;
  const corners: Point[] = [[near, low], [far, low], [far, high], [near, high]];
  (wound > 0 ? corners : corners.reverse()).forEach(([along, across], i) =>
    point(onWay(along, across), !i));
}

/**
 * Adds the open ground past a bent tunnel's mouth to the path: from the mouth's own line (its two
 * wall ends) out a beam's reach, as wide again each side - wound as the walls' outline, so a
 * nonzero clip joins them.
 * @param point adds a world point to the path (moveTo for the first)
 * @param mouth the two wall faces' end points
 * @param inner the two points before them (inside the tunnel)
 * @param wound the walls' outline's winding (sign of its area)
 * @param open m out from the mouth (and each side)
 */
function traceMouthOpen(point: (at: Point, first: boolean) => void, mouth: Point[],
  inner: Point[], wound: number, open: number) {
  const midX = (mouth[0][0] + mouth[1][0]) / 2, midY = (mouth[0][1] + mouth[1][1]) / 2;
  const lineX = mouth[1][0] - mouth[0][0], lineY = mouth[1][1] - mouth[0][1];
  const lineLength = Math.hypot(lineX, lineY) || 1;
  const sideX = lineX / lineLength, sideY = lineY / lineLength;
  // (outward: square to the mouth's line, away from the points inside)
  let outX = -sideY, outY = sideX;
  const inX = (inner[0][0] + inner[1][0]) / 2 - midX;
  const inY = (inner[0][1] + inner[1][1]) / 2 - midY;
  if (outX * inX + outY * inY > 0) [outX, outY] = [-outX, -outY];
  const corners: Point[] = [[-1, 0], [1, 0], [1, 1], [-1, 1]].map(([side, out]): Point => [
    midX + (sideX * side + outX * out) * open, midY + (sideY * side + outY * out) * open]);
  (Math.sign(signedArea(corners)) === wound ? corners : corners.reverse())
    .forEach((corner, i) => point(corner, !i));
}

/**
 * The signed area of an outline (its winding: positive one way round, negative the other), m2.
 * @param pts the outline
 * @returns the area
 */
function signedArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return area / 2;
}
