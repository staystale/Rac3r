// world/levels/croughed-venue.ts - CROUGHED, a NEW venue (?croughed=1, world/venue.ts): Croft
// Circuit (North Yorkshire) from OpenStreetMap (venues/croughed.ts) at 1/2 of real length with the
// 13 m road: Clervaux, Hawthorn, the chicane, the Back Straight, Tower Bend, the Esses, Barcroft,
// Sunny, the Complex and the Hairpin onto the Main Straight, on the old airfield. Checked against
// Wikipedia (the Main Circuit 3.423 km, the OSM loop 3299 m; Club Circuit 'A' 1.997 km over the
// Club Link, 1860 m), OSM's start / finish node, its pit lane and its barrier lines (barrier=wall,
// which tools/osmvenue.mjs does not read), and aerial photographs (ESRI World Imagery) for the
// barriers and the gravel at Clervaux and Barcroft. The rallycross loop through the infield is
// left out (venues/croughed.json skip: a dirt road that would end in the run-off at both ends).
// EU-DEM heights fitted as one slope (rms 0.8 m): up to the south-west by Barcroft (59 m) from
// Clervaux (50). North up, the lap clockwise.
import { CROUGHED_VENUE } from "./venues/croughed.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE REAL BARRIERS: OSM maps them as barrier=wall (one mapper, with the raceways), and the aerial
// photographs (ESRI World Imagery, 0.35 m a pixel) show them on those lines - the Complex's outside
// a row of blocks on it. Real m, OSM's lines (simplified to 0.5 m), followed as rails (the edge's
// Armco at the rim beside them; behind the gravel at Clervaux and Barcroft); the pit wall, the
// walls round the paddock and the huts and an infield wall 40 m off the road left out
const CR_RAILS: Point[][] = [
  // the wood's edge inside the Complex, the Hairpin and the Esses
  [[-165.7, 204.2], [-162.5, 196.8], [-50.0, 107.8], [-38.2, 112.8], [-35.5, 118.7],
    [-33.0, 143.9], [-64.7, 267.0], [-71.8, 269.9], [-118.9, 233.8], [-165.7, 204.2]],
  // the Back Straight's outside on to Tower Bend
  [[135.5, 428.5], [154.8, 392.0], [154.9, 324.2], [157.2, 190.3], [166.5, 138.9], [172.7, 114.4],
    [177.1, 103.7], [182.0, 95.6]],
  // inside the Hairpin
  [[-3.7, 160.8], [-18.4, 218.2], [-20.6, 215.0], [-15.7, 207.7]],
  // between the way into the Hairpin and the Main Straight
  [[-4.9, 160.8], [-0.3, 80.7]],
  // Clervaux's outside, behind the gravel
  [[296.5, -424.8], [291.2, -429.3], [274.4, -428.8], [256.3, -422.1], [235.6, -416.2],
    [222.1, -405.9], [204.2, -400.3], [172.8, -402.5], [156.7, -398.8], [129.8, -362.5]],
  // the west side past Sunny In, then Barcroft's outside behind the gravel
  [[-540.9, -153.2], [-540.1, -132.8], [-542.7, -119.9], [-543.3, -103.5], [-538.4, -86.6],
    [-534.7, -68.9], [-532.4, -63.3], [-531.1, -32.8], [-513.7, 24.9], [-493.2, 48.6],
    [-463.3, 78.7], [-412.9, 121.8], [-389.6, 149.1], [-363.5, 170.4]],
  // the Esses' south side
  [[-177.9, 227.6], [-143.4, 251.6], [-78.5, 300.2], [-61.9, 314.3], [-38.6, 345.1]],
  // Hawthorn's outside, the chicane and down the Back Straight
  [[207.6, -29.1], [230.8, -113.4], [237.7, -140.5], [239.8, -152.3], [259.5, -175.9],
    [289.9, -222.3], [317.3, -261.5], [329.5, -290.7], [332.5, -316.0], [332.1, -337.0],
    [321.2, -377.3], [314.4, -399.0], [301.9, -432.4]],
  // the Back Straight's outside
  [[180.3, 91.2], [201.7, 7.9], [207.0, -3.1], [212.0, -23.2]],
  // the run to Clervaux, its west side past the pits
  [[136.9, -357.7], [129.3, -327.1], [120.0, -295.3], [91.6, -190.0], [74.8, -156.6]],
  // south of the way out of Tower Bend
  [[-31.8, 336.6], [28.1, 372.6]],
  // Sunny Out to the Complex's outside (the row of blocks), round to the Hairpin
  [[-9.2, 83.8], [-12.8, 72.9], [-40.2, 55.7], [-91.4, 86.9], [-111.4, 95.4], [-137.9, 101.8],
    [-160.1, 102.4], [-180.4, 92.8], [-195.0, 74.7], [-310.8, -103.9], [-321.8, -127.3],
    [-365.4, -202.6]],
  // the Back Straight's inside
  [[138.1, 160.6], [146.9, 117.5], [148.0, 103.9]],
];
// Sunny's outside: the barrier stands 37-72 m back, past the old runway - laid as a tyre wall at
// its real place (the run-off reaches it), not at the rim
const CR_WALLS: Point[][] = [
  // OSM's line, past the runway
  [[-377.0, -210.7], [-389.3, -212.6], [-428.6, -204.0], [-551.2, -190.1], [-562.0, -173.2]],
];

