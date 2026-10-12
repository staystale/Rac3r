// Shared world data shapes; this file grows as files are converted.

// What a wheel leaves behind on a surface.
export interface Mark {
  rgb: string;
  widen: number;
  alpha: number;
}

// What the wheels throw up from a surface.
export interface Spray {
  rgb: string;
  size: number;
  rate: number;
  lift: number;
  life: number;
  grow: number;
}

export interface Surface {
  id: string;
  label?: string;
  mu: number;
  peakK: number;
  longK?: number;
  plough: number;
  rough: number;
  mark: Mark | null;
  spray?: Spray | null;
  hard?: boolean;
  coolK?: number;
  heatK?: number;
}

export interface Paint {
  kind: string;
  x: number;
  y: number;
  r?: number;
  lw?: number;
  tone?: number;
  w?: number;
  h?: number;
  len?: number;
  wid?: number;
  rot?: number;
}

export interface Board {
  x: number;
  y: number;
  label: string;
  rot?: number;
}

export interface Cone {
  x: number;
  y: number;
  kind?: string;
  rot?: number;
  paint?: string;
  num?: string;
  col?: string;
  tape?: string;
  idx?: number;
}

export interface Spawn {
  x: number;
  y: number;
  heading: number;
  rot?: number;
}

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  surface: Surface;
  boxed?: boolean;
  ext?: boolean;
  lane?: string;
  rounded?: boolean;
  rot?: number;
  art?: string;
  hedge?: boolean;
  field?: number;
  _s?: number;
}

export interface Bump {
  kind: string;
  x: number;
  y: number;
  cos: number;
  sin: number;
  reach2: number;
  rot?: number;
  len?: number;
  wid?: number;
  h?: number;
  r?: number;
  d?: number;
  amp?: number;
  wave?: number;
  r0?: number;
  R?: number;
  B?: number;
}

export interface Prop {
  kind: string;
  x: number;
  y: number;
  wid?: number;
  rot?: number;
  w?: number;
  h?: number;
  size?: number;
  label?: string;
  col?: string;
  s?: number;
  seed?: number;
  brand?: string;
  front?: unknown[];
  back?: unknown[];
  banner?: unknown[];
  roof?: string;
  paint?: string;
  num?: string;
  len?: number;
  line?: unknown[];
  nose?: boolean;
  field?: number;
  _s?: number;
  house?: boolean;
  church?: boolean;
  blue?: boolean;
  bars?: number;
  n?: number;
  snow?: boolean;
  pal?: string;
}

// An x, y pair in metres.
export type Point = [number, number];

// The floor rectangle (LEVEL.bounds).
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Level {
  paint: Paint[];
  boards: Board[];
  cones: Cone[];
  spawn: Spawn;
  zones: Zone[];
  bumps: Bump[];
  props?: Prop[];
  bounds?: Rect;
  floor?: number;
  subtrack?: Subtrack;
}

// One resampled centre-line point of a subtrack.
export interface TrackPoint {
  x: number;
  y: number;
  dist: number;
  dirX: number;
  dirY: number;
  nx: number;
  ny: number;
  heading: number;
  width: number;
}

// A stretch of the lap with its own surface; startDist > endDist wraps over the start line.
export interface Sector {
  startDist: number;
  endDist: number;
  surface: Surface;
}

// A kerb along the road edge. 'left' = the +normal side.
export interface CurvedKerb {
  side: 'left' | 'right';
  startDist: number;
  endDist: number;
  width: number;
  h: number;
}

// One padded road segment of the lookup grid.
export interface SubSeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dx: number;
  dy: number;
  l2: number;
  len: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  ghost?: boolean;   // set by ghostSegment
}

// What createSubtrack returns (the track centre line and its lookup grid).
export interface Subtrack {
  pts: TrackPoint[];
  segs: SubSeg[];
  totalDist: number;
  width: number;
  sectors: Sector[];
  sectorAt: (dist: number) => Sector | { surface: Surface };
  curvedKerbs: CurvedKerb[];
  grid: Map<number, number[]>;
  ghost?: { d0: number; d1: number };   // ghostSegment
  noLines?: boolean;   // stagegen.js
  laneDash?: number[];   // highway.js
  laneSolid?: number[];   // highway.js
  sBase?: number;   // highway.js
  layoutId?: number;   // highway.js, grass-track.js: a new value means cached ground is stale
}

// Options of autoKerbs (all optional; defaults in subtrack.ts).
export interface AutoKerbOptions {
  maxR?: number;
  exitR?: number;
  width?: number;
  h?: number;
  heavyR?: number;
  heavyW?: number;
  heavyH?: number;
  minTurn?: number;
  mergeGap?: number;
}

// Options of traceTrack (all optional; defaults in subtrack.ts).
export interface TraceOptions {
  mpp?: number;
  cx?: number;
  cy?: number;
  step?: number;
  rMin?: number;
  passes?: number;
  kern?: number;
}