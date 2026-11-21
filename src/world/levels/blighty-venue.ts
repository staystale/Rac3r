// world/levels/blighty-venue.ts - BLIGHTY PARK (Blyton Park, Lincolnshire: an old RAF airfield;
// the name approved by the owner 11-13), from the map (venues/blighty.ts: tools/venues/
// blighty.json, OpenStreetMap way 129241665 "Blyton Park Driving Centre" and the links across it).
// The circuit: the OUTER loop (2313 m mapped), all tarmac, at half size as the other circuits,
// clockwise from the west straight. Its rallycross at full size is blightyrx-venue.ts (owner
// 11-17: "a tarmac Blighty Park circuit from the same map" beside the RX).
// WHAT IT IS MEANT TO FAIL YOU AT (the owner's: "the flat, fast airfield corners, slippery when
// wet"): the wide flat hairpins at the ends of the long straights - nothing to lean on, a flat
// airfield's standing water in the rain.
// ITS LOOK: open, flat Lincolnshire - hedgerow trees, a windsock, Union flags by the start, the
// paddock's cabins and transporters east of the circuit (where the map has the venue's centre).
// The map carries no barriers: the edge is the venues' run-off rule. North up.
import { BLIGHTY_VENUE } from "./venues/blighty.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// the venue's name (the parody approved by the owner 11-13), in one place
export const BLIGHTY = 'Blighty Park';

// the Union flag's red, white and blue (cars.ts PALETTE)
const UNION = ['#c8342a', '#f0f0ea', '#1d3f9a'];

/**
 * Union flags at a row of spots, red, white and blue in turn.
 * @param spots where they stand (real m)
 * @returns the flags
 */
export function unionFlags(spots: Point[]): NonNullable<VenueSpec['landmarks']> {
  return spots.map((spot, i) => ({ at: spot, kind: 'flag', size: 1,
    col: UNION[i % UNION.length] }));
}

// the hedgerows' trees round the fields (real m; by eye from the map's field edges)
export const BLIGHTY_TREES: NonNullable<VenueSpec['landmarks']> = [[-380, -250], [-360, -200],
  [-390, 120], [-370, 170], [220, -260], [240, -200], [250, 150], [230, 210], [-60, -300],
  [20, -300]].map(([x, y], i) => ({ at: [x, y] as Point, kind: 'tree', size: 6,
  seed: 3 + i * 4 }));
// the airfield's windsock
export const BLIGHTY_WINDSOCK: NonNullable<VenueSpec['landmarks']> = [
  { at: [170, -120], kind: 'windsock', size: 1 }];

// the paddock's dressing (real m, round an anchor): the hospitality cabins, the transporters,
// the cars and their spares
const PADDOCK: [number, number, string][] = [[0, 0, 'block'], [0, 24, 'block'],
  [16, 44, 'truck'], [16, 60, 'truck'], [-14, 50, 'parkedcar'], [-14, 58, 'parkedcar']];
const PADDOCK_LOOSE: [number, number, string][] = [[34, 50, 'tyre'], [34.9, 50.2, 'tyre'],
  [35.8, 49.9, 'tyre'], [34, 72, 'crate'], [35.2, 72.1, 'box'], [-20, 10, 'bin']];
// m: each prop's length and width
const PROP_SIZE: Record<string, [number, number]> = { block: [12, 6], truck: [14, 2.5],
  parkedcar: [4.2, 1.8] };
// rad the paddock is turned
const PADDOCK_ROT = 0.3;

/**
 * The paddock's dressing round an anchor.
 * @param anchor where its first cabin stands (real m)
 * @returns the props and the loose objects (VenueSpec dress)
 */
export function blightyPaddock([anchorX, anchorY]: Point): NonNullable<VenueSpec['dress']> {
  const props = PADDOCK.map(([dx, dy, kind], i) => ({ at: [anchorX + dx, anchorY + dy] as Point,
    kind, size: PROP_SIZE[kind][1], len: PROP_SIZE[kind][0], rot: PADDOCK_ROT,
    ...(kind === 'block' ? {} : { col: UNION[i % UNION.length] }) }));
  const litter = PADDOCK_LOOSE.map(([dx, dy, kind]) => ({
    at: [anchorX + dx, anchorY + dy] as Point, kind }));
  return { props, litter };
}

export const BLIGHTY_SPEC: VenueSpec = {
  id: 'blighty',
  data: BLIGHTY_VENUE,
  // half size, as the other circuits
  share: 0.5,
  realRoadM: 12,
  calibrate: { layout: 'circuit', realLapM: 2313 },
  // the start / finish on the west straight
  start: [-230, 48],
  startOnLine: true,
  // m (game): the hairpins at half size under the venues' least radius
  minR: 10,
  // real m: a flat airfield
  hills: [],
  banks: [
    { pts: [[-180, 120], [-150, 70]], r: 6, h: 2.5 },
  ],
  boards: [
    { at: [-250, 20], label: 'BLIGHTY PARK' },
    { at: [-40, -215], label: 'DUNFLOP' },
    { at: [-200, 260], label: 'KUM TYRES' },
  ],
  // RAF Blyton opened in 1942
  seed: 1942,
  landmarks: [...unionFlags([[-262, 40], [-258, 55], [-254, 70]]), ...BLIGHTY_TREES,
    ...BLIGHTY_WINDSOCK],
  dress: blightyPaddock([190, 300]),
};

// the one layout - built on first use (world/load.ts buildLevel)
export const BLIGHTY_LEVELS: Level[] = [
  { id: 'blighty', name: `${BLIGHTY} Circuit`, venue: BLIGHTY,
    _lap: () => venueLap(BLIGHTY_SPEC, 'circuit'),
    _build: () => venueLevel(BLIGHTY_SPEC, 'circuit', 'blighty', `${BLIGHTY} Circuit`),
  } as Level,
];
