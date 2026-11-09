// world/levels/oultonpork-venue.ts - OULTON PORK, a venue (world/venue.ts; passed 11-09): Oulton
// Park (Cheshire) from OpenStreetMap (venues/oultonpork.ts) at 1/2 of real length with the 13 m
// road, its three layouts one venue sharing its scenery: the International
// (the Island Bend loop out to the Shell Oils hairpin and back through Britten's), the Island (the
// Island hairpin cutting the loop) and the Fosters (Foster's cutting from Cascades to Hislop's).
// Checked against Wikipedia (International 4.307 km, Island 3.616, Fosters 2.656; the OSM loops
// read 4322 / 3572 / 2684 m), OSM's start / finish node on the pit straight, its pit lane and
// footbridge at Clay Hill, and aerial photographs (the footbridge over Deer Leap and the pit
// entry, the gravel at Druids, Lodge and the Shell Oils hairpin, which the map does not carry).
// EU-DEM heights fitted as three hills: high in the north (Druids 76 m, Lodge 75), the valley
// through Cascades (55) and Knickerbrook, the lake's basin by Lakeside and the Island (54-60).
// North up, the lap clockwise. OSM maps no rails: the edge is the venue rule's (Armco behind the
// gravel and before hazards - another stretch of the track, a building).
import { OULTONPORK_VENUE } from "./venues/oultonpork.ts";
import { venueLap, venueLevel } from "../venue.ts";
import { FIX } from "../../core/fixes.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE REAL ARMCO (?oultonrails=1; owner 11-09: "Yes do those all" - OSM maps none, and Old Hall's
// exit was open grass with the car park behind it: 20-car starts threw cars 13-23 m off into the
// parked cars). Traced from aerial photographs (ESRI World Imagery, 0.36 m a pixel), real m, each
// a barrier line the edge follows (spec.railsSeen with followRails): the Armco stands at the
// run-off's rim beside it
const OP_RAILS: Point[][] = [
  // Lodge's exit, down Deer Leap and the pit straight on the outside to Old Hall
  [[237, -635], [225, -590], [214, -554], [214, -500], [216.5, -438], [236, -348], [257, -270],
    [275, -204], [287, -160]],
  // past Old Hall's tyre wall, along The Avenue's and Denton's south side to Cascades
  [[140, -11], [99, 13.5], [60, 33], [30, 48], [-19.5, 77.5], [-82.5, 88.9], [-118.5, 96.4],
    [-150, 112], [-165, 130]],
  // The Avenue's and Denton's north side, from past the pit exit to Cascades
  [[126, -48], [90, -22.5], [45, 0], [21, 14.5], [-9, 29.5], [-30, 38.5], [-114, 49],
    [-186, 63.4]],
  // the lake side, from Cascades down Lakeside, round Island Bend to the Shell Oils gravel
  [[-163.5, 145], [-159, 175], [-150, 196], [-132, 220], [-114, 248.5], [-87.5, 295.5],
    [-62, 351], [-38, 390], [-14, 426], [7, 465], [19, 496], [46, 538], [70, 580], [100, 610],
    [148, 634], [235, 632], [310, 615.5], [364, 606.5]],
  // between Lakeside and Hilltop, to the Island hairpin
  [[-171.5, 333.6], [-140, 372], [-110, 411], [-80, 444], [-58, 476], [-35, 496], [13, 541]],
  // Britten's outside and the Shell Oils loop's return leg, south side
  [[-65, 520], [-53, 562], [-41, 598], [-30.5, 631], [4, 649], [40, 670], [100, 702.5],
    [139, 719]],
  // Hislop's outside, from Knickerbrook along the stream
  [[-367.5, 61], [-327, 83.5], [-288, 103], [-222, 115]],
  // the old Knickerbrook line's far side and Hilltop's end, to Hislop's
  [[-381, 83.5], [-354, 136], [-312, 190], [-270, 238], [-240, 268]],
  // Clay Hill's east side, from Knickerbrook up past the footbridge
  [[-330, -36], [-324, -66], [-309, -108], [-294, -144], [-286.5, -198], [-270, -225],
    [-258, -300]],
  // the straight from Druids to Lodge, its south side (Lodge's inside)
  [[-43.5, -662.5], [0, -674.5], [45, -686.5], [90, -698], [150, -707], [195, -711.5]],
];

