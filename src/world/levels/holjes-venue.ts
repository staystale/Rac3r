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
// ITS LOOK: pine forest round it, the crowd on the hillside above the hill gravel, the campers and
// caravans of the summer race weekend in the clearing west of the top hairpin, the paddock by the
// mapped buildings. The world clock and weather set its hour and sky. North up.
import { HOLJES_VENUE } from "./venues/holjes.ts";
import { venueLap } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the course's name (the parody approved by the owner 11-13), in one place
export const HOLY_JEEZ = 'Holy Jeez';

// the campers' field in the clearing west of the top hairpin, 30-110 m off the lap and clear of
// the service roads: two rows of caravans (game m)
const CAMPERS_X = [-250, -232], CAMPERS_Y0 = -212, CAMPERS_GAP_M = 11, CAMPERS_ROW = 10;

/**
 * The caravans of the campers' field.
 * @returns the loose caravans
 */
function campers(): NonNullable<VenueSpec['litter']> {
  return CAMPERS_X.flatMap((x, row) => Array.from({ length: CAMPERS_ROW }, (unused, i) => ({
    at: [x, CAMPERS_Y0 + i * CAMPERS_GAP_M + row * 4] as [number, number], kind: 'caravan',
    rot: Math.PI / 2 })));
}

// the crowd on the hillside above the hill gravel, along its bank, and at the start
const CROWD: NonNullable<VenueSpec['landmarks']> = [
  { at: [-150, -40], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 1 },
  { at: [-122, -14], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 2 },
  { at: [-94, 12], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 3 },
  { at: [-66, 38], kind: 'crowd', size: 3, len: 9, rot: 0.75, seed: 4 },
  { at: [92, 60], kind: 'crowd', size: 3, len: 9, rot: 1.57, seed: 5 },
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
  // real m: THE CREST JUMP up the start straight, and the hillside the crowd stands on
  hills: [
    { kind: 'hump', x: 124, y: 8, r: 26, h: 2.6 },
    { kind: 'hump', x: -120, y: -10, r: 90, h: 7 },
  ],
  // the crowd's earth bank above the hill gravel (fenced: a catch fence in front)
  banks: [{ pts: [[-160, -50], [-110, -5], [-60, 42]], r: 12, h: 2.5 }],
  boards: [
    { at: [110, 60], label: 'HOLY JEEZ' },
    { at: [135, -20], label: 'DUNFLOP' },
    { at: [-100, -120], label: 'PIRRELLY' },
    { at: [40, 30], label: 'GOOD YEAH' },
  ],
  seed: 1976,
  runoffM: 4,
  followRails: true,
  // the joker: the joker loop's way round the outside of the split that the lap does not race
  joker: { layout: 'rx', loop: 'joker', near: [85, -100] },
  landmarks: CROWD,
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
