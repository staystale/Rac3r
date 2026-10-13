import { FLOOR } from "../bounds.ts";
import type { Barrier, Level } from "../types.ts";
import { SURFACES } from "../surfaces.ts";
import { alongTrack, solidsFromProps } from "../barriers.ts";
import { LAB_BOUNDS, LAB_OFFROAD_BUMPS } from "./lab-extension.ts";
import { onTrack, propClearance } from "../tyrewall.ts";
import {
  SB_SUBTRACK, SB_CONES, SB_COVERS, SB_ZONES, SB_BUMPS, SB_PAINT, SB_BOARDS, SB_PROPS, SB_SPAWN,
} from "./sandbox.ts";
import { TT_SUBTRACK, TT_CONES, TT_ZONES, TT_BUMPS, TT_PAINT, TT_BOARDS } from "./test-track.ts";
import {
  GO_SECTORS, GO_SUBTRACK, GO_RANDOM_PATCHES, randomiseGrassTrack, GO_ZONES, GO_PROPS, GO_PAINT,
  GO_BOARDS,
} from "./grass-track.ts";
import { SO_SUBTRACK, SO_ZONES, SO_PROPS, SO_PAINT, SO_BOARDS } from "./stock-car.ts";
import { NC_SUBTRACK, NC_ZONES, NC_PROPS, NC_PAINT, NC_BOARDS } from "./naffcar.ts";
import {
  TH_SUBTRACK, TH_ZONES, TH_BUMPS, TH_PAINT, TH_PROPS, TH_CONES, TH_STAND, TH_PIT, TH_GAR,
  TH_LANES,
} from "./thruston.ts";
import { CC_SUBTRACK, CC_ZONES, CC_BUMPS, CC_PAINT, CC_PROPS, CC_LANES } from "./castle-cum.ts";
import {
  SH_SUBTRACK, SH_BUMPS, SH_START, SH_JOKER, SH_PADDOCK, SH_JOKER_RULE, SH_PROPS, SH_ARMCO,
} from "./slidden-hill.ts";
import {
  SL_SUBTRACK, SL_BUMPS, SL_STREAM, SL_PAINT, SL_CONES, SL_PROPS, SL_TAPE, SL_YARD, SL_FINISH,
} from "./sweaty-lamb.ts";
import {
  KD_SUBTRACK, KD_BUMPS, KD_WATER, KD_PAINT, KD_CONES, KD_PROPS, KD_TAPE, KD_YARD, KD_FINISH,
} from "./killder.ts";
import { BH_GP_LEVEL, BH_INDY_LEVEL } from "./brands-snatch.ts";
import { LAB_PAINT, LAB_BOARDS } from "../barriers.ts";
import { prepBumps } from "../terrain.ts";
import { courseCones, slalom, outerTyreWall } from "../tyrewall.ts";
import {
  LAB_LANE_ZONES, LAB_OFFROAD_ZONES, LAB_EXT_PAINT, LAB_EXT_BOARDS, LAB_CRASH_OBJECTS,
} from "./lab-extension.ts";
import { LAB_BUMPS, LAB_PANELS } from "./sandbox.ts";
import { KH_LEVEL } from "./knobhill.ts";
import { rxDress, jokerBales } from "./kit.ts";
import { SH_TYREWALL, SH_STARTWALL } from "./slidden-hill.ts";
import { CC_TYREWALL, CC_KIT, CC_ARMCO } from "./castle-cum.ts";
import { TH_ARMCO } from "./thruston.ts";
// =============================================================================================
// THE LEVELS. `base` is what you are on where no zone covers you; `zones` are first-hit-wins.

