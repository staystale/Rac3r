// world/levels/brands-venue.ts - BRANDS SNATCH AS THE REAL VENUE (world/venue.ts):
// the real Brands Hatch from OpenStreetMap (venues/brands-snatch.ts) at 1/2 of real length with
// the 13 m road, the GP and the Indy as two layouts of one venue sharing its scenery. Checked
// against the circuit's own venue map (art/ref/bh-indy-msv.png: the grandstands, pits, paddocks,
// both GP road bridges and the Hailwood Hill footbridge are where OSM has them) and Wikipedia (the
// OSM loops read 1929 / 3900 m, the official 1944 / 3916 m). The hills are the old level's (from
// the contour map art/ref/bh1.png), carried into real metres (the old trace: 0.656 real m a map
// pixel, turned 28 deg); the frame is turned as the old level was (Brabham across the top).
import { BRANDS_VENUE } from "./venues/brands-snatch.ts";
import { venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const BRANDS_SPEC: VenueSpec = {
  id: 'brands-snatch',
  data: BRANDS_VENUE,
  share: 0.5,
  // m: the real Brands road (9-12 m): at 1/2 the game's 13 m road is wider, so the map steps back
  realRoadM: 10,
  calibrate: { layout: 'gp', realLapM: 3916 },
  // the start / finish line on Brabham Straight (the old map's chequer)
  start: [14.7, -414.1],
  pitLane: 'Pit Lane',
  // real m: Paddock Hill's plunge, Druids' rise, Pilgrims Drop's valley, Dingle Dell, the high
  // ground west of the infield (heights ~half the real ones, as every circuit: tools/crestcheck)
  hills: [
    { kind: 'dip', x: 267.4, y: -215.2, r: 116.5, d: 8.5 },
    { kind: 'hump', x: 149.2, y: -61, r: 88.9, h: 4.7 },
    { kind: 'dip', x: 119.7, y: 142.5, r: 232.9, d: 9.5 },
    { kind: 'dip', x: -136.3, y: 457.6, r: 95.3, d: 4.7 },
    { kind: 'hump', x: -228.2, y: -15, r: 317.6, h: 6.4 },
  ],
  // the spectator banks outside Paddock Hill Bend and along Cooper Straight (the Southbank)
  banks: [
    { pts: [[283.2, -445.1], [317.4, -418.5], [346.4, -378.7], [361.3, -332.3], [363.1, -316.8],
      [354.9, -240.4], [331, -181.4], [314, -147.5]], r: 14.8, h: 3 },
    { pts: [[143.7, -270.3], [24.4, -296.4], [-85.1, -297.4]], r: 14.8, h: 3 },
  ],
  boards: [
    { at: [-359.7, -387], label: 'BRANDS SNATCH' },
    { at: [193.1, -465.6], label: 'KUM TYRES' },
    { at: [-120.1, -285.4], label: 'SPUM OIL' },
  ],
  bridgeLabel: 'BRANDS SNATCH',
  // owner 11-07: more room in the pit area - everything south of the pits (Cooper Straight, the
  // infield) 12 real m further from Brabham, eased in across the pit lane and garages
  warps: [{ at: [0, -355], dir: [0, 1], band: 40, shift: 12 }],
  // the hand finish (game m): the infield service road runs on past the bridge's foot, where
  // the bridge meets it (the map's road 4 through the junction); the Paddock Hill tunnel's road
  // runs on along the pit exit to the paddock behind the garages (the map's road behind the
  // pits is under our wider garages)
  finish: {
    // the Medical Centre stands 6 m north of the map's road 4 at the west bridge's junction (our
    // placing pushed it onto the junction): back off the road
    move: [{ at: [-93, -79], by: [-6, -11] }],
    cut: [{ at: [15, 27], keep: [-85, -74] }, { at: [41, 62], keep: [55, 84] },
      // the road off the bridge's far end turns hard back along the track (the map's road 26):
      // cut back, the bridge's ramp curves round into it
      { at: [41, -8], keep: [-73, -126] },
      // and the west bridge's road 4 cut back off its ramp's foot (room to curve on into it)
      { at: [-84, -73], keep: [55, 84] }],
    roads: [
      { pts: [[15, 27], [19, 36], [22.5, 43], [24.7, 47.5], [29, 52], [35, 57.5], [41, 62]] },
      // the bridge's road down to that junction, on the bridge's line (its ramp runs on into it)
      { pts: [[24.7, 47.5], [28, 45.3]] },
      // (with the footpath tunnel drivable its paddock mouth is past Cooper Straight - world/
      // venuescenery.ts roomToDriveOut: the road runs on into the paddock instead of to it)
      { pts: [[71, -181], [62, -178.5], [52, -176.5], [42, -176.5], [34, -178],
        [30, -180.5], [26, -181.3], [22, -181.6]] },
    ],
  },
  seed: 3911,
};

// the two layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel): a venue takes seconds to build on a phone, and the page loaded every one up front
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, _build: () => venueLevel(BRANDS_SPEC, layout, levelId, name) } as Level);
export const BH_GP_LEVEL: Level = layoutLevel('gp', 'brands-snatch', 'Brands Snatch GP');
export const BH_INDY_LEVEL: Level = layoutLevel('indy', 'brands-snatch-indy', 'Brands Snatch Indy');
