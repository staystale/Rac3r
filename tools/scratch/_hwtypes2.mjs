import fs from 'node:fs';
function sub(path, a, b) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  fs.writeFileSync(path, s.replace(a, b));
}
const T = 'src/highway/hwtypes.ts';
sub(T, "import type { Level } from '../world/types.ts';",
  "import type { Level, Point, Prop, Lane, Zone, Barrier, Solid, Cover, Bump } from '../world/types.ts';");
sub(T, `  sideOff?: number;   // the secret side road runs this far off it here
}`, `  sideOff?: number;   // the secret side road runs this far off it here
  gapL?: number;   // 1 where the side road opens the left verge (the guard lets you through)
}`);
sub(T, `export interface HwCut {
  pts: { x: number; y: number }[]; w: number; s: number;
  skip: [number, number];   // the road distances it skips
  after?: number; _s?: number;
}`, `export interface HwCut {
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
}`);
sub(T, `  covers: unknown[]; coversDirty: boolean;   // the rivers' water (synced into level.covers)
  side: unknown;   // the secret side road being built
  [field: string]: unknown;
}`, `  covers: Cover[]; coversDirty: boolean;   // the rivers' water (synced into level.covers)
  side: SideRoad | null;   // the secret side road being built
  nextSlip?: number; nextBridge?: number;   // the road distance of the next slip / bridge
  gantryDue?: boolean; villageNext?: number;
  looseCut?: number | null; looseNew?: unknown[];   // the loose objects dropped / added
  tookExit?: boolean;   // the player left by a slip
  inV?: number; camS?: number; outPrev?: number | null;   // the guard's and the camera's memory
}`);
sub(T, `export type HwLevel = Level & { _hw: HwState; _cfg: HwCfg; seed: number };`,
  `export type HwLevel = Level & {
  _hw: HwState; _cfg: HwCfg; seed: number;
  // the parts the road streams, always there on a highway level
  props: Prop[]; lanes: Lane[]; zones: Zone[]; barriers: Barrier[]; solids: Solid[];
  covers: Cover[]; bumps: Bump[];
};`);
const W = 'src/world/types.ts';
sub(W, `  out?: number;   // gravel traps only (see Trap)
  _segs?:`, `  out?: number;   // gravel traps only (see Trap)
  _s?: number;   // highway.ts: the road distance it is dropped behind with
  _segs?:`);
console.log('ok');
