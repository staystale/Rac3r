// render/droplooks.ts - DROPS THAT READ AS DROPS (owner on round203, SPIKES PEAK; each look its own
// switch so each can be tested alone), per hill-shade cell (render/glshade.ts computeChunk: drawn
// over the ground with the hill shading, computed once per chunk - no work a frame):
//   (a) ?spikescree - ROCK AND SCREE on ground steeper than SCREE_SLOPE, by the surface under it:
//       grass and mud a dark broken rock, gravel and sand a pale scree;
//   (b) ?spikeshadow - a DROP SHADOW: ground below the road darkened by how far below it lies,
//       most just past the road's edge, fading over SHADOW_BAND_M - so a valley floor and a
//       cliff's foot read darkest;
//   (c) ?spikehaze - HEIGHT HAZE: ground far below the road drawn paler and bluer, more the deeper
//       (HAZE_FROM_M to HAZE_FULL_M below it).
// The road's height and the distance past its edge come from the level (Level.roadRiseAt:
// world/levels/spikes.ts). First numbers, Worker C's: here to change.
import { FIX } from '../core/fixes.ts';
import { LEVEL } from '../world/state.ts';
import { groundAt } from '../world/wear.ts';

// rise over run past which ground is rock / scree. MEASURED beside SPIKES PEAK's road (30000
// points within 60 m): median 0.12, 90 % under 0.41, 99 % under 1.07 - at a scree slope's own 0.75
// (37 deg) 2-5 % of the ground showed it; 0.4 (22 deg) shows ~10-13 %
const SCREE_SLOPE = 0.4;
// the rock looks, by the surface (RGB) and how strongly they cover it
const ROCK_DARK = [92, 86, 78], SCREE_PALE = [186, 178, 162], SCREE_ALPHA = 0.55;
// m below the road the drop shadow is fullest; m past the road's edge it fades over; its darkest
const SHADOW_DEPTH_M = 25, SHADOW_BAND_M = 60, SHADOW_ALPHA = 0.55;
const SHADOW_RGB = [18, 22, 34];
// m below the road the haze starts and is fullest; its colour and its fullest strength
const HAZE_FROM_M = 15, HAZE_FULL_M = 150, HAZE_RGB = [196, 214, 236], HAZE_ALPHA = 0.5;
// the surfaces that take the dark rock (the rest the pale scree)
const DARK_ROCK_ON = new Set(['grass', 'grassShort', 'grassLong', 'mud', 'thickMud']);
// m: the road's height and distance are read once per square this size and kept (a lookup a 0.5 m
// cell was ~1.1 ms a chunk); the most squares kept before they are let go
const ROAD_SQUARE_M = 2, ROAD_KEPT_MAX = 50000;
const ROAD_KEPT = new Map<number, { rise: number; outM: number } | null>();
let roadKeptFor: object | null = null;

/**
 * The nearest road's height and distance past its edge at a point, read once per ROAD_SQUARE_M
 * square (Level.roadRiseAt).
 * @param x world x, m
 * @param y world y, m
 * @returns the road, or null (none near)
 */
function roadNear(x: number, y: number) {
  if (roadKeptFor !== LEVEL || ROAD_KEPT.size > ROAD_KEPT_MAX) {
    ROAD_KEPT.clear();
    roadKeptFor = LEVEL;
  }
  const col = Math.floor(x / ROAD_SQUARE_M), row = Math.floor(y / ROAD_SQUARE_M),
    key = col * 1e6 + row;
  let road = ROAD_KEPT.get(key);
  if (road === undefined) {
    road = LEVEL.roadRiseAt!((col + 0.5) * ROAD_SQUARE_M, (row + 0.5) * ROAD_SQUARE_M);
    ROAD_KEPT.set(key, road);
  }
  return road;
}

/** Whether any drop look is on, on a level that can show them. */
export const dropLooksOn = () => !!LEVEL.roadRiseAt
  && (FIX.spikescree || FIX.spikeshadow || FIX.spikehaze);

/**
 * A cell's drop looks over its hill shade: the looks blended in turn over the shade's own
 * (premultiplied) colour.
 * @param base the cell's shade, premultiplied RGB 0..255 and its alpha 0..1 (changed in place)
 * @param slope the ground's rise over run at the cell
 * @param height the ground's height at the cell, m
 * @param x the cell centre, m
 * @param y the cell centre, m
 */
export function addDropLooks(base: number[], slope: number, height: number, x: number,
  y: number) {
  const road = FIX.spikeshadow || FIX.spikehaze ? roadNear(x, y) : null;
  if (FIX.spikescree && slope > SCREE_SLOPE) {
    const dark = DARK_ROCK_ON.has(groundAt(x, y).surface.id);
    blendOver(base, dark ? ROCK_DARK : SCREE_PALE, SCREE_ALPHA * Math.min(1, (slope - SCREE_SLOPE)
      / SCREE_SLOPE + 0.5));
  }
  if (!road || road.outM <= 0) return;
  const depth = road.rise - height;
  if (FIX.spikeshadow && depth > 0) {
    const deep = Math.min(1, depth / SHADOW_DEPTH_M), near = Math.max(0, 1 - road.outM
      / SHADOW_BAND_M);
    blendOver(base, SHADOW_RGB, SHADOW_ALPHA * deep * (0.4 + 0.6 * near));
  }
  if (FIX.spikehaze && depth > HAZE_FROM_M) {
    const far = Math.min(1, (depth - HAZE_FROM_M) / (HAZE_FULL_M - HAZE_FROM_M));
    blendOver(base, HAZE_RGB, HAZE_ALPHA * far);
  }
}

/**
 * Blends a colour over a premultiplied cell (in place).
 * @param base premultiplied RGB 0..255 and alpha 0..1
 * @param rgb the colour
 * @param alpha its strength, 0..1
 */
function blendOver(base: number[], rgb: number[], alpha: number) {
  if (!(alpha > 0)) return;
  for (let i = 0; i < 3; i++) base[i] = rgb[i] * alpha + base[i] * (1 - alpha);
  base[3] = alpha + base[3] * (1 - alpha);
}
