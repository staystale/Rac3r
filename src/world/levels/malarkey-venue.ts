// world/levels/malarkey-venue.ts - MALARKEY PARK, a NEW venue (?malarkey=1, world/venue.ts):
// Mallory Park (Leicestershire) from OpenStreetMap (venues/malarkey.ts) at 1/2 of real length
// with the 13 m road, its two car layouts one venue sharing its scenery: the Car Circuit (Gerard's,
// Stebbe Straight, the John Cooper Esses out to Shaw's Hairpin, back down the Devil's Elbow) and
// the Oval (the Castrol link from the Esses onto Kirkby Straight, no hairpin loop). Checked against
// Wikipedia (Car 2.173 km, Oval 1.609; the OSM loops read 2035 / 1553 m), OSM's start / finish node
// on Kirkby Straight, its pit lane, footbridges and the gravel it maps as sand, and aerial
// photographs (ESRI World Imagery) for the Armco, which the map does not carry. The bike layouts
// (the Bus Stop, Edwina's and the Charlie's / Stapleton's complex) are not built. EU-DEM heights
// fitted as two hollows (rms 1.7 m): the lake's basin in the infield (103 m), up to the paddock by
// the hairpin (125). North up, the lap clockwise.
import { MALARKEY_VENUE } from "./venues/malarkey.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE REAL ARMCO (OSM maps none at Mallory): barrier lines seen on aerial photographs (ESRI World
// Imagery, 0.36 m a pixel), real m, each followed by the edge (spec.railsSeen with followRails)
const MP_RAILS: Point[][] = [
  // between the hairpin loop's two legs, and the Esses' north side out to Shaw's Hairpin
  [[54, -380], [132, -422], [210, -455]],
  [[-60, -396.5], [30, -419], [120, -444.5], [210, -474.5]],
  // the Devil's Elbow's south side by the hairpin
  [[168, -419], [240, -440]],
  // Kirkby Straight's east side
  [[44.7, -170], [44.7, -131], [45.7, 51], [46, 90]],
];

// the barriers that stand well back across the grass - Gerard's inside along the lake, Stebbe
// Straight's west side, 10-17 real m past the road's edge, Gerard's outside by the perimeter road,
// 50 m - laid as tyre walls (the run-off
// reaches them, two tyre rows in front of their Armco): followed as rails their Armco stood 5.5 m
// off the edge, and the 20-car starts' field ran into it (17 of 21 hits)
const MP_WALLS: Point[][] = [
  [[-163, 232], [-121, 248.5], [-82, 253], [-40, 247], [2, 220], [26, 178], [32, 136],
    [30.5, 100]],
  [[-240.8, -180], [-252, -93], [-263, -26], [-268.8, 16]],
  // (the run-off reaches the wall: no tree stands in it - the starts' hardest hits were trees
  // 13 m off Gerard's outside edge, where the photographs show open grass)
  [[-220, 253], [-183.6, 281], [-150, 303.6], [-108, 316], [-63, 316], [-24, 309], [9.6, 298],
    [32, 285.4], [48.8, 264.4], [57, 242]],
];

// the venue's name (agreed 11-09, owner: "Yes do those all"), in one place
export const MALARKEY = 'Malarkey Park';

export const MALARKEY_SPEC: VenueSpec = {
  id: 'malarkey',
  data: MALARKEY_VENUE,
  share: 0.5,
  // m: the real road (about 10 m on the aerial photographs)
  realRoadM: 10,
  calibrate: { layout: 'car', realLapM: 2173 },
  // the start / finish on Kirkby Straight (OSM's start-finish node), both layouts'
  start: [35.6, -129.2],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): Shaw's Hairpin is tighter than the venue's least radius
  minR: 10,
  // the hand finish (game m): the service roads east of Kirkby Straight (cut short by the map's
  // reach, a 9 m track stub, the paddock lanes off them) left out; north of the paddock a farm
  // road that ran on over the road beside it (crossing it) ends where it meets it, and that road
  // where it meets the farm road (beyond, it ran to the map's reach)
  finish: {
    drop: [[45, 16.6], [46.1, -51.5], [73, -114], [132.7, -183.9], [98.4, -149.6],
      [128.8, -191.1], [76.3, -154.7]],
    cut: [{ at: [97, -288.5], keep: [44, -273] }, { at: [95, -291.5], keep: [96, -275] }],
  },
  // the hairpin loop's two legs (the Esses out, the Devil's Elbow back) run 22-32 real m apart for
  // 170 m (two 13 m roads at 1/2 scale need 36): everything south of a line between them moved
  // 16 m on - Shaw's Hairpin widens; where the line leaves the loop it lengthens Stebbe Straight's
  // top and the Castrol link
  warps: [{ at: [150, -431], dir: [0.426, 0.905], band: 30, shift: 16 }],
  // real m (scaled with the map): EU-DEM fitted (rms 1.7 m)
  hills: [
    { kind: 'dip', x: -35.5, y: 255.2, r: 701, d: 28 },
    { kind: 'dip', x: -129.4, y: -382.5, r: 658, d: 19.5 },
  ],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  boards: [],
  followRails: true,
  railsSeen: MP_RAILS,
  tyreWalls: MP_WALLS,
  // Mallory Park's first meeting on the tarmac circuit, 1956
  seed: 1956,
};

// the two layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: MALARKEY,
    _lap: () => venueLap(MALARKEY_SPEC, layout),
    _build: () => venueLevel(MALARKEY_SPEC, layout, levelId, name) } as Level);
export const MP_LEVELS: Level[] = [
  layoutLevel('car', 'malarkey', `${MALARKEY} Car Circuit`),
  layoutLevel('oval', 'malarkey-oval', `${MALARKEY} Oval`),
];