// the venue's name (the owner's pick, 11-09: "CROUGHED"), in one place
export const CROUGHED = 'Croughed';

export const CROUGHED_SPEC: VenueSpec = {
  id: 'croughed',
  data: CROUGHED_VENUE,
  share: 0.5,
  // m: the real road (about 12 m on the aerial photographs)
  realRoadM: 12,
  calibrate: { layout: 'circuit', realLapM: 3423 },
  // the start / finish on the Main Straight (OSM's start-finish node), the club's too
  start: [54.8, -9.8],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // the hand finish (game m): the paddock north of Clervaux is one paved strip the map runs two
  // roads through - the perimeter road starts at the access road from West Lane instead of running
  // beside the paddock road; its spur to West Lane that ran back along it starts where it leaves
  // it; West Lane ends at the farm road and at the access road (both ways it leaves the venue)
  finish: {
    cut: [
      { at: [111.8, -265.2], keep: [124.6, -261.6] },
      { at: [186.6, -167.4], keep: [219.3, -170.1] },
      { at: [224.8, 46], keep: [224.1, 15.8] },
      { at: [240.0, -254.5], keep: [234.8, -211.7] },
    ],
    roads: [{ pts: [[111.8, -265.2], [109.8, -270.5], [110.2, -276.5]] }],
  },
  // the Hairpin's two legs run 33-34 m apart, closer than two 13 m roads at 1/2 scale allow (36
  // real m between centres; the trace eased its whole length away), and the pit lane runs between
  // them: the way in, and all to the west, pulled 17 m off a line between them - 8 m for the two
  // roads, 9 more to clear the pit lane, which had overlapped the way in by 1.6 m (where the line
  // crosses the lap, the Hairpin's foot and the Esses are lengthened)
  warps: [{ at: [-14, 185], dir: [-0.973, -0.229], band: 12, shift: 17 }],
  // m (game): the Hairpin is tighter than the venue's least radius
  minR: 10,
  // real m (scaled with the map): EU-DEM fitted (rms 0.8 m) - the slope up to the south-west
  hills: [{ kind: 'hump', x: -487, y: 655.1, r: 1688.8, h: 11.8 }],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  boards: [],
  // the first race meeting on the old airfield, 1964
  seed: 1964,
  followRails: true,
  railsSeen: CR_RAILS,
  tyreWalls: CR_WALLS,
};

// each layout its own level - built on first use (world/load.ts buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: CROUGHED,
    _lap: () => venueLap(CROUGHED_SPEC, layout),
    _build: () => venueLevel(CROUGHED_SPEC, layout, levelId, name) } as Level);
export const CR_LEVELS: Level[] = [
  layoutLevel('circuit', 'croughed', CROUGHED),
  layoutLevel('club', 'croughed-club', `${CROUGHED} Club`),
];
