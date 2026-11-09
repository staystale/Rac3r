// world/venueoval.ts - A SPEEDWAY'S OWN PARTS (world/venuescenery.ts builds the rest; Dieatona's):
// the concrete wall round the oval's outside right at its edge, the lakes in the infield as
// scenery water, and the patterns mown into the infield grass.
import { alongTrack, smoothOnTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { HALF_ROAD, centreAt, nearestLoop } from "./venuegeo.ts";
import { querySubtrack } from "./tyrewall.ts";
import { pastRim } from "./venueedge.ts";
import { onLanes, placeAll } from "./venuesite.ts";
import { insidePolygon } from "./zones.ts";
import type { Site } from "./venuesite.ts";
import type { Barrier, Cover, Patch, Point } from "./types.ts";

// a lake is laid in LAKE_SLICES slices along its long axis, each LAKE_SLICE_MIN_M..LAKE_SLICE_MAX_M
// m (game) wide (a pond's curved shore in fine steps) and a turned rectangle LAKE_SEAM_M wider so
// they meet with no seam (rectangles: overlapping ellipses scalloped a long straight shore); a
// stretch of water under LAKE_MIN_M across is left out (a lake's tip: a stray line of water)
const LAKE_SLICES = 40, LAKE_SLICE_MIN_M = 0.75, LAKE_SLICE_MAX_M = 2, LAKE_SEAM_M = 0.5;
const LAKE_MIN_M = 1;
// m a lake keeps from the edge's rim and from a road (its shore never on the tarmac), and the
// step a slice that meets one is tested in for its open water
const LAKE_CLEAR_M = 2, LAKE_STEP_M = 1;

/**
 * The oval's outside wall (spec.ovalWall): one closed barrier gapM past the outer edge of the
 * layout it names, all the way round (the real speedway's wall, a SAFER barrier on concrete).
 * @param site the venue's builders' state
 * @returns the wall, or null with none asked for
 */
export function ovalWall(site: Site): Barrier | null {
  const wall = site.build.spec.ovalWall, sub = wall && site.build.loops[wall.layout];
  if (!wall || !sub) return null;
  // which side is outside: the +normal side's point beyond the road lies outside the loop's outline
  const outline = sub.pts.map((point): Point => [point.x, point.y]);
  const probe = smoothOnTrack(sub, 0, 30);
  const side = insidePolygon(outline, probe.x, probe.y) ? -1 : 1;
  // held gapM off every layout's road (the road course's trace of the shared banking wanders a
  // metre from the oval's)
  const loops = Object.values(site.build.loops), offset = side * (HALF_ROAD + wall.gapM);
  const pts = alongTrack(sub, 0, sub.totalDist, offset, 2).map(([x, y]): Point => {
    const { hit } = nearestLoop(loops, x, y);
    const short = HALF_ROAD + wall.gapM - hit.dist;
    if (!(short > 0)) return [x, y];
    const centre = centreAt(sub, querySubtrack(sub, x, y).trackDist);
    return [x + centre.nx * side * short, y + centre.ny * side * short];
  });
  return { kind: wall.kind, pts };
}

/**
 * The lakes (data.water) as scenery water: each laid in slices across its long axis, a rectangle
 * over each stretch of open water the slice crosses, the rectangles meeting in one shore; none on
 * a road or inside the edge's rim (a road along the shore trims the water back, one across it
 * splits it).
 * @param site the venue's builders' state
 * @returns the covers
 */
export function venueWater(site: Site): Cover[] {
  return (site.build.spec.data.water || []).flatMap((lake) => layLake(placeAll(site, lake.pts),
    lakeShoreDry(site, placeAll(site, lake.pts))));
}

/**
 * One lake's covers: its slices across its long axis (the widest pair of its points' direction),
 * a rectangle over each run of open water a slice crosses.
 * @param pts the lake's outline (world m)
 * @param dry true where the water may not lie (lakeShoreDry)
 * @returns the covers
 */
function layLake(pts: Point[], dry: (x: number, y: number) => boolean): Cover[] {
  let best = 0, axis = 0;
  for (const [fromX, fromY] of pts) for (const [toX, toY] of pts) {
    const span = Math.hypot(toX - fromX, toY - fromY);
    if (span > best) [best, axis] = [span, Math.atan2(toY - fromY, toX - fromX)];
  }
  const cosA = Math.cos(axis), sinA = Math.sin(axis), covers: Cover[] = [];
  const local = pts.map(([x, y]): Point => [x * cosA + y * sinA, -x * sinA + y * cosA]);
  const alongs = local.map(([along]) => along);
  const slice = Math.min(LAKE_SLICE_MAX_M, Math.max(LAKE_SLICE_MIN_M, best / LAKE_SLICES));
  for (let along = Math.min(...alongs) + slice / 2; along < Math.max(...alongs); along += slice) {
    // where the slice line crosses the shore, paired into stretches of water
    const crossings: number[] = [];
    for (let i = 0; i < local.length; i++) {
      const [fromU, fromV] = local[i], [toU, toV] = local[(i + 1) % local.length];
      if ((fromU - along) * (toU - along) < 0)
        crossings.push(fromV + (toV - fromV) * (along - fromU) / (toU - fromU));
    }
    crossings.sort((first, second) => first - second);
    const toWorld = (across: number): Point =>
      [along * cosA - across * sinA, along * sinA + across * cosA];
    for (let pair = 0; pair + 1 < crossings.length; pair += 2)
      for (const [from, until] of openWater(crossings[pair], crossings[pair + 1], toWorld, dry)) {
        const [x, y] = toWorld((from + until) / 2);
        covers.push({ x, y, w: slice + LAKE_SEAM_M, h: until - from, cover: 'wet', water: true,
          shape: 'rect', rot: axis });
      }
  }
  return covers;
}

/**
 * Where a lake's water may not lie: within LAKE_CLEAR_M of the edge's rim or of a road. Only the
 * roads reaching the lake's box are tested, and the rim only when a point of its shore comes
 * near it (a shore point's own reach: half the shore's longest side).
 * @param site the venue's builders' state
 * @param pts the lake's outline (world m)
 * @returns true where dry
 */
function lakeShoreDry(site: Site, pts: Point[]): (x: number, y: number) => boolean {
  const allX = pts.map(([x]) => x), allY = pts.map(([, y]) => y);
  const [left, right] = [Math.min(...allX), Math.max(...allX)];
  const [top, bottom] = [Math.min(...allY), Math.max(...allY)];
  // (a lane is kept when any of its segments' boxes reaches the lake's)
  const lanes = site.lanes.filter((lane) => {
    const reach = lane.width / 2 + LAKE_CLEAR_M;
    return lane.pts.slice(1).some(([toX, toY], i) => {
      const [fromX, fromY] = lane.pts[i];
      return Math.max(fromX, toX) > left - reach && Math.min(fromX, toX) < right + reach
        && Math.max(fromY, toY) > top - reach && Math.min(fromY, toY) < bottom + reach;
    });
  });
  const side = Math.max(...pts.map(([x, y], i) => {
    const [toX, toY] = pts[(i + 1) % pts.length];
    return Math.hypot(toX - x, toY - y);
  }));
  const nearRim = pts.some(([x, y]) => pastRim(site.rims, x, y) < LAKE_CLEAR_M + side / 2);
  return (x, y) => (nearRim && pastRim(site.rims, x, y) < LAKE_CLEAR_M)
    || onLanes(lanes, x, y, LAKE_CLEAR_M);
}

/**
 * The open water of one stretch of a lake's slice: all of it when its ends, quarters and middle
 * are wet (most), else each wet run of it, tested every LAKE_STEP_M.
 * @param low the stretch's one end, m across the lake's axis
 * @param high its other end
 * @param toWorld the world point of a distance across
 * @param dry true where the water may not lie
 * @returns the runs of open water, [from, until] across
 */
function openWater(low: number, high: number, toWorld: (across: number) => Point,
  dry: (x: number, y: number) => boolean): [number, number][] {
  const wet = (across: number) => !dry(...toWorld(across));
  if (high - low < LAKE_MIN_M) return [];
  if ([0, 0.25, 0.5, 0.75, 1].every((frac) => wet(low + (high - low) * frac))) return [[low, high]];
  const runs: [number, number][] = [];
  let runFrom: number | null = null, lastWet = low;
  for (let across = low; across < high + LAKE_STEP_M; across += LAKE_STEP_M) {
    const here = Math.min(across, high);
    if (wet(here)) {
      if (runFrom === null) runFrom = here;
      lastWet = here;
    } else if (runFrom !== null) {
      runs.push([runFrom, lastWet]);
      runFrom = null;
    }
  }
  if (runFrom !== null) runs.push([runFrom, lastWet]);
  return runs.filter(([from, until]) => until - from >= Math.max(LAKE_MIN_M, 2 * LAKE_STEP_M));
}

/**
 * Whether a point lies within pad of a scenery water cover (a tree keeps its trunk out of a lake).
 * @param covers the level's covers
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when on or that near water
 */
export function nearWater(covers: Cover[], x: number, y: number, pad: number): boolean {
  return covers.some((cover) => {
    const reach = (cover.w + cover.h) / 2 + pad, offX = x - cover.x, offY = y - cover.y;
    if (!cover.water || Math.abs(offX) > reach || Math.abs(offY) > reach) return false;
    const cosR = Math.cos(cover.rot || 0), sinR = Math.sin(cover.rot || 0);
    const along = Math.abs(offX * cosR + offY * sinR);
    const across = Math.abs(-offX * sinR + offY * cosR);
    const halfW = cover.w / 2 + pad, halfH = cover.h / 2 + pad;
    return cover.shape === 'ellipse' ? (along / halfW) ** 2 + (across / halfH) ** 2 <= 1
      : along <= halfW && across <= halfH;
  });
}

/**
 * The patterns mown into the grass (spec.mown) as ground patches of short grass, one square-edged
 * patch per run of '#' along a row (patches, not zones: a zone's edge is blended into the grass
 * round it, a few metres each way, and a pattern's small parts were lost in it).
 * @param site the venue's builders' state
 * @returns the patches
 */
export function venueMown(site: Site): Patch[] {
  const patches: Patch[] = [];
  for (const art of site.build.spec.mown || []) {
    const [midX, midY] = site.place(art.at), wide = Math.max(...art.rows.map((row) => row.length));
    art.rows.forEach((row, line) => {
      for (const run of row.matchAll(/#+/g)) {
        const from = run.index, cells = run[0].length;
        patches.push({ x: midX + (from + cells / 2 - wide / 2) * art.pxM,
          y: midY + (line + 0.5 - art.rows.length / 2) * art.pxM, w: cells * art.pxM, h: art.pxM,
          sq: true, surface: SURFACES.grassShort });
      }
    });
  }
  return patches;
}

/**
 * Whether a point lies within pad of a mown pattern's patch (a tree keeps off it).
 * @param patches the patches
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when on or that near one
 */
export function onPatches(patches: Patch[], x: number, y: number, pad: number): boolean {
  return patches.some((patch) => Math.abs(x - patch.x) < patch.w / 2 + pad
    && Math.abs(y - patch.y) < patch.h / 2 + pad);
}
