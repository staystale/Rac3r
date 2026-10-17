// FALLING RAIN AND SNOW (weather): pixel streaks falling across the view with small splashes on
// the ground, or slow drifting snowflakes, drawn in the art buffer over the cars (screen.ts), as
// many as it is raining / snowing hard (weather.ts). Every new look costs Safari frames (NOTES.md),
// so each is ONE path a frame from a fixed pool (no allocation), and nothing at all when it is dry.
// Its own random numbers, so drawing never moves the simulation's Math.random sequence.

import { lcg } from "../core/random.ts";

// drops at a downpour (rain 1) on a phone-sized art buffer; scaled by the buffer's area
const DROPS_MAX = 140;
const SPLASHES_MAX = 36;
// a phone art buffer's area (art px), the size the pools are set for
const AREA_REF = 330 * 360;
// screen heights a drop falls per second, and its streak length (art px) - fast, short streaks read
// as rain falling toward a top-down camera, and slant a little with the wind
const FALL_PER_S = 1.6, STREAK_PX = 5, SLANT = 0.35;
// s a splash shows; art px across
const SPLASH_S = 0.16, SPLASH_PX = 1;
const DROP_COLOUR = 'rgba(205,218,238,0.42)';
const SPLASH_COLOUR = 'rgba(215,226,242,0.5)';
// SNOW: flakes at a blizzard (snow 1), screen heights a second they fall (slow, drifting side to
// side), how far they drift (fraction of the view) and how fast they sway (rad/s)
const FLAKES_MAX = 120, FLAKE_FALL_PER_S = 0.22, FLAKE_DRIFT = 0.012, FLAKE_SWAY = 2.4;
const FLAKE_COLOUR = 'rgba(248,250,255,0.85)';

/** The fixed pools: x, y as fractions of the view, and one more number each. */
interface Pools {
  random: () => number;
  drops: Float32Array;      // + speed factor
  splashes: Float32Array;   // + age, s
  flakes: Float32Array;     // + sway phase, rad
}

/** One frame's drawing: the art buffer (identity transform), its size and the step. */
interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  step: number;
}

/**
 * Moves and draws the rain streaks: one stroked path.
 * @param pools the pools
 * @param frame this frame's drawing
 * @param count how many drops
 */
function drawDrops(pools: Pools, frame: Frame, count: number) {
  const { drops, random } = pools, { ctx, width, height, step } = frame;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const slot = i * 3;
    drops[slot + 1] += FALL_PER_S * drops[slot + 2] * step;
    drops[slot] -= FALL_PER_S * SLANT * drops[slot + 2] * step * (height / width);
    if (drops[slot + 1] > 1 || drops[slot] < 0) {
      drops[slot] = random() * 1.2;
      drops[slot + 1] = -random() * 0.1;
    }
    const x = Math.round(drops[slot] * width), y = Math.round(drops[slot + 1] * height);
    ctx.moveTo(x + 0.5, y);
    ctx.lineTo(x + 0.5 - STREAK_PX * SLANT, y + STREAK_PX);
  }
  ctx.strokeStyle = DROP_COLOUR;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Ages and draws the splashes, each a small plus that opens out: one filled path.
 * @param pools the pools
 * @param frame this frame's drawing
 * @param count how many splashes
 */
function drawSplashes(pools: Pools, frame: Frame, count: number) {
  const { splashes, random } = pools, { ctx, width, height, step } = frame;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const slot = i * 3;
    splashes[slot + 2] += step;
    if (splashes[slot + 2] >= SPLASH_S) {
      splashes[slot] = random();
      splashes[slot + 1] = random();
      splashes[slot + 2] -= SPLASH_S;
    }
    const x = Math.round(splashes[slot] * width), y = Math.round(splashes[slot + 1] * height);
    const reach = SPLASH_PX + (splashes[slot + 2] > SPLASH_S / 2 ? 1 : 0);
    ctx.rect(x - reach, y, 1, 1);
    ctx.rect(x + reach, y, 1, 1);
    ctx.rect(x, y - reach, 1, 1);
    ctx.rect(x, y + reach, 1, 1);
  }
  ctx.fillStyle = SPLASH_COLOUR;
  ctx.fill();
}

/**
 * Moves and draws the snowflakes, 1 or 2 art px squares drifting down: one filled path.
 * @param pools the pools
 * @param frame this frame's drawing
 * @param count how many flakes
 */
function drawSnow(pools: Pools, frame: Frame, count: number) {
  const { flakes, random } = pools, { ctx, width, height, step } = frame;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const slot = i * 3;
    flakes[slot + 2] += FLAKE_SWAY * step;
    flakes[slot + 1] += FLAKE_FALL_PER_S * step;
    if (flakes[slot + 1] > 1) {
      flakes[slot] = random();
      flakes[slot + 1] = -0.02;
    }
    const x = Math.round((flakes[slot] + FLAKE_DRIFT * Math.sin(flakes[slot + 2])) * width);
    const size = i % 3 === 0 ? 2 : 1;
    ctx.rect(x, Math.round(flakes[slot + 1] * height), size, size);
  }
  ctx.fillStyle = FLAKE_COLOUR;
  ctx.fill();
}

/** How many of a pool to draw: its size by how hard it falls and the view's area, capped. */
const poolShare = (most: number, amount: number, scale: number) =>
  Math.min(most, Math.round(most * amount * scale));

/** The pools, filled once. */
function makePools(): Pools {
  const random = lcg(0x5eed);
  const fill = (count: number, third: () => number) => {
    const pool = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pool[i * 3] = random();
      pool[i * 3 + 1] = random();
      pool[i * 3 + 2] = third();
    }
    return pool;
  };
  return {
    random,
    drops: fill(DROPS_MAX, () => 0.8 + 0.4 * random()),
    splashes: fill(SPLASHES_MAX, () => random() * SPLASH_S),
    flakes: fill(FLAKES_MAX, () => random() * Math.PI * 2),
  };
}

/**
 * Creates the rain and snow drawer.
 * @returns draw(ctx, width, height, wallDt, rain, snow)
 */
export function createRain() {
  const pools = makePools();
  // reused every frame (no allocation in the frame)
  const frame: Frame = { ctx: null as unknown as CanvasRenderingContext2D, width: 0, height: 0,
    step: 0 };
  /**
   * Moves and draws the rain and snow into the art buffer.
   * @param ctx the art buffer's context
   * @param width the art buffer's width, art px
   * @param height the art buffer's height, art px
   * @param wallDt the wall-clock step, s
   * @param rain how hard it rains, 0..1
   * @param snow how hard it snows, 0..1
   */
  function draw(ctx: CanvasRenderingContext2D, width: number, height: number, wallDt: number,
      rain: number, snow = 0) {
    if ((rain <= 0 && snow <= 0) || !width || !height) return;
    const scale = Math.min(1.6, (width * height) / AREA_REF);
    frame.ctx = ctx;
    frame.width = width;
    frame.height = height;
    frame.step = Math.min(0.1, wallDt);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (snow > 0) drawSnow(pools, frame, poolShare(FLAKES_MAX, snow, scale));
    if (rain > 0) {
      drawDrops(pools, frame, poolShare(DROPS_MAX, rain, scale));
      drawSplashes(pools, frame, poolShare(SPLASHES_MAX, rain, scale));
    }
    ctx.restore();
  }
  return { draw };
}
