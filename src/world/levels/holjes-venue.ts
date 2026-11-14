// world/levels/holjes-venue.ts - HOLY JEEZ (Holjes, Sweden: the rallycross in the pine forest by
// the Klaralven; the name approved by the owner 11-13), a NEW venue (world/venue.ts) traced from
// the map (venues/holjes.ts: tools/venues/holjes.json, OpenStreetMap, every piece tagged tarmac or
// gravel) at FULL SIZE (share 1, as the other short courses). 1204 m, 37 % gravel. Clockwise from
// the grid on the start lane (the stub below the merge): up the start straight over THE CREST
// JUMP, the split at the top where the joker leaves, along the top gravel to THE TOP HAIRPIN, down
// the hill gravel, the bottom hairpin, and back up the return gravel onto the straight.
// THE JOKER (the real rules: once a race, the shared joker rule): the mapped joker, round the
// outside of the split from the top of the straight onto the top gravel, 24 m longer.
// WHAT IT IS MEANT TO FAIL YOU AT: the crest after the start taken flat (the car lands crooked
// into the split) and the tight hairpin at the top, both at their real size.
// ITS LOOK: pine forest round it, the crowd and Swedish flags on the hillside above the hill
// gravel and along the start straight, a TV tower over the crest, the campers and caravans of the
// summer race weekend in a mown field in the forest north of the top gravel (between the top
// hairpin and the joker), the teams' transporters in the paddock behind the grandstands, by the
// mapped buildings. The world clock and weather set its hour and sky. North up.
import { HOLJES_VENUE } from "./venues/holjes.ts";
import { venueLap } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the course's name (the parody approved by the owner 11-13), in one place
export const HOLY_JEEZ = 'Holy Jeez';

// the campers' field in the forest north of the top gravel, 40-70 m off the lap and clear of every
// road (real m): its mown grass (the trees keep off it), and two rows of caravans along it, end to
// end CAMPERS_GAP_M apart (the map's west edge is at -195: west of the top hairpin is off the map)
const CAMPERS_FIELD = { at: [-15, -163] as [number, number], w: 116, h: 38 };
const CAMPERS_Y = [-170, -156], CAMPERS_X0 = -64, CAMPERS_GAP_M = 11, CAMPERS_ROW = 10;

/**
 * The caravans of the campers' field.
 * @returns the loose caravans
 */
function campers(): NonNullable<VenueSpec['litter']> {
  return CAMPERS_Y.flatMap((y, row) => Array.from({ length: CAMPERS_ROW }, (unused, i) => ({
    at: [CAMPERS_X0 + i * CAMPERS_GAP_M + row * 4, y] as [number, number], kind: 'caravan',
    rot: 0 })));
}

// the crowd on the hillside above the hill gravel, along its bank (25-35 m off the lap's centre:
// in view from the road), and along the start straight's east side up to the crest (20 m off)
const CROWD: NonNullable<VenueSpec['landmarks']> = [
  { at: [-135, -59], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 1 },
  { at: [-107, -33], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 2 },
  { at: [-79, -7], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 3 },
  { at: [-51, 19], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 4 },
  { at: [121, 56], kind: 'crowd', size: 3, len: 9, rot: 1.2, seed: 5 },
  { at: [132, 0], kind: 'crowd', size: 3, len: 9, rot: -1.02, seed: 6 },
];

// the Swedish flags (blue and yellow, cars.ts PALETTE) behind the crowd's bank
const FLAGS: NonNullable<VenueSpec['landmarks']> = [[-140, -54], [-120, -35], [-100, -17],
  [-80, 2], [-60, 20]].map(([x, y], i) => ({ at: [x, y] as [number, number], kind: 'flag',
  size: 1, col: i % 2 ? '#f2a900' : '#1d3f9a' }));

