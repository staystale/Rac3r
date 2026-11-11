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
// 170 m (creative licence: wider than the real pitch), the path 798 m (the real ~1 km). North up.
import { WOBBLY_VENUE } from "./venues/wobbly.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE BARRIERS (the ROC's "400 m of standard motorway barrier along the corners" and concrete
// blocks: both sides of both lanes all round): a line 10 m off each side of every lane but the
// crossover (tools/scratch/_rocdata.mjs wobbly), followed as rails - the edge's Armco at its
// run-off's rim, a catch fence where the stands are
const WB_RAILS: Point[][] = [
  [
    [20, 42], [22.8, 42], [25.6, 42], [28.3, 42], [31.1, 42], [33.9, 42], [36.7, 42], [39.4, 42],
    [42.2, 42], [45, 42],
  ],
  [
    [20, 22], [22.8, 22], [25.6, 22], [28.3, 22], [31.1, 22], [33.9, 22], [36.7, 22], [39.4, 22],
    [42.2, 22], [45, 22],
  ],
  [
    [46.1, 41.9], [50.1, 41.4], [55, 39.4], [59.2, 36.2], [62.4, 32], [64.4, 27.1], [65, 22.5],
    [65, 19.1], [65, 16.1], [65, 13.2], [65, 10.3], [65, 7.3], [65, 4.4], [65, 1.5], [65, -1.5],
    [65, -4.4], [65, -7.3], [65, -10.3], [65, -13.2], [65, -16.1], [65, -19.1], [65, -22.5],
    [64.4, -27.1], [62.4, -32], [59.2, -36.2], [55, -39.4], [50.1, -41.4], [46.1, -41.9],
  ],
  [
    [43.9, 22.1], [45.1, 22], [45, 22], [45, 22], [45, 22], [45, 22.1], [45, 21.5], [45, 19.1],
    [45, 16.1], [45, 13.2], [45, 10.3], [45, 7.3], [45, 4.4], [45, 1.5], [45, -1.5], [45, -4.4],
    [45, -7.3], [45, -10.3], [45, -13.2], [45, -16.1], [45, -19.1], [45, -21.5], [45, -22.1],
    [45, -22], [45, -22], [45, -22], [45.1, -22], [43.9, -22.1],
  ],
  [
    [45, -42], [42, -42], [39, -42], [36, -42], [33, -42], [30, -42], [27, -42], [24, -42],
    [21, -42], [18, -42], [15, -42], [12, -42], [9, -42], [6, -42], [3, -42], [0, -42], [-3, -42],
    [-6, -42], [-9, -42], [-12, -42], [-15, -42], [-18, -42], [-21, -42], [-24, -42], [-27, -42],
    [-30, -42], [-33, -42], [-36, -42], [-39, -42], [-42, -42], [-45, -42],
  ],
  [
    [45, -22], [42, -22], [39, -22], [36, -22], [33, -22], [30, -22], [27, -22], [24, -22],
    [21, -22], [18, -22], [15, -22], [12, -22], [9, -22], [6, -22], [3, -22], [0, -22], [-3, -22],
    [-6, -22], [-9, -22], [-12, -22], [-15, -22], [-18, -22], [-21, -22], [-24, -22], [-27, -22],
    [-30, -22], [-33, -22], [-36, -22], [-39, -22], [-42, -22], [-45, -22],
  ],
  [
    [-46.1, -41.9], [-50.1, -41.4], [-55, -39.4], [-59.2, -36.2], [-62.4, -32], [-64.4, -27.1],
    [-65, -22.5], [-65, -19.1], [-65, -16.1], [-65, -13.2], [-65, -10.3], [-65, -7.3],
    [-65, -4.4], [-65, -1.5], [-65, 1.5], [-65, 4.4], [-65, 7.3], [-65, 10.3], [-65, 13.2],
    [-65, 16.1], [-65, 19.1], [-65, 22.5], [-64.4, 27.1], [-62.4, 32], [-59.2, 36.2], [-55, 39.4],
    [-50.1, 41.4], [-46.1, 41.9],
  ],
  [
    [-43.9, -22.1], [-45.1, -22], [-45, -22], [-45, -22], [-45, -22], [-45, -22.1], [-45, -21.5],
    [-45, -19.1], [-45, -16.1], [-45, -13.2], [-45, -10.3], [-45, -7.3], [-45, -4.4], [-45, -1.5],
    [-45, 1.5], [-45, 4.4], [-45, 7.3], [-45, 10.3], [-45, 13.2], [-45, 16.1], [-45, 19.1],
    [-45, 21.5], [-45, 22.1], [-45, 22], [-45, 22], [-45, 22], [-45.1, 22], [-43.9, 22.1],
  ],
  [
    [-45, 42], [-42.2, 42], [-39.4, 42], [-36.7, 42], [-33.9, 42], [-31.1, 42], [-28.3, 42],
    [-25.6, 42], [-22.8, 42], [-20, 42],
  ],
  [
    [-45, 22], [-42.2, 22], [-39.4, 22], [-36.7, 22], [-33.9, 22], [-31.1, 22], [-28.3, 22],
    [-25.6, 22], [-22.8, 22], [-20, 22],
  ],
  [
    [20, 62], [22.8, 62], [25.6, 62], [28.3, 62], [31.1, 62], [33.9, 62], [36.7, 62], [39.4, 62],
    [42.2, 62], [45, 62],
  ],
  [
    [20, 42], [22.8, 42], [25.6, 42], [28.3, 42], [31.1, 42], [33.9, 42], [36.7, 42], [39.4, 42],
    [42.2, 42], [45, 42],
  ],
  [
    [45.3, 62], [48.9, 61.8], [52.9, 61.2], [56.6, 60.3], [60.3, 59], [63.8, 57.3], [67.3, 55.2],
    [70.4, 52.9], [73.3, 50.3], [75.9, 47.4], [78.2, 44.3], [80.3, 40.8], [82, 37.3],
    [83.3, 33.6], [84.2, 29.9], [84.8, 25.9], [85, 22.2], [85, 19.1], [85, 16.1], [85, 13.2],
    [85, 10.3], [85, 7.3], [85, 4.4], [85, 1.5], [85, -1.5], [85, -4.4], [85, -7.3], [85, -10.3],
    [85, -13.2], [85, -16.1], [85, -19.1], [85, -22.2], [84.8, -25.9], [84.2, -29.9],
    [83.3, -33.6], [82, -37.3], [80.3, -40.8], [78.2, -44.3], [75.9, -47.4], [73.3, -50.3],
    [70.4, -52.9], [67.3, -55.2], [63.8, -57.3], [60.3, -59], [56.6, -60.3], [52.9, -61.2],
    [48.9, -61.8], [45.3, -62],
  ],
  [
    [44.7, 42], [46.9, 42], [48.9, 41.6], [50.8, 41.1], [52.7, 40.4], [54.4, 39.7], [56.1, 38.6],
    [57.6, 37.5], [59.1, 36.1], [60.5, 34.6], [61.6, 33.1], [62.7, 31.4], [63.4, 29.7],
    [64.1, 27.8], [64.6, 25.9], [65, 23.9], [65, 21.8], [65, 19.1], [65, 16.1], [65, 13.2],
    [65, 10.3], [65, 7.3], [65, 4.4], [65, 1.5], [65, -1.5], [65, -4.4], [65, -7.3], [65, -10.3],
    [65, -13.2], [65, -16.1], [65, -19.1], [65, -21.8], [65, -23.9], [64.6, -25.9], [64.1, -27.8],
    [63.4, -29.7], [62.7, -31.4], [61.6, -33.1], [60.5, -34.6], [59.1, -36.1], [57.6, -37.5],
    [56.1, -38.6], [54.4, -39.7], [52.7, -40.4], [50.8, -41.1], [48.9, -41.6], [46.9, -42],
    [44.7, -42],
  ],
  [
    [45, -62], [42, -62], [39, -62], [36, -62], [33, -62], [30, -62], [27, -62], [24, -62],
    [21, -62], [18, -62], [15, -62], [12, -62], [9, -62], [6, -62], [3, -62], [0, -62], [-3, -62],
    [-6, -62], [-9, -62], [-12, -62], [-15, -62], [-18, -62], [-21, -62], [-24, -62], [-27, -62],
    [-30, -62], [-33, -62], [-36, -62], [-39, -62], [-42, -62], [-45, -62],
  ],
  [
    [45, -42], [42, -42], [39, -42], [36, -42], [33, -42], [30, -42], [27, -42], [24, -42],
    [21, -42], [18, -42], [15, -42], [12, -42], [9, -42], [6, -42], [3, -42], [0, -42], [-3, -42],
    [-6, -42], [-9, -42], [-12, -42], [-15, -42], [-18, -42], [-21, -42], [-24, -42], [-27, -42],
    [-30, -42], [-33, -42], [-36, -42], [-39, -42], [-42, -42], [-45, -42],
  ],
  [
    [-45.3, -62], [-48.9, -61.8], [-52.9, -61.2], [-56.6, -60.3], [-60.3, -59], [-63.8, -57.3],
    [-67.3, -55.2], [-70.4, -52.9], [-73.3, -50.3], [-75.9, -47.4], [-78.2, -44.3],
    [-80.3, -40.8], [-82, -37.3], [-83.3, -33.6], [-84.2, -29.9], [-84.8, -25.9], [-85, -22.2],
    [-85, -19.1], [-85, -16.1], [-85, -13.2], [-85, -10.3], [-85, -7.3], [-85, -4.4], [-85, -1.5],
    [-85, 1.5], [-85, 4.4], [-85, 7.3], [-85, 10.3], [-85, 13.2], [-85, 16.1], [-85, 19.1],
    [-85, 22.2], [-84.8, 25.9], [-84.2, 29.9], [-83.3, 33.6], [-82, 37.3], [-80.3, 40.8],
    [-78.2, 44.3], [-75.9, 47.4], [-73.3, 50.3], [-70.4, 52.9], [-67.3, 55.2], [-63.8, 57.3],
    [-60.3, 59], [-56.6, 60.3], [-52.9, 61.2], [-48.9, 61.8], [-45.3, 62],
  ],
  [
    [-44.7, -42], [-46.9, -42], [-48.9, -41.6], [-50.8, -41.1], [-52.7, -40.4], [-54.4, -39.7],
    [-56.1, -38.6], [-57.6, -37.5], [-59.1, -36.1], [-60.5, -34.6], [-61.6, -33.1],
    [-62.7, -31.4], [-63.4, -29.7], [-64.1, -27.8], [-64.6, -25.9], [-65, -23.9], [-65, -21.8],
    [-65, -19.1], [-65, -16.1], [-65, -13.2], [-65, -10.3], [-65, -7.3], [-65, -4.4], [-65, -1.5],
    [-65, 1.5], [-65, 4.4], [-65, 7.3], [-65, 10.3], [-65, 13.2], [-65, 16.1], [-65, 19.1],
    [-65, 21.8], [-65, 23.9], [-64.6, 25.9], [-64.1, 27.8], [-63.4, 29.7], [-62.7, 31.4],
    [-61.6, 33.1], [-60.5, 34.6], [-59.1, 36.1], [-57.6, 37.5], [-56.1, 38.6], [-54.4, 39.7],
    [-52.7, 40.4], [-50.8, 41.1], [-48.9, 41.6], [-46.9, 42], [-44.7, 42],
  ],
  [
    [-45, 62], [-42.2, 62], [-39.4, 62], [-36.7, 62], [-33.9, 62], [-31.1, 62], [-28.3, 62],
    [-25.6, 62], [-22.8, 62], [-20, 62],
  ],
  [
    [-45, 42], [-42.2, 42], [-39.4, 42], [-36.7, 42], [-33.9, 42], [-31.1, 42], [-28.3, 42],
    [-25.6, 42], [-22.8, 42], [-20, 42],
  ],
];

