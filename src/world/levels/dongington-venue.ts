// world/levels/dongington-venue.ts - DONGINGTON PARK, a NEW venue (world/venue.ts; PASSED 11-09):
// Donington Park (Leicestershire) from OpenStreetMap (venues/dongington.ts) at 1/2 of real length
// with the 13 m road, its two layouts one venue sharing its scenery: the GP (with the Melbourne
// Loop) and the National (Roberts cutting from the Esses to the pit straight). Checked against
// Wikipedia (GP 4.020 km, National 3.149 km; the OSM loops read 4000 / 3181 m), the OSM start /
// finish node, OSM's rails, tyre walls and gravel traps, its four tunnels under the track (the
// Paddock, Coppice and Williamson tunnels and the footway under Starkey's Straight), the Hollywood
// grandstand and the pit garages, EU-DEM heights (Redgate 88 m, Craner Curves 75, the Old Hairpin
// 67, McLeans 90, Coppice 96) and aerial photographs. North up: the pit straight (Wheatcroft
// Straight) across the middle run west to Redgate, the lap clockwise.
import { DONGINGTON_VENUE } from "./venues/dongington.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (the owner's pick, 11-09), in one place
export const DONGINGTON = 'Dongington Park';

export const DONGINGTON_SPEC: VenueSpec = {
  id: 'dongington',
  data: DONGINGTON_VENUE,
  share: 0.5,
  // m: the real road (about 11 m on the aerial photographs)
  realRoadM: 11,
  calibrate: { layout: 'gp', realLapM: 4020 },
  // the start / finish line on the pit straight (OSM's start-finish node)
  start: [-339.2, 17.9],
  // (the map draws the pit straight as its two ends: the line where the node is on it)
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the Melbourne Hairpin and Goddards are tighter than the venue's least radius
  minR: 11,
  // the hand finish (game m): a service road by the Melbourne Hairpin stopped 4 m short of the one
  // it meets
  finish: { roads: [{ pts: [[-313, 146.5], [-300, 145]] }] },
  // real m (scaled with the map): the valley the lap drops into - Craner Curves down to the Old
  // Hairpin (EU-DEM: 88 m at Hollywood, 67 at the Old Hairpin), back up Starkey's to McLeans (90)
  hills: [{ kind: 'dip', x: -50, y: -290, r: 420, d: 22 }],
  // no viewing banks: a bank brings a catch fence, and no source shows one
  banks: [],
  // the edge as the real circuit's: Armco where OSM maps its rails
  followRails: true,
  // the boards on the barriers by the pit straight, Craner Curves, McLeans and Coppice (the
  // register's brands)
  boards: [
    { at: [-420, 40], label: 'DONGINGTON' },
    { at: [-300, -330], label: 'DUNFLOP' },
    { at: [480, -205], label: 'PIRRELLY' },
    { at: [660, 60], label: 'GOOD YEAH' },
  ],
  // Donington Park opened in 1931
  seed: 1931,
};

// the two layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: DONGINGTON,
    _lap: () => venueLap(DONGINGTON_SPEC, layout),
    _build: () => venueLevel(DONGINGTON_SPEC, layout, levelId, name) } as Level);
export const DG_LEVELS: Level[] = [
  layoutLevel('gp', 'dongington', `${DONGINGTON} GP`),
  layoutLevel('national', 'dongington-national', `${DONGINGTON} National`),
];
