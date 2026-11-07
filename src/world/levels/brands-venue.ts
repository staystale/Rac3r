// world/levels/brands-venue.ts - BRANDS SNATCH AS THE REAL VENUE (?bigbrands=1, world/venue.ts):
// the real Brands Hatch from OpenStreetMap (venues/brands-snatch.ts) at 3/4 of real length with
// the 13 m road, the GP and the Indy as two layouts of one venue sharing its scenery. Checked
// against the circuit's own venue map (art/ref/bh-indy-msv.png: the grandstands, pits, paddocks,
// both GP road bridges and the Hailwood Hill footbridge are where OSM has them) and Wikipedia (the
// OSM loops read 1929 / 3900 m, the official 1944 / 3916 m). The hills are the old level's (from
// the contour map art/ref/bh1.png), carried into real metres (the old trace: 0.656 real m a map
// pixel, turned 28 deg); the frame is turned as the old level was (Brabham across the top).
import { BRANDS_VENUE } from "./venues/brands-snatch.ts";
import type { VenueSpec } from "../venue.ts";

export const BRANDS_SPEC: VenueSpec = {
  id: 'brands-snatch',
  data: BRANDS_VENUE,
  share: 0.75,
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
  seed: 3911,
};