export const LEVELS: Level[] = [
  {
    id: 'lab', name: 'The Lab',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    // COVERS (2026-10-03): lying ON whatever is under them; see "LAYERED" wear in this file.
    // The ice sheet is over GRASS on purpose — scrub it through and the grass shows, then wears
    // to mud (the user's chain).
    covers: [
      { x: -95, y: -185, w: 60, h: 30, cover: 'ice', shape: 'ellipse' },
      { x: -180, y: -185, w: 50, h: 26, cover: 'snow', shape: 'ellipse' },
      { x: 120, y: 60, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: 0.3 },
    ],
    base: SURFACES.lab,
    bounds: LAB_BOUNDS,   // S-B: 520 x 1000 m, the extension south of the old square
    zones: [
      ...LAB_PANELS,
      { x: -FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.lab },      // SW
      { x: FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.tarmac },    // SE
      { x: FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.gravel },   // NE
      { x: -FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.grass },   // NW
      // S-B: AFTER the old zones, so the old blend's random stream (and every old patch) is
      // unchanged
      ...LAB_LANE_ZONES, ...LAB_OFFROAD_ZONES,
    ],
    bumps: [...LAB_BUMPS, ...prepBumps(LAB_OFFROAD_BUMPS)],
    paint: [...LAB_PAINT, ...LAB_EXT_PAINT],
    boards: [...LAB_BOARDS, ...LAB_EXT_BOARDS],
    props: [],
    seams: true,
    cones: [
      ...courseCones(),
      ...slalom(-150, 230, 13, 9),
      { x: 30, y: 200 }, { x: 55, y: 215 }, { x: 22, y: 222 },
      { x: 150, y: -10 }, { x: 175, y: -10 },
      ...LAB_CRASH_OBJECTS,   // S-B: every loose object kind, at the ends of the crash lanes
    ],
    spawn: { x: -28.3, y: 28.3, heading: 0 },
  },
  {
    id: 'test-track', name: 'Test Track',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    base: SURFACES.grassShort,
    subtrack: TT_SUBTRACK,
    // CAMBER (user, 2026-10-03): 2% crown on the straights, up to 4 deg of positive camber in
    // the corners (at 40 m radius or tighter). Off-camber sections can be added here as
    // { from, to, deg: -2 } (metres of track distance).
    camber: { maxDeg: 4, refR: 40, crown: 0.02, edge: 6, sections: [] },
    covers: [
      // sweeper, tarmac
      onTrack(TT_SUBTRACK, 250, 2, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),
      // hairpin, tarmac
      onTrack(TT_SUBTRACK, 740, -2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),
      // black ice on the dirt
      onTrack(TT_SUBTRACK, 580, 0, { w: 14, h: 9, cover: 'ice', shape: 'ellipse' }),
      // drift beside the hairpin
      onTrack(TT_SUBTRACK, 700, 14, { w: 18, h: 10, cover: 'snow', shape: 'ellipse' }),
    ],
    zones: TT_ZONES,
    bumps: TT_BUMPS,
    paint: TT_PAINT,
    boards: TT_BOARDS,
    props: [],
    seams: false,
    cones: TT_CONES,
    spawn: { x: -62, y: -96.48, heading: 0.0109 },
  },
  KH_LEVEL,
  BH_GP_LEVEL,
  BH_INDY_LEVEL,
  {
    id: 'sweaty-lamb', name: 'Sweaty Lamb',
    base: SURFACES.grassLong,                 // moorland
    subtrack: SL_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: SL_BUMPS,
    covers: SL_STREAM,
    paint: SL_PAINT,
    boards: [], seams: false, cones: SL_CONES,
    props: SL_PROPS,
    barriers: SL_TAPE,
    solids: solidsFromProps(SL_PROPS),
    lanes: [SL_YARD],
    stage: { finish: SL_FINISH },
    // 6 m behind the START line, facing it: the clock starts as you cross it
    spawn: (() => {
      const pose = onTrack(SL_SUBTRACK, SL_SUBTRACK.totalDist - 6, 0, {});
      return { x: pose.x, y: pose.y, heading: pose.rot };
    })(),
  },
  {
    id: 'killder', name: 'Killder',
    base: SURFACES.grassLong,                 // forest floor / moorland between the plantations
    subtrack: KD_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: KD_BUMPS,
    covers: KD_WATER,
    paint: KD_PAINT,
    boards: [], seams: false, cones: KD_CONES,
    props: KD_PROPS,
    barriers: KD_TAPE,
    solids: solidsFromProps(KD_PROPS),
    lanes: [KD_YARD],
    stage: { finish: KD_FINISH },
    spawn: (() => {
      const pose = onTrack(KD_SUBTRACK, KD_SUBTRACK.totalDist - 6, 0, {});
      return { x: pose.x, y: pose.y, heading: pose.rot };
    })(),
  },
  {
    id: 'slidden-hill', name: 'Slidden Hill',
    base: SURFACES.grass,
    subtrack: SH_SUBTRACK,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [],
    bumps: SH_BUMPS,
    paint: [{
      kind: 'chequered', x: SH_SUBTRACK.pts[0].x, y: SH_SUBTRACK.pts[0].y, len: 1.6, wid: 14,
      rot: SH_SUBTRACK.pts[0].heading,
    }],
    boards: [], seams: false,
    lanes: [SH_START, SH_JOKER, SH_PADDOCK],
    joker: SH_JOKER_RULE,
    props: SH_PROPS,
    solids: solidsFromProps(SH_PROPS),
    cones: [
      ...SH_TYREWALL, ...SH_STARTWALL,
      ...rxDress(
        SH_SUBTRACK, [SH_START, SH_JOKER, SH_PADDOCK], [...SH_TYREWALL, ...SH_STARTWALL],
      ),
      ...jokerBales(SH_SUBTRACK, SH_JOKER, [...SH_TYREWALL, ...SH_STARTWALL]),
    ],
    barriers: SH_ARMCO.map(([begin, end, off]) => (
      { kind: 'armco', pts: alongTrack(SH_SUBTRACK, begin, end, off, 2) }
    )),
    // on the grid near the dead end of the (moved) start straight, facing the junction
    spawn: (() => {
      const [fromPt, toPt] = SH_START.pts,
        spawnX = fromPt[0] + (toPt[0] - fromPt[0]) * 0.08,
        spawnY = fromPt[1] + (toPt[1] - fromPt[1]) * 0.08;
      return {
        x: spawnX, y: spawnY, heading: Math.atan2(toPt[1] - fromPt[1], toPt[0] - fromPt[0]),
      };
    })(),
  },
  {
    id: 'castle-cum', name: 'Castle Cum',
    base: SURFACES.grass,
    subtrack: CC_SUBTRACK,
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: CC_ZONES,
    bumps: CC_BUMPS,
    paint: CC_PAINT,
    boards: [],
    props: CC_PROPS,
    seams: false,
    cones: [
      ...CC_TYREWALL,
      ...[1000, 1012, 1024].map((dist, idx) => (
        { ...CC_KIT.at(dist, idx % 2 ? 9 : -9), kind: 'tyrestack' }
      )),
    ],
    lanes: CC_LANES,
    solids: solidsFromProps(CC_PROPS),
    barriers: [
      { kind: 'pitwall', pts: alongTrack(CC_SUBTRACK, 1250, 97, -10, 2) },
      { kind: 'line', pts: alongTrack(CC_SUBTRACK, 1255, 92, -15.5, 2) },
      ...CC_ARMCO.map(([begin, end]): Barrier =>
        ({ kind: 'armco', pts: alongTrack(CC_SUBTRACK, begin, end, -16, 2) })),
      // "only a waist high fence" on the Camp bank
      { kind: 'fence', pts: alongTrack(CC_SUBTRACK, 1110, 1215, -22, 2) },
    ],
    spawn: (() => {
      const pose = onTrack(CC_SUBTRACK, CC_SUBTRACK.totalDist - 15, 0, {});
      return { x: pose.x, y: pose.y, heading: pose.rot };
    })(),
  },
  {
    id: 'thruston', name: 'Thruston',
    base: SURFACES.grass,
    subtrack: TH_SUBTRACK,
    // a smooth, fast airfield surface: a gentle crown, up to 3 deg of camber in the corners
    // (Thruxton is FLAT; bumps above)
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: TH_ZONES,
    bumps: TH_BUMPS,
    paint: TH_PAINT,
    boards: [],
    props: TH_PROPS,
    seams: false,
    cones: TH_CONES,
    // on the grid 15 m BEHIND the line (photographed: at distance 0 the car sat on the
    // chequers)
    spawn: (() => {
      const pose = onTrack(TH_SUBTRACK, TH_SUBTRACK.totalDist - 15, 0, {});
      return { x: pose.x, y: pose.y, heading: pose.rot };
    })(),
    // the grandstand is solid: an invisible 'building' barrier along its track-side face
    // (obstacles are axis-aligned only)
    barriers: [
      {
        kind: 'building',
        pts: alongTrack(TH_SUBTRACK, TH_STAND.d0, TH_STAND.d1, TH_STAND.off + 4.2),
      },
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, 1093, 1119, -22.6, 2) },
      // pit wall between the track and the lane, only where the lane has fully separated
      { kind: 'pitwall', pts: alongTrack(TH_SUBTRACK, 1201, 25, 10, 2) },
      // the yellow line
      { kind: 'line', pts: alongTrack(TH_SUBTRACK, 1206, 20, TH_PIT.off - 1.5, 2) },
      {
        kind: 'building',
        pts: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2 + 0.3, 2),
      },
      // ARMCO on the OUTSIDE of the right-handers (an inside offset of a tight corner
      // self-intersects)
      ...TH_ARMCO.map(([begin, end]): Barrier =>
        ({ kind: 'armco', pts: alongTrack(TH_SUBTRACK, begin, end, -16, 2) })),
      // catch fence behind the Armco at Church, where the spectators stand
      { kind: 'fence', pts: alongTrack(TH_SUBTRACK, 780, 875, -22, 2) },
    ],
    lanes: TH_LANES,
    solids: solidsFromProps(TH_PROPS),
  },
  {
    id: 'grass-track', name: 'Grass Track',
    base: SURFACES.grass,
    subtrack: GO_SUBTRACK,
    // new random patches every load
    randomise: () => randomiseGrassTrack(GO_SUBTRACK, GO_SECTORS, GO_RANDOM_PATCHES),
    patches: GO_RANDOM_PATCHES,
    covers: [
      onTrack(GO_SUBTRACK, 100, 2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 300, -3, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 380, 1.5, { w: 6, h: 3.5, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: GO_ZONES,
    bumps: [],
    paint: GO_PAINT,
    boards: GO_BOARDS,
    props: GO_PROPS,
    seams: false,
    cones: [
      { x: 0, y: 0, kind: 'podium' },
      { x: -26, y: -4, kind: 'caravan', rot: 0.16 },
      // Corner apex clipping tyre barriers
      { x: 55, y: 28, kind: 'tyrestack' }, { x: 57, y: 27, kind: 'tyrestack' },
      { x: 55, y: -28, kind: 'tyrestack' }, { x: 57, y: -27, kind: 'tyrestack' },
      { x: -55, y: -28, kind: 'tyrestack' }, { x: -57, y: -27, kind: 'tyrestack' },
      { x: -55, y: 28, kind: 'tyrestack' }, { x: -57, y: 27, kind: 'tyrestack' },
      // Infield caravan protection barrier
      { x: -18, y: -6, kind: 'tyrestack' }, { x: -18, y: -3, kind: 'tyrestack' },
      { x: -18, y: 0, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 3 m outside the track edge, gapped round
      // the pylons
      ...outerTyreWall(GO_SUBTRACK, { margin: 3, spacing: 1.0, clear: propClearance(GO_PROPS) }),
    ],
    spawn: { x: -4, y: 38, heading: 0 },
    obstacles: [
      { x: 0, y: 66, w: 38, h: 7 }, // Wooden covered grandstand — moved out 10 m (2026-10-02)
    ],
  },
  {
    id: 'stock-car', name: 'Stock Car',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grass,
    subtrack: SO_SUBTRACK,
    covers: [
      onTrack(SO_SUBTRACK, 40, -3, { w: 8, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 250, 3, { w: 10, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 470, 0, { w: 6, h: 3, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: SO_ZONES,
    bumps: [],
    paint: SO_PAINT,
    boards: SO_BOARDS,
    props: SO_PROPS,
    seams: false,
    cones: [
      { x: -28, y: 12, kind: 'banger', rot: 0.52 },
      { x: 20, y: -14, kind: 'banger', rot: -0.44 },
      { x: -8, y: -10, kind: 'banger', rot: 2.15 },
      { x: 30, y: 15, kind: 'banger', rot: -1.15 },
      // Continuous infield barrier separating track from wrecked bangers
      { x: -45, y: 36, kind: 'tyrestack' }, { x: -30, y: 36, kind: 'tyrestack' },
      { x: 30, y: 36, kind: 'tyrestack' }, { x: 45, y: 36, kind: 'tyrestack' },
      { x: -45, y: -36, kind: 'tyrestack' }, { x: -30, y: -36, kind: 'tyrestack' },
      { x: 30, y: -36, kind: 'tyrestack' }, { x: 45, y: -36, kind: 'tyrestack' },
      // Corner apex tyre stacks
      { x: 72, y: 24, kind: 'tyrestack' }, { x: 72, y: -24, kind: 'tyrestack' },
      { x: -72, y: -24, kind: 'tyrestack' }, { x: -72, y: 24, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 2 m outside the track edge — 2, not 3, so
      // the wall runs IN FRONT of the sponsor boards (front edge y 60.8) instead of being gapped
      // by 18 m at each
      ...outerTyreWall(SO_SUBTRACK, { margin: 2, spacing: 1.0, clear: propClearance(SO_PROPS) }),
    ],
    spawn: { x: -4, y: 48, heading: 0 },
    obstacles: [
      // Grandstand — moved further from the track edge (2026-10-02)
      { x: 18, y: 76, w: 42, h: 7 },
      { x: -14, y: 64, w: 4.4, h: 3.6 }, // Marshal tower / official box
    ],
  },
  {
    id: 'naffcar', name: 'Naffcar Speedway',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grassShort,
    subtrack: NC_SUBTRACK,
    zones: NC_ZONES,
    bumps: [],
    paint: NC_PAINT,
    boards: NC_BOARDS,
    props: NC_PROPS,
    bankAngle: 0.31, // ~18 deg banking in the turns
    seams: false,
    cones: [
      // Pit wall impact attenuator crash cushions
      { x: -111, y: 62, kind: 'tyrestack' }, { x: -113, y: 61, kind: 'tyrestack' },
      { x: -113, y: 63, kind: 'tyrestack' },
      { x: 111, y: 62, kind: 'tyrestack' }, { x: 113, y: 61, kind: 'tyrestack' },
      { x: 113, y: 63, kind: 'tyrestack' },
      // Spare racing tyre sets stacked along pit stalls
      { x: -60, y: 57, kind: 'tyrestack' }, { x: -20, y: 57, kind: 'tyrestack' },
      { x: 20, y: 57, kind: 'tyrestack' }, { x: 60, y: 57, kind: 'tyrestack' },
    ],
    spawn: { x: -4, y: 75, heading: 0 },
    obstacles: [
      { x: 0, y: 62, w: 220, h: 1.4 },  // Solid concrete pit divider wall
      { x: 0, y: 98, w: 180, h: 14 },   // Front stadium grandstand
      { x: 0, y: -98, w: 180, h: 14 },  // Back stadium grandstand
    ],
  },
  {
    id: 'sandbox', name: 'Surface Sandbox',
    base: SURFACES.grassShort,
    subtrack: SB_SUBTRACK,
    covers: SB_COVERS,
    zones: SB_ZONES,
    bumps: SB_BUMPS,
    paint: SB_PAINT,
    boards: SB_BOARDS,
    props: SB_PROPS,
    seams: false,
    cones: SB_CONES,
    spawn: SB_SPAWN,
    obstacles: [{ x: -20, y: 222, w: 60, h: 8 }],   // the grandstand is solid
  },
];
