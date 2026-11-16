// render/torncut.ts - A PANEL TORN OFF AS A REAL ONE IS (owner 11-16: "the clean
// square panels missing looks cheap - and isn't how cars look - copy how real cars work"). A lost
// part's hole follows the panel's own outline, not its box: a wing's ARCH round its wheel (the rest
// of the wing stays), a bonnet's and boot lid's rounded corners, a door's shut lines. Its edge is
// TORN: teeth 0-3 px deep every 2 px, and on each edge a FLAP or two - a chunk of the panel 3-6 px
// long left on, 3-5 px deep. Two times in three a piece stays on, BENT OUT from where it hangs (the
// owner: "with the stronger hanging pieces"): half a bumper swung out past the car's end, a door
// hanging open on its hinge, a strip of the wing peeled out from the arch. The kept metal is the
// panel's own pixels, darkened with a fold every 2 px (the crumple's look, render/cardamage.ts).
// Seeded per car corner and part, so the same every frame; painted once with the lost-parts sprite
// (render/carparts.ts withoutParts), never per frame.
import type { Region } from './carparts.ts';

/** A lost part as the cut reads it: its kind, corner and place (sprite px, inclusive). */
export interface TornPart { kind: string; corner: number; region: Region }

// the kept metal's shade, a fold line and between (the dent band's look)
const FOLD_DARK = 0.6, FOLD_LIGHT = 0.8;
// px a hanging piece's free end is bent out from where it hangs
const BEND_PX = 5;
// the share of a bumper's width left hanging; of a door's length, hanging open
const BUMPER_HANG = 0.5, DOOR_HANG = 1;
// rad a door hangs open on its hinge
const DOOR_OPEN_RAD = 0.55;
// px: a tooth's depth range, a flap's length and depth ranges
const TOOTH_PX = 4, FLAP_LEN_MIN = 3, FLAP_LEN_SPAN = 4, FLAP_DEPTH_MIN = 3, FLAP_DEPTH_SPAN = 3;
// px a bonnet's or boot lid's hole's corners are rounded by
const LID_CORNER_PX = 4;

/**
 * A seeded 0..range-1 per (first, second).
 * @param first a number
 * @param second a number
 * @param range the count
 * @returns 0..range-1
 */
const tornHash = (first: number, second: number, range: number) =>
  (((first * 73856093) ^ (second * 19349663)) >>> 0) % range;

/** The part's seed: its kind and corner. */
const seedOf = (part: TornPart) => part.corner * 7 + part.kind.length * 131;

/**
 * Whether this part hangs on (two times in three; never a bonnet or boot lid).
 * @param part the lost part
 * @returns it hangs
 */
export const hangs = (part: TornPart) => part.kind !== 'bonnet' && part.kind !== 'boot'
  && tornHash(seedOf(part), 5, 3) !== 0;

/**
 * How deep the torn edge reaches into the hole at a place along one edge: a tooth, or a flap.
 * @param along px along the edge
 * @param seed the part's seed and which edge
 * @param span the edge's length, px
 * @returns px of metal kept in from the edge
 */
function edgeDepth(along: number, seed: number, span: number): number {
  const tooth = tornHash(along >> 1, seed, TOOTH_PX);
  // (a flap or two per edge, each at its own seeded place)
  for (let flap = 0; flap < 2; flap++) {
    const start = tornHash(seed, flap + 11, Math.max(1, span));
    const length = FLAP_LEN_MIN + tornHash(seed, flap + 17, FLAP_LEN_SPAN);
    if (along >= start && along < start + length)
      return Math.max(tooth, FLAP_DEPTH_MIN + tornHash(seed, flap + 23, FLAP_DEPTH_SPAN));
  }
  return tooth;
}

/**
 * Whether a wing's pixel stays: outside the arch round its wheel, or on the arch's torn edge.
 * @param region the wing's place
 * @param plus on the car's +y side
 * @param seed the part's seed
 * @param x sprite px
 * @param y sprite px
 * @returns keep it
 */
function keepWing(region: Region, plus: boolean, seed: number, x: number, y: number): boolean {
  const axle = (region.x0 + region.x1) / 2, halfL = (region.x1 - region.x0) / 2;
  const depth = region.y1 - region.y0, inward = plus ? region.y1 - y : y - region.y0;
  const reach = (x - axle) / halfL;
  const lip = edgeDepth(x - region.x0, seed, region.x1 - region.x0);
  return inward > depth * Math.sqrt(Math.max(0, 1 - reach * reach)) - lip;
}

/**
 * Whether a lost part's pixel stays as torn metal: outside the panel's own outline, or on its torn
 * edge.
 * @param part the lost part
 * @param x sprite px
 * @param y sprite px
 * @returns keep it
 */
export function keepTorn(part: TornPart, x: number, y: number): boolean {
  const { kind, corner, region } = part, seed = seedOf(part), front = corner < 2;
  if (kind === 'wing') return keepWing(region, corner % 2 === 1, seed, x, y);
  const fromX0 = x - region.x0, fromX1 = region.x1 - x, fromY0 = y - region.y0;
  const fromY1 = region.y1 - y, spanX = region.x1 - region.x0, spanY = region.y1 - region.y0;
  // (the depth kept in from each edge, by the place along it)
  const atY0 = edgeDepth(fromX0, seed + 1, spanX), atY1 = edgeDepth(fromX0, seed + 2, spanX);
  const atX0 = edgeDepth(fromY0, seed + 3, spanY), atX1 = edgeDepth(fromY0, seed + 4, spanY);
  // a bumper tears off its mounts: a ragged strip left at the car's end
  if (kind === 'bumper') return (front ? fromX1 : fromX0) < (front ? atX1 : atX0) - 1;
  // a door: its shut lines at both ends, ragged
  if (kind === 'panel') return fromX0 < 1 + atX0 || fromX1 < 1 + atX1;
  // a bonnet / boot lid: its rounded corners and a torn edge all round
  const cornerIn = Math.min(fromX0, fromX1) + Math.min(fromY0, fromY1);
  return cornerIn < LID_CORNER_PX || fromX0 < atX0 || fromX1 < atX1 || fromY0 < atY0
    || fromY1 < atY1;
}

