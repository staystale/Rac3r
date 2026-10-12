import { SURFACES } from "../surfaces.ts";
import { createSubtrack } from "../subtrack.ts";
// =============================================================================================
// NAFFCAR SPEEDWAY (Super Speedway — PLAN.md §3)
// Counter-clockwise (turning left). Max extent 226m (fits cleanly within 302m world fence).
// Start/finish at x=0, y=75. Banked corners (18 deg), stadium grandstands, start gantry.
// =============================================================================================
const NC_APEXES = [
  [0, 75], [135, 75], [190, 48], [215, 0], [190, -48], [135, -75], [0, -75], [-135, -75], [-190, -48], [-215, 0], [-190, 48], [-135, 75]
];
const NC_SECTORS = [
  { startDist: 0, endDist: 2500, surface: SURFACES.racetarmac }
];
const NC_CURVED_KERBS = [
  // Inner rumble kerb
  { side: 'right', startDist: 0, endDist: 2500, width: 2.4, h: 0.12 },
  // Outer warning kerb
  { side: 'left', startDist: 0, endDist: 2500, width: 2.0, h: 0.08 }
];
export const NC_SUBTRACK = createSubtrack(NC_APEXES, 22, NC_SECTORS, NC_CURVED_KERBS);

export const NC_ZONES = [
  { x: 0, y: 0, w: 360, h: 90, surface: SURFACES.grassShort },  // grassy infield
  { x: 0, y: 54, w: 240, h: 14, surface: SURFACES.tarmac },       // driveable pit apron
];

export const NC_PROPS = [
  { kind: 'gantry', x: 0, y: 75, wid: 26, rot: Math.PI / 2 },
  { kind: 'pit_wall', x: 0, y: 62, len: 220, h: 1.2 },
  { kind: 'stadium_grandstand', x: 0, y: 98, w: 180, h: 14 },
  { kind: 'stadium_grandstand', x: 0, y: -98, w: 180, h: 14 },
  { kind: 'pylon', x: -210, y: 70 }, { kind: 'pylon', x: 210, y: 70 },
  { kind: 'pylon', x: -210, y: -70 }, { kind: 'pylon', x: 210, y: -70 },
];

export const NC_PAINT = [
  // Start/finish chequered stripe
  { kind: 'chequered', x: 0, y: 75, wid: 22, len: 2.5 },
  // Pit lane entrance & exit white divider line
  { kind: 'lane', x: 0, y: 62, w: 220, h: 0.4, tone: 0.8 },
];

export const NC_BOARDS = [
  { x: 0, y: 88, label: 'FINISH' },
];
