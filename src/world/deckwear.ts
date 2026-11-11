// world/deckwear.ts - A BRIDGE'S OR TUNNEL'S OWN GROUND (world/crossings.ts): its own wear cells -
// the same cells and rules as every other ground (world/wear.ts: water, oil, glass, tyre passes,
// drying, spreading, the grip they give) in the one wear map, but filed DECK_SHIFT_M along x for
// each crossing, far off any level, so a deck's never mix with the ground beneath it (owner 11-08:
// water "can drip up thru the tunnels"; it "should work like any other surface"). A car on a
// crossing reads and wears the cells at its place shifted so; what it lets go of lands there. They
// are drawn over the deck by the ground's own painter (render/ground/wear.ts drawDeckWear).
import { LEVEL } from "./state.ts";
import type { CarBody, Crossing, WearCell } from "./types.ts";

// m: crossing i's cells are filed (i + 1) times this far along x - a whole number of 1.5 m wear
// cells, past any level (the wear key holds 2^20 cells either side: room for ~50 crossings)
export const DECK_SHIFT_M = 30000;

/**
 * How far along x the ground of the crossing a car is on is filed (0 on the ground).
 * @param car the car
 * @returns m to add to its x for its wear cells
 */
export const deckShiftOf = (car: Pick<CarBody, 'crossing'>): number =>
  ((car.crossing ?? -1) + 1) * DECK_SHIFT_M;

/**
 * Whether a (filed) x is a crossing's ground, not the level's - only on a level with crossings
 * (the endless highway's road runs on for kilometres along x).
 * @param x world x as filed, m
 * @returns true on a crossing's ground
 */
export const isDeckX = (x: number): boolean => x > DECK_SHIFT_M / 2 && !!LEVEL.crossings?.length;

/**
 * The crossing whose ground a filed x is on.
 * @param x world x as filed, m
 * @returns its LEVEL.crossings index (-1 for the level's ground)
 */
export const deckIndexOfX = (x: number): number =>
  (isDeckX(x) ? Math.round(x / DECK_SHIFT_M) - 1 : -1);

/**
 * The crossing whose ground a filed x is on.
 * @param x world x as filed, m
 * @returns the crossing, or null
 */
export function deckOfX(x: number): Crossing | null {
  const index = deckIndexOfX(x);
  return index >= 0 && LEVEL.crossings ? LEVEL.crossings[index] || null : null;
}

// each crossing's wear cells, as they were made (drawn by render/ground/wear.ts drawDeckWear)
let deckCells: WearCell[][] = [];

/**
 * Notes a wear cell made on a crossing's ground.
 * @param cell the cell (its cx as filed)
 * @param x its x as filed, m
 */
export function noteDeckCell(cell: WearCell, x: number): void {
  const index = deckIndexOfX(x);
  if (index >= 0) (deckCells[index] || (deckCells[index] = [])).push(cell);
}

/**
 * A crossing's wear cells.
 * @param index its LEVEL.crossings index
 * @returns the cells (their cx as filed)
 */
export const deckCellsOf = (index: number): WearCell[] => deckCells[index] || [];

/**
 * Forgets one crossing's cells as drawn (its slot given to another bridge: highway/bridgeways.ts).
 * @param index its LEVEL.crossings index
 */
export function clearDeckCellsOf(index: number): void {
  deckCells[index] = [];
}

/** Forgets every crossing's cells (the wear map cleared: world/wear.ts clearWear). */
export function clearDeckCells(): void {
  deckCells = [];
}
