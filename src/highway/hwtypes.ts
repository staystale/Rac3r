// highway/hwtypes.ts: the shapes the endless highway shares - its road type, the road it grows,
// the state it keeps on the level (level._hw), and the dressing context.
import type { Level, Point, Prop, Lane, Zone, Barrier, BarrierKind, Solid, Cover,
  Bump } from '../world/types.ts';
import type { RoadQ } from '../ai/types.ts';
import type { LevelObj } from '../cones/coneTypes.ts';

/** A road type (presets.ts HW_PRESETS): lanes, widths (m), the bend limits and mix. */
export interface HwCfg {
  lanes: number; laneW: number;
  shoulder: number;   // the hard shoulder, left (a solid line inside it when >= 2 m)
  edge: number;   // the right margin
  maxDeg: number;   // the heading's limit off straight up
  sweep: number[]; bend: number[];   // radius ranges, m
  pStraight: number; pBend: number;   // the chance of a straight / a tight bend
  walls?: string; wallGap?: number;   // walled in: the barrier kind, m off the road edge
  theme?: 'canyon';   // its own roadside (highway/canyon.ts); none: the countryside
  kRate?: number;   // the fastest curvature change, 1/m per m (road.ts; else presets.ts K_RATE)
  // its changes by road distance (Deaf Valley's HIGH road: highway/desertplan.ts)
  stretch?: (dist: number, seed: number) => Partial<HwCfg> | null;
  // the other way's traffic: a second carriageway, mirrored, the far side of a central
  // reservation with a barrier of kind median (road.ts laneGeo)
  oncoming?: 'carriageway';
  median?: BarrierKind;
}

/** The road's cross-section (road.ts laneGeo), m from the centre line (+ = the driver's right). */
export interface HwGeo {
  width: number; hw: number;
  centres: number[];   // our way's lanes, left first (the racers' road: ai/roadLine.ts)
  dashes: number[]; solid: number[];   // the lane lines drawn
  own: number[];   // the lanes our way's traffic drives
  oncoming: number[];   // the other way's lanes, its nearside first (none: no oncoming traffic)
  ownR: number;   // our carriageway's right edge (our traffic keeps inside it)
  oppL: number;   // the other way's edge nearest us (its traffic keeps beyond it)
  median: number | null;   // the central reservation's barrier, its offset (null: none)
}

/** A point of the road's centre line. */
export interface HwPoint {
  x: number; y: number; s: number; curv: number;
  sideOff?: number;   // the secret side road runs this far off it here
  gapL?: number;   // 1 where the side road opens the left verge (the guard lets you through)
}

/** A road element still to be laid: its length, curvature, the ramp in and out, the hold. */
export interface HwElem { len: number; k: number; ramp: number; hold: number; done?: number }

/** A point on (or off) the road: where, and the road's heading there. */
export interface HwPose { x: number; y: number; rot: number }

/** A keep-out rectangle (scenery stays out): centre, axes and half sizes. */
export interface KeepRect {
  x: number; y: number; ax: number; ay: number; hu: number; hv: number;
  _s?: number; field?: number;   // the road distance it belongs to; the field it fences
}

/** Where the road is cut short by a returning road or slip (cuts.ts). */
export interface HwCut {
  pts: Point[]; w: number; s: number;   // the outward polyline (cut short in place)
  skip: [number, number];   // the road distances it skips (its own stretch)
  after: () => void;   // called when it is cut
  _s?: number;
}

/** The secret side road while it is being built (cuts.ts sideStep). */
export interface SideRoad {
  s0: number; run: number;   // where it leaves the road; how long it runs beside it
  pts: Point[]; mpts: Point[];   // this piece's centre line; the part off the motorway's tarmac
  sPiece: number;   // the road distance this piece is dropped behind with
}

/** The state the highway keeps on its level (highway.ts rebuild). */
export interface HwState {
  seed: number;
  rnd: () => number; grnd: () => number; lrnd: () => number; xrnd: () => number;
  frnd: () => number;   // the random streams: dressing, road shape, loose, extras, fields
  geo: HwGeo;
  pts: HwPoint[];
  plan: HwElem[];
  x: number; y: number; hdg: number; s: number;   // where the road has grown to
  dressed: number;   // points dressed so far
  target: number; tUntil: number; tSide: number;   // the lean the road steers toward
  offT: number; warn: string | null; ci: number; best: number; driven: number; backT: number;
  q: (RoadQ & { i: number }) | null;   // where the player is on the road (and its point)
  camDir: { x: number; y: number };
  fieldId: number;
  fieldNext: Record<number, number> | null;   // the next field's road distance, by side (-1 / 1)
  goneFields?: Set<number>;   // fields cleared (their animals leave: main.ts game.cones.cull)
  keep: KeepRect[]; cuts: HwCut[];
  covers: Cover[]; coversDirty: boolean;   // the rivers' water (synced into level.covers)
  side: SideRoad | null;   // the secret side road being built
  nextSlip?: number; nextBridge?: number;   // the road distance of the next slip / bridge
  gantryDue?: boolean; villageNext?: number;
  looseCut?: number | null; looseNew?: LevelObj[];   // the loose objects dropped / added
  tookExit?: boolean;   // the player left by a slip
  inV?: number; camS?: number; outPrev?: number | null;   // the guard's and the camera's memory
}

/** A highway level: a level with its road type and its road state. */
export type HwLevel = Omit<Level, '_hw' | '_cfg'> & {
  _hw: HwState; _cfg: HwCfg; seed: number;
  // the parts the road streams, always there on a highway level
  props: Prop[]; lanes: Lane[]; zones: Zone[]; barriers: Barrier[]; solids: Solid[];
  covers: Cover[]; bumps: Bump[]; lamps: Prop[];
};

/** A bridge over the motorway (or the river under it): a prop with its span, skew and what it
 * carries (extras.ts buildBridge). */
export type Bridge = Prop & {
  carries: string; rot: number; wid: number; skew: number;
  roadHw: number;   // the motorway's half width under it, m
};

/** Stamps a prop / area with the road distance it is dropped behind with, and returns it. */
export interface Stamp { (obj: Prop): Prop; (obj: Bump): Bump }

/** The player's car as the highway reads it. */
export interface HwCar { x: number; y: number; vx: number; vy: number }

/** The dressing context of one stretch of road (dress.ts makeDressContext). */
export interface DressCtx {
  level: HwLevel; state: HwState; rand: () => number; halfWidth: number; road: HwPoint[];
  firstIdx: number; endIdx: number;
  loose: LevelObj[];   // receives the loose objects (the level's cones on the first stretch)
  pointAt: (i: number, off: number) => HwPose;
  clear: (x: number, y: number, radius: number) => boolean;
}
