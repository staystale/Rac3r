// world/levels/thruston-venue.ts - THRUSTON AS THE REAL VENUE (?thrustonvenue=1, world/venue.ts):
// Thruxton Circuit (Hampshire) from OpenStreetMap (venues/thruston.ts) at 1/2 of real length with
// the 13 m road: the airfield's old perimeter road with the Club chicane and the Complex (Campbell,
// Cobb, Segrave), the airfield still inside it. Checked against Wikipedia (3.793 km, 12 turns; the
// OSM loop reads 3771 m), the circuit's own visitor guide (BARC: the spectator map - the viewing
// banks outside Allard to the Complex, above Segrave, at Noble and on Woodham Hill, the pits along
// the start straight, the grandstands at the chicane, the tunnel under the start straight to the
// paddock, the skid pan before it) and aerial photographs. The frame is the map's own (north up,
// as the old level sat): the start straight up the west side, the lap clockwise. Flat, as the
// old level: Segrave's "nasty bump just before the apex" and bumpy Goodwood.
import { THRUSTON_VENUE } from "./venues/thruston.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const THRUSTON_SPEC: VenueSpec = {
  id: 'thruston',
  data: THRUSTON_VENUE,
  share: 0.5,
  // m: the real road (about 12 m on the aerial photographs)
  realRoadM: 12,
  calibrate: { layout: 'circuit', realLapM: 3793 },
  // the start / finish line on the start straight (OSM's start-finish node)
  start: [-627.4, 260.1],
  pitLane: 'Pit Lane',
  // real m (scaled with the map): Segrave's bump before the apex and Goodwood's field of humps and
  // dips across the line, the old level's
  hills: [
    { kind: 'hump', x: -224, y: -450, r: 6.8, h: 0.18 },
    ...[0, 1, 2, 3, 4, 5].map((idx) => ({ kind: idx % 2 ? 'dip' : 'hump',
      x: 420 + idx * 24, y: -399 - idx * 2 + ((idx % 3) - 1) * 4, r: 6, h: 0.12, d: 0.1 })),
  ],
  // the viewing banks (the visitor guide's spectator map): outside the start straight's far end,
  // Allard and up to the Complex; above Segrave; Noble toward Goodwood; Woodham Hill
  banks: [
    { pts: [[-633.5, 312.5], [-655.5, 275.4], [-686.4, 198.2], [-696.2, 154.2], [-697.5, 94.2],
      [-682.2, 50.9], [-641, -2.9], [-539.5, -79.3], [-504.1, -117.6], [-466.3, -180.6],
      [-452, -233.9]], r: 12, h: 2.5 },
    { pts: [[-232.3, -491.1], [-141.9, -511.3], [-92.7, -509.5], [-27.4, -498.2]], r: 12, h: 2.5 },
    { pts: [[189.3, -384.8], [221.5, -375.6], [287.2, -377], [339.7, -398.4], [416.3, -432.8]],
      r: 12, h: 2.5 },
    { pts: [[-150.5, 379.9], [-238.1, 433.8], [-301.7, 471.7], [-330.4, 482.3]], r: 12, h: 2.5 },
  ],
  // the boards on the barriers by the banks and stands (the register's brands)
  boards: [
    { at: [-690, 120], label: 'THRUSTON' },
    { at: [-150, -505], label: 'KUM TYRES' },
    { at: [260, -378], label: 'SPUM OIL' },
    { at: [-250, 440], label: 'AVAN' },
  ],
  // the skid pan at the top of the main driveway, before the tunnel (the visitor guide; aerial
  // photographs: about 45 x 70 m), plain tarmac (no wet sample: the weather lays water)
  pads: [{ at: [-700, 530], w: 45, h: 70, rot: 0, surface: 'tarmac' }],
  // light aircraft on the airfield's grass stands (OSM's aircraft stands; the aerial photographs
  // show them parked there in rows), in the old level's six colours
  planes: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#c8302c', '#5a5e66'],
  // the windsocks on the airfield (OSM)
  landmarks: [{ at: [183, -228], kind: 'windsock', size: 1 }, { at: [271, -8], kind: 'windsock',
    size: 1 }],
  seed: 1968,
};

// the one layout, built on first use (world/load.ts buildLevel): a venue takes seconds to build
// on a phone
export const TH_VENUE_LEVEL: Level = ({ id: 'thruston', name: 'Thruston',
  _lap: () => venueLap(THRUSTON_SPEC, 'circuit'),
    _build: () => venueLevel(THRUSTON_SPEC, 'circuit', 'thruston', 'Thruston') } as Level);
