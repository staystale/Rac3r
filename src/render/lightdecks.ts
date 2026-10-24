// DECKS OVER THE LIGHT: the decks of the overhead props (a bridge over the motorway, a footbridge),
// drawn above the cars, which a car's light from below must not reach: a beam or lamp glow under a
// deck lights the road up to the deck's edge and on past it, never the deck's top (the night
// layer, render/light.ts, puts the dark back over them). Lamps hang above: their pools still
// light a deck. The start gantries are open trusses, so light passes them.
import { PROPS } from '../world/state.ts';
import { overheadDeck } from './props/bridges.ts';

// ?decklight=1: car light is kept off the decks
let isDeckLight = false;

/**
 * Turns the decks' cut on or off (?decklight=1).
 * @param isOn true to keep car light off the decks
 */
export function setDeckLight(isOn: boolean): void {
  isDeckLight = isOn;
}

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
 * @returns how many decks were added (0: none on the map, or the cut is off)
 */
export function traceDecks(ctx: CanvasRenderingContext2D, map: DeckMapping): number {
  if (!isDeckLight || !PROPS) return 0;
  let count = 0;
  for (const prop of PROPS) {
    const deck = overheadDeck(prop);
    if (!deck) continue;
    const centreX = map.artX(prop.x), centreY = map.artY(prop.y);
    if (!map.isNear(centreX, centreY, deck.halfLength * map.artPerMetre())) continue;
    const cos = Math.cos(prop.rot || 0), sin = Math.sin(prop.rot || 0);
    for (const [along, across] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const localX = along * deck.halfLength, localY = across * deck.halfWidth;
      const pointX = map.artX(prop.x + cos * localX - sin * localY);
      const pointY = map.artY(prop.y + sin * localX + cos * localY);
      if (along === -1 && across === -1) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
    count++;
  }
  return count;
}
