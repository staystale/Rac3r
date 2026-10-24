// MUD AND WATER (owner's M1, behind ?mudwater=1):
// - mud turns to thick mud only with water - damp ground (rain, a wet spell) or a puddle churned
//   into it (wear.ts WATER_MIX); dry passes still dig ruts (dig.ts DRY_MUD_DIG), never thicken it;
// - the LEVEL'S OWN mud and thick mud dry in the heat as worn mud does (puddles.ts dryMud): an
//   event's start gives every square of it a wear cell, so the one drying rule reaches it, and the
//   drying follows the water catch (coverfield.ts catchAt): the squares the rain covers first dry
//   last, so the mud dries back in patches, not all at once (and the tiles repaint a few squares a
//   tick, never a burst). Each piece of it (a pad, patch, lane, road stretch) watches its cells:
//   when all have dried a step the piece itself steps (thick mud -> mud -> dirt), which takes its
//   edge with it (a strip under 0.75 m wide holds no cell centre); a SPECK (no cell centre inside
//   it) dries on its own by the same rule at its centre. The pieces are put back at the next start.
// Endless (highway) levels are left out: their fields stream with the road.
import { LEVEL } from "./state.ts";
import { catchAt, WATER_SEED } from "./coverfield.ts";
import { getCell, groundSurfaceAt, WEAR_CELL } from "./wear.ts";
import { SURFACES, type SurfaceId } from "./surfaces.ts";
import type { Level, Surface, WearCell } from "./types.ts";

/** A box of the world to search for level mud, m. */
export type MudBox = { x0: number; y0: number; x1: number; y1: number };

let mudWater = false;

/**
 * One piece of the level's own mud (a zone, patch, lane or road sector): what it was built as,
 * the wear cells laid over it, its own drying (a piece with no cells: a speck) and its box.
 */
type MudSource = {
  holder: { surface: Surface }; was: Surface; cells: WearCell[]; dry: number; box: MudBox;
  x: number; y: number;
};
const sources: MudSource[] = [];

/** ?mudwater=1: mud needs water to thicken, the level's own mud dries (main.js). */
export function setMudWater(isOn: boolean): void {
  mudWater = isOn;
}

/** Whether ?mudwater=1 is on. */
export function mudWaterOn(): boolean {
  return mudWater;
}

// the surfaces the level's own ground can dry from
const isMud = (surface: Surface) => surface.id === 'mud' || surface.id === 'thickMud';

// margin round a box, m: a rounded pad's tarmac apron and a road's kerbs lie outside the shape
const BOX_MARGIN_M = 3;

/**
 * A box round a centre, m.
 * @param x centre x
 * @param y centre y
 * @param halfW half width
 * @param halfH half height
 * @returns the box
 */
function boxAround(x: number, y: number, halfW: number, halfH: number): MudBox {
  return {
    x0: x - halfW - BOX_MARGIN_M, y0: y - halfH - BOX_MARGIN_M,
    x1: x + halfW + BOX_MARGIN_M, y1: y + halfH + BOX_MARGIN_M,
  };
}

/**
 * The box round a run of points, widened by a half width, m.
 * @param points the points
 * @param halfWidth half the ribbon's width
 * @returns the box, or null for no points
 */