// the venue's name (a parody of Wembley Stadium, approved by the owner 11-10), in one place
export const WOBBLY_STADIUM = 'Wobbly Stadium';

export const WOBBLY_SPEC: VenueSpec = {
  id: 'wobbly',
  data: WOBBLY_VENUE,
  // (laid in game m: the path's own length calibrates it to itself)
  share: 1,
  realRoadM: 13,
  calibrate: { layout: 'roc', realLapM: 798 },
  // the start line on the outer lane's east straight, the grid back toward its south-east corner
  start: [75, 0],
  startOnLine: true,
  minR: 10,
  hills: [],
  banks: [],
  // the boards on the barriers by the crossover, the east straight and the gravel (the
  // register's brands; the event's name - HEAD-TO-HEADBUTT, approved 11-10 - and the stadium's)
  boards: [
    { at: [0, 66], label: 'HEAD-TO-HEADBUTT' },
    { at: [90, -10], label: 'WOBBLY' },
    { at: [0, -66], label: 'PIRRELLY' },
    { at: [-90, 10], label: 'DUNFLOP' },
  ],
  // the first Race of Champions at Wembley, 2007
  seed: 2007,
  // m past the road's edge the barriers stand (laid round the lanes, no run-off)
  runoffM: 3,
  followRails: true,
  // the barriers tidied, an Armco end carried on to the catch fence's round the crossover
  // (world/venuetidy.ts)
  tidyEdge: 'fences',
  railsSeen: WB_RAILS,
  // the crossover: the inner lane's way back out runs under the outer lane's way in
  crossover: { under: 'Crossover under' },
  // the crossover bridge's abutment walls (stone slats, world/venuecross.ts's kind): where the
  // edge's barrier ends short of an underpass portal's wall, in the X between the four arms
  landmarks: [
    { at: [-18.2, 23.2], kind: 'slat', size: 2, len: 6.6, rot: 0.73 },
    { at: [14.4, 60], kind: 'slat', size: 2, len: 9.5, rot: -2.15 },
  ],
  // a stadium: no trees, no bushes on its pitch
  trees: 0,
  bushless: true,
  // no kerbs: the lanes were laid on plates over the pitch, edged by the barriers
  kerbless: true,
  // the pitch's mown stripes inside the inner lane (6 m bands)
  mown: [{ at: [0, 0], pxM: 6, rows: Array.from({ length: 7 }, () => '#.#.#.#.#.#.#.#') }],
};

// the one layout - built on first use (world/load.ts buildLevel)
export const WOBBLY_LEVELS: Level[] = [
  { id: 'wobbly', name: WOBBLY_STADIUM, venue: WOBBLY_STADIUM,
    _lap: () => venueLap(WOBBLY_SPEC, 'roc'),
    _build: () => venueLevel(WOBBLY_SPEC, 'roc', 'wobbly', WOBBLY_STADIUM) } as Level,
];
