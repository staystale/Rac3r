// world/levels/knobhill-venue.ts - KNOBHILL AS THE REAL VENUE (?knobhillvenue=1, world/venue.ts):
// Knockhill (Fife) from OpenStreetMap (venues/knobhill.ts) at 1/2 of real length with the 13 m
// road, two layouts of one venue sharing its scenery. Checked against Wikipedia (the International
// layout 2.039 km, 10 m wide, 37 m of climb: the crest by the start its highest point, the foot
// of the hill after Butcher's its lowest), the circuit's own map (the rallycross "1 mile, asphalt
// and gravel dust"), British Rallycross reports and aerial photographs. North up, as the old level
// sat: the start straight along the top, the lap clockwise.
//   THE CIRCUIT: the International layout - Duffus Dip, Leslie's, McIntyre's, Butcher's, the
//     chicane, Clark's, Hislop's, the Railway Straight and Taylor's hairpin (OSM 2037 m).
//   THE RALLYCROSS (the level the old Knobhill was, category rx): over the crest and down Duffus
//     Dip, off Leslie's onto the gravel through the infield to Hislop's (OSM 562 m of 1384: 41 %
//     loose, the old level's 39 %), up the Railway Straight and "cutting up the escape road" to the
//     start straight. The JOKER is the real one: "run along the bottom straight and around the
//     hairpin" instead (British Rallycross, Knockhill).
import { KNOBHILL_VENUE } from "./venues/knobhill.ts";
import { venueLap, venueLevel } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const KNOBHILL_SPEC: VenueSpec = {
  id: 'knobhill',
  data: KNOBHILL_VENUE,
  share: 0.5,
  // m: the real road (the circuit's own map: 30 ft)
  realRoadM: 10,
  calibrate: { layout: 'circuit', realLapM: 2039 },
  // the start / finish line on the start straight (OSM's start-finish node)
  start: [-47.4, -290],
  pitLane: 'Pit Lane',
  // real m (scaled with the map), the old level's hills at the real corners: Duffus Dip's drop to
  // the foot at Leslie's, Clark's blind uphill crest, the hairpin on the hill top
  hills: [
    { kind: 'dip', x: 268, y: -214, r: 110, d: 7 },
    { kind: 'hump', x: 8, y: 95, r: 64, h: 4.4 },
    { kind: 'hump', x: -385, y: -300, r: 190, h: 8 },
  ],
  banks: [],
  // the boards on the barriers by the stands and at Butcher's (the old level's brands)
  boards: [
    { at: [-420, -330], label: 'KNOBHILL' },
    { at: [395, -40], label: 'KUM TYRES' },
  ],
  // the rallycross joker: the circuit's hairpin, which the rallycross lap cuts out
  joker: { layout: 'rx', loop: 'circuit', near: [-385, -300] },
  seed: 1974,
};

// the two layouts of the one venue, each built on first use (world/load.ts buildLevel)
const circuitLevel = (): Level =>
  venueLevel(KNOBHILL_SPEC, 'circuit', 'knobhill-circuit', 'Knobhill Circuit');
export const KH_VENUE_LEVELS: Level[] = [
  ({ id: 'knobhill', name: 'Knobhill', venue: 'Knobhill', _lap: () => venueLap(KNOBHILL_SPEC, 'rx'),
    _build: () => rallycrossLevel(KNOBHILL_SPEC, 'rx', 'knobhill', 'Knobhill') } as Level),
  ({ id: 'knobhill-circuit', name: 'Knobhill Circuit', venue: 'Knobhill',
    _lap: () => venueLap(KNOBHILL_SPEC, 'circuit'), _build: circuitLevel } as Level),
];
