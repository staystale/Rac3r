import { FLOOR } from "../bounds.ts";
import type { Level } from "../types.ts";
import { SURFACES } from "../surfaces.ts";
import { alongTrack, solidsFromProps } from "../barriers.ts";
import { BOWLING_ALLEY_LEVEL, ROUGH_PATCH_LEVEL } from "./lab-extension.ts";
import { CRASH_BENCH_LEVEL } from "./crashbench.ts";
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
  SH_SUBTRACK, SH_BUMPS, SH_START, SH_JOKER, SH_PADDOCK, SH_JOKER_RULE, SH_PROPS, SH_ARMCO,
} from "./slidden-hill.ts";
import {
  SL_SUBTRACK, SL_BUMPS, SL_STREAM, SL_PAINT, SL_CONES, SL_PROPS, SL_TAPE, SL_YARD, SL_FINISH,
} from "./sweaty-lamb.ts";
import {
  KD_SUBTRACK, KD_BUMPS, KD_WATER, KD_PAINT, KD_CONES, KD_PROPS, KD_TAPE, KD_YARD, KD_FINISH,
} from "./killder.ts";
import { BH_GP_LEVEL, BH_INDY_LEVEL } from "./brands-venue.ts";
import { CC_VENUE_LEVEL } from "./castle-cum-venue.ts";
import { SN_LEVELS } from "./snotterton-venue.ts";
import { DG_LEVELS } from "./dongington-venue.ts";
import { SS_LEVELS } from "./sillystone-venue.ts";
import { CW_LEVELS } from "./cadwallop-venue.ts";
import { MP_LEVELS } from "./malarkey-venue.ts";
import { AG_LEVELS } from "./anglesleazy-venue.ts";
import { GW_LEVELS } from "./goodwoody-venue.ts";
import { CR_LEVELS } from "./croughed-venue.ts";
import { SPA_LEVELS } from "./spa-venue.ts";
import { MONZA_LEVELS } from "./monza-venue.ts";
import { NERD_LEVELS } from "./nordschlep-venue.ts";
import { LEMANS_LEVELS } from "./lemans-venue.ts";
import { SUZUKA_LEVELS } from "./suzuka-venue.ts";
import { YASMARINA_LEVELS } from "./yasmarina-venue.ts";
import { BATHURST_LEVELS } from "./bathurst-venue.ts";
import { MOANACO_LEVELS } from "./moanaco-venue.ts";
import { WOBBLY_LEVELS } from "./wobbly-venue.ts";
import { STADEPRANCE_LEVELS } from "./stadeprance-venue.ts";
import { BIRDSMESS_LEVELS } from "./birdsmess-venue.ts";
import { LALIVELY_LEVELS } from "./lalively-venue.ts";
import { HOLJES_LEVELS } from "./holjes-venue.ts";
import { FIX } from "../../core/fixes.ts";
import { OP_LEVELS } from "./oultonpork-venue.ts";
import { DT_LEVELS } from "./dieatona-venue.ts";
import { TH_VENUE_LEVEL } from "./thruston-venue.ts";
import { KH_VENUE_LEVELS } from "./knobhill-venue.ts";
import { LAB_PAINT, LAB_BOARDS } from "../barriers.ts";
import { courseCones, slalom, outerTyreWall } from "../tyrewall.ts";
import { LAB_BUMPS, LAB_PANELS } from "./sandbox.ts";
import { KH_LEVEL } from "./knobhill.ts";
import { rxDress, jokerBales } from "./kit.ts";
import { LAB_BUSHES, RALLY_BUSHES, TEST_TRACK_BUSHES } from "./bushes.ts";
import { SH_TYREWALL, SH_STARTWALL } from "./slidden-hill.ts";
// =============================================================================================
// THE LEVELS. `base` is what you are on where no zone covers you; `zones` are first-hit-wins.

