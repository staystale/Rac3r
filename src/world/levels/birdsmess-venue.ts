// world/levels/birdsmess-venue.ts - THE BIRD'S MESS (the Bird's Nest, Beijing National Stadium;
// the name approved by the owner 11-10), a NEW venue (world/venue.ts) laid by hand
// (venues/birdsmess.ts: tools/scratch/_rocdata.mjs birdsmess, the same generator as Wobbly
// Stadium's and Stade de Prance's): the Race of Champions' track in the Bird's Nest, 2009 - as the
// other stadiums', two interwoven lanes side by side on the pitch, one crossover bridge, the cars
// head to head (TODO.md ROC STADIUMS). ONE path crossing itself once - round the outer lane, over
// the crossover onto the inner lane, round it inside, under the bridge back out - Snoozuka's
// crossover system. CLOSE TO, NOT TRACED: no plan of the Beijing track was supplied - the shape is
// its own, a fat egg in the Nest's elliptical bowl: a sweeping south-east into a tight north-east
// hairpin, the north side PINCHED IN (a bend the other way round - the one right-hander of the lap,
// where the lanes swap which is inside), a tighter north-west, the west end one long sweeper into
// the south-west, the crossover west of the south straight's middle, 1015 m. At FULL SIZE as the
// others (two lanes at the 13 m road need 20 m between centres); the bowl a near-ellipse with its
// roof ring (creative licence). SURFACES: tarmac (the base off the road the pitch's grass), gravel
// on both lanes' east end - the south-east sweeper, the start straight and the north-east hairpin.
// A NIGHT RACE under floodlights (Level.eventHour). ITS OWN DRESSING: the stands' seats the
// Nest's red, its roof ring a steel lattice (both outside the catch fence, nothing over the track
// or a car), floodlight pylons round both lanes (apron and infield), the flags red and gold, the
// Nest's criss-cross mown into the pitch, litter behind the barriers (pallets, barrels, spare
// tyres, a tarp). North up.
import { BIRDSMESS_DRESS, BIRDSMESS_DRESS_LITTER, BIRDSMESS_FLAGS, BIRDSMESS_FLOODS,
  BIRDSMESS_LITTER, BIRDSMESS_VENUE } from "./venues/birdsmess.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the venue's name (a parody of the Bird's Nest, approved by the owner 11-10), in one place
export const THE_BIRDS_MESS = "The Bird's Mess";

// the hour an event here starts at when the setup leaves the time LIVE: a night race (the owner's
// answer), 22:00 dark in every season (world/clock.ts: the longest day's dusk ends ~21:00)
const NIGHT_RACE_HOUR = 22;

export const BIRDSMESS_SPEC: VenueSpec = {
  id: 'birdsmess',
  data: BIRDSMESS_VENUE,
  // (laid in game m: the path's own length calibrates it to itself)
  share: 1,
  realRoadM: 13,
  calibrate: { layout: 'roc', realLapM: 1015 },
  // the start line on the outer lane's east straight, the grid back toward its south-east sweeper
  // (on the gravel - the owner: "start on the gravel facing the same way but on different lanes";
  // the inner lane's gravel alongside, 20 m in, the same way, north into the hairpins)
  start: [95.3, -14],
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
    { at: [-10, 72], label: "THE BIRD'S MESS", on: 'catchfence' },
    { at: [60, 72], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [-60, 72], label: 'KUM', on: 'catchfence' },
    { at: [105, 0], label: 'MICKY TOMSON', on: 'catchfence' },
    { at: [-118, 4], label: 'HEAD-TO-HEADBUTT', on: 'catchfence' },
    { at: [60, -70], label: 'GOOD YEAH', on: 'catchfence' },
    { at: [-55, -70], label: "THE BIRD'S MESS", on: 'catchfence' },
    { at: [0, -63], label: 'FIRESTONED', on: 'catchfence' },
    { at: [0, -22], label: "THE BIRD'S MESS" },
    { at: [-40, 20], label: 'DUNFLOP' },
    { at: [30, 20], label: 'SPUM' },
    { at: [-74, -5], label: 'AVAN' },
    { at: [60, -18], label: 'PIRRELLY' },
  ],
  // the Race of Champions in the Bird's Nest, 2009
  seed: 2009,
  // m past the road's edge the barriers stand (laid round the lanes, no run-off)
  runoffM: 3,
  // THE BARRIERS (as the other stadiums': concrete blocks and Armco both sides of both lanes): a
  // line 10 m off each side of every lane but the crossover (tools/scratch/_rocdata.mjs
  // birdsmess), followed as rails - the edge's Armco at its run-off's rim, a catch fence where the
  // stands are
  followRails: true,
  // the barriers tidied, an Armco end carried on to the catch fence's round the crossover
  // (world/venuetidy.ts)
  tidyEdge: 'fences',
  // and made even: its Armco and fences eased, its free ends met (world/stadiumtidy.ts)
  evenEdge: true,
  // the crossover: the inner lane's way back out runs under the outer lane's way in, its cut 1.5 m
  // wider each side than the road's own and its lintels 2.4 m further from the bridge road (room
  // for a car on either road's edge at the portals; the generator's CUT_SPARE, LINTEL_EXTRA)
  crossover: { under: 'Crossover under', spareM: 1.5, clearM: 2.4 },
  // the flags along the front of the bowl, red and gold, and the floodlight pylons round both
  // lanes, every 55 m 16 m off the lane's centre (the generator's; the lamp plan adds its own);
  // its dressing (the generator's): red and gold transporters and a paddock,
  // a motorhome, a TV camera platform, a red steel sculpture and show cars in the infield, fans
  landmarks: [
    ...BIRDSMESS_FLAGS,
    ...BIRDSMESS_FLOODS,
  ],
  dress: { props: BIRDSMESS_DRESS, litter: BIRDSMESS_DRESS_LITTER },
  // the litter (the generator's): heaps of spare tyres, pallets, barrels and a tarp on the apron
  // and in the infield, behind the barriers
  litter: BIRDSMESS_LITTER,
  // THE NEST: the inner bowl's seats red (two tiers' shades in turn), the roof ring a pale membrane
  // under the woven steel lattice - the stands and the roof only, all outside the catch fence
  bowlLook: { seats: ['#8e1c22', '#b32a2f'], roof: '#b4b9bf', lattice: '#4c535c' },
  // a stadium: no trees, no bushes on its pitch, no kerbs (the lanes laid on plates)
  trees: 0,
  bushless: true,
  kerbless: true,
  // the Nest's criss-cross mown into the pitch inside the inner lane (3 m squares, a diamond
  // lattice 93 x 27 m)
  mown: [{ at: [-5, 2], pxM: 3, rows: [
    '#...#...#...#...#...#...#...#..',
    '.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.',
    '..#...#...#...#...#...#...#...#',
    '.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.',
    '#...#...#...#...#...#...#...#..',
    '.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.',
    '..#...#...#...#...#...#...#...#',
    '.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.',
    '#...#...#...#...#...#...#...#..',
  ] }],
};

// the one layout - built on first use (world/load.ts buildLevel); a night race
export const BIRDSMESS_LEVELS: Level[] = [
  { id: 'birdsmess', name: THE_BIRDS_MESS, venue: THE_BIRDS_MESS, eventHour: NIGHT_RACE_HOUR,
    _lap: () => venueLap(BIRDSMESS_SPEC, 'roc'),
    _build: () => venueLevel(BIRDSMESS_SPEC, 'roc', 'birdsmess', THE_BIRDS_MESS) } as Level,
];
