// A RALLY STAGE'S WEATHER SIDE (stagegen.js): what lies on a generated stage - the forest's water
// splash, the ice in the shade of alpine hairpins and on snow stages - and, WEATHER ONLY
// (?weatheronly=1; owner: no stage-drawn snow or ice, the weather lays it; a snow stage "might be
// road, might be track, might be dirt"), a snow stage's road drawn from its own seed (SNOW_ROADS,
// cumulative shares) on grass, with that road's character patches (SNOW_PATCH); its theme biases
// the weather instead (world/weather.ts). The road has its own random stream and the covers make
// the same draws either way, so the stage's layout and dressing are unchanged.
import { lcg } from '../core/random.ts';
import { isWeatherOnly } from './weather.ts';
import type { Cover, CoverId, TrackKit } from './types.ts';

const SNOW_ROADS: [string, number][] = [['tarmac', 0.4], ['gravel', 0.8], ['dirt', 1]];
const SNOW_PATCH: Record<string, string> = { tarmac: 'broken', gravel: 'dirt', dirt: 'gravel' };
// mixed into the seed: a stream apart from the layout's
const ROAD_STREAM = 0x2f6b9a41;
// a hairpin, for the alpine ice: a turn of more than this, radians
const HAIRPIN_TURN = 2;

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
 * COVERS: the forest's water splash, ice in the shade of alpine hairpins, ice patches on snow
 * stages. Weather only: the splash is scenery water (a ford: never dries, may freeze), the ice
 * is the weather's.
 * @param rand the stage's random source
 * @param theme the theme name
 * @param kit the track kit
 * @param corners the corners
 * @param straights the straights between corners, [start, end] road distances
 * @param finish the finish's road distance
 * @returns the covers
 */
export function buildStageCovers(rand: () => number, theme: string, kit: TrackKit,
    corners: Span[], straights: number[][], finish: number): Cover[] {
  const covers: Cover[] = [];
  const weatherOnly = isWeatherOnly();
  const coverAt = (dist: number, cover: CoverId, coverW: number, coverH: number) => {
    if (weatherOnly && cover === 'ice') return;
    const pos = kit.at(dist, 0);
    covers.push({ x: pos.x, y: pos.y, w: coverW, h: coverH, cover, shape: 'ellipse',
      rot: kit.rot(dist), ...(weatherOnly && cover === 'wet' ? { water: true } : {}) });
  };
  if (theme === 'forest' && straights.length) {
    const [segStart, segEnd] = straights[(rand() * straights.length) | 0];
    coverAt((segStart + segEnd) / 2 + 20, 'wet', 16, 13);
  }
  if (theme === 'alpine') {
    const hairpins = corners.filter((item) => Math.abs(stageTurnOf(kit, item)) > HAIRPIN_TURN);
    for (const corner of hairpins.slice(0, 3)) {
      coverAt((corner.startDist + corner.endDist) / 2, 'ice', 9, 7);
    }
  }
  if (theme === 'snow') {
    for (let patch = 0; patch < 4; patch++) coverAt(120 + rand() * (finish - 200), 'ice', 14, 8);
  }
  return covers;
}
