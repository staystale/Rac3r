// world/levels/oultonpork-venue.ts - OULTON PORK (working name), a NEW venue (?oultonpork=1,
// world/venue.ts): Oulton Park (Cheshire) from OpenStreetMap (venues/oultonpork.ts) at 1/2 of real
// length with the 13 m road, its three layouts one venue sharing its scenery: the International
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
import { venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

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
};

// the three layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: OULTONPORK,
    _build: () => venueLevel(OULTONPORK_SPEC, layout, levelId, name) } as Level);
export const OP_LEVELS: Level[] = [
  layoutLevel('international', 'oultonpork', `${OULTONPORK} International`),
  layoutLevel('island', 'oultonpork-island', `${OULTONPORK} Island`),
  layoutLevel('fosters', 'oultonpork-fosters', `${OULTONPORK} ${OULTONPORK_FOSTERS}`),
];
