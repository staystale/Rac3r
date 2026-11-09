// world/levels/snotterton-venue.ts - SNOTTERTON AS THE REAL VENUE (world/venue.ts): Snetterton
// Circuit (Norfolk) from OpenStreetMap (venues/snotterton.ts) at 1/2 of real length with the 13 m
// road, its three layouts one venue sharing its scenery: the 300 (the full lap), the 200 (Wilson
// to Bentley Straight by the Chapman link, closest to the old circuit) and the 100 (the infield,
// run anticlockwise by the Firmans link). Checked against Wikipedia (300 4.779 km, 200 3.219 km,
// 100 1.577 km; the OSM loops read 4794 / 3197 / 1564 m), the circuit's own maps
// (snetterton.co.uk: the corners, the pit garages along Senna Straight, the Jim Russell and Oliver
// Sear stands, Tyrrells, the viewing banks, the access road over Bentley Straight by Brundle) and
// aerial photographs. The frame is the map's own (north up): Senna Straight across the bottom, run
// right to left, the 300 clockwise. Flat Norfolk airfield: no hills.
import { SNOTTERTON_VENUE } from "./venues/snotterton.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

export const SNOTTERTON_SPEC: VenueSpec = {
  id: 'snotterton',
  data: SNOTTERTON_VENUE,
  share: 0.5,
  // m: the real road (about 11 m on the aerial photographs)
  realRoadM: 11,
  calibrate: { layout: '300', realLapM: 4779 },
  // the start / finish line on Senna Straight (OSM's start-finish node, the circuit's map)
  start: [-147, 201],
  // the 100 starts from the infield's grandstand, Tyrrells, on the Palmer straight
  starts: { 100: [-192, 58] },
  pitLane: 'Pit Lane',
  // m: Wilson's hairpin is 23 real m across its middle (11.5 at 1/2), Agostini's 29
  minR: 11,
  // the Firmans hairpin's two legs (Wilson to Palmer, Oggies to Williams) are 28 real m apart:
  // at 1/2 with the 13 m road they touched - everything east of them 18 m further east, eased in
  warps: [{ at: [-542, 0], dir: [1, 0], band: 30, shift: 18 }],
  hills: [],
  // the raised viewing banks (the circuit's map): north of Bentley Straight behind the fence line
  // on the aerial photographs (the Wyatts Walk bank), and south of Senna Straight
  banks: [
    { pts: [[-520, -212], [-380, -177], [-250, -170], [-150, -168]], r: 12, h: 2.5 },
    { pts: [[-470, 252], [-360, 244], [-250, 238]], r: 12, h: 2 },
  ],
  // the boards on the barriers by the stands and banks (the register's brands)
  boards: [
    { at: [-300, 242], label: 'SNOTTERTON' },
    { at: [-440, -185], label: 'KUM TYRES' },
    { at: [640, -100], label: 'SPUM OIL' },
    { at: [400, 120], label: 'DUNFLOP' },
  ],
  seed: 1951,
};

// the three layouts of the one venue, sharing its scenery - each built on first use (world/load.ts
// buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: 'Snotterton',
    _lap: () => venueLap(SNOTTERTON_SPEC, layout),
    _build: () => venueLevel(SNOTTERTON_SPEC, layout, levelId, name) } as Level);
export const SN_LEVELS: Level[] = [
  layoutLevel('300', 'snotterton', 'Snotterton 300'),
  layoutLevel('200', 'snotterton-200', 'Snotterton 200'),
  layoutLevel('100', 'snotterton-100', 'Snotterton 100'),
];
