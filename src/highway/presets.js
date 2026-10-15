// highway presets: the road types (HW_PRESETS), the window constants and the silly signs,
// plus the tiny wrap / rng helpers every highway file shares. Split out of highway.js.
import { lcg } from "../core/random.ts";
// lanes / laneW / shoulder (left, hard shoulder; a solid line inside it when >= 2 m) / edge (right
// margin) in m; maxDeg off straight up; sweep / bend = radius ranges (m); pStraight / pBend =
// chance an element is a straight / a tight bend (else a sweeper)
export const HW_PRESETS = {
  motorway: {
    lanes: 3,
    laneW: 3.65,
    shoulder: 3.3,
    edge: 0.7,
    maxDeg: 60,
    sweep: [350, 900],
    bend: [180, 300],
    pStraight: 0.34,
    pBend: 0.2,
  },
  interstate: {
    lanes: 4,
    laneW: 3.7,
    shoulder: 3.0,
    edge: 1.2,
    maxDeg: 45,
    sweep: [600, 1400],
    bend: [350, 500],
    pStraight: 0.45,
    pBend: 0.1,
  },
  dual: {
    lanes: 2,
    laneW: 3.4,
    shoulder: 0.6,
    edge: 0.6,
    maxDeg: 60,
    sweep: [250, 600],
    bend: [120, 200],
    pStraight: 0.3,
    pBend: 0.25,
  },
  // WALLED IN (requirement: some levels that use this mechanic should be more walled in):
  // `walls` = a continuous barrier kind both sides, `wallGap` m off the road edge; no trees / barns
  // inside the walls
  walled: {
    lanes: 3,
    laneW: 3.65,
    shoulder: 1.0,
    edge: 1.0,
    maxDeg: 50,
    sweep: [400, 900],
    bend: [220, 320],
    pStraight: 0.3,
    pBend: 0.2,
    walls: "wall",
    wallGap: 1.2,
  },
};
export const HW_NAMES = {
  motorway: "MOTORWAY",
  interstate: "INTERSTATE",
  dual: "DUAL C/WAY",
  walled: "WALLED",
};
// SPAWN_S 40 -> 300 (MEASURED, treadmillcheck: the road's raw START was only 40 m behind
// the car at spawn, inside a zoomed-out view); K_RATE = the fastest curvature change, 1/m per m (a
// clothoid; 5e-5 = a 0 -> R 200 ramp over 100 m)
export const STEP = 4,
  AHEAD = 1100,
  BEHIND = 450,
  SPAWN_S = 300,
  UP_HEADING = -Math.PI / 2,
  K_RATE = 5e-5;
export const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const rng = (seed) => lcg((seed >>> 0) || 1);
// SILLY SIGNS (the distance to Hull goes UP — you never get there)
export const SIGNS = [
  "SERVICES 2 MI (CLOSED)",
  "SPEED CAMERA (BROKEN)",
  "NO CHIPS FOR 300 MI",
  "CONES NEXT 40 MI",
  "WELCOME TO NOWHERE",
  "HULL: TWINNED WITH HULL",
  "ARE WE NEARLY THERE?",
  "BEWARE OF THE SHEEP",
  "ROADWORKS ENDED 1987",
  "SLOW DOWN (OR DON'T)",
  "SKID PAN 5 MI",
  "LAST TOILET: BEHIND YOU",
];
