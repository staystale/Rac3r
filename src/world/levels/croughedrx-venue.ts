// world/levels/croughedrx-venue.ts - CROUGHED RX (Croft's rallycross; the name approved by the
// owner 11-13), the Croughed venue's rallycross lap as its OWN level at FULL SIZE (share 1, as
// the other short courses), a build of its own from the same map download as the half-size circuit
// (venues/croughedrx.ts: tools/venues/croughedrx.json, OpenStreetMap way 108510895 "Rallycross"
// and the circuit pieces it runs over). 1252 m, 59 % gravel. Clockwise from the grid on the Main
// Straight (the start lane, off the lap): up to the merge, along the Clervaux run to CLERVAUX
// (tarmac, the gravel trap on its outside), HAWTHORN, into the chicane and off it left onto the
// gravel, down the infield beside the Back Straight, round THE GRAVEL HAIRPIN at its real size, and
// back up the infield's return leg to the merge.
// THE SURFACES: the map leaves the Rallycross way's surface off; the venue file carries it as
// gravel (the loose section off the circuit: BRX reports, aerial photographs - the config's
// source); the circuit's pieces it runs over are tarmac.
// THE JOKER (the shared joker rule): Croft ran none (BRX reports 2017, 2018); the owner asked for
// the joker choice, so a gravel joker is laid by hand into the open infield off the return leg
// (TODO 3b: the owner's question) - 24 m longer round two tight bends.
// WHAT IT IS MEANT TO FAIL YOU AT: the gravel hairpin at its real size; the changes from tarmac to
// gravel and back (the grip changes through the lap: brake for the chicane's exit on the tarmac,
// not on the gravel past it); the joker's choice.
// ITS LOOK: a UK round on the old airfield - grass banks for the crowd inside the hairpin and
// along the return leg, hospitality units and the teams' transporters in the paddock west of the
// Main Straight, a big screen by the crowd (a board: no screen prop), Union flags. The world clock
// and weather set its hour and sky. North up.
import { CROUGHEDRX_VENUE } from "./venues/croughedrx.ts";
import { venueLap } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import { CROUGHED, CR_RAILS } from "./croughed-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the course's name (the parody approved by the owner 11-13), in one place
export const CROUGHED_RX = 'Croughed RX';

// the Union flag's red, white and blue (cars.ts PALETTE)
const UNION = ['#c8342a', '#f0f0ea', '#1d3f9a'];

// the crowd's grass banks (real m, each a line along its top; fenced: a catch fence in front):
// inside the hairpin, between the start lane and the return leg, and inside Hawthorn facing the
// chicane's turn onto the gravel
const BANKS: VenueSpec['banks'] = [
  { pts: [[112, 26], [128, 56]], r: 6, h: 2.5 },
  { pts: [[76, -75], [80, -40], [84, -5]], r: 7, h: 2.5 },
  { pts: [[195, -300], [232, -308], [268, -300]], r: 9, h: 3 },
];

// the crowd on the banks, facing the road
const CROWD: NonNullable<VenueSpec['landmarks']> = [
  { at: [120, 41], kind: 'crowd', size: 3, len: 9, rot: 1.08, seed: 1 },
  { at: [78, -58], kind: 'crowd', size: 3, len: 9, rot: 1.46, seed: 2 },
  { at: [82, -22], kind: 'crowd', size: 3, len: 9, rot: 1.46, seed: 3 },
  { at: [212, -304], kind: 'crowd', size: 3, len: 9, rot: -0.2, seed: 4 },
  { at: [250, -304], kind: 'crowd', size: 3, len: 9, rot: 0.2, seed: 5 },
];

// Union flags behind the banks, red, white and blue in turn
const FLAGS: NonNullable<VenueSpec['landmarks']> = [[195, -314], [215, -318], [235, -320],
  [255, -318], [69, -70], [72, -35], [76, 0]].map(([x, y], i) => ({ at: [x, y] as [number, number],
  kind: 'flag', size: 1, col: UNION[i % UNION.length] }));

