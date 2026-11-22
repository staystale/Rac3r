// render/lamppools.ts - THE LAMPS' POOLS in the night layer (render/light.ts): the pool of light
// below each lit lamp's head (world/lamps.ts), rubbed out of the dark, and its warm tint.
import { activeLamps, lampsLit } from '../world/lamps.ts';

// a lamp pool's warm tint: its colour, 'r,g,b', its strength in the middle and its radius as a
// share of the pool's (a floodlight's 34 m pool is tinted out to ~18 m)
const POOL_TINT_RGB = '255,246,214', POOL_TINT_ALPHA = 0.16, POOL_TINT_SHARE = 0.53;

/**
 * A round pool of light, full in the middle, fading to its rim.
 * @param pictureCtx the picture's context
 */
export function paintPool(pictureCtx: CanvasRenderingContext2D) {
  const side = pictureCtx.canvas.width, mid = side / 2;
  const glow = pictureCtx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.fillRect(0, 0, side, side);
}

/**
 * A pool's warm tint, full in the middle, fading to its rim.
 * @param pictureCtx the picture's context
 */
export function paintPoolTint(pictureCtx: CanvasRenderingContext2D) {
  const side = pictureCtx.canvas.width, mid = side / 2;
  const glow = pictureCtx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, 'rgba(' + POOL_TINT_RGB + ',1)');
  glow.addColorStop(0.5, 'rgba(' + POOL_TINT_RGB + ',0.5)');
  glow.addColorStop(1, 'rgba(' + POOL_TINT_RGB + ',0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.fillRect(0, 0, side, side);
}

/** What the pools are painted with: the light map, the pool pictures and the art-px mapping. */
export interface PoolPainter {
  lightCtx: CanvasRenderingContext2D;
  pool: HTMLCanvasElement;
  tint: HTMLCanvasElement;
  artX: (worldX: number) => number;
  artY: (worldY: number) => number;
  artPerMetre: () => number;
  isNear: (x: number, y: number, reach: number) => boolean;
}

/**
 * Rubs one pool of light out of the dark when it reaches the light map.
 * @param painter the light map and the mapping
 * @param x the pool's centre, art px
 * @param y the pool's centre, art px
 * @param size its diameter, art px
 */
export function drawPool(painter: PoolPainter, picture: HTMLCanvasElement, x: number, y: number,
    size: number) {
  if (!painter.isNear(x, y, size / 2)) return;
  painter.lightCtx.drawImage(picture, x - size / 2, y - size / 2, size, size);
}

/**
 * The pools of light below each lit lamp (world/lamps.ts; the light is where its head is): in
 * the rub-out blend the pool lights the dark; in source-over its warm tint colours it.
 * @param painter the light map and the mapping
 * @param isTint true for the warm tint (source-over), false for the rub-out
 */
export function drawPools(painter: PoolPainter, isTint: boolean) {
  const { lightCtx, artX, artY, artPerMetre } = painter;
  if (!lampsLit()) return;
  const picture = isTint ? painter.tint : painter.pool;
  const share = isTint ? POOL_TINT_SHARE : 1;
  for (const lamp of activeLamps()) {
    if (lamp.shown <= 0) continue;
    lightCtx.globalAlpha = lamp.shown * (isTint ? POOL_TINT_ALPHA : 1);
    // a twin-arm street light's two heads (no list made a lamp)
    const size = 2 * lamp.poolM * share * artPerMetre();
    drawPool(painter, picture, artX(lamp.headX), artY(lamp.headY), size);
    if (lamp.twin) drawPool(painter, picture, artX(lamp.twinX), artY(lamp.twinY), size);
  }
  lightCtx.globalAlpha = 1;
}
