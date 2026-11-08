// render/ground/deckcovers.ts - A BRIDGE'S OR TUNNEL'S OIL, WATER AND GLASS (world/deckwear.ts)
// painted as the GPU field paints them on the ground (render/glfield.ts, its colours from
// render/coverlooks.ts): square by square of FIELD_SQ, the body with its diagonal sheen, a rim
// where the next square is bare, glass as pale specks. The field is drawn under everything, so a
// deck over the track needs its own painting of the same look.
import { FIELD_SQ } from "../../world/coverfield.ts";
import { WEAR_CELL } from "../../world/wear.ts";
import { GLASS_LOOK, OIL_LOOK, WATER_LOOK } from "../coverlooks.ts";
import type { WearCell } from "../../world/types.ts";
import type { GroundCtx } from "./types.ts";

// field squares to a wear cell's side
const SQUARES = Math.round(WEAR_CELL / FIELD_SQ);

/**
 * A look's colour for one square, as the field's shader makes it (thick: a tyre-made cover).
 * @param look the cover's look
 * @param rim the square's neighbour is bare
 * @param sheenAt the square's sheen weight, 0..1
 * @returns a CSS colour
 */
function squareColour(look: typeof OIL_LOOK, rim: boolean, sheenAt: number): string {
  const css = (rgb: number[], alpha: number) => `rgba(${Math.round(rgb[0] * 255)},`
    + `${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${alpha.toFixed(3)})`;
  if (rim) return css(look.rim, look.rim[3]);
  const mix = sheenAt * look.sheenShare;
  return css(look.body.map((value, i) => value + (look.sheen[i] - value) * mix),
    look.alpha + look.thickAlpha);
}

/**
 * Paints a crossing's oil, water and glass cells (their cx already at their real place) with the
 * GPU field's look.
 * @param groundCtx the shared ground painter context (drawing at the camera)
 * @param cells the cells whose cover is oil, water or glass
 */
export function paintDeckCovers(groundCtx: GroundCtx, cells: WearCell[]) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const coverAt = new Map<string, string>();
  for (const cell of cells) coverAt.set(`${cell.cx},${cell.cy}`, cell.cover!);
  // the cover of the square at (squareX, squareY), from its wear cell
  const squareCover = (squareX: number, squareY: number) =>
    coverAt.get(`${Math.floor(squareX / SQUARES)},${Math.floor(squareY / SQUARES)}`);
  for (const cell of cells) {
    for (let i = 0; i < SQUARES * SQUARES; i++) {
      const squareX = cell.cx * SQUARES + (i % SQUARES), squareY = cell.cy * SQUARES
        + Math.floor(i / SQUARES);
      const left = toScreenX(squareX * FIELD_SQ), top = toScreenY(squareY * FIELD_SQ);
      const size = toScreenX((squareX + 1) * FIELD_SQ) - left;
      if (cell.cover === 'glass') {
        paintGlass(view.ctx, squareX, squareY, left, top, size);
        continue;
      }
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
        squareCover(squareX + dx, squareY + dy) !== cell.cover);
      const streak = ((squareX + squareY) * 0.027) % 1 < 0.1 ? 1 : 0;
      const sheen = ((squareX + squareY) * 0.083) % 1 < 0.12 ? 1 : 0;
      view.ctx.fillStyle = cell.cover === 'oil'
        ? squareColour(OIL_LOOK, rim, Math.max(sheen, streak))
        : squareColour(WATER_LOOK, rim, sheen);
      view.ctx.fillRect(left, top, size, size);
    }
  }
}

/**
 * One square's glass specks: GLASS_LOOK.px to a side, on GLASS_LOOK.share of them (the field's
 * hash), pale.
 * @param ctx the canvas
 * @param squareX the square's column (world, FIELD_SQ)
 * @param squareY its row
 * @param left its screen left, px
 * @param top its screen top, px
 * @param size its side, px
 */
function paintGlass(ctx: CanvasRenderingContext2D, squareX: number, squareY: number, left: number,
  top: number, size: number) {
  const specks = GLASS_LOOK.px, speck = size / specks;
  ctx.fillStyle = `rgba(${GLASS_LOOK.pale.map((value) => Math.round(value * 255)).join(',')},0.6)`;
  for (let i = 0; i < specks * specks; i++) {
    const column = i % specks, row = Math.floor(i / specks);
    const speckX = squareX * specks + column, speckY = squareY * specks + row;
    let hash = (Math.imul(speckX, 73856093) ^ Math.imul(speckY, 19349663) ^ 3266489917) >>> 0;
    hash = (Math.imul(hash, 747796405) + 2891336453) >>> 0;
    hash = (hash ^ (hash >>> 16)) >>> 0;
    if ((hash & 1023) / 1023 >= GLASS_LOOK.share) continue;
    ctx.fillRect(left + column * speck, top + row * speck, Math.max(1, speck), Math.max(1, speck));
  }
}
