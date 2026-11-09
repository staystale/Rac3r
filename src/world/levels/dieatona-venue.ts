// world/levels/dieatona-venue.ts - DIEATONA AS THE REAL VENUE (?dieatona=1, world/venue.ts): the
// Daytona International Speedway parody from OpenStreetMap (venues/dieatona.ts) at 1/2 of real
// length with the 13 m road, two layouts of one venue sharing its scenery: the 2.5-mile tri-oval
// and the road course the 24-hour race runs (the infield, the oval's banking from turn 1 and the Le
// Mans chicane on the back straight). The frame is turned so the frontstretch and its grandstands
// run along the bottom, the oval run anticlockwise (left to right along the bottom).
import { DIEATONA_VENUE } from "./venues/dieatona.ts";
import { venueLap, venueLevel } from "../venue.ts";
import type { VenueSpec } from "../venue.ts";
import type { Camber, Level } from "../types.ts";

// THE BANKING (real angles: 31 deg in the turns, 18 in the tri-oval, about 3 on the back
// straight), always toward the infield (side -1: the oval runs anticlockwise). An angle changes
// in RAMP_STEP_M steps over 100 m (world/terrain.ts camberTable smooths only over +-6 points; the
// old Naffcar notes: a 7 m outer edge rising over 30 m is a launch at speed)
const RAMP_STEP_M = 10;
type Section = { from: number; to: number; deg: number; side: -1 };
const hold = (from: number, until: number, deg: number): Section[] =>
  [{ from, to: until, deg, side: -1 }];
const ramp = (from: number, until: number, fromDeg: number, toDeg: number): Section[] => {
  const steps = Math.round((until - from) / RAMP_STEP_M);
  return Array.from({ length: steps }, (_unused, step) => {
    const frac = (step + 0.5) / steps, ease = frac * frac * (3 - 2 * frac);
    return { from: from + step * RAMP_STEP_M, to: from + (step + 1) * RAMP_STEP_M,
      deg: fromDeg + (toDeg - fromDeg) * ease, side: -1 as const };
  });
};
const banked = (sections: Section[]): Camber => ({ maxDeg: 0, refR: 70, crown: 0, edge: 16,
  sections });
// lap metres of the traced layouts (tools/scratch/_venueloops.mjs; the line at the tri-oval's apex)
const OVAL_BANKING = banked([
  ...hold(0, 230, 18), ...ramp(230, 330, 18, 31), ...hold(330, 720, 31),
  ...ramp(720, 820, 31, 3), ...hold(820, 1170, 3), ...ramp(1170, 1270, 3, 31),
  ...hold(1270, 1650, 31), ...ramp(1650, 1750, 31, 18), ...hold(1750, 2020, 18),
]);
// the road course: the oval's banking where it runs on the oval (its Speedway 872 m on, its turns
// 1 and 2 857 m on), flat in the infield and the Le Mans chicane, eased off the banking before
// the turn into the infield (143) and onto it after the rejoin (1145) and the chicane (2043)
const ROAD_BANKING = banked([
  ...hold(0, 40, 18), ...ramp(40, 140, 18, 0),
  ...ramp(1145, 1245, 0, 31), ...hold(1245, 1577, 31), ...ramp(1577, 1677, 31, 3),
  ...hold(1677, 1874, 3), ...ramp(1874, 1904, 3, 0),
  ...ramp(2043, 2143, 0, 31), ...hold(2143, 2522, 31), ...ramp(2522, 2622, 31, 18),
  ...hold(2622, 2885, 18),
]);

// THE SUBTLE SKULL (the owner's Die-tona joke): mown into the infield's grass behind the pit road
// at the tri-oval, where the real one has its logo - short grass on the grass, the eyes, nose and
// gaps between the teeth left long; upright on the screen
const SKULL = [
  '.#######.',
  '#########',
  '#########',
  '#..###..#',
  '#..###..#',
  '####.####',
  '.#######.',
  '..#.#.#..',
  '..#####..',
];

export const DIEATONA_SPEC: VenueSpec = {
  id: 'dieatona',
  data: DIEATONA_VENUE,
  share: 0.5,
  // m: the real road on the banking (40 ft)
  realRoadM: 12,
  calibrate: { layout: 'oval', realLapM: 4023 },
  // the start / finish line at the tri-oval's apex, by the pit road's middle
  start: [0, 330],
  pitLane: 'Pit Lane (pit road)',
  // the tri-oval's line jogs ~3 deg twice in the map (a car went light on the banking there)
  trace: { oval: { passes: 40, kern: 10 } },
  rollingStart: true,
  camber: { oval: OVAL_BANKING, road: ROAD_BANKING },
  // the SAFER wall round the oval's outside, 2 m past its edge (tools/barriercheck.mjs: every
  // barrier 2 m off the road; concrete, every layout's)
  ovalWall: { layout: 'oval', gapM: 2.05, kind: 'wall' },
  // the hand finish (game m): the turn 4 tunnel's outer mouth meets the service road outside it
  // (its own 30 real m of road was too short to lay)
  finish: { roads: [{ pts: [[-381.4, 84.9], [-383.2, 88], [-385, 91]] }] },
  hills: [],
  banks: [],
  // the boards on the outside wall round the oval (the register's brands)
  boards: [
    { at: [-300, 372], label: 'DIEATONA', on: 'wall' },
    { at: [300, 362], label: 'GOOD YEAH', on: 'wall' },
    { at: [790, -60], label: 'SPUM OIL', on: 'wall' },
    { at: [-790, -60], label: 'CREEM OIL', on: 'wall' },
  ],
  mown: [{ at: [0, 322], pxM: 1.6, rows: SKULL }],
  seed: 1959,
};

// the two layouts of the one venue, each built on first use (world/load.ts buildLevel)
const layoutLevel = (layout: string, levelId: string, name: string): Level =>
  ({ id: levelId, name, venue: 'Dieatona',
    _lap: () => venueLap(DIEATONA_SPEC, layout),
    _build: () => venueLevel(DIEATONA_SPEC, layout, levelId, name) } as Level);
export const DT_LEVELS: Level[] = [
  layoutLevel('oval', 'dieatona', 'Dieatona'),
  layoutLevel('road', 'dieatona-road', 'Dieatona Road Course'),
];
