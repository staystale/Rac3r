// world/levels/lalively-venue.ts - L.A. LIVELY (X GAYMS RALLYCROSS, Los Angeles 2012; the names
// approved by the owner 11-10), a NEW venue (world/venue.ts) laid by hand (venues/lalively.ts:
// tools/scratch/_lalivelydata.mjs): the X Gayms rallycross course in the streets and lots round the
// arena - not traced (no plan was supplied: the real street grid round an arena, creative
// licence), 923 m, a FIGURE OF EIGHT laid loose - mixed corners, bending streets, free lines across
// the lots. Clockwise from the start: the south street west (the grid, tarmac), bending a little,
// into the WEST LOT (dirt): a sweep onto its diagonal (r26), a 15 m HAIRPIN in its far corner,
// back across it (r28) onto the avenue, bending (r40) to run east OVER THE CROSSOVER BRIDGE; a
// fast SWEEPER (r38) into the EAST LOT (dirt), across it on the diagonal and north (r36) past the
// joker's branch, a corner that TIGHTENS (r28, then r14) onto the NORTH LOT (dirt), a KINK (r30)
// along it to the north corner (r18, back on tarmac), south down the street UNDER THE BRIDGE
// (world/venuecross.ts: the street at 90 deg under the avenue, the stadiums' crossover system) to
// the south corner (r24) and back round to the line. SURFACES: the streets race tarmac; the lots
// dirt laid over the street (a piece's surface, as every rallycross lap's loose stretch - the base
// under the dirt the street's tarmac); off the road the city's concrete. 43 % dirt.
// THE JOKER (the real rules: once a race, the shared joker rule): a dirt lane round the north
// lot's outside - on north past the lot's corner, west along the joker straight, south onto the
// street - 52 m longer than the lap's way, with THE GAP JUMP on its straight: a 2 m kicker (the
// terrain's ramp, its red lip drawn), a 16 m (52 ft) gap, a 2 m landing deck (the terrain's
// table) - no new physics, the suspension's own airtime and landings. MEASURED
// (tools/scratch/_gapjump.mjs, held at a speed): the cars clear the gap from 60-70 km/h; slower
// they land in the gap or on the landing's face, no damage, nothing stuck.
// ITS OWN LOOK: the arena, the convention halls, offices, shops, a hotel tower, a parking deck and
// studios round the course (flat-roofed blocks), bleachers at the start, the jump, the avenue and
// the east lot with the event's orange, black and white flags in front, floodlight pylons every
// 50 m and street lights along every straight (Level.streetLamps: it races at the game's own
// hour - lit by night, the city by day), litter in the event's colours behind the barriers.
// North up.
import { LALIVELY_DRESS, LALIVELY_DRESS_LITTER, LALIVELY_FLAGS, LALIVELY_FLOODS, LALIVELY_JUMP,
  LALIVELY_LAP_M, LALIVELY_LITTER, LALIVELY_VENUE } from "./venues/lalively.ts";
import { venueLap } from "../venue.ts";
import { prepBumps } from "../terrain.ts";
import { rallycrossLevel } from "./rallycross-venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Level } from "../types.ts";

// the course's name and the event's (parodies approved by the owner 11-10), in one place
export const LA_LIVELY = 'L.A. Lively';

export const LALIVELY_SPEC: VenueSpec = {
  id: 'lalively',
  data: LALIVELY_VENUE,
  // (laid in game m: the lap's own length calibrates it to itself)
  share: 1,
  realRoadM: 13,
  calibrate: { layout: 'rx', realLapM: LALIVELY_LAP_M },
  // the start line on the south street, the grid back east along it toward the street's corner
  start: [-100, 90],
  startOnLine: true,
  // the lap laid as arcs and straights: smoothed lightly (as the stadiums', so the crossover's
  // streets stay straight to their portals)
  trace: { rx: { passes: 2, kern: 2 }, joker: { passes: 2, kern: 2 } },
  // (its hairpin's 15 m and the tightening corner's 14 m traced as laid: the venues' least radius,
  // 15.5 m, opened the hairpin out across its own legs, 10 m off its line)
  minR: 10,
  hills: [],
  banks: [],
  // the boards (the event's and the register's brands): on the barriers along the tarmac streets
  // (the dirt's sides are lined with bales), the start's and the avenue's by their stands
  boards: [
    { at: [-90, 100], label: 'X GAYMS', on: 'catchfence' },
    { at: [-65, 100], label: 'L.A. LIVELY', on: 'catchfence' },
    { at: [-60, 80], label: 'PIRRELLY' },
    { at: [-55, -10], label: 'L.A. LIVELY', on: 'catchfence' },
    { at: [-85, -10], label: 'DUNFLOP', on: 'catchfence' },
    { at: [40, -10], label: 'X GAYMS' },
    { at: [-10, 60], label: 'KUM' },
    { at: [10, -55], label: 'GOOD YEAH' },
  ],
  // the X Gayms in Los Angeles, 2012
  seed: 2012,
  // m past the road's edge the barriers stand (a street course: hard by the road)
  runoffM: 3,
  // THE BARRIERS: concrete blocks and Armco both sides of every road, a line 10 m off each side
  // (the generator's rails), followed as rails - a catch fence where the stands watch
  followRails: true,
  // tidied, an Armco end carried on to the catch fence's and round the crossover's portals
  tidyEdge: 'fences',
  // and made even, as the stadiums': its Armco and fences eased, its free ends
  // met, the runs at the crossover's mouths laid along the road (world/stadiumtidy.ts)
  evenEdge: true,
  // the crossover: the street under the avenue, its cut and lintels given the stadiums' room
  crossover: { under: 'Crossover under', spareM: 1.5, clearM: 3.5 },
  // the joker: the joker loop's way round the north lot that the lap does not race
  joker: { layout: 'rx', loop: 'joker', near: [75, -140] },
  // the floodlight pylons round the lap and the joker, the event's flags before the stands
  landmarks: [...LALIVELY_FLOODS, ...LALIVELY_FLAGS],
  // its dressing (the generator's, the stadiums' kits) in the event's orange,
  // black and white: the paddock in the lot east of the convention hall (transporters, the teams'
  // cars, flight cases, spare tyres, a motorhome with its bins), a TV camera platform and fans by
  // the jump's stand, fans by the start's, show cars in the infield
  dress: { props: LALIVELY_DRESS, litter: LALIVELY_DRESS_LITTER },
  litter: LALIVELY_LITTER,
  // the city: concrete off the road (pavements, lots), no trees, no bushes, no kerbs (a course laid
  // for a weekend on the streets)
  base: 'concrete',
  trees: 0,
  bushless: true,
  kerbless: true,
};

/**
 * The course as a level: the venue's rallycross layout (the joker rule, the bales) with the gap
 * jump laid on the joker straight.
 * @returns the level
 */
function laLivelyLevel(): Level {
  const level = rallycrossLevel(LALIVELY_SPEC, 'rx', 'xgayms', LA_LIVELY);
  // (a city street course: street lights along every straight - world/lampplan.ts)
  return { ...level, bumps: prepBumps([...(level.bumps || []), ...LALIVELY_JUMP]),
    streetLamps: true };
}

// the one layout - built on first use (world/load.ts buildLevel)
export const LALIVELY_LEVELS: Level[] = [
  { id: 'xgayms', name: LA_LIVELY, venue: LA_LIVELY,
    _lap: () => venueLap(LALIVELY_SPEC, 'rx'), _build: laLivelyLevel } as Level,
];
