import { SURFACES } from "../surfaces.ts";
import { createSubtrack } from "../subtrack.js";
// =============================================================================================
// STOCK CAR OVAL (Tarmac with broken sections — PLAN.md §3)
// Counter-clockwise (turning left). Start/finish at x=0, y=48.
// =============================================================================================
const SO_APEXES = [
  [0, 48], [70, 48], [105, 22], [105, -22], [70, -48], [0, -48], [-70, -48], [-105, -22], [-105, 22], [-70, 48]
];
const SO_SECTORS = [
  { startDist: 0, endDist: 85, surface: SURFACES.tarmac },
  { startDist: 85, endDist: 195, surface: SURFACES.broken },   // broken Turn 1/2
  { startDist: 195, endDist: 300, surface: SURFACES.tarmac },
  { startDist: 300, endDist: 410, surface: SURFACES.broken },  // broken Turn 3/4
  { startDist: 410, endDist: 1000, surface: SURFACES.tarmac },
];
const SO_CURVED_KERBS = [
  { side: 'right', startDist: 0, endDist: 1000, width: 2.2, h: 0.12 }
];
export const SO_SUBTRACK = createSubtrack(SO_APEXES, 15, SO_SECTORS, SO_CURVED_KERBS);

export const SO_ZONES = [
  { x: 0, y: 0, w: 150, h: 56, surface: SURFACES.broken },     // infield broken tarmac
  { x: 0, y: 72, w: 120, h: 22, surface: SURFACES.tarmac },     // paddock & pits outside
  { x: -45, y: 8, w: 26, h: 18, surface: SURFACES.grassShort },
  { x: 45, y: -8, w: 26, h: 18, surface: SURFACES.grassShort },
];

export const SO_PROPS = [
  { kind: 'banger', x: -28, y: 12, rot: 0.52, paint: '#8b2a26', num: '42' },
  { kind: 'banger', x: 20, y: -14, rot: -0.44, paint: '#2a4d7a', num: '17' },
  { kind: 'banger', x: -8, y: -10, rot: 2.15, paint: '#8b7a2b', num: '88' },
  { kind: 'banger', x: 30, y: 15, rot: -1.15, paint: '#484c56', num: '03' },
  { kind: 'official_box', x: -14, y: 64 },
  { kind: 'grandstand', x: 18, y: 76, w: 42, h: 7, rot: 0 },
  { kind: 'board', x: -55, y: 62, label: 'SPUM TYRES' },
  { kind: 'board', x: 55, y: 62, label: 'CREEM OIL' },
  { kind: 'board', x: 0, y: -62, label: 'SLAG HEAP SCRAP' },
  { kind: 'pylon', x: -90, y: 60 }, { kind: 'pylon', x: 90, y: 60 },
  { kind: 'pylon', x: -90, y: -60 }, { kind: 'pylon', x: 90, y: -60 },
];

export const SO_PAINT = [
  // Chequered start/finish line across the front straight
  { kind: 'chequered', x: 0, y: 48, wid: 15, len: 2.0 },
];

export const SO_BOARDS = [
  { x: 0, y: 58, label: 'FINISH' },
];
