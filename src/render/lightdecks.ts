// DECKS OVER THE LIGHT: the decks of the overhead props (a bridge over the motorway, a footbridge),
// drawn above the cars, which a car's light from below must not reach: a beam or lamp glow under a
// deck lights the road up to the deck's edge and on past it, never the deck's top (the night
// layer, render/light.ts, puts the dark back over them). Lamps hang above: their pools still
// light a deck. The start gantries are open trusses, so light passes them.
import { LEVEL, PROPS } from '../world/state.ts';
import { overheadDeck } from './props/bridges.ts';
import { FIX } from '../core/fixes.ts';
import { lampsLit } from '../world/lamps.ts';
import { drawPool } from './lamppools.ts';
import type { PoolPainter } from './lamppools.ts';
import type { Prop } from '../world/types.ts';

/** The light map's mapping from world metres to its art px, and its on-map test. */
export interface DeckMapping {
  artX: (worldX: number) => number;
  artY: (worldY: number) => number;
  artPerMetre: () => number;
  isNear: (x: number, y: number, reach: number) => boolean;
}

/**
 * Adds every deck on the light map to the context's current path, as a closed quad each.
 * @param ctx the light map's context (identity transform)
 * @param map the world-to-art-px mapping
 * @returns how many decks were added (0: none on the map)
 */
export function traceDecks(ctx: CanvasRenderingContext2D, map: DeckMapping): number {
  if (!PROPS) return 0;
  let count = 0;
  for (const prop of PROPS) {
    const deck = overheadDeck(prop);
    if (deck && traceQuad(ctx, map, prop, deck)) count++;
  }
  return count + (FIX.tunnellamps ? traceUnderground(ctx, map) : 0);
}

/**
 * Adds one prop's deck to the path as a closed quad, when it reaches the map: by its half length
 * (?tunnellamps: by its longer half - a slat 26 m across and 3.2 m along was left off whenever
 * its middle was off the map, so its dark came and went at the screen's edge).
 * @param ctx the light map's context (identity transform)
 * @param map the world-to-art-px mapping
 * @param prop the prop (its middle and turn)
 * @param deck its half length and half width, m
 * @returns true when added
 */
function traceQuad(ctx: CanvasRenderingContext2D, map: DeckMapping, prop: Prop,
  deck: { halfLength: number; halfWidth: number }): boolean {
  const centreX = map.artX(prop.x), centreY = map.artY(prop.y);
  const reach = FIX.tunnellamps ? Math.max(deck.halfLength, deck.halfWidth) : deck.halfLength;
  if (!map.isNear(centreX, centreY, reach * map.artPerMetre())) return false;
  const cos = Math.cos(prop.rot || 0), sin = Math.sin(prop.rot || 0);
  for (const [along, across] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const localX = along * deck.halfLength, localY = across * deck.halfWidth;
    const pointX = map.artX(prop.x + cos * localX - sin * localY);
    const pointY = map.artY(prop.y + sin * localX + cos * localY);
    if (along === -1 && across === -1) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.closePath();
  return true;
}

/**
 * ?tunnellamps: the night's dark put back over every tunnel cover - each slat, each straight
 * tunnel's underground stretch - last of all, after every light and tint (the street lights and
 * their heads hang above a bridge's deck, so the decks' order lets them light it; over a tunnel
 * nothing may show on top: owner 11-22 "they should only show in the tunnel / through the slats").
 * The cars' lamps, beams, indicators, hazards, police lights and the tunnel's own lamps all stay
 * in the gaps.
 * @param pools the light map and its mapping
 * @param darkFill the night's dark this frame
 */
export function darkenCovers(pools: PoolPainter, darkFill: string): void {
  if (!FIX.tunnellamps || !PROPS) return;
  const ctx = pools.lightCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  let count = traceUnderground(ctx, pools);
  for (const prop of PROPS) {
    if (prop.kind === 'slat' && traceQuad(ctx, pools, prop, { halfLength: prop.w! / 2,
      halfWidth: prop.h! / 2 })) count++;
  }
  if (!count) return;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = darkFill;
  ctx.fill();
}

/**
 * ?tunnellamps: adds each straight tunnel's underground stretch (lintel to lintel, wall face to
 * wall face) to the path, as a deck: the light of a car in it never reaches the ground above.
 * @param ctx the light map's context (identity transform)
 * @param map the world-to-art-px mapping
 * @returns how many were added
 */
function traceUnderground(ctx: CanvasRenderingContext2D, map: DeckMapping): number {
  let count = 0;
  for (const way of LEVEL.crossings || []) {
    if (way.kind !== 'tunnel' || way.hidden || way.length <= 2 * way.cut) continue;
    const corners = [[way.cut, way.minAcross], [way.length - way.cut, way.minAcross],
      [way.length - way.cut, way.maxAcross], [way.cut, way.maxAcross]];
    corners.forEach(([along, across], i) => {
      const pointX = map.artX(way.ax + way.dirX * along - way.dirY * across);
      const pointY = map.artY(way.ay + way.dirY * along + way.dirX * across);
      if (i) ctx.lineTo(pointX, pointY);
      else ctx.moveTo(pointX, pointY);
    });
    ctx.closePath();
    count++;
  }
  return count;
}

// ?tunnellamps: A SLATTED TUNNEL'S OWN LAMPS - a pool on its road in each gap between two slats
// (seen between them: the slats are a deck), its radius m and strength; the gap after a slat, m,
// where its prop does not give its pitch (Moanaco's: world/venuecross.ts SLAT_GAP_M)
const COVER_LAMP_M = 3, COVER_LAMP_ALPHA = 0.55, SLAT_GAP_M = 1.4;

/**
 * Rubs the tunnel's own lamps out of the dark under its cover (in the light map's rub-out blend,
 * with the ground's cars' light, before the dark is put back over the decks): lit from dusk, as
 * the street lights.
 * @param pools the light map and its mapping
 */
export function rubCoverLamps(pools: PoolPainter): void {
  if (!FIX.tunnellamps || !PROPS || !lampsLit()) return;
  const size = 2 * COVER_LAMP_M * pools.artPerMetre();
  pools.lightCtx.globalAlpha = COVER_LAMP_ALPHA;
  for (const prop of PROPS) {
    if (prop.kind !== 'slat') continue;
    const gap = prop.wid ? prop.wid - prop.w! : SLAT_GAP_M, ahead = prop.w! / 2 + gap / 2;
    const gapX = prop.x + Math.cos(prop.rot || 0) * ahead,
      gapY = prop.y + Math.sin(prop.rot || 0) * ahead;
    drawPool(pools, pools.pool, pools.artX(gapX), pools.artY(gapY), size);
  }
  pools.lightCtx.globalAlpha = 1;
}
