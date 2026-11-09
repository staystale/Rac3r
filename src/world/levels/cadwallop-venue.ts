// world/levels/cadwallop-venue.ts - CADWALLOP PARK, a NEW venue (?cadwallop=1, world/venue.ts):
// Cadwell Park (Lincolnshire) from OpenStreetMap (venues/cadwallop.ts) at 1/2 of real length with
// the 13 m road, its two layouts one venue sharing its scenery: the Full (the Mountain, Hall Bends,
// the Hairpin and Barn) and the Club (the Club Hairpin cutting from the foot of the Mountain onto
// the pit straight). Checked against Wikipedia (Full 3.502 km, Club 2.375; the OSM loops read 3423
// / 2311 m), its pit lane and the Club Hairpin's stand, and aerial photographs (ESRI World
// Imagery: the start gantry by the race control). The footbridge over the pit straight and
// Mansfield's straight by Coppice is left out: its deck centres on one road and its far leg
// stood on the other (two roads 21 game m apart; a start's hardest hit, 43 m/s). The Woodlands
// layout is not built: its link from the pit straight onto the Mountain is a U-turn between two
// roads 16 m apart.
// EU-DEM heights fitted as three hollows (rms 2.8 m): high to the west (Park, 144 m), down to the
// valley east of the pit straight (105). North up, the lap clockwise.
import { CADWALLOP_VENUE } from "./venues/cadwallop.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (agreed 11-09, owner: "Yes do those all"), in one place
export const CADWALLOP = 'Cadwallop Park';

export const CADWALLOP_SPEC: VenueSpec = {
  id: 'cadwallop',
  data: CADWALLOP_VENUE,
  share: 0.5,
  // m: the real road (about 9 m on the aerial photographs)
  realRoadM: 9,
  calibrate: { layout: 'full', realLapM: 3502 },
  // the Full's start / finish under the gantry by the race control (aerial photographs; the map
  // has no start node); the Club's, which runs no part of the pit straight above the Club
  // Hairpin, on the straight's foot before Coppice
  start: [235, -85],
  starts: { club: [153, 140] },
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the Hairpin, the Club Hairpin and the Gooseneck are tighter than the venue's least
  // radius
  minR: 10,
  // the hand finish (game m): an infield road's end ran 5 m on past the road it meets
  finish: { cut: [{ at: [21.5, -110], keep: [-4.9, -114.2] }] },
  // two pairs of stretches run closer than two 13 m roads at 1/2 scale allow (36 real m between
  // centres): the pit straight's foot and Mansfield's straight up to the Mountain, 16-24 m apart
  // for 160 m, and Mansfield's apex by Park Straight, 31 m - each pulled apart past a line
  // between them (where the lines cross the lap, Barn's start and Charlies' end are lengthened)
  warps: [
    { at: [170, 46], dir: [0.948, 0.318], band: 24, shift: 28 },
    { at: [-96, 359], dir: [-0.707, 0.707], band: 30, shift: 8 },
  ],
  // real m (scaled with the map): EU-DEM fitted (rms 2.8 m) - the high ground to the west, the
  // valley east of the pit straight, the slope away to the north-east
  hills: [
    { kind: 'dip', x: -67.5, y: 398.6, r: 635, d: 19.8 },
    { kind: 'dip', x: 262.9, y: -76.4, r: 267, d: 17.3 },
    { kind: 'dip', x: 520.8, y: -538.1, r: 1138, d: 35 },
  ],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  boards: [],
  // Cadwell Park's first race meeting, 1934
  seed: 1934,
};

// the two layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: CADWALLOP,
    _lap: () => venueLap(CADWALLOP_SPEC, layout),
    _build: () => venueLevel(CADWALLOP_SPEC, layout, levelId, name) } as Level);
export const CW_LEVELS: Level[] = [
  layoutLevel('full', 'cadwallop', `${CADWALLOP} Full`),
  layoutLevel('club', 'cadwallop-club', `${CADWALLOP} Club`),
];
