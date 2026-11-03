// world/stagetypes.ts: the shapes the rally stage generator (stagegen.ts) shares - a theme, the
// growing road and its elements, and the dressing context.
import type { BushPlan, Cone, Prop, Barrier, Subtrack } from './types.ts';
import type { trackKit } from './levels/kit.ts';

/** A stage theme: its name, road and base surfaces, road width, separation, bushes, mix. */
export interface ThemeSpec {
  name: string; road: string | null; width: number; base: string; sep: number;
  bushes?: BushPlan;
  w: Record<string, number>;   // weights of the element kinds
}
/** A point of the growing road: where, and its road distance (the run-up is negative). */
export interface RoadPt { x: number; y: number; s: number }
/** The growing road: the box limit, the other-road separation, the occupancy grid, its points and
 * its head. */
export interface Grow {
  LIM: number; SEP: number; occ: Map<number, RoadPt[]>; points: RoadPt[];
  x: number; y: number; hdg: number; dist: number;
}
/** One part of a road element: a straight (len) or an arc (rad, ang). */
export interface Part { len?: number; rad: number; ang?: number }
/** A trial element: its points and where it leaves the head. */
export interface Cand { out: RoadPt[]; x: number; y: number; hdg: number; s: number }
/** A committed element: how many points it laid and the head before it. */
export interface Laid { n: number; x: number; y: number; hdg: number; s: number }
/** What the stage dressing shares (genStage). */
export interface Dress {
  rand: () => number; kit: ReturnType<typeof trackKit>; sub: Subtrack; theme: string; seed: number;
  width: number; halfWidth: number; FIN: number;   // FIN: the finish distance
  endD: number; runD: number;   // where the stage road ends and the return runs
  props: Prop[]; cones: Cone[]; barriers: Barrier[];
}
