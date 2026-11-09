// render/props/formations.ts - DEAF VALLEY's ROCK FORMATIONS seen from above (world/formations.ts
// their shapes; highway/canyon.ts places them), in the desert's red rock tones, lit from the
// top-left with their long shadows down-right as every other prop's: a BUTTE (its shadow, the
// talus round its foot, the cliff band, the flat caprock top and a stratum), HOODOOS (each spire's
// stepped shadow, its column, its dark cap), an ARCH (drawn over the cars: you can drive under
// it - its legs and the span bowing between them, and the shadow they throw).
import { butteOutline, hoodooSpires, archShape } from '../../world/formations.ts';
import type { Point, Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

const SHADOW = 'rgba(40,20,12,0.34)', TALUS = '#8c5f40', CLIFF = '#6e4a32', TOP = '#b07a54',
  TOP_LIT = '#c39270', STRATUM = '#8c4f33', COLUMN = '#a87652', CAP = '#5e3b28';

/**
 * A screen offset (down-right, the shadows' way) in the prop's own turned frame, m.
 * @param prop the prop (its turn)
 * @param screenM m down and right on the screen
 * @returns the offset in its frame
 */
function shadowShift(prop: Prop, screenM: number): Point {
  const cos = Math.cos(prop.rot || 0), sin = Math.sin(prop.rot || 0);
  return [screenM * (cos + sin), screenM * (cos - sin)];
}

/**
 * Fills a polygon given in metres, scaled about the prop and shifted.
 * @param ctx the canvas (at the prop, turned)
 * @param pts the polygon, m
 * @param ppm pixels per metre
 * @param scale its scale about the prop
 * @param shift its shift, m
 */
function fillShape(ctx: CanvasRenderingContext2D, pts: Point[], ppm: number, scale: number,
    shift: Point = [0, 0]) {
  ctx.beginPath();
  pts.forEach(([x, y], idx) => (idx ? ctx.lineTo : ctx.moveTo).call(ctx,
    (x * scale + shift[0]) * ppm, (y * scale + shift[1]) * ppm));
  ctx.closePath();
  ctx.fill();
}

/**
 * A butte: its long shadow, the talus skirt, the cliff band, the caprock top lit on its
 * top-left, a stratum round it.
 * @param propCtx the view and painter helpers
 * @param prop the butte
 * @param ppm pixels per metre
 */
export function drawButte(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, outline = butteOutline(prop), size = prop.s || 24;
  ctx.fillStyle = SHADOW;
  fillShape(ctx, outline, ppm, 0.95, shadowShift(prop, size * 0.2));
  ctx.fillStyle = TALUS;
  fillShape(ctx, outline, ppm, 1);
  ctx.fillStyle = CLIFF;
  fillShape(ctx, outline, ppm, 0.86);
  ctx.fillStyle = TOP;
  fillShape(ctx, outline, ppm, 0.74);
  ctx.fillStyle = TOP_LIT;
  fillShape(ctx, outline, ppm, 0.58, shadowShift(prop, -size * 0.05));
  ctx.strokeStyle = STRATUM;
  ctx.lineWidth = Math.max(1, 0.5 * ppm);
  ctx.beginPath();
  outline.forEach(([x, y], idx) => (idx ? ctx.lineTo : ctx.moveTo).call(ctx, x * 0.93 * ppm,
    y * 0.93 * ppm));
  ctx.closePath();
  ctx.stroke();
}

/**
 * A cluster of hoodoos: each spire's stepped shadow (tall: four steps), its column lit top-left,
 * its dark cap stone.
 * @param propCtx the view and painter helpers
 * @param prop the cluster
 * @param ppm pixels per metre
 */
export function drawHoodoo(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, spires = hoodooSpires(prop);
  ctx.fillStyle = SHADOW;
  for (const spire of spires) for (let step = 1; step <= 4; step++) {
    const [dx, dy] = shadowShift(prop, spire.d * 0.45 * step);
    ctx.fillRect((spire.x + dx - spire.d / 2) * ppm, (spire.y + dy - spire.d / 2) * ppm,
      spire.d * ppm, spire.d * ppm);
  }
  for (const spire of spires) {
    const [litX, litY] = shadowShift(prop, -spire.d * 0.12);
    ctx.fillStyle = COLUMN;
    ctx.fillRect((spire.x - spire.d / 2) * ppm, (spire.y - spire.d / 2) * ppm, spire.d * ppm,
      spire.d * ppm);
    ctx.fillStyle = CAP;
    ctx.fillRect((spire.x + litX - spire.d * 0.32) * ppm, (spire.y + litY - spire.d * 0.32) * ppm,
      spire.d * 0.64 * ppm, spire.d * 0.64 * ppm);
  }
}

/**
 * An arch (over the cars): the shadow of its span and legs, the legs, the span with its lit edge.
 * @param propCtx the view and painter helpers
 * @param prop the arch
 * @param ppm pixels per metre
 */
export function drawArch(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, { legs, span, width } = archShape(prop),
    size = prop.s || 18, [shX, shY] = shadowShift(prop, size * 0.18);
  const stroke = (pts: Point[], dx: number, dy: number, lineWidth: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, lineWidth * ppm);
    ctx.beginPath();
    pts.forEach(([x, y], idx) => (idx ? ctx.lineTo : ctx.moveTo).call(ctx, (x + dx) * ppm,
      (y + dy) * ppm));
    ctx.stroke();
  };
  ctx.lineCap = 'butt';
  stroke(span, shX, shY, width, SHADOW);
  ctx.fillStyle = SHADOW;
  for (const [x, y, wid, len] of legs)
    ctx.fillRect((x + shX - wid / 2) * ppm, (y + shY - len / 2) * ppm, wid * ppm, len * ppm);
  for (const [x, y, wid, len] of legs) {
    ctx.fillStyle = CLIFF;
    ctx.fillRect((x - wid / 2) * ppm, (y - len / 2) * ppm, wid * ppm, len * ppm);
    ctx.fillStyle = TALUS;
    ctx.fillRect((x - wid / 2) * ppm, (y - len / 2) * ppm, wid * 0.6 * ppm, len * 0.6 * ppm);
  }
  stroke(span, 0, 0, width, COLUMN);
  const [litX, litY] = shadowShift(prop, -width * 0.25);
  stroke(span, litX, litY, width * 0.4, TOP_LIT);
}
