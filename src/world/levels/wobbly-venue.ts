// world/levels/wobbly-venue.ts - WOBBLY STADIUM (Wembley; the name approved by the owner 11-10), a
// NEW venue (world/venue.ts) laid by hand (venues/wobbly.ts: tools/scratch/_rocdata.mjs wobbly):
// the Race of Champions' track on Wembley's pitch, 2007-08 - "a parallel track ... two lanes
// running parallel to allow drivers to race within the confines of the stadium", about a kilometre
// with "a 100-tonne cross-over bridge", 400 m of motorway barrier along its corners (CAR magazine,
// racecar.com, the Wirtgen Group's account of the build). TODO.md RALLYCROSS > NEW TRACKS (agreed
// 11-10): ONE path crossing itself once - round the outer lane, over the crossover bridge onto
// the inner lane, round it inside, under the bridge back out - so a car racing it covers both
// lanes (Snoozuka's crossover system: world/venuecross.ts, trackunder.ts); tarmac, gravel on both
// lanes' north straight; the stands in two tiers round the bowl, the roof behind them. BUILT AT
// FULL SIZE, not 1/2: at the venues' 13 m road a half-size bowl (Wembley's pitch and surrounds are
// about 140 x 100 m) holds no two lanes side by side - the lanes are 20 m apart, the bowl ~210 x
// 170 m (creative licence: wider than the real pitch), the path 782 m (the real ~1 km), each corner
// its own (a tight south-east hairpin, a wider north-east, the north straight bowed out, a wider
// north-west), the crossover two straight diagonals over straight lanes. Dressed as an event:
// tyre rows round the hairpins and at the crossover, boards on the stands' catch fence and the
// infield, a row of flags before the stands. North up.
import { WOBBLY_VENUE, WOBBLY_FLAGS } from "./venues/wobbly.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (a parody of Wembley Stadium, approved by the owner 11-10), in one place
export const WOBBLY_STADIUM = 'Wobbly Stadium';

export const WOBBLY_SPEC: VenueSpec = {
  id: 'wobbly',
  data: WOBBLY_VENUE,
  // (laid in game m: the path's own length calibrates it to itself)
  share: 1,
  realRoadM: 13,
  calibrate: { layout: 'roc', realLapM: 782 },
  // the start line on the outer lane's east straight, the grid back toward its south-east corner
  start: [4, -54.6],
  startOnLine: true,
  // the Race of Champions' start: the two cars side by side on the two lanes, each timed over its
  // lap from its own line (Level.splitStart)
  splitStart: true,
  minR: 10,
  // the trace smoothed lightly (world/subtrack.ts traceTrack: 10 passes by default): the data is
  // laid as arcs and straights, and the default spread the crossover's bends 4 deg into its portals
  trace: { roc: { passes: 2, kern: 2 } },
  hills: [],
  banks: [],
  // the boards (the register's brands; the event's name - HEAD-TO-HEADBUTT, approved 11-10 -
  // and the stadium's): on the catch fence along the stands all round the outside, and on the
  // infield's Armco inside the inner lane (none on the barrier between the lanes: a board behind
  // it would face the other lane)
  boards: [
    { at: [0, 66], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [45, 66], label: 'GOOD YEAH', on: 'catchfence' },
    { at: [-45, 66], label: 'AVAN', on: 'catchfence' },
    { at: [0, -70], label: 'WOBBLY', on: 'catchfence' },
    { at: [45, -70], label: 'SPUM', on: 'catchfence' },
    { at: [-45, -66], label: 'MICKY TOMSON', on: 'catchfence' },
    { at: [90, 0], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [-90, 0], label: 'BF GOODWRENCH', on: 'catchfence' },
    { at: [88, 40], label: 'FIRESTONED', on: 'catchfence' },
    { at: [-88, -35], label: 'PIRRELLY', on: 'catchfence' },
    { at: [0, -22], label: 'PIRRELLY' },
    { at: [40, -8], label: 'WOBBLY' },
    { at: [-40, 6], label: 'DUNFLOP' },
    { at: [-25, 20], label: 'KUM' },
    { at: [28, -21], label: 'CREEM OIL' },
  ],
  // the first Race of Champions at Wembley, 2007
  seed: 2007,
  // m past the road's edge the barriers stand (laid round the lanes, no run-off)
  runoffM: 3,
  // THE BARRIERS (the ROC's "400 m of standard motorway barrier along the corners" and concrete
  // blocks: both sides of both lanes all round): a line 10 m off each side of every lane but the
  // crossover (tools/scratch/_rocdata.mjs wobbly), the data's rails - the edge's Armco at its
  // run-off's rim, a catch fence where the stands are
  followRails: true,
  // the barriers tidied, an Armco end carried on to the catch fence's round the crossover
  // (world/venuetidy.ts)
  tidyEdge: 'fences',
  // the crossover: the inner lane's way back out runs under the outer lane's way in
  crossover: { under: 'Crossover under' },
  // the flags along the front of the bowl (the generator's)
  landmarks: [
    ...WOBBLY_FLAGS,
  ],
  // a stadium: no trees, no bushes on its pitch
  trees: 0,
  bushless: true,
  // no kerbs: the lanes were laid on plates over the pitch, edged by the barriers
  kerbless: true,
  // the pitch's mown stripes inside the inner lane (6 m bands; its south side 30 m in from the
  // outer lane's, where the crossover is)
  mown: [{ at: [0, -5], pxM: 6, rows: Array.from({ length: 5 }, () => '#.#.#.#.#.#.#.#') }],
};

// the one layout - built on first use (world/load.ts buildLevel)
export const WOBBLY_LEVELS: Level[] = [
  { id: 'wobbly', name: WOBBLY_STADIUM, venue: WOBBLY_STADIUM,
    _lap: () => venueLap(WOBBLY_SPEC, 'roc'),
    _build: () => venueLevel(WOBBLY_SPEC, 'roc', 'wobbly', WOBBLY_STADIUM) } as Level,
];
