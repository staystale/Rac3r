// cones/coneTypes.ts: the shapes the loose-object simulation shares - a live loose object, a tape
// section, a car as the objects see it, and the one cones context (cones.ts createCones).
import type { Cone } from '../world/types.ts';

/** A live loose object: a cone, tyre, stack, bale, animal, debris, tape post ... */
export interface Loose {
  kind: string;
  // how it moves: 'cone' (topples), 'stack', 'roll', 'flip', 'wobble', 'flat', or its kind
  mode: string;
  x: number; y: number; vx: number; vy: number;
  hx?: number; hy?: number;   // its home spot (where the level put it)
  ang: number; spin: number;
  down: number;   // 0 upright .. 1 knocked flat
  moved: boolean;   // knocked (the tally)
  mass: number; r: number;
  col?: string; tape?: string | number; idx?: number; field?: number;   // the level's tags
  paint?: string; num?: string;
  hitCount: number;
  rollDist: number; flipPhase: number; flipSpeed: number; wobblePhase: number; wobbleAmp: number;
  _s?: number;   // the road distance it belongs to (streamed levels drop it with that stretch)
  _n?: number;   // a fixed creation index (hits are taken in list order)
  _ck?: number;   // the rest-grid cell it is filed in
  _i?: number;   // its list index this step (a mover)
  over?: boolean; overTried?: boolean;   // hopping a wall
  impacts?: number; _lastHit?: number;   // distinct hits (chevrons, flags, breaking debris)
  tipped?: boolean;   // a cow on its side
  flat?: boolean;   // flattened: driven over
  _nailT?: number;   // the last time its nails had a go at a tyre
  part?: boolean; trim?: string; fade?: number;   // a crashed car's part (world/debris.ts)
}

/** A loose object as the level gives it (world/types.ts Cone, maybe streamed or in a field). */
export type LevelObj = Cone & { field?: number; _s?: number };

/** A stretch of rally tape between two consecutive posts. */
export interface TapeSection {
  a: Loose; b: Loose; rest: number;   // its posts and their rest distance
  broken: boolean; gone?: boolean;
  hits?: number; at?: number;   // hits taken; the time of the last
}

/** A snapped tape section trailing from a car (render.ts draws it). */
import type { Streamer } from '../vehicle.ts';
export type { Streamer };

/** A hit the renderer turns into dust (render/particles.ts). */
export interface ConeHit { x: number; y: number; speed: number; kind?: string }

/** A car as the loose objects see it. */
export interface ConeCar {
  x: number; y: number; vx: number; vy: number; heading: number; yawRate: number;
  spec: { len: number; wid: number; mass: number; lf: number; lr: number; trackWidth?: number };
  streamers?: Streamer[] | null;   // (null: reset)
  burstTyre?: number; burstSlow?: boolean;   // damage.ts applyBurst: a tyre to burst, slowly
  wheelOff?: boolean[];
  _hitKind?: string | null;   // the sharpest thing hit this step (physics/punctures.ts)
}

/** The one cones context every step shares (cones.ts createCones). */
export interface ConesCtx {
  list: Loose[];
  clock: number;   // sim time (distinct-impact counting)
  sections: TapeSection[];
  puffs: { x: number; y: number; vx: number; vy: number }[];   // tape gone in a puff (render)
  nextN: number;
  objectHits: boolean;   // false: harness baselines only
  hits: ConeHit[];   // drained by render.ts each frame for dust
  restGrid: Map<number, Loose[]>;   // cell key -> objects at rest in it
  movers: Loose[]; prevMovers: Loose[];
  burst: Loose[];   // reused every step
}