export const LEVELS: Level[] = [
  {
    id: 'lab', name: 'OG Lab',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    // COVERS: lying ON whatever is under them; see "LAYERED" wear in this file.
    // The ice sheet is over GRASS on purpose — scrub it through and the grass shows, then wears
    // to mud (the user's chain).
    covers: [
      { x: -95, y: -185, w: 60, h: 30, cover: 'ice', shape: 'ellipse' },
      { x: -180, y: -185, w: 50, h: 26, cover: 'snow', shape: 'ellipse' },
      { x: 120, y: 60, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: 0.3 },
    ],
    base: SURFACES.lab,
    zones: [
      ...LAB_PANELS,
      { x: -FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.lab },      // SW
      { x: FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.tarmac },    // SE
      { x: FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.gravel },   // NE
      { x: -FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.grass },   // NW
    ],
    bumps: LAB_BUMPS,
    paint: LAB_PAINT,
    boards: LAB_BOARDS,
    props: [],
    seams: true,
    bushes: LAB_BUSHES,
    cones: [
      ...courseCones(),
      ...slalom(-150, 230, 13, 9),
      { x: 30, y: 200 }, { x: 55, y: 215 }, { x: 22, y: 222 },
      { x: 150, y: -10 }, { x: 175, y: -10 },
    ],
    spawn: { x: -28.3, y: 28.3, heading: 0 },
  },
  // the Lab's sister test grounds (lab-extension.ts): the surface lanes, the off-road area
  BOWLING_ALLEY_LEVEL,
  ROUGH_PATCH_LEVEL,
  // the physics under load, to watch (crashbench.ts)
  CRASH_BENCH_LEVEL,
  {
    id: 'test-track', name: 'Test Track',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    base: SURFACES.grassShort,
    subtrack: TT_SUBTRACK,
    // CAMBER: 2% crown on the straights, up to 4 deg of positive camber in
    // the corners (at 40 m radius or tighter). Off-camber sections can be added here as
    // { from, to, deg: -2 } (metres of track distance).
    camber: { maxDeg: 4, refR: 40, crown: 0.02, edge: 6, sections: [] },
    zones: TT_ZONES,
    bumps: TT_BUMPS,
    paint: TT_PAINT,
    boards: TT_BOARDS,
    props: [],
    seams: false,
    cones: TT_CONES,
    bushes: TEST_TRACK_BUSHES,
    spawn: { x: -62, y: -96.48, heading: 0.0109 },
  },
  // the rallycross as it was (owner 11-10: "keep the originals"), the real venue's circuit beside
  // it (knobhill-venue.ts; passed 11-10)
  KH_LEVEL, ...KH_VENUE_LEVELS,
  // Wobbly Stadium, the Race of Champions' track at Wembley (wobbly-venue.ts)
  ...WOBBLY_LEVELS,
  // Stade de Prance, the Race of Champions' track in Paris (stadeprance-venue.ts)
  ...STADEPRANCE_LEVELS,
  // The Bird's Mess, the Race of Champions' track in Beijing (birdsmess-venue.ts)
  ...BIRDSMESS_LEVELS,
  ...LALIVELY_LEVELS,
  // Holy Jeez, the Holjes rallycross (holjes-venue.ts), under test
  ...(FIX.holyjeez ? HOLJES_LEVELS : []),
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
    bushes: RALLY_BUSHES,
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
    bushes: RALLY_BUSHES,
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
  // the real venue (castle-cum-venue.ts), built on first use
  CC_VENUE_LEVEL,
  // Snotterton's three layouts (snotterton-venue.ts), built on first use
  ...SN_LEVELS,
  // Dongington Park, a new venue (dongington-venue.ts), its GP and National
  ...DG_LEVELS,
  // Sillystone, a new venue (sillystone-venue.ts), its GP and National
  ...SS_LEVELS,
  // Cadwallop Park, a new venue (cadwallop-venue.ts), its Full and Club
  ...CW_LEVELS,
  // Malarkey Park, a new venue (malarkey-venue.ts), its Car Circuit and Oval (Mallory's one-mile
  // road layout: listed with its venue, not the ovals)
  ...MP_LEVELS,
  // Anglesleazy, a new venue (anglesleazy-venue.ts), its four layouts
  ...AG_LEVELS,
  // Goodwoody, a new venue (goodwoody-venue.ts)
  ...GW_LEVELS,
  // Croughed, a new venue (croughed-venue.ts), its two layouts
  ...CR_LEVELS,
  // Spa-Frankenchumps, a venue (spa-venue.ts), the first world championship circuit (passed 11-09)
  ...SPA_LEVELS,
  // Monzarella, a venue (monza-venue.ts), a world championship circuit (passed 11-10)
  ...MONZA_LEVELS,
  // the Nerdburgring Nordschlep, a venue (nordschlep-venue.ts), a simple first build (passed 11-10)
  ...NERD_LEVELS,
  // Le Manky, the Circuit de la Sarthe, a simple first build (lemans-venue.ts; passed 11-10)
  ...LEMANS_LEVELS,
  // Snoozuka, the Suzuka Circuit with its crossover (suzuka-venue.ts; passed 11-10)
  ...SUZUKA_LEVELS,
  // Yass Marina, the Yas Marina Circuit with its pit exit tunnel (yasmarina-venue.ts; passed 11-10)
  ...YASMARINA_LEVELS,
  // Bathworst, the Mount Panorama Circuit (bathurst-venue.ts; passed 11-11)
  ...BATHURST_LEVELS,
  // Moanaco, the Circuit de Monaco and its tunnel (moanaco-venue.ts; passed 11-11)
  ...MOANACO_LEVELS,
  // Oulton Pork, a new venue (oultonpork-venue.ts), its International, Island and Frosters
  ...OP_LEVELS,
  // Thruston, the real venue (thruston-venue.ts; passed 11-10), built on first use
  TH_VENUE_LEVEL,
  {
    id: 'grass-track', name: 'Grass Track',
    base: SURFACES.grass,
    subtrack: GO_SUBTRACK,
    // new random patches every load
    randomise: () => randomiseGrassTrack(GO_SUBTRACK, GO_SECTORS, GO_RANDOM_PATCHES),
    patches: GO_RANDOM_PATCHES,
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
      // Outer tyre wall: loose stacks 3 m outside the track edge, gapped round
      // the pylons
      ...outerTyreWall(GO_SUBTRACK, { margin: 3, spacing: 1.0, clear: propClearance(GO_PROPS) }),
    ],
    spawn: { x: -4, y: 38, heading: 0 },
    obstacles: [
      { x: 0, y: 66, w: 38, h: 7 }, // Wooden covered grandstand — moved out 10 m
    ],
  },
  {
    id: 'stock-car', name: 'Stock Car',
    rollingStart: true,   // races start ROLLING (user: the ovals)
    base: SURFACES.grass,
    subtrack: SO_SUBTRACK,
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
      // Outer tyre wall: loose stacks 2 m outside the track edge — 2, not 3, so
      // the wall runs IN FRONT of the sponsor boards (front edge y 60.8) instead of being gapped
      // by 18 m at each
      ...outerTyreWall(SO_SUBTRACK, { margin: 2, spacing: 1.0, clear: propClearance(SO_PROPS) }),
    ],
    spawn: { x: -4, y: 48, heading: 0 },
    obstacles: [
      // Grandstand — moved further from the track edge
      { x: 18, y: 76, w: 42, h: 7 },
      { x: -14, y: 64, w: 4.4, h: 3.6 }, // Marshal tower / official box
    ],
  },
  // Dieatona's oval and road course (dieatona-venue.ts; passed 11-10), built on first use
  ...DT_LEVELS,
  {
    id: 'naffcar', name: 'Naffcar Speedway',
    rollingStart: true,   // races start ROLLING (user: the ovals)
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
    bushes: TEST_TRACK_BUSHES,
    spawn: SB_SPAWN,
    obstacles: [{ x: -20, y: 222, w: 60, h: 8 }],   // the grandstand is solid
  },
];
