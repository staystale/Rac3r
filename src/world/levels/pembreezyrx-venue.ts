// world/levels/pembreezyrx-venue.ts - PEMBREEZY RX (Pembrey's rallycross; the name approved by the
// owner 11-13), the Pembreezy venue's rallycross lap as its OWN level at FULL SIZE (share 1, as
// the other short courses), a build of its own from the same map download as the half-size
// circuit (venues/pembreezyrx.ts: tools/venues/pembreezyrx.json, OpenStreetMap way 893412420
// "Rallycross" and the circuit pieces it runs over) and the same dressing (pembreezy-venue.ts).
// 2063 m, 29 % gravel. Clockwise (the circuit's way, Honda the last corner: Motorsport News 2016)
// from the grid on Cowles Straight: HATCHETS HAIRPIN, Spitfires, Dibeni, THE FAST TARMAC SWEEPER
// down past the old apron and along the old taxiway, THE GRAVEL HAIRPIN off the taxiway's end
// onto the infield's gravel, the gravel loop's right-hander (Hansen's), the gravel west through
// the infield to Woodlands, and the flat-out Honda Curve. The circuit guide (motorsportcircuits.
// co.uk) draws the rallycross section the same way, off the Esses down to Woodlands.
// THE SURFACES: the map leaves the gravel's surface off; the venue file carries it (aerial
// photographs, ESRI World Imagery: a loose track off the tarmac); the circuit is tarmac.
// THE JOKER (the real rules, BRX 2022: clockwise, "around the outside of Hansen's corner"): the
// mapped loop round the outside of the gravel loop's right-hander, 56 m longer, gravel.
// WHAT IT IS MEANT TO FAIL YOU AT: the gravel hairpin off the end of the fast tarmac sweeper (the
// grip gone where the braking ends), and the gravel right-hander after it.
// ITS LOOK: the venue's - Welsh flags, the paddock's hospitality units and transporters, the
// dunes and pines to the south-west - with the rallycross's bales and grass banks for the crowd
// inside the gravel loop and south of the gravel's west run. The circuit's own Esses, Brooklands
// and Speedway Straight are not raced and left out (as Croughed RX). North up.
import { PEMBREEZYRX_VENUE } from "./venues/pembreezyrx.ts";
import { venueLap } from "../venue.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import { DUNE_HILLS, DUNE_PADS, DUNE_PINES, PEMBREEZY, PEMBREEZY_FIR_SHARE, paddockDress,
  welshFlags } from "./pembreezy-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";
import { FIX } from "../../core/fixes.ts";

// the course's name (the parody approved by the owner 11-13), in one place
export const PEMBREEZY_RX = 'Pembreezy RX';
// m its racing line keeps from the edge on the gravel (?pbzline=1; LINE_MARGIN 1.6 elsewhere):
// tools/scratch/_pbzoff.mjs measured 2.6 and 3.6 m - the owner picks
const LOOSE_LINE_M = 2.6;

// the crowd's grass banks (real m, each a line along its top; fenced: a catch fence in front):
// inside the gravel loop (the spotters' side of Hansen's), south of the gravel's west run, and
// inside Hatchets
const BANKS: VenueSpec['banks'] = [
  { pts: [[148, 160], [152, 195]], r: 6, h: 2.5 },
  { pts: [[-120, 305], [-80, 302], [-45, 310]], r: 6, h: 2.5 },
  { pts: [[-40, -255], [-25, -225]], r: 6, h: 2.5 },
];

// the crowd on the banks, facing the road
const CROWD: NonNullable<VenueSpec['landmarks']> = [
  { at: [150, 170], kind: 'crowd', size: 3, len: 9, rot: 1.5, seed: 1 },
  { at: [151, 186], kind: 'crowd', size: 3, len: 9, rot: 1.5, seed: 2 },
  { at: [-105, 303], kind: 'crowd', size: 3, len: 9, rot: 0.05, seed: 3 },
  { at: [-65, 304], kind: 'crowd', size: 3, len: 9, rot: 0.1, seed: 4 },
  { at: [-33, -242], kind: 'crowd', size: 3, len: 9, rot: 1.1, seed: 5 },
];

export const PEMBREEZYRX_SPEC: VenueSpec = {
  id: 'pembreezyrx',
  data: PEMBREEZYRX_VENUE,
  // full size: the traced lap is its own real length
  share: 1,
  realRoadM: 12,
  calibrate: { layout: 'rx', realLapM: 2063 },
  // the start / finish on Cowles Straight (OSM's start-finish node), the grid back along it
  start: [-225, -31],
  startOnLine: true,
  // m (game): the gravel hairpin's real radius (about 12 m) under the venues' least radius
  minR: 10,
  // real m: a flat airfield by the sea; the dunes' rise
  hills: DUNE_HILLS,
  banks: BANKS,
  boards: [
    { at: [-200, -60], label: 'PEMBREEZY RX' },
    { at: [-60, -320], label: 'DUNFLOP' },
    { at: [60, 120], label: 'LIVE' },
    { at: [100, 255], label: 'KUM TYRES' },
    { at: [-150, 270], label: 'GOOD YEAH' },
  ],
  // the circuit opened on the old RAF airfield, 1989
  seed: 1989,
  followRails: true,
  // the map's tyre walls tidied: those of the roads this level does not race, their fringe beside
  // the edge's rows and their stubs left out (world/venuetyres.ts)
  tidyTyres: true,
  // tidied and made even (world/venuetidy.ts, world/stadiumtidy.ts), as Holy Jeez and Croughed RX
  tidyEdge: true,
  evenEdge: true,
  // the joker: the joker loop's way round the outside of Hansen's that the lap does not race
  joker: { layout: 'rx', loop: 'joker', near: [207, 215] },
  pads: DUNE_PADS,
  landmarks: [...CROWD, ...welshFlags([[-245, -70], [-240, -55], [-235, -40], [140, 150],
    [160, 205], [-130, 312], [-90, 312], [-50, 318]]), ...DUNE_PINES],
  dress: paddockDress([-150, 150]),
};

/**
 * The course as a level: the venue's rallycross layout (the joker rule, the bales).
 * @returns the level
 */
function pembreezyRxLevel(): Level {
  // (its racing line keeps LOOSE_LINE_M from the edge on the gravel: ?pbzline=1, ai/line.ts)
  return { ...rallycrossLevel(PEMBREEZYRX_SPEC, 'rx', 'pembreezyrx', PEMBREEZY_RX),
    ...(FIX.pbzline ? { looseLineMargin: LOOSE_LINE_M } : {}) };
}

// the one layout, a layout of the Pembreezy venue - built on first use (world/load.ts buildLevel)
export const PEMBREEZYRX_LEVELS: Level[] = [
  { id: 'pembreezyrx', name: PEMBREEZY_RX, venue: PEMBREEZY, firShare: PEMBREEZY_FIR_SHARE,
    _lap: () => venueLap(PEMBREEZYRX_SPEC, 'rx'), _build: pembreezyRxLevel } as Level,
];
