// world/levels/brands-indy-scale.ts - BRANDS SNATCH INDY TO SCALE (owner 11-03, ordered 11-07 "3
// ok"): two TEST levels - the Indy layout at REAL scale and at 3/4 - to feel whether the circuits'
// 0.48-of-real scale (corners tighter than real) is right ("the full size might be too big still
// but who knows"). The track surface, its kerbs, the hills and a grid for the AI to race; no
// scenery. The same traced map as Brands Snatch (art/ref/bh2.png), the lap and the hills' reach
// and height scaled (so the slopes are the game's own); the road keeps the game's 13 m. TRIED:
// the width to scale too (the real Indy 9 m -> 9 / 6.75 m) - owner 11-07: "maybe the previous
// widths were better ... vibing towards 3/4 length and that original width".
import { createSubtrack, autoKerbs, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack } from "../tyrewall.ts";
import { BH_TOP, BH_INDY, BH_MPP } from "./brands-snatch.ts";
import type { Bump, Level, Point } from "../types.ts";

// real m a map pixel: the map's scale bar (300 m = 460 px) says 0.652, which traces a 1921 m lap;
// the real Indy is 1944 m (Wikipedia, 2003-), so the bar reads 1.2 % short - calibrated to the lap
const REAL_MPP = 0.652 * 1944 / 1921;
// m: the road, at every scale (Brands Snatch's own)
const ROAD_M = 13;
// m of grass round the track's extent to the floor's edge
const MARGIN_M = 60;
// the hills on the Indy loop, in map pixels, at the game's scale (brands-snatch.ts BH_HILLS):
// Paddock Hill's plunge, Druids on its rise, the high ground west of the infield
const INDY_HILLS: { kind: 'dip' | 'hump'; at: Point; r: number; size: number }[] = [
  { kind: 'dip', at: [1085, 455], r: 55, size: 4.0 },
  { kind: 'hump', at: [905, 690], r: 42, size: 2.2 },
  { kind: 'hump', at: [330, 760], r: 150, size: 3.0 },
];

/**
 * The Indy layout at a share of real scale.
 * @param levelId the level id
 * @param name its name
 * @param scale the share of real size (1 = real)
 * @returns the level
 */
function indyAtScale(levelId: string, name: string, scale: number): Level {
  const mapPts = [...BH_TOP, ...BH_INDY], mpp = REAL_MPP * scale, grow = mpp / BH_MPP;
  // centred on the layout's own middle (the Brands map's centre is the GP's)
  const mapXs = mapPts.map(([x]) => x), mapYs = mapPts.map(([, y]) => y);
  const midX = (Math.min(...mapXs) + Math.max(...mapXs)) / 2;
  const midY = (Math.min(...mapYs) + Math.max(...mapYs)) / 2;
  const sub = createSubtrack(traceTrack(mapPts, { mpp, cx: midX, cy: midY, rMin: 15.5 }), ROAD_M,
    [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
  sub.curvedKerbs = autoKerbs(sub, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
  const bumps: Bump[] = INDY_HILLS.map((hill) => ({ kind: hill.kind,
    x: (hill.at[0] - midX) * mpp, y: (hill.at[1] - midY) * mpp, r: hill.r * grow,
    ...(hill.kind === 'dip' ? { d: hill.size * grow } : { h: hill.size * grow }) }));
  const roadXs = sub.pts.map((point) => point.x), roadYs = sub.pts.map((point) => point.y);
  const bounds = { x0: Math.min(...roadXs) - MARGIN_M, x1: Math.max(...roadXs) + MARGIN_M,
    y0: Math.min(...roadYs) - MARGIN_M, y1: Math.max(...roadYs) + MARGIN_M };
  const start = onTrack(sub, sub.totalDist - 15, 0, {});
  return {
    id: levelId, name, base: SURFACES.grass, subtrack: sub, bounds,
    floor: Math.ceil(Math.max(-bounds.x0, bounds.x1, -bounds.y0, bounds.y1)),
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: [], covers: [], bumps: prepBumps(bumps), boards: [], seams: false, cones: [],
    props: [], barriers: [], lanes: [],
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: ROAD_M,
      rot: sub.pts[0].heading }],
    spawn: { x: start.x, y: start.y, heading: start.rot },
  } as Level;
}

export const BH_INDY_REAL_LEVEL = indyAtScale('brands-indy-real', 'Brands Snatch Indy 1:1', 1);
export const BH_INDY_34_LEVEL = indyAtScale('brands-indy-34', 'Brands Snatch Indy 3/4', 0.75);
