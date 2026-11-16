// world/levels/pembreezy-venue.ts - PEMBREEZY (Pembrey Circuit, Carmarthenshire, Wales; the name
// approved by the owner 11-13), a NEW venue (world/venue.ts) from OpenStreetMap (venues/
// pembreezy.ts: tools/venues/pembreezy.json) at 1/2 of real length, as the other road circuits.
// THE CIRCUIT: the full lap, the one the British Touring Cars raced in 1992 and 1993 (Wikipedia:
// 2.343 km, 8 turns; the OSM loop 2333 m), all tarmac, clockwise: the start on Cowles Straight
// (OSM's start-finish node), HATCHETS HAIRPIN, Spitfires, DIBENI, the fast sweep down past the
// airfield's old apron, the Senna Esses, BROOKLANDS HAIRPIN, the Speedway Straight, Woodlands and
// the flat-out HONDA CURVE onto Cowles Straight. The rallycross's gravel and its links through the
// infield are left out (tools/venues/pembreezy.json skip): the rallycross lap is its own level at
// full size (pembreezyrx-venue.ts), a build of its own from the same map download and the same
// dressing (one venue, two scales: NOTES track scale).
// WHAT IT IS MEANT TO FAIL YOU AT: the two hairpins at the ends of the long straights (braking
// from the top speed of the lap), the fast Honda Curve onto the start straight.
// ITS LOOK: a flat old airfield by the sea (Pembrey Forest's pines and the Cefn Sidan dunes to the
// south-west): Welsh flags (the flag prop in the flag's white, green and red in turn), the
// paddock's hospitality units and transporters on the mapped paddock, grass banks inside Hatchets
// and by the infield. The dunes and the pines are laid nearer than the real ones (about 600 m
// south-west, past the fields) so the level shows them. The world clock and weather set its hour
// and sky. North up.
import { PEMBREEZY_VENUE } from "./venues/pembreezy.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level, Point } from "../types.ts";

// the venue's name (the parody approved by the owner 11-13), in one place
export const PEMBREEZY = 'Pembreezy';

// the share of its trees that are firs: Pembrey Forest is a pine plantation (render/trees.ts)
export const PEMBREEZY_FIR_SHARE = 0.85;

// the Welsh flag's white, green and red (cars.ts PALETTE), the flag prop in each in turn
const WELSH = ['#f0f0ea', '#2f8a3a', '#c8342a'];

// THE DUNES (real m): the sand hills south-west of the circuit, brought in past the fields and
// the outer tyre wall (each a sand pad with a hump over it; the pads turned so they do not read as
// a grid) - off every road, the nearest 40 m past the Woodlands exit's outside
const DUNES: { at: Point; w: number; h: number; rot: number; r: number; tall: number }[] = [
  { at: [-345, 300], w: 60, h: 34, rot: 0.5, r: 30, tall: 3 },
  { at: [-300, 345], w: 70, h: 30, rot: 0.2, r: 32, tall: 3.5 },
  { at: [-240, 382], w: 64, h: 28, rot: -0.15, r: 30, tall: 3 },
  { at: [-372, 245], w: 46, h: 30, rot: 0.9, r: 24, tall: 2.5 },
  { at: [-170, 400], w: 58, h: 24, rot: -0.25, r: 26, tall: 2.5 },
];

/** The dunes' sand, as pads (real m). */
export const DUNE_PADS: NonNullable<VenueSpec['pads']> = DUNES.map((dune) => ({ at: dune.at,
  w: dune.w, h: dune.h, rot: dune.rot, surface: 'sand' }));

/** The dunes' rise, as humps (real m). */
export const DUNE_HILLS: VenueSpec['hills'] = DUNES.map((dune) => ({ kind: 'hump', x: dune.at[0],
  y: dune.at[1], r: dune.r, h: dune.tall }));

// pines along the dunes' landward side (their seeds draw firs: render/trees.ts by seed), real m
const PINE_SEEDS = [1, 6, 9, 13, 21, 26];
export const DUNE_PINES: NonNullable<VenueSpec['landmarks']> = [[-390, 330], [-350, 370],
  [-300, 395], [-395, 205], [-200, 415], [-130, 425]].map(([x, y], i) => ({ at: [x, y] as Point,
  kind: 'tree', size: 6, seed: PINE_SEEDS[i] }));

/**
 * The Welsh flags at a row of spots, white, green and red in turn.
 * @param spots where they stand (real m)
 * @returns the flags
 */
export function welshFlags(spots: Point[]): NonNullable<VenueSpec['landmarks']> {
  return spots.map((spot, i) => ({ at: spot, kind: 'flag', size: 1,
    col: WELSH[i % WELSH.length] }));
}