// OLD HALL'S OUTSIDE (the start crash review: the field runs wide there from the turn-in, 154-180 m
// from the line, and carried on over the open grass into the car park, trees and lamps at 225-270
// m): the real barrier with its tyres, 15-17 real m past the road's edge round the corner and its
// exit (aerial photographs at 0.1 m a pixel), laid as a tyre wall - the run-off reaches it, the two
// tyre rows in front of its Armco
const OP_WALLS: Point[][] = [
  [[287, -160], [286, -120], [281, -108], [275, -94], [270, -81], [259, -74], [240, -65],
    [224.4, -57.8], [206.7, -50.6], [185.6, -39.4], [173.3, -31.7], [156.7, -21.7], [140, -11]],
];

// the venue's name (a working name until the owner picks), and the Fosters layout's (a parody of
// the lager it was named for), in one place
export const OULTONPORK = 'Oulton Pork';
export const OULTONPORK_FOSTERS = 'Frosters';

export const OULTONPORK_SPEC: VenueSpec = {
  id: 'oultonpork',
  data: OULTONPORK_VENUE,
  share: 0.5,
  // m: the real road (about 10 m on the aerial photographs)
  realRoadM: 10,
  calibrate: { layout: 'international', realLapM: 4307 },
  // the start / finish line on the pit straight (OSM's start-finish node), every layout's
  start: [213, -391.6],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the Shell Oils and Island hairpins and Lodge are tighter than the venue's least
  // radius
  minR: 11,
  // the hand finish (game m): the village road north of Lodge, cut short by the map's reach, ends
  // at the farm road's junction (its stub on dropped); south of the paddock a road laid over the
  // loop road (crossing it twice, and the paddock's side road) and a spur left without it
  // dropped, the side road that met it ended on the loop
  finish: {
    drop: [[197, -398.5], [30, -79], [-4, -58]],
    cut: [{ at: [145, -398], keep: [100, -397] }, { at: [9, -101.5], keep: [11, -132] }],
  },
  // real m (scaled with the map): EU-DEM fitted (rms 2 m) - the high ground to the north, the
  // valley through Cascades and Knickerbrook, the lake's basin
  hills: [
    { kind: 'dip', x: -240, y: 115, r: 414, d: 12.3 },
    { kind: 'hump', x: -145, y: -1078, r: 965, h: 13.6 },
    { kind: 'dip', x: 225, y: 563, r: 614, d: 13.9 },
  ],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  // the boards on the Armco behind the gravel at Cascades, Lodge, Druids and Knickerbrook (the
  // register's brands)
  boards: [
    { at: [-215, 110], label: 'OULTON PORK' },
    { at: [242, -690], label: 'DUNFLOP' },
    { at: [-332, -620], label: 'PIRRELLY' },
    { at: [-410, 20], label: 'GOOD YEAH' },
  ],
  // Oulton Park's first race meeting, 1953
  seed: 1953,
  ...(FIX.oultonrails ? { followRails: true, railsSeen: OP_RAILS, tyreWalls: OP_WALLS } : {}),
};

// the three layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: OULTONPORK,
    _lap: () => venueLap(OULTONPORK_SPEC, layout),
    _build: () => venueLevel(OULTONPORK_SPEC, layout, levelId, name) } as Level);
export const OP_LEVELS: Level[] = [
  layoutLevel('international', 'oultonpork', `${OULTONPORK} International`),
  layoutLevel('island', 'oultonpork-island', `${OULTONPORK} Island`),
  layoutLevel('fosters', 'oultonpork-fosters', `${OULTONPORK} ${OULTONPORK_FOSTERS}`),
];