/**
 * Darkens a kept pixel with the fold pattern.
 * @param rgba the pixels
 * @param index the pixel's index
 * @param along its place along the fold's run (px)
 */
export function foldPixel(rgba: Uint8ClampedArray, index: number, along: number): void {
  const shade = along % 2 === 0 ? FOLD_DARK : FOLD_LIGHT;
  rgba[index] *= shade;
  rgba[index + 1] *= shade;
  rgba[index + 2] *= shade;
}

/**
 * a lost part's pixel kept as torn metal, folded (render/carparts.ts lostPixel).
 * @param rgba the sprite's pixels
 * @param index the pixel's index
 * @param part the lost part
 * @param place the pixel, sprite px [x, y]
 * @returns it was kept (nothing more to do with it)
 */
export function tornPixel(rgba: Uint8ClampedArray, index: number, part: TornPart,
  place: number[]): boolean {
  const [x, y] = place;
  if (!rgba[index + 3] || !keepTorn(part, x, y)) return false;
  foldPixel(rgba, index, part.kind === 'bumper' ? y : x);
  return true;
}

/** The sprite's pixels: what is painted, what it was painted from, its size (canvas px). */
export interface Pixels { rgba: Uint8ClampedArray; from: Uint8ClampedArray; width: number;
  height: number }

/**
 * Copies one source pixel (the panel as it was) to a target, folded (canvas px, the 2 px margin
 * included).
 * @param pixels the sprite's pixels
 * @param source [x, y] the panel's pixel
 * @param target [x, y] where it now is
 * @param along its place along the fold's run
 */
function placeBent(pixels: Pixels, source: number[], target: number[], along: number): void {
  const { rgba, from, width, height } = pixels;
  const [toX, toY] = target.map(Math.round), [fromX, fromY] = source;
  if (toX < 0 || toY < 0 || toX >= width || toY >= height) return;
  const fromAt = (fromY * width + fromX) * 4, toAt = (toY * width + toX) * 4;
  if (!from[fromAt + 3]) return;
  for (let channel = 0; channel < 4; channel++) rgba[toAt + channel] = from[fromAt + channel];
  foldPixel(rgba, toAt, along);
}

/**
 * Half a bumper left hanging: hinged at its far half's inner edge, its free end swung out past the
 * car's end.
 * @param pixels the sprite's pixels
 * @param part the lost bumper
 */
function hangBumper(pixels: Pixels, part: TornPart): void {
  const { corner, region } = part, plus = corner % 2 === 1;
  const side = plus ? 1 : -1, end = corner < 2 ? 1 : -1;
  const width = region.y1 - region.y0 + 1, hang = Math.round(width * BUMPER_HANG);
  for (let row = 0; row < hang; row++) {
    const y = plus ? region.y1 - row : region.y0 + row, bend = BEND_PX * (1 - row / hang);
    for (let x = region.x0; x <= region.x1; x++)
      placeBent(pixels, [x + 2, y + 2], [x + 2 + end * bend, y + 2 + side * bend * 0.5], x);
  }
}

/**
 * A door hanging open on its front hinge: the door's outer edge swung out from the car.
 * @param pixels the sprite's pixels
 * @param part the lost door
 */
function hangDoor(pixels: Pixels, part: TornPart): void {
  const { corner, region } = part, plus = corner % 2 === 1, side = plus ? 1 : -1;
  const length = Math.round((region.x1 - region.x0 + 1) * DOOR_HANG);
  const hingeX = region.x1, edgeY = plus ? region.y1 : region.y0;
  for (let step = 0; step <= length; step++)
    for (let thick = 0; thick < 2; thick++) {
      const x = hingeX - Math.cos(DOOR_OPEN_RAD) * step;
      const y = edgeY + side * (Math.sin(DOOR_OPEN_RAD) * step + thick);
      placeBent(pixels, [hingeX - step + 2, edgeY - side * thick + 2], [x + 2, y + 2], step);
    }
}

/**
 * A strip of the wing at the arch's end peeled out sideways.
 * @param pixels the sprite's pixels
 * @param part the lost wing
 */
function hangWing(pixels: Pixels, part: TornPart): void {
  const { corner, region } = part, plus = corner % 2 === 1, side = plus ? 1 : -1;
  const fromX = corner < 2 ? region.x0 : region.x1 - 3;
  for (let x = fromX; x < fromX + 4; x++) for (let y = region.y0; y <= region.y1; y++) {
    const outward = plus ? y - region.y0 : region.y1 - y;
    const bend = BEND_PX * (outward / (region.y1 - region.y0 + 1));
    placeBent(pixels, [x + 2, y + 2], [x + 2, y + 2 + side * bend], y);
  }
}

/**
 * The piece a lost part leaves hanging, bent out (painted after the hole is cut).
 * @param pixels the sprite's pixels (from: the panel as it was)
 * @param part the lost part
 */
export function drawHanging(pixels: Pixels, part: TornPart): void {
  if (!hangs(part)) return;
  if (part.kind === 'bumper') hangBumper(pixels, part);
  else if (part.kind === 'panel') hangDoor(pixels, part);
  else if (part.kind === 'wing') hangWing(pixels, part);
}
