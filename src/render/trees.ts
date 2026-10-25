// TREES (?trees=1, world/treetrunks.ts; owner D): a tree is a canopy over a trunk. Only the
// TRUNK is solid (the cars clip under the canopy: world/treetrunks.ts); the canopy is drawn ABOVE
// the cars (props.ts's overhead layer) and blocks the light at night - no lamp, sign or headlight
// lights a canopy's top from below (render/light.ts puts the night's dark back over it). Each tree
// is a LEAFY tree or a FIR by its seed (desert scrub stays scrub). Leafy trees follow the season:
// fresh green in spring, deep green in summer, orange / red / gold in autumn, bare branches in
// winter (light passes through them); firs and scrub keep theirs. Snow settles on them from the
// weather (it snows, or the weather's snow lies), never from level art.
import { calendarAt, CLOCK } from '../world/clock.ts';
import { FIELD } from '../world/coverfield.ts';
import { WEATHER, weatherSeason } from '../world/weather.ts';
import type { Prop } from '../world/types.ts';

// the share of trees that are firs (by seed)
const FIR_SHARE = 0.4;
// snow lies on the trees while it snows this hard, or the weather's snow lies this deep
const SNOWING = 0.05, SNOW_LYING = 0.3;
const LEAFY_SPRING = ['#3f7a34', '#58963f', '#7cb553'];
const LEAFY_SUMMER = ['#2f5a2a', '#3d6e33', '#4f8240'];
const LEAFY_AUTUMN = [['#8a4a1c', '#b0662a', '#d08a3a'], ['#7a2e1e', '#9a3e26', '#b85a34'],
  ['#8a7a26', '#a8962e', '#c8b444']];
const FIR = ['#1f4a32', '#2a5c3e', '#3a704c'];
const SCRUB = [['#5b5a2e', '#6f6d38', '#8a8646'], ['#64552c', '#786a36', '#948548']];
const BARK = '#4a3a2c', SNOW = '#e8eef4';

/**
 * A tree's 0..1 share from its seed (stable per tree).
 * @param prop the tree
 * @param salt a different share per use
 * @returns the share
 */
function seedShare(prop: Prop, salt: number): number {
  const value = Math.sin(((prop.seed || 0) + salt) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The season the trees show: the event's (its weather's), else the game clock's.
 * @returns 0 winter .. 3 autumn
 */
function seasonNow(): number {
  return weatherSeason() ?? calendarAt(CLOCK.globalS).season;
}

/**
 * Whether snow lies on the trees now: it is snowing, or the weather's snow lies deep enough.
 * @returns true when snowy
 */
function isSnowy(): boolean {
  return WEATHER.snow > SNOWING || FIELD.snow > SNOW_LYING;
}

/**
 * What a tree is.
 * @param prop the tree
 * @returns scrub (desert), fir or leafy
 */
function kindOf(prop: Prop): 'scrub' | 'fir' | 'leafy' {
  if (prop.pal === 'dry') return 'scrub';
  return seedShare(prop, 1) < FIR_SHARE ? 'fir' : 'leafy';
}

/**
 * Whether a tree has bare branches now (a leafy tree in winter): light passes through it.
 * @param prop the tree
 * @returns true when bare
 */
export function isBare(prop: Prop): boolean {
  return kindOf(prop) === 'leafy' && seasonNow() === 0;
}

/**
 * A tree's three canopy shades now, dark to light.
 * @param prop the tree
 * @returns the colours
 */
function canopyColours(prop: Prop): string[] {
  const kind = kindOf(prop);
  if (kind === 'scrub') return SCRUB[seedShare(prop, 2) < 0.5 ? 0 : 1];
  if (kind === 'fir') return FIR;
  const season = seasonNow();
  if (season === 1) return LEAFY_SPRING;
  if (season === 3) return LEAFY_AUTUMN[Math.floor(seedShare(prop, 3) * LEAFY_AUTUMN.length)];
  return LEAFY_SUMMER;
}

/**
 * Draws a tree from overlapping squares (the pixel rule), centred on the context's origin: its
 * shadow, then its canopy (or, bare, its branches), snow on top when it lies.
 * @param ctx the canvas (origin at the tree)
 * @param prop the tree
 * @param size its canopy's side, px
 */
export function drawSeasonTree(ctx: CanvasRenderingContext2D, prop: Prop, size: number): void {
  const half = size / 2, snowy = isSnowy();
  const square = (offX: number, offY: number, side: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(-half + size * offX, -half + size * offY, size * side, size * side);
  };
  ctx.fillStyle = 'rgba(10,12,16,0.32)';
  ctx.fillRect(-half + 0.25 * size, -half + 0.35 * size, size, size);
  if (isBare(prop)) {
    square(0.42, 0.42, 0.16, BARK);
    for (const [offX, offY] of [[0.15, 0.2], [0.6, 0.18], [0.2, 0.62], [0.62, 0.6]]) {
      square(offX, offY, 0.12, snowy ? SNOW : BARK);
    }
    return;
  }
  const colours = canopyColours(prop);
  square(0, 0, 1, colours[0]);
  square(0.12, 0.1, 0.62, snowy ? SNOW : colours[1]);
  if (snowy) square(0.42, 0.42, 0.32, colours[1]);
  square(0.2, 0.18, 0.3, snowy ? '#ffffff' : colours[2]);
}

/**
 * Adds every leafy (not bare) or fir canopy near the light map to the context's path, as a
 * square each (render/light.ts puts the night's dark back over them).
 * @param ctx the light map's context (identity transform)
 * @param props the level's props
 * @param map the world-to-art-px mapping
 * @param map.artX world x to art px
 * @param map.artY world y to art px
 * @param map.artPerMetre art px a metre
 * @param map.isNear whether a point is on the map, with a reach
 * @returns how many canopies were added
 */
export function traceCanopies(ctx: CanvasRenderingContext2D, props: Prop[], map: {
  artX: (x: number) => number; artY: (y: number) => number; artPerMetre: () => number;
  isNear: (x: number, y: number, reach: number) => boolean; }): number {
  let count = 0;
  const scale = map.artPerMetre();
  for (const prop of props) {
    if (prop.kind !== 'tree' || isBare(prop)) continue;
    const side = (prop.s || 4) * scale, x = map.artX(prop.x), y = map.artY(prop.y);
    if (!map.isNear(x, y, side)) continue;
    ctx.rect(x - side / 2, y - side / 2, side, side);
    count++;
  }
  return count;
}
