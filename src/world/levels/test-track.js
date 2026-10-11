import { SURFACES } from "../surfaces.js";
import { createSubtrack } from "../subtrack.js";
import { prepBumps } from "../terrain.js";
import { courseCones } from "../tyrewall.js";
// =============================================================================================
// THE TEST TRACK (A flowing road course showcasing all surface types)
const TT_APEXES = [
  [-70, -95], [0, -95], [70, -95],                 // Main straight (Race Tarmac)
  [120, -75], [145, -20], [130, 35],               // Turn 1 sweeping right (Tarmac)
  [95, 75], [55, 95], [15, 75],                    // Turn 2 chicane (Broken Tarmac + Kerbs)
  [-30, 95], [-85, 115], [-135, 90],               // Turn 3 dirt sweeper (Dirt Road)
  [-145, 40], [-115, 5], [-140, -35],              // Turn 4 hairpin cut (Long / Short Grass)
  [-110, -75],                                     // Turn 5 entry back to straight
];

const TT_CURVED_KERBS = [
  // Turn 1 Apex inside (Right / -nx)
  { side: 'right', startDist: 180, endDist: 280, width: 2.4, h: 0.11 },
  // Turn 1 Exit outside (Left / +nx)
  { side: 'left', startDist: 285, endDist: 345, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Entry 1 apex (Left / +nx)
  { side: 'left', startDist: 365, endDist: 415, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Flick 2 apex (Right / -nx)
  { side: 'right', startDist: 425, endDist: 470, width: 2.4, h: 0.11 },
  // Turn 2 Chicane Exit outside (Left / +nx)
  { side: 'left', startDist: 470, endDist: 510, width: 2.4, h: 0.11 },
  // Turn 4 Double Hairpin Apex 1 (Right / -nx)
  { side: 'right', startDist: 690, endDist: 735, width: 2.4, h: 0.11 },
  // Turn 4 Double Hairpin Apex 2 (Left / +nx)
  { side: 'left', startDist: 745, endDist: 785, width: 2.4, h: 0.11 },
  // Turn 5 Final Corner Exit outside (Right / -nx)
  { side: 'right', startDist: 805, endDist: 855, width: 2.4, h: 0.11 },
];

const TT_SECTORS = [
  // Sector 1: Race Tarmac main straight
  { startDist: 820, endDist: 150, surface: SURFACES.racetarmac },
  // Sector 2: Turn 1 sweeper
  { startDist: 150, endDist: 345, surface: SURFACES.tarmac },
  // Sector 3: Chicane with broken tarmac
  { startDist: 345, endDist: 495, surface: SURFACES.broken },
  // Sector 4: Off-road dirt sweeper
  { startDist: 495, endDist: 675, surface: SURFACES.dirt },
  // Sector 5: Double Hairpin & return straight
  { startDist: 675, endDist: 820, surface: SURFACES.tarmac },
];

export const TT_SUBTRACK = createSubtrack(TT_APEXES, 13, TT_SECTORS, TT_CURVED_KERBS);
export const TT_CONES = [
  ...courseCones(TT_APEXES, 13, 14),
  // Chicane and corner protection tyre stacks
  { x: 58, y: 72, kind: 'tyrestack' },
  { x: 55, y: 70, kind: 'tyrestack' },
  { x: 32, y: 96, kind: 'tyrestack' },
  { x: 35, y: 98, kind: 'tyre' },
  // Turn 1 run-off safety buffers
  { x: 148, y: -20, kind: 'tyrestack' },
  { x: 146, y: -25, kind: 'tyre' },
  // Infield testing pad entrance tyre stacks
  { x: -20, y: -16, kind: 'tyrestack' },
  { x: -22, y: -18, kind: 'tyre' },
  { x: 20, y: -16, kind: 'tyrestack' },
];

export const TT_ZONES = [
  // Dedicated Infield Proving Ground testing facilities:
  { x: 0, y: -30, w: 54, h: 28, surface: SURFACES.wet, boxed: true, rounded: true },
  { x: -58, y: -30, w: 46, h: 28, surface: SURFACES.ice, boxed: true, rounded: true },
  { x: 58, y: -30, w: 46, h: 28, surface: SURFACES.snow, boxed: true, rounded: true },
  { x: -30, y: 25, w: 52, h: 32, surface: SURFACES.mud, boxed: true, rounded: true },
  { x: 32, y: 25, w: 52, h: 32, surface: SURFACES.gravel, boxed: true, rounded: true },
];

export const TT_BUMPS = prepBumps([
  // Table jump on the straight exit (straight ramp on straight section)
  { kind: 'table', x: 45, y: -95, rot: 0, len: 24, wid: 14, h: 0.80 },
]);

export const TT_PAINT = [
  // Chequered Grand Prix start/finish line — exactly aligned with road centerline and heading
  { kind: 'chequered', x: -48, y: -96.48, len: 1.6, wid: 13, rot: 0.0109 },
];

export const TT_BOARDS = [
  { x: -48, y: -87.5, label: 'FINISH' },
  { x: 0, y: -87.5, label: '50m' },
  { x: 50, y: -87.5, label: '100m' },
];
