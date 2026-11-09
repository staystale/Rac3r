// world/levels/anglesleazy-venue.ts - ANGLESLEAZY, a NEW venue (?anglesleazy=1, world/venue.ts):
// the Anglesey Circuit (Trac Mon, Ty Croes) from OpenStreetMap (venues/anglesleazy.ts) at 1/2 of
// real length with the 13 m road, its four layouts one venue sharing its scenery: the
// International (the Corkscrew, Tom Pryce Straight out to the Hairpin, the Bus Stop, Target, the
// Banking and Church), the Coastal (the Corkscrew link cutting the Hairpin loop), the National
// (the west loop and the Hairpin loop, School Corner between them) and the Club (the Club Hairpin
// off School onto the start straight). Checked against Wikipedia (International 3.380 km,
// Coastal 2.494, National 1.931, Club 1.287; the OSM loops read 3296 / 2472 / 1909 / 1276 m),
// OSM's start / finish node, its two pit lanes and its 31 rails, and aerial photographs. EU-DEM
// heights fitted (rms 2.6 m): the ridge by Peel and the Corkscrew (31 m) falling to the sea.
// North up.
import { ANGLESLEAZY_VENUE } from "./venues/anglesleazy.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (agreed 11-09, owner: "Yes do those all"), in one place
export const ANGLESLEAZY = 'Anglesleazy';

export const ANGLESLEAZY_SPEC: VenueSpec = {
  id: 'anglesleazy',
  data: ANGLESLEAZY_VENUE,
  share: 0.5,
  // m: the real road (about 11 m on the aerial photographs)
  realRoadM: 11,
  calibrate: { layout: 'international', realLapM: 3380 },
  // the start / finish on the start straight (OSM's start-finish node), the International's and
  // the Coastal's; the National's on the Hairpin Straight by its own pit lane, the Club's at the
  // middle of the straight out of the Banking (neither runs the line; the Club's stub past its
  // hairpin is 25 m)
  start: [73.1, -101.1],
  starts: { national: [3, -300], club: [290, -291] },
  startOnLine: true,
  pitLane: ['Pit Lane', 'National Pit Lane'],
  // the main pit lane leaves the lap in the Bus Stop, where its points beside the road folded back
  // over themselves: laid as mapped there
  pitCuts: true,
  // the hand finish (game m): the public road north of the Banking, cut short by the map's reach,
  // left out (it ran to nowhere)
  finish: { drop: [[170, -455]] },
  // m (game): the Hairpin, the Club Hairpin and the Corkscrew are tighter than the venue's least
  // radius
  minR: 10,
  // real m (scaled with the map): EU-DEM fitted (rms 2.6 m) - the ridge to the west, the fall to
  // the start straight and the sea
  hills: [
    { kind: 'dip', x: -14, y: -415.7, r: 394, d: 20.7 },
    { kind: 'hump', x: -76.3, y: -458.1, r: 536, h: 33.9 },
  ],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  boards: [],
  // the edge as the real circuit's: Armco where OSM maps its rails
  followRails: true,
  // the Anglesey Circuit opened in 1997
  seed: 1997,
};

// the four layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: ANGLESLEAZY,
    _lap: () => venueLap(ANGLESLEAZY_SPEC, layout),
    _build: () => venueLevel(ANGLESLEAZY_SPEC, layout, levelId, name) } as Level);
export const AG_LEVELS: Level[] = [
  layoutLevel('international', 'anglesleazy', `${ANGLESLEAZY} International`),
  layoutLevel('coastal', 'anglesleazy-coastal', `${ANGLESLEAZY} Coastal`),
  layoutLevel('national', 'anglesleazy-national', `${ANGLESLEAZY} National`),
  layoutLevel('club', 'anglesleazy-club', `${ANGLESLEAZY} Club`),
];
