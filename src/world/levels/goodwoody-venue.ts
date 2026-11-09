// world/levels/goodwoody-venue.ts - GOODWOODY, a NEW venue (?goodwoody=1, world/venue.ts): the
// Goodwood Motor Circuit (West Sussex) from OpenStreetMap (venues/goodwoody.ts) at 1/2 of real
// length with the 13 m road: Madgwick, Fordwater, St Mary's, Lavant, the Lavant Straight,
// Woodcote and the chicane onto the start / finish straight, round the airfield. Checked against
// Wikipedia (3.809 km; the OSM loop reads 3818 m), OSM's start / finish node, its pit lane, its
// seven grandstands, the tunnels under the track and the airfield's runways, and aerial
// photographs (ESRI World Imagery) for the Armco and tyre walls, which the map does not carry.
// EU-DEM heights fitted as one slope (rms 1.5 m): up to the north by Lavant (34 m) from
// Fordwater (22). North up, the lap clockwise.
import { GOODWOODY_VENUE } from "./venues/goodwoody.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// THE REAL BARRIERS (OSM maps none at Goodwood): lines seen on aerial photographs (ESRI World
// Imagery, 0.38 m a pixel), real m. The start / finish straight's east side is a followed rail
// (the edge's Armco at the rim beside it); the corners' barriers stand 15-30 m back across the
// grass, so they are laid as tyre walls at their real place (the run-off reaches them, two tyre
// rows in front of their Armco)
const GW_RAILS: Point[][] = [
  [[402, -200], [403.5, -101], [406.5, -86], [411, 10], [417, 100]],
];
const GW_WALLS: Point[][] = [
  // Madgwick's outside
  [[453.6, 348], [451.5, 390], [444, 420], [426, 433.5], [390, 451.5], [360, 465], [330, 475.5]],
  // St Mary's outside
  [[-439.6, -286], [-453.2, -235], [-466.8, -184], [-483.8, -116], [-494, -48], [-490.6, 3]],
  // Lavant's outside, above the gravel
  [[-643.6, -660.8], [-596, -666.4], [-545.6, -670.6], [-484, -666.4], [-400, -653.8]],
  // Woodcote's outside, past its tarmac run-off (from where the perimeter road leaves it)
  [[461.6, -486.4], [484, -453], [481, -422], [475.6, -394], [468.6, -360]],
];

// the venue's name (agreed 11-09, owner: "Yes do those all"), in one place
export const GOODWOODY = 'Goodwoody';

export const GOODWOODY_SPEC: VenueSpec = {
  id: 'goodwoody',
  data: GOODWOODY_VENUE,
  share: 0.5,
  // m: the real road (about 11 m on the aerial photographs)
  realRoadM: 11,
  calibrate: { layout: 'circuit', realLapM: 3809 },
  // the start / finish on the start / finish straight (OSM's start-finish node)
  start: [412.5, 72.2],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // the hand finish (game m): a farm track and its 10 m stub and an airfield lane that ended in the
  // grass left out; the road south from the roundabout by Woodcote starts at the ring (it crossed
  // it)
  finish: {
    drop: [[-24, -328.8], [22, -321.5], [133.4, -69.7]],
    cut: [{ at: [283.6, -246], keep: [282.7, -240.8] }],
  },
  // m (game): the chicane is tighter than the venue's least radius
  minR: 10,
  // real m (scaled with the map): EU-DEM fitted (rms 1.5 m) - the slope up to the north
  hills: [{ kind: 'hump', x: -42.9, y: -1021.1, r: 2447, h: 17.3 }],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  boards: [],
  // Goodwood's first race meeting, 1948
  seed: 1948,
  followRails: true,
  railsSeen: GW_RAILS,
  tyreWalls: GW_WALLS,
};

// the one layout - built on first use (world/load.ts buildLevel)
export const GW_LEVELS: Level[] = [
  { id: 'goodwoody', name: GOODWOODY, venue: GOODWOODY,
    _lap: () => venueLap(GOODWOODY_SPEC, 'circuit'),
    _build: () => venueLevel(GOODWOODY_SPEC, 'circuit', 'goodwoody', GOODWOODY) } as Level,
];