// the paddock between the service road and the Clervaux run (real m): the hospitality units (flat
// roofed cabins), the teams' transporters, their cars and spares, a TV tower over the chicane
const DRESS: NonNullable<VenueSpec['landmarks']> = [
  ...[-300, -282, -264].map((y) => ({ at: [86, y] as [number, number], kind: 'block', size: 6,
    len: 12, rot: -1.3 })),
  ...[-250, -236, -222].map((y, i) => ({ at: [80, y] as [number, number], kind: 'truck',
    size: 2.5, len: 14, rot: -1.3, col: UNION[i] })),
  ...[-232, -226].map((y, i) => ({ at: [66, y] as [number, number], kind: 'parkedcar',
    size: 1.8, len: 4.2, rot: -1.3, col: UNION[i * 2] })),
  { at: [232, -262], kind: 'tower', size: 4, rot: 0 },
];
const DRESS_LITTER: NonNullable<VenueSpec['litter']> = [
  { at: [70, -244], kind: 'tyre' }, { at: [70.9, -244.2], kind: 'tyre' },
  { at: [71.8, -243.9], kind: 'tyre' }, { at: [70.4, -243.1], kind: 'tyre' },
  { at: [72, -212], kind: 'crate' }, { at: [73.2, -212.1], kind: 'box' },
  { at: [94, -292], kind: 'bin' }, { at: [94.8, -292], kind: 'bin' },
  { at: [75, -218], kind: 'barrel', col: '#1d3f9a' }, { at: [75.8, -218.3], kind: 'barrel' },
];

export const CROUGHEDRX_SPEC: VenueSpec = {
  id: 'croughedrx',
  data: CROUGHEDRX_VENUE,
  // full size: the traced lap is its own real length
  share: 1,
  realRoadM: 12,
  calibrate: { layout: 'rx', realLapM: 1252 },
  // the line where the start lane (the Main Straight) meets the lap
  start: [103, -188.8],
  // the Main Straight from its dead end (the circuit's Hairpin, not raced) up to the merge
  startLane: { layout: 'rx', pieces: ['Main Straight', 'Main Straight north'], gridRoomM: 320 },
  // m (game): the gravel hairpin's real radius (about 13 m) under the venues' least radius
  minR: 10,
  // real m: the circuit's slope (croughed-venue.ts, EU-DEM fitted), up to the south-west
  hills: [{ kind: 'hump', x: -487, y: 655.1, r: 1688.8, h: 11.8 }],
  banks: BANKS,
  // the boards: the big screen stands in as a board by the start (no screen prop)
  boards: [
    { at: [120, -250], label: 'CROUGHED RX' },
    { at: [70, -150], label: 'LIVE' },
    { at: [200, -240], label: 'DUNFLOP' },
    { at: [175, 20], label: 'KUM TYRES' },
    { at: [60, 105], label: 'GOOD YEAH' },
  ],
  // the first rallycross at Croft, December 1967
  seed: 1967,
  followRails: true,
  railsSeen: CR_RAILS,
  // the joker: the joker loop's way round the infield east of the return leg
  joker: { layout: 'rx', loop: 'joker', near: [140, -70] },
  landmarks: [...CROWD, ...FLAGS],
  dress: { props: DRESS, litter: DRESS_LITTER },
};

/**
 * The course as a level: the venue's rallycross layout (the joker rule, the bales).
 * @returns the level
 */
function croughedRxLevel(): Level {
  return rallycrossLevel(CROUGHEDRX_SPEC, 'rx', 'croughedrx', CROUGHED_RX);
}

// the one layout, a layout of the Croughed venue - built on first use (world/load.ts buildLevel)
export const CROUGHEDRX_LEVELS: Level[] = [
  { id: 'croughedrx', name: CROUGHED_RX, venue: CROUGHED,
    _lap: () => venueLap(CROUGHEDRX_SPEC, 'rx'), _build: croughedRxLevel } as Level,
];
