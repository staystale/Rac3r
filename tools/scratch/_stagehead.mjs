import fs from 'node:fs';
const p = 'src/stagegen.ts';
let s = fs.readFileSync(p, 'utf8');
const lines = s.split('\n');
let last = -1;
for (let i = 0; i < lines.length; i++) {
  if (!/^import /.test(lines[i])) continue;
  let end = i;
  while (end < lines.length - 1 && !/from ['"][^'"]+['"];?\s*$/.test(lines[end])) end++;
  last = end; i = end;
}
lines.splice(last + 1, 0, `import type { BushPlan, Cone, Prop, Barrier, Subtrack, Level } from './world/types.ts';

/** A stage theme: its name, road and base surfaces, road width, separation, bushes, mix. */
interface ThemeSpec {
  name: string; road: string | null; width: number; base: string; sep: number;
  bushes?: BushPlan;
  w: Record<string, number>;   // weights of the element kinds
}
/** A point of the growing road: where, and its road distance (the run-up is negative). */
interface RoadPt { x: number; y: number; s: number }
/** The growing road: the box limit, the other-road separation, the occupancy grid, its points and
 * its head. */
interface Grow {
  LIM: number; SEP: number; occ: Map<number, RoadPt[]>; points: RoadPt[];
  x: number; y: number; hdg: number; dist: number;
}
/** One part of a road element: a straight (len) or an arc (rad, ang). */
interface Part { len: number; rad: number; ang: number }
/** A trial element: its points and where it leaves the head. */
interface Cand { out: RoadPt[]; x: number; y: number; hdg: number; s: number }
/** A committed element: how many points it laid and the head before it. */
interface Laid { n: number; x: number; y: number; hdg: number; s: number }
/** What the stage dressing shares (genStage). */
interface Dress {
  rand: () => number; kit: ReturnType<typeof trackKit>; sub: Subtrack; theme: string; seed: number;
  width: number; halfWidth: number; FIN: number;   // FIN: the finish distance
  endD: number; runD: number;   // where the stage road ends and the return runs
  props: Prop[]; cones: Cone[]; barriers: Barrier[];
}`);
s = lines.join('\n');
s = s.replace('export const THEMES = {', 'export const THEMES: Record<string, ThemeSpec> = {');
s = s.replace('export const LENGTHS = {', 'export const LENGTHS: Record<string, number> = {');
s = s.replace('const STYLES = {', 'const STYLES: Record<string, Record<string, number>> = {');
fs.writeFileSync(p, s);
console.log('ok');