// the paddock's dressing round an anchor (real m): the hospitality units (flat roofed cabins), the
// teams' transporters, their cars and spares. Each level lays it where its own scale leaves room
// (at half size the circuit's car park and service roads take more of the paddock)
const PADDOCK_PROPS: [number, number, string][] = [[0, 0, 'block'], [0, 18, 'block'],
  [10, 36, 'truck'], [10, 50, 'truck'], [10, 64, 'truck'], [-10, 42, 'parkedcar'],
  [-10, 48, 'parkedcar']];
const PADDOCK_LOOSE: [number, number, string][] = [[34, 46, 'tyre'], [34.9, 46.2, 'tyre'],
  [35.8, 45.9, 'tyre'], [34.4, 47.1, 'tyre'], [30, 72, 'crate'], [31.2, 72.1, 'box'],
  [-15, 10, 'bin'], [-14.2, 10, 'bin'], [30, 60, 'barrel'], [30.8, 59.7, 'barrel']];
// m along: a cabin's, a transporter's and a car's length; their size across
const PADDOCK_SIZE: Record<string, [number, number]> = { block: [12, 6], truck: [14, 2.5],
  parkedcar: [4.2, 1.8] };
// rad: the paddock's rows turned along the Cowles Straight's line
const PADDOCK_ROT = 0.7;

/**
 * The paddock's dressing round an anchor.
 * @param anchor where its first cabin stands (real m)
 * @returns the props and the loose objects (VenueSpec dress)
 */
export function paddockDress([anchorX, anchorY]: Point): NonNullable<VenueSpec['dress']> {
  const props = PADDOCK_PROPS.map(([dx, dy, kind], i) => ({
    at: [anchorX + dx, anchorY + dy] as Point, kind,
    size: PADDOCK_SIZE[kind][1], len: PADDOCK_SIZE[kind][0], rot: PADDOCK_ROT,
    ...(kind === 'block' ? {} : { col: WELSH[i % WELSH.length] }) }));
  const litter = PADDOCK_LOOSE.map(([dx, dy, kind], i) => ({
    at: [anchorX + dx, anchorY + dy] as Point, kind,
    ...(kind === 'barrel' && i % 2 === 0 ? { col: WELSH[1] } : {}) }));
  return { props, litter };
}

export const PEMBREEZY_SPEC: VenueSpec = {
  id: 'pembreezy',
  data: PEMBREEZY_VENUE,
  share: 0.5,
  // m: the real road (about 12 m on the aerial photographs)
  realRoadM: 12,
  calibrate: { layout: 'circuit', realLapM: 2343 },
  // the start / finish on Cowles Straight (OSM's start-finish node)
  start: [-225, -31],
  startOnLine: true,
  pitLane: 'Pit Lane',
  // m (game): the hairpins are tighter than the venues' least radius at half size
  minR: 10,
  // real m: a flat airfield by the sea (5 m up); the dunes' rise
  hills: DUNE_HILLS,
  // the crowd's grass banks inside Hatchets and by the paddock (fenced: a catch fence in front)
  banks: [
    { pts: [[-40, -255], [-25, -225]], r: 6, h: 2.5 },
    { pts: [[-95, 20], [-80, 50]], r: 6, h: 2.5 },
  ],
  boards: [
    { at: [-200, -60], label: 'PEMBREEZY' },
    { at: [-60, -320], label: 'DUNFLOP' },
    { at: [300, 200], label: 'KUM TYRES' },
    { at: [100, 340], label: 'GOOD YEAH' },
  ],
  // the circuit opened on the old RAF airfield, 1989
  seed: 1989,
  followRails: true,
  pads: DUNE_PADS,
  landmarks: [...welshFlags([[-245, -70], [-240, -55], [-235, -40], [-45, -265], [-30, -235]]),
    ...DUNE_PINES],
  // (the paddock at half size: on its grass south of the car park, clear of the parked cars)
  dress: paddockDress([-90, 245]),
};

// each layout its own level - built on first use (world/load.ts buildLevel)
export const PEMBREEZY_LEVELS: Level[] = [
  { id: 'pembreezy', name: `${PEMBREEZY} Circuit`, venue: PEMBREEZY,
    firShare: PEMBREEZY_FIR_SHARE,
    _lap: () => venueLap(PEMBREEZY_SPEC, 'circuit'),
    _build: () => venueLevel(PEMBREEZY_SPEC, 'circuit', 'pembreezy', `${PEMBREEZY} Circuit`),
  } as Level,
];
