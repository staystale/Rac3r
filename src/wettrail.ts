// wettrail.ts - WET TRAILS (owner: "tyre marks
// in the wet need to vanish quite quickly 10-50 m"). On a wet road a tyre lays no rubber: it
// squeezes the water aside and leaves a lighter line the water closes over again (MARK_WET).
// Those lines went into the skid-mark layer (marks.js), which fades everything ~46 s to half:
// about 2 km of trail at race speed. Now a wet wheel keeps a short trail of points instead - one
// each TRAIL_STEP m, dropped after TRAIL_S s or past TRAIL_M m of trail (~10 m at 36 km/h, 50 m
// at 180 km/h) - drawn each frame where the marks are drawn, fading with age: one stroke per fade
// band and line width, no new layer and no whole-canvas fade.
import { MARK_WET } from "./world/surfaces.ts";

// m between trail points; how long (s) and how far (m) a trail lasts; a longer pause than
// TRAIL_GAP_S (s) between points breaks the line (the wheel left the wet)
const TRAIL_STEP = 1, TRAIL_S = 1, TRAIL_M = 50, TRAIL_GAP_S = 0.25;
// the newest part's alpha, fading to 0 over BANDS steps
const TRAIL_ALPHA = 0.3, BANDS = 4;

/** One wheel's trail: its line width (m) and points as x, y, sim time triples (x NaN = a break). */
interface Trail { width: number; pts: number[] }

const trails = new Map<string, Trail>();
let clock = 0;

/**
 * A wet wheel's position this physics step (marks.js stampWheel): a new point once it has moved
 * TRAIL_STEP m.
 * @param key the wheel's key (per car)
 * @param x world x, m
 * @param y world y, m
 * @param width the line's width, m
 */
export function addTrailPoint(key: string, x: number, y: number, width: number): void {
  let trail = trails.get(key);
  if (!trail) trails.set(key, (trail = { width, pts: [] }));
  const pts = trail.pts, count = pts.length;
  if (count) {
    const lastT = pts[count - 1];
    if (clock - lastT > TRAIL_GAP_S) pts.push(NaN, NaN, lastT);
    else if (Math.hypot(x - pts[count - 3], y - pts[count - 2]) < TRAIL_STEP) return;
  }
  pts.push(x, y, clock);
}

/**
 * Ages the trails by one physics step: points older than TRAIL_S or past TRAIL_M m go.
 * @param dt sim seconds
 */
export function stepWetTrails(dt: number): void {
  clock += dt;
  for (const [key, trail] of trails) {
    const pts = trail.pts;
    let keepFrom = pts.length, run = 0;
    for (let i = pts.length - 3; i >= 0; i -= 3) {
      if (clock - pts[i + 2] > TRAIL_S) break;
      // pts[i + 3] is NaN across a break: that piece adds nothing
      if (i + 3 < pts.length) run += Math.hypot(pts[i + 3] - pts[i], pts[i + 4] - pts[i + 1]) || 0;
      if (run > TRAIL_M) break;
      keepFrom = i;
    }
    if (keepFrom >= pts.length) trails.delete(key);
    else if (keepFrom) pts.splice(0, keepFrom);
  }
}

/** Forgets every trail (a restart, a new level: marks.js clear). */
export function clearWetTrails(): void { trails.clear(); }

/**
 * Draws the trails, oldest band first, one stroke per band and line width.
 * @param target the canvas context the marks are drawn on
 * @param toScreenX world x to screen
 * @param toScreenY world y to screen
 * @param ppm screen px per metre
 */
export function drawWetTrails(target: CanvasRenderingContext2D, toScreenX: (x: number) => number,
    toScreenY: (y: number) => number, ppm: number): void {
  if (!trails.size) return;
  const byWidth = new Map<number, Trail[]>();
  for (const trail of trails.values()) {
    const widthPx = Math.max(1, Math.round(trail.width * ppm));
    const group = byWidth.get(widthPx);
    if (group) group.push(trail);
    else byWidth.set(widthPx, [trail]);
  }
  target.save();
  target.lineCap = 'round';
  for (let band = BANDS - 1; band >= 0; band--) {
    target.strokeStyle = `rgba(${MARK_WET.rgb},${(TRAIL_ALPHA * (1 - band / BANDS)).toFixed(3)})`;
    for (const [widthPx, group] of byWidth) {
      target.lineWidth = widthPx;
      target.beginPath();
      for (const trail of group) traceBand(target, trail.pts, band, toScreenX, toScreenY);
      target.stroke();
    }
  }
  target.restore();
}

/**
 * Adds a trail's pieces in one fade band to the path (a piece's band by its newer end's age).
 * @param target the canvas context
 * @param pts the trail's points
 * @param band the fade band, 0 newest
 * @param toScreenX world x to screen
 * @param toScreenY world y to screen
 */
function traceBand(target: CanvasRenderingContext2D, pts: number[], band: number,
    toScreenX: (x: number) => number, toScreenY: (y: number) => number): void {
  for (let i = 3; i < pts.length; i += 3) {
    if (!Number.isFinite(pts[i]) || !Number.isFinite(pts[i - 3])) continue;
    const age = clock - pts[i + 2];
    if (Math.min(BANDS - 1, Math.floor((age / TRAIL_S) * BANDS)) !== band) continue;
    target.moveTo(toScreenX(pts[i - 3]), toScreenY(pts[i - 2]));
    target.lineTo(toScreenX(pts[i]), toScreenY(pts[i + 1]));
  }
}