// the dressing (as the stadiums'): a TV tower over the crest; the teams' transporters, cars and
// spares in the paddock behind the grandstands (real m)
const DRESS: NonNullable<VenueSpec['landmarks']> = [
  { at: [90, -5], kind: 'tower', size: 4, rot: 0 },
  ...[281, 285.5, 290, 294.5].map((y, i) => ({ at: [135, y] as [number, number], kind: 'truck',
    size: 2.5, len: 14, rot: 0, col: ['#1d3f9a', '#f2a900', '#c8342a', '#f0f0ea'][i] })),
  ...[282, 285, 288].map((y, i) => ({ at: [123, y] as [number, number], kind: 'parkedcar',
    size: 1.8, len: 4.2, rot: 0, col: ['#f0f0ea', '#1d3f9a', '#16181d'][i] })),
];
const DRESS_LITTER: NonNullable<VenueSpec['litter']> = [
  { at: [146, 282], kind: 'tyre' }, { at: [146.9, 282.2], kind: 'tyre' },
  { at: [147.8, 281.9], kind: 'tyre' }, { at: [146.4, 282.9], kind: 'tyre' },
  { at: [147, 298], kind: 'crate' }, { at: [148.2, 298.1], kind: 'box' },
  { at: [150, 290], kind: 'barrel', col: '#1d3f9a' }, { at: [150.8, 290.3], kind: 'barrel' },
  { at: [121, 297], kind: 'bin' }, { at: [121.8, 297], kind: 'bin' },
  // the campers' bins and boxes in the aisle between the caravans
  { at: [-72, -163], kind: 'bin' }, { at: [-71.2, -163], kind: 'bin' },
  { at: [-30, -163], kind: 'box' }, { at: [-29.2, -163.2], kind: 'crate' },
  { at: [10, -163], kind: 'barrel', col: '#f2a900' }, { at: [46, -163], kind: 'bin' },
];

export const HOLJES_SPEC: VenueSpec = {
  id: 'holjes',
  data: HOLJES_VENUE,
  // full size: the traced lap is its own real length
  share: 1,
  realRoadM: 12,
  calibrate: { layout: 'rx', realLapM: 1204 },
  // the line where the start lane meets the lap, the grid back down the lane
  start: [118, 101],
  startLane: { layout: 'rx', pieces: ['Start Straight'] },
  // real m: THE CREST JUMP up the start straight (its middle on the road's centreline, 100 m
  // up the lap from the start lane's merge), and the hillside the crowd stands on
  hills: [
    { kind: 'hump', x: 103, y: 8, r: 26, h: 2.6 },
    { kind: 'hump', x: -120, y: -10, r: 90, h: 7 },
  ],
  // the crowd's earth bank above the hill gravel (fenced: a catch fence in front)
  banks: [{ pts: [[-145, -69], [-95, -24], [-45, 23]], r: 12, h: 2.5 }],
  // the campers' field, mown
  pads: [{ ...CAMPERS_FIELD, rot: 0, surface: 'grassShort' }],
  boards: [
    { at: [110, 60], label: 'HOLY JEEZ' },
    { at: [135, -20], label: 'DUNFLOP' },
    { at: [93, 90], label: 'PIRRELLY' },
    { at: [40, 30], label: 'GOOD YEAH' },
  ],
  seed: 1976,
  runoffM: 4,
  followRails: true,
  // tidied and made even (world/venuetidy.ts, world/stadiumtidy.ts): the lap's Armco and the
  // joker's met at the split's nose doubled over ~8 m; joined, they close the island between them
  tidyEdge: true,
  evenEdge: true,
  // the joker: the joker loop's way round the outside of the split that the lap does not race
  joker: { layout: 'rx', loop: 'joker', near: [85, -100] },
  landmarks: [...CROWD, ...FLAGS],
  dress: { props: DRESS, litter: DRESS_LITTER },
  litter: campers(),
  // a pine forest
  trees: 3000,
};

/**
 * The course as a level: the venue's rallycross layout (the joker rule, the bales).
 * @returns the level
 */
function holyJeezLevel(): Level {
  return rallycrossLevel(HOLJES_SPEC, 'rx', 'holyjeez', HOLY_JEEZ);
}

// the one layout - built on first use (world/load.ts buildLevel)
export const HOLJES_LEVELS: Level[] = [
  { id: 'holyjeez', name: HOLY_JEEZ, venue: HOLY_JEEZ,
    _lap: () => venueLap(HOLJES_SPEC, 'rx'), _build: holyJeezLevel } as Level,
];
