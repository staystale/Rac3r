// world/levels/blightyrx-venue.ts - BLIGHTY PARK RX (Blyton Park's rallycross; the name approved
// by the owner 11-13), the Blighty Park venue's rallycross lap as its OWN level at FULL SIZE (share
// 1, as the other short courses), a build of its own from the same map download as the half-size
// circuit (venues/blightyrx.ts: tools/venues/blightyrx.json). 1447 m, about a fifth gravel.
// Clockwise from the grid on the west straight: up to THE NORTH HAIRPIN (flat, wide, the end of
// the fastest run), down the Spur's tarmac, onto THE GRAVEL LOOP through the infield and its
// hairpin, back onto the Spur, round THE SOUTH LOOP's long fast sweeper onto the west straight.
// NOT REAL WHERE INVENTED: no map of the real course was found (the venue says only "a mile-long
// course" on "the Northern part of the site", "part asphalt and part gravel": blytonpark.co.uk);
// the tarmac is the map's (the circuit's north loop and the Spur and Link across it), the GRAVEL
// LOOP IS INVENTED (owner 11-17: as proposed, flagged not real).
// NO JOKER: no source shows one (the owner's rule: none where the real course has none).
// WHAT IT IS MEANT TO FAIL YOU AT (the owner's: "the flat, fast airfield corners, slippery when
// wet"): the north hairpin at the end of the fastest run and the south loop's long sweeper; the
// gravel loop between them the slow part.
// ITS LOOK: the venue's (blighty-venue.ts) - open, flat Lincolnshire, hedgerow trees, a windsock,
// Union flags - with the crowd's grass banks inside the north hairpin and the gravel loop.
// North up.
import { BLIGHTYRX_VENUE } from "./venues/blightyrx.ts";
import { venueLap } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import { BLIGHTY, BLIGHTY_TREES, BLIGHTY_WINDSOCK, blightyPaddock, unionFlags }
  from "./blighty-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the course's name (the parody approved by the owner 11-13), in one place
export const BLIGHTY_RX = 'Blighty Park RX';

// the crowd's grass banks (real m, each a line along its top; fenced: a catch fence in front):
// inside the north hairpin, inside the gravel loop
const BANKS: VenueSpec['banks'] = [
  { pts: [[-80, -115], [-35, -125]], r: 6, h: 2.5 },
  { pts: [[-100, 10], [-80, 25]], r: 6, h: 2.5 },
];

// the crowd on the banks, facing the road
const CROWD: NonNullable<VenueSpec['landmarks']> = [
  { at: [-68, -118], kind: 'crowd', size: 3, len: 9, rot: 0.2, seed: 1 },
  { at: [-47, -122], kind: 'crowd', size: 3, len: 9, rot: 0.2, seed: 2 },
  { at: [-92, 16], kind: 'crowd', size: 3, len: 9, rot: 0.6, seed: 3 },
];

export const BLIGHTYRX_SPEC: VenueSpec = {
  id: 'blightyrx',
  data: BLIGHTYRX_VENUE,
  // full size: the traced lap is its own real length
  share: 1,
  realRoadM: 12,
  calibrate: { layout: 'rx', realLapM: 1447 },
  // the start / finish on the west straight
  start: [-230, 48],
  startOnLine: true,
  // m (game): the venues' least radius, the house standard (tools/scratch/_lapradius.mjs reads
  // the finished lap's north hairpin at 9.5 m over 8 m, 8.9 m through points 3 apart)
  minR: 10,
  // real m: a flat airfield
  hills: [],
  banks: BANKS,
  boards: [
    { at: [-250, 20], label: 'BLIGHTY PARK RX' },
    { at: [-80, -215], label: 'DUNFLOP' },
    { at: [40, -100], label: 'LIVE' },
    { at: [-170, 230], label: 'GOOD YEAH' },
  ],
  // RAF Blyton opened in 1942
  seed: 1942,
  // tidied and made even (world/venuetidy.ts, world/stadiumtidy.ts), as the other RX courses
  tidyEdge: true,
  evenEdge: true,
  landmarks: [...CROWD, ...unionFlags([[-262, 40], [-258, 55], [-254, 70], [-85, -105],
    [-60, -110]]), ...BLIGHTY_TREES, ...BLIGHTY_WINDSOCK],
  dress: blightyPaddock([150, -40]),
};

/**
 * The course as a level: the venue's rallycross layout (the bales; no joker).
 * @returns the level
 */
function blightyRxLevel(): Level {
  return rallycrossLevel(BLIGHTYRX_SPEC, 'rx', 'blightyrx', BLIGHTY_RX);
}

// the one layout, a layout of the Blighty Park venue - built on first use (world/load.ts
// buildLevel)
export const BLIGHTYRX_LEVELS: Level[] = [
  { id: 'blightyrx', name: BLIGHTY_RX, venue: BLIGHTY,
    _lap: () => venueLap(BLIGHTYRX_SPEC, 'rx'), _build: blightyRxLevel } as Level,
];
