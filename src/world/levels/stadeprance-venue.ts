// world/levels/stadeprance-venue.ts - STADE DE PRANCE (the Stade de France, Saint-Denis; the name
// approved by the owner 11-10), a NEW venue (world/venue.ts) laid by hand (venues/stadeprance.ts:
// tools/scratch/_rocdata.mjs stadeprance, the same generator as Wobbly Stadium's): the Race of
// Champions' track in the Stade de France, 2004-06 - "an all-asphalt parallel track inside the
// arena, featuring two interwoven lanes, a cross-over bridge, and tight hairpins" (Wikipedia's
// 2004-06 Race of Champions; racecar.com); 2005 "the 1 km circuit", the asphalt 7 m wide; 2006
// lengthened to 1.2 km, "a long straight leads to a cross-over bridge" where the cars reach about
// 150 km/h, the bridge 100 tonnes (pitpass.com, Eurosport). As Wobbly Stadium (TODO.md RALLYCROSS
// > NEW TRACKS, agreed 11-10): ONE path crossing itself once - round the outer lane, over the
// crossover onto the inner lane, round it inside, under the bridge back out - Snoozuka's crossover
// system; tarmac, gravel on both lanes' west hairpin and the straight from it to the crossover.
// CLOSE TO, NOT TRACED: no plan of the Paris tracks was found - the shape is the press's: a long
// rounded rectangle with tight ends (the hairpins, 10 m), each its own (a double apex at the east
// end, the north straight kinked, a tight north-west, a wide south-west), the crossover east of
// the south straight's middle so a long straight leads to it, 950 m (the real 1-1.2 km). At FULL
// SIZE as Wobbly's (two lanes at the 13 m road need 20 m between centres); the bowl the Stade de
// France's oval, ~380 x 245 m with its roof ring (creative licence). Dressed as Wobbly's. North up.
import { STADEPRANCE_FLAGS, STADEPRANCE_VENUE }
  from "./venues/stadeprance.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (a parody of the Stade de France, approved by the owner 11-10), in one place
export const STADE_DE_PRANCE = 'Stade de Prance';

export const STADEPRANCE_SPEC: VenueSpec = {
  id: 'stadeprance',
  data: STADEPRANCE_VENUE,
  // (laid in game m: the path's own length calibrates it to itself)
  share: 1,
  realRoadM: 13,
  calibrate: { layout: 'roc', realLapM: 950 },
  // the start line on the outer lane's north straight, the grid back toward its north-east hairpin
  start: [-19.9, 48],
  startOnLine: true,
  // the Race of Champions' start: the two cars side by side on the two lanes, each timed over its
  // lap from its own line (Level.splitStart)
  splitStart: true,
  minR: 10,
  // the trace smoothed lightly (world/subtrack.ts traceTrack: 10 passes by default): the data is
  // laid as arcs and straights, and the default spread the crossover's bends 4 deg into its portals
  trace: { roc: { passes: 2, kern: 2 } },
  hills: [],
  banks: [],
  // the boards (the register's brands; the event's name - HEAD-TO-HEADBUTT, approved 11-10 -
  // and the stadium's): on the catch fence along the stands all round the outside, and on the
  // infield's Armco inside the inner lane (none on the barrier between the lanes: a board behind
  // it would face the other lane)
  boards: [
    { at: [35, 62], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [-30, 62], label: 'KUM', on: 'catchfence' },
    { at: [-75, 62], label: 'SPUM', on: 'catchfence' },
    { at: [0, -62], label: 'STADE DE PRANCE', on: 'catchfence' },
    { at: [60, -62], label: 'FIRESTONED', on: 'catchfence' },
    { at: [-60, -62], label: 'BF GOODWRENCH', on: 'catchfence' },
    { at: [118, 0], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [-114, 0], label: 'PIRRELLY', on: 'catchfence' },
    { at: [0, -17], label: 'STADE DE PRANCE' },
    { at: [55, -15], label: 'PIRRELLY' },
    { at: [-66, -3], label: 'GOOD YEAH' },
    { at: [-30, 16], label: 'DUNFLOP' },
    { at: [12, 13], label: 'MICKY TOMSON' },
    { at: [35, -16], label: 'CREEM OIL' },
    { at: [-55, -15], label: 'AVAN' },
  ],
  // the first Race of Champions in the Stade de France, 2004
  seed: 2004,
  // m past the road's edge the barriers stand (laid round the lanes, no run-off)
  runoffM: 3,
  // THE BARRIERS (as Wobbly's: concrete blocks and Armco both sides of both lanes): a line 10 m off
  // each side of every lane but the crossover (tools/scratch/_rocdata.mjs stadeprance), followed as
  // rails - the edge's Armco at its run-off's rim, a catch fence where the stands are
  followRails: true,
  // the barriers tidied, an Armco end carried on to the catch fence's round the crossover
  // (world/venuetidy.ts)
  tidyEdge: 'fences',
  // the crossover: the inner lane's way back out runs under the outer lane's way in
  crossover: { under: 'Crossover under' },
  // the flags along the front of the bowl (the generator's)
  landmarks: [
    ...STADEPRANCE_FLAGS,
  ],
  // a stadium: no trees, no bushes on its pitch, no kerbs (the lanes laid on plates)
  trees: 0,
  bushless: true,
  kerbless: true,
  // the pitch's mown stripes inside the inner lane (6 m bands; its south side 30 m in from the
  // outer lane's, where the crossover is)
  mown: [{ at: [0, -5], pxM: 6, rows: Array.from({ length: 4 }, () => '#.#.#.#.#.#.#.#.#.#.#.#') }],
};

// the one layout - built on first use (world/load.ts buildLevel)
export const STADEPRANCE_LEVELS: Level[] = [
  { id: 'stadeprance', name: STADE_DE_PRANCE, venue: STADE_DE_PRANCE,
    _lap: () => venueLap(STADEPRANCE_SPEC, 'roc'),
    _build: () => venueLevel(STADEPRANCE_SPEC, 'roc', 'stadeprance', STADE_DE_PRANCE) } as Level,
];