function boxOfPoints(points: { x: number; y: number }[], halfWidth: number): MudBox | null {
  if (!points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const reach = halfWidth + BOX_MARGIN_M;
  return { x0: minX - reach, y0: minY - reach, x1: maxX + reach, y1: maxY + reach };
}

/** A piece found: its holder and box, centred where its drying need is read. */
function pieceOf(holder: { surface: Surface }, box: MudBox): MudSource {
  return { holder, was: holder.surface, cells: [], dry: 0, box,
    x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
}

/**
 * The road's mud sectors (the sandbox's mud hairpin).
 * @param level the level
 * @returns the pieces
 */
function sectorPieces(level: Level): MudSource[] {
  const sub = level.subtrack;
  if (!sub) return [];
  const pieces: MudSource[] = [];
  for (const sector of sub.sectors) {
    if (!isMud(sector.surface)) continue;
    const run = sub.pts.filter((point) =>
      point.dist >= sector.startDist && point.dist <= sector.endDist);
    const box = boxOfPoints(run, sub.width / 2);
    if (box) pieces.push(pieceOf(sector, box));
  }
  return pieces;
}

/**
 * Every piece of the level's own mud or thick mud: zones, patches, lanes and the road's
 * sectors, each with a box round it (the caller checks each square inside).
 * @param level the level (default: the one loaded)
 * @returns the pieces; none on an endless level
 */
export function levelMudPieces(level: Level = LEVEL): MudSource[] {
  if (level.endless) return [];
  return zonePieces(level).concat(patchPieces(level), lanePieces(level), sectorPieces(level));
}

/**
 * The level's mud zones (pads, areas), each boxed round its turned corners.
 * @param level the level
 * @returns the pieces
 */
function zonePieces(level: Level): MudSource[] {
  const pieces: MudSource[] = [];
  for (const zone of level.zones) {
    if (!isMud(zone.surface)) continue;
    const half = zone.rot ? Math.hypot(zone.w, zone.h) / 2 : 0;
    pieces.push(pieceOf(zone, boxAround(zone.x, zone.y, half || zone.w / 2, half || zone.h / 2)));
  }
  return pieces;
}

/**
 * The level's mud patches (random spots, blends, inclusions).
 * @param level the level
 * @returns the pieces
 */
function patchPieces(level: Level): MudSource[] {
  const pieces: MudSource[] = [];
  for (const patch of level.allPatches || []) {
    if (!isMud(patch.surface)) continue;
    // patchAt: a square patch is w x h, a round one reaches out to w
    const half = patch.sq ? 0 : Math.max(patch.w, patch.h);
    pieces.push(pieceOf(patch,
      boxAround(patch.x, patch.y, half || patch.w / 2, half || patch.h / 2)));
  }
  return pieces;
}

/**
 * The level's mud lanes (none today; a lane of any surface may be one).
 * @param level the level
 * @returns the pieces
 */
function lanePieces(level: Level): MudSource[] {
  const pieces: MudSource[] = [];
  for (const lane of level.lanes || []) {
    const points = lane.pts.map(([x, y]) => ({ x, y }));
    const box = isMud(lane.surface) ? boxOfPoints(points, lane.width / 2) : null;
    if (box) pieces.push(pieceOf(lane, box));
  }
  return pieces;
}

/**
 * How much drying a mud square needs before it dries a step, 0.5..1.5 (1 = the worn-mud
 * pace): the squares that hold water longest (a low water catch) dry last.
 * @param x the square's centre x, m
 * @param y the square's centre y, m
 * @returns the drying needed
 */
export function mudDryNeed(x: number, y: number): number {
  return 1.5 - catchAt(x, y, WATER_SEED);
}

/**
 * Gives every square of the level's own mud in a piece's box a wear cell, and lists them on it.
 * @param piece the piece (its cells filled in)
 */
function seedPiece(piece: MudSource): void {
  const box = piece.box;
  const cellX1 = Math.floor(box.x1 / WEAR_CELL), cellY1 = Math.floor(box.y1 / WEAR_CELL);
  for (let cellY = Math.floor(box.y0 / WEAR_CELL); cellY <= cellY1; cellY++) {
    for (let cellX = Math.floor(box.x0 / WEAR_CELL); cellX <= cellX1; cellX++) {
      if (!isMud(groundSurfaceAt((cellX + 0.5) * WEAR_CELL, (cellY + 0.5) * WEAR_CELL))) continue;
      const cell = getCell(cellX, cellY);
      if (cell) piece.cells.push(cell);
    }
  }
}

/**
 * An event's start (wear.ts has just been cleared): the pieces dried last time are put back,
 * then under ?mudwater=1 the level's own mud gets its wear cells.
 * @returns the areas whose ground changed back (to repaint)
 */
export function seedLevelMud(): MudBox[] {
  const restored: MudBox[] = [];
  for (const piece of sources) {
    if (piece.holder.surface === piece.was) continue;
    piece.holder.surface = piece.was;
    restored.push(piece.box);
  }
  sources.length = 0;
  if (!mudWater) return restored;
  for (const piece of levelMudPieces()) {
    seedPiece(piece);
    sources.push(piece);
  }
  return restored;
}

/**
 * Whether a piece is ready to dry a step: its cells have all moved past its surface, or (a
 * speck) its own drying passed its need.
 * @param piece the piece (its own drying moved on)
 * @param dryBy the drying this tick
 * @returns true to step
 */
function pieceDries(piece: MudSource, dryBy: number): boolean {
  const surfaceId = piece.holder.surface.id;
  if (piece.cells.length) return piece.cells.every((cell) => cell.base !== surfaceId);
  piece.dry += dryBy;
  if (piece.dry < mudDryNeed(piece.x, piece.y)) return false;
  piece.dry = 0;
  return true;
}

/**
 * Dries the pieces a tick: each steps when its cells all have (or, a speck, by its own drying).
 * @param dryBy the drying this tick (puddles.ts dryMud's pace)
 * @param driesTo what each mud dries to (thick mud -> mud -> dirt)
 * @returns the areas whose ground changed (to repaint)
 */
export function dryLevelMud(dryBy: number, driesTo: Record<string, string>): MudBox[] {
  const changed: MudBox[] = [];
  for (const piece of sources) {
    const next = driesTo[piece.holder.surface.id];
    if (!next || !pieceDries(piece, dryBy)) continue;
    piece.holder.surface = SURFACES[next as SurfaceId];
    changed.push(piece.box);
  }
  return changed;
}
