// A RALLY STAGE'S WEATHER SIDE (stagegen.js; owner: no stage-drawn snow or ice - the weather lays
// it; a snow stage "might be road, might be track, might be dirt"). Only the forest's ford lies on
// a stage, as scenery water. A snow stage's road is drawn from its own seed (SNOW_ROADS,
// cumulative shares) on grass, with that road's character patches (SNOW_PATCH); its theme biases
// the weather (world/weather.ts). The road has its own random stream and the stage's stream
// keeps the draws its old ice patches made, so every layout and its dressing stay as they were.
import { lcg } from '../core/random.ts';
import type { Cover, TrackKit } from './types.ts';

const SNOW_ROADS: [string, number][] = [['tarmac', 0.4], ['gravel', 0.8], ['dirt', 1]];
const SNOW_PATCH: Record<string, string> = { tarmac: 'broken', gravel: 'dirt', dirt: 'gravel' };
// mixed into the seed: a stream apart from the layout's
const ROAD_STREAM = 0x2f6b9a41;
// the stage stream's draws the old snow-stage ice patches made (kept: the dressing follows them)
const OLD_ICE_DRAWS = 4;

/** A stretch of a stage by road distance (a corner from autoKerbs). */
interface Span { startDist: number; endDist: number }

/**
 * A weather-only snow stage's road surface, from its seed.
 * @param seed the stage's seed
 * @returns tarmac, gravel or dirt
 */
export function snowRoadOf(seed: number): string {
  const roll = lcg(((seed ^ ROAD_STREAM) >>> 0) || 1)();
  return (SNOW_ROADS.find(([, upTo]) => roll < upTo) || SNOW_ROADS[0])[0];
}

/**
 * The character patches along a weather-only snow stage's road.
 * @param road the road surface id (snowRoadOf)
 * @returns the patches' surface id
 */
export function snowPatchOf(road: string): string {
  return SNOW_PATCH[road];
}

/**
 * The signed turn of a corner.
 * @param kit the track kit
 * @param corner the corner
 * @returns the turn, radians
 */
export function stageTurnOf(kit: TrackKit, corner: Span): number {
  const turn = kit.rot(corner.endDist) - kit.rot(corner.startDist);
  return Math.atan2(Math.sin(turn), Math.cos(turn));
}

/**
 * COVERS: the forest's water splash, scenery water (a ford: never dries, may freeze).
 * @param rand the stage's random source
 * @param theme the theme name
 * @param kit the track kit
 * @param straights the straights between corners, [start, end] road distances
 * @returns the covers
 */
export function buildStageCovers(rand: () => number, theme: string, kit: TrackKit,
    straights: number[][]): Cover[] {
  const covers: Cover[] = [];
  if (theme === 'forest' && straights.length) {
    const [segStart, segEnd] = straights[(rand() * straights.length) | 0];
    const dist = (segStart + segEnd) / 2 + 20, pos = kit.at(dist, 0);
    covers.push({ x: pos.x, y: pos.y, w: 16, h: 13, cover: 'wet', shape: 'ellipse',
      rot: kit.rot(dist), water: true });
  }
  if (theme === 'snow') for (let draw = 0; draw < OLD_ICE_DRAWS; draw++) rand();
  return covers;
}
