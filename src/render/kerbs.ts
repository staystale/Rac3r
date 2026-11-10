// The CURVED CORNER KERBS of the ground tiles (moved out of road.ts). Drawn AFTER patches, wear
// and covers, so nothing can paint over them: kerbs are their own surface, bumpy and slightly
// slippy like real race kerbs. The physics already treats them that way (SURFACES.kerb, mu 0.70,
// ridges in bumpAt).
// MEASURED (11-10, the Nordschlep: 10.4 km, 1502 teeth): every tile and the overview tested every
// lap sample against every kerb (563,000 tests a tile) and drew every tooth on the lap - 17% of a
// CPU x4 profile, and the 250-290 ms frames as tiles were painted. Now each kerb's teeth are found
// once per subtrack (KerbRun), and a kerb whose box misses the tile is skipped: the same teeth
// drawn in the same order, so the same pixels (renderhash).
import { LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import type { CurvedKerb } from "../world/types.ts";
import type { View } from "./types.ts";

/** what the kerb painter reads: the view and the projection helpers (road.ts RoadCtx) */
interface KerbCtx {
  view: View;
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
}

type Sub = NonNullable<typeof LEVEL.subtrack>;

/** one kerb's teeth: the first sample of each, in lap order, and the world box round them */
interface KerbRun {
  kerb: CurvedKerb;
  teeth: Int32Array;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** the kerbs of one subtrack, with what they were built from (to know when they are stale) */
interface KerbIndex {
  pts: Sub['pts'];
  count: number;
  width: number;
  kerbs: CurvedKerb[];
  /** each kerb's side, start, end and width when built */
  keys: string[];
  runs: KerbRun[];
}

let kerbIndex: KerbIndex | null = null;

/**
 * Draws one tooth of a curved kerb between two track samples: the quad, its outer highlight
 * bevel along the crest and the inner shadow joint along the asphalt edge.
 * @param ctx the kerb context
 * @param sub the subtrack
 * @param kerb the curved kerb (side, width)
 * @param index the index of the tooth's first sample
 */
function drawKerbTooth(ctx: KerbCtx, sub: Sub, kerb: CurvedKerb, index: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const pts = sub.pts, count = pts.length, pxPerM = PPMz(), halfW = sub.width / 2;
  const sgn = kerb.side === 'left' ? 1 : -1;
  const kerbWidth = kerb.width || 2.4;
  const startPt = pts[index];
  const endPt = pts[(index + 1) % count];

  // Red and white kerb teeth alternating every 2.0 m along the corner
  const tooth = Math.floor(startPt.dist / 2.0) % 2;
  view.ctx.fillStyle = tooth ? COL.kerbB : COL.kerbA;

  const iaX = toScreenX(startPt.x + sgn * startPt.nx * halfW), iaY = toScreenY(
      startPt.y + sgn * startPt.ny * halfW);
  const ibX = toScreenX(endPt.x + sgn * endPt.nx * halfW), ibY = toScreenY(
      endPt.y + sgn * endPt.ny * halfW);
  const oaX = toScreenX(startPt.x + sgn * startPt.nx * (halfW + kerbWidth)),
    oaY = toScreenY(
      startPt.y + sgn * startPt.ny * (halfW + kerbWidth));
  const obX = toScreenX(endPt.x + sgn * endPt.nx * (halfW + kerbWidth)), obY = toScreenY(
      endPt.y + sgn * endPt.ny * (halfW + kerbWidth));

  view.ctx.beginPath();
  view.ctx.moveTo(iaX, iaY);
  view.ctx.lineTo(ibX, ibY);
  view.ctx.lineTo(obX, obY);
  view.ctx.lineTo(oaX, oaY);
  view.ctx.closePath();
  view.ctx.fill();

  // Outer highlight bevel along crest
  view.ctx.strokeStyle = 'rgba(255,255,255,0.40)';
  view.ctx.lineWidth = Math.max(1, 0.08 * pxPerM);
  view.ctx.beginPath();
  view.ctx.moveTo(oaX, oaY); view.ctx.lineTo(obX, obY);
  view.ctx.stroke();

  // Inner shadow joint along asphalt edge
  view.ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  view.ctx.lineWidth = Math.max(1, 0.08 * pxPerM);
  view.ctx.beginPath();
  view.ctx.moveTo(iaX, iaY); view.ctx.lineTo(ibX, ibY);
  view.ctx.stroke();
}

/**
 * A kerb's fingerprint: the fields its teeth are drawn from.
 * @param kerb the curved kerb
 * @returns the key
 */
const kerbKey = (kerb: CurvedKerb) => `${kerb.side} ${kerb.startDist} ${kerb.endDist} ${
  kerb.width}`;

/**
 * One kerb's teeth - every sample i the whole-lap test drew (!(dist < start || dist > end)), in
 * the same order - and the world box of their quads (NaN, never skipped, if a point is NaN).
 * @param sub the subtrack
 * @param kerb the curved kerb
 * @returns the run
 */
function kerbRun(sub: Sub, kerb: CurvedKerb): KerbRun {
  const pts = sub.pts, count = pts.length, halfW = sub.width / 2;
  const sgn = kerb.side === 'left' ? 1 : -1, outer = halfW + (kerb.width || 2.4);
  const teeth: number[] = [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < count; i++) {
    const startPt = pts[i];
    if (startPt.dist < kerb.startDist || startPt.dist > kerb.endDist) continue;
    teeth.push(i);
    for (const point of [startPt, pts[(i + 1) % count]]) {
      for (const off of [halfW, outer]) {
        const x = point.x + sgn * point.nx * off, y = point.y + sgn * point.ny * off;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  return { kerb, teeth: Int32Array.from(teeth), left, top, right, bottom };
}

/**
 * The subtrack's kerb runs, built once and rebuilt when the samples or kerbs change.
 * @param sub the subtrack
 * @param kerbs its curved kerbs
 * @returns the runs
 */
function kerbRuns(sub: Sub, kerbs: CurvedKerb[]): KerbRun[] {
  const keys = kerbs.map(kerbKey);
  const fresh = kerbIndex && kerbIndex.pts === sub.pts && kerbIndex.count === sub.pts.length
    && kerbIndex.width === sub.width && kerbIndex.kerbs === kerbs
    && kerbIndex.keys.length === keys.length
    && keys.every((key, idx) => key === kerbIndex!.keys[idx]);
  if (!fresh) {
    kerbIndex = { pts: sub.pts, count: sub.pts.length, width: sub.width, kerbs, keys,
      runs: kerbs.map((kerb) => kerbRun(sub, kerb)) };
  }
  return kerbIndex!.runs;
}

/**
 * Whether a kerb's box misses the canvas (by more than a stroke and the anti-aliasing): its teeth
 * would paint no pixel there.
 * @param ctx the kerb context
 * @param run the kerb run
 * @returns true when it can be skipped
 */
function offCanvas(ctx: KerbCtx, run: KerbRun) {
  const { view, toScreenX, toScreenY } = ctx;
  const margin = Math.max(1, 0.08 * ctx.PPMz()) + 2;
  const xLow = toScreenX(run.left), xHigh = toScreenX(run.right);
  const yLow = toScreenY(run.top), yHigh = toScreenY(run.bottom);
  return Math.max(xLow, xHigh) < -margin || Math.min(xLow, xHigh) > view.W + margin
    || Math.max(yLow, yHigh) < -margin || Math.min(yLow, yHigh) > view.H + margin;
}

/**
 * Draws the curved corner kerbs of the subtrack that reach the canvas (a tile, the overview).
 * The last tooth of the lap is always drawn - off the canvas if its kerb is skipped, so no pixel
 * - to leave the canvas's fill, stroke and path as the whole-lap loop left them.
 * @param ctx the kerb context
 */
export function drawCurvedKerbs(ctx: KerbCtx) {
  if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
  const sub = LEVEL.subtrack;
  if (!sub.curvedKerbs) return;
  const runs = kerbRuns(sub, sub.curvedKerbs);
  let last: KerbRun | null = null, lastDrawn = false;
  for (const run of runs) {
    if (!run.teeth.length) continue;
    last = run;
    lastDrawn = !offCanvas(ctx, run);
    if (!lastDrawn) continue;
    for (const i of run.teeth) drawKerbTooth(ctx, sub, run.kerb, i);
  }
  if (last && !lastDrawn) drawKerbTooth(ctx, sub, last.kerb, last.teeth[last.teeth.length - 1]);
}
