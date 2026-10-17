// FALLING RAIN (weather): pixel streaks falling across the view and small splashes on the ground,
// drawn in the art buffer over the cars (screen.ts), as many as it is raining hard (weather.ts
// rain). Every new look costs Safari frames (NOTES.md), so this is kept to ONE stroked path and ONE
// filled path a frame, from a fixed pool (no allocation), and nothing at all when it is dry. Its
// own random numbers, so drawing never moves the simulation's Math.random sequence.

// drops at a downpour (rain 1) on a phone-sized art buffer; scaled by the buffer's area
const DROPS_MAX = 140;
const SPLASHES_MAX = 36;
// a phone art buffer's area (art px), the size DROPS_MAX is set for
const AREA_REF = 330 * 360;
// screen heights a drop falls per second, and its streak length (art px) - fast, short streaks read
// as rain falling toward a top-down camera, and slant a little with the wind
const FALL_PER_S = 1.6, STREAK_PX = 5, SLANT = 0.35;
// s a splash shows; art px across
const SPLASH_S = 0.16, SPLASH_PX = 1;
const DROP_COLOUR = 'rgba(205,218,238,0.42)';
const SPLASH_COLOUR = 'rgba(215,226,242,0.5)';

/** A tiny deterministic random stream (xorshift32), 0..1. */
function makeRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * Creates the rain drawer.
 * @returns draw(ctx, width, height, wallDt, rain)
 */
export function createRain() {
  const random = makeRandom(0x5eed);
  // x, y as fractions of the view, and a speed factor
  const drops = new Float32Array(DROPS_MAX * 3);
  // x, y as fractions of the view, and the age, s
  const splashes = new Float32Array(SPLASHES_MAX * 3);
  for (let i = 0; i < DROPS_MAX; i++) {
    drops[i * 3] = random();
    drops[i * 3 + 1] = random();
    drops[i * 3 + 2] = 0.8 + 0.4 * random();
  }
  for (let i = 0; i < SPLASHES_MAX; i++) splashes[i * 3 + 2] = random() * SPLASH_S;

  /**
   * Moves and draws the rain into the art buffer.
   * @param ctx the art buffer's context
   * @param width the art buffer's width, art px
   * @param height the art buffer's height, art px
   * @param wallDt the wall-clock step, s
   * @param rain how hard it rains, 0..1
   */
  function draw(ctx: CanvasRenderingContext2D, width: number, height: number, wallDt: number,
      rain: number) {
    if (rain <= 0 || !width || !height) return;
    const scale = Math.min(1.6, (width * height) / AREA_REF);
    const dropCount = Math.min(DROPS_MAX, Math.round(DROPS_MAX * rain * scale));
    const splashCount = Math.min(SPLASHES_MAX, Math.round(SPLASHES_MAX * rain * scale));
    const step = Math.min(0.1, wallDt);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    for (let i = 0; i < dropCount; i++) {
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
    ctx.beginPath();
    for (let i = 0; i < splashCount; i++) {
      const slot = i * 3;
      splashes[slot + 2] += step;
      if (splashes[slot + 2] >= SPLASH_S) {
        splashes[slot] = random();
        splashes[slot + 1] = random();
        splashes[slot + 2] -= SPLASH_S;
      }
      // a small plus that opens out as it ages
      const x = Math.round(splashes[slot] * width), y = Math.round(splashes[slot + 1] * height);
      const reach = SPLASH_PX + (splashes[slot + 2] > SPLASH_S / 2 ? 1 : 0);
      ctx.rect(x - reach, y, 1, 1);
      ctx.rect(x + reach, y, 1, 1);
      ctx.rect(x, y - reach, 1, 1);
      ctx.rect(x, y + reach, 1, 1);
    }
    ctx.fillStyle = SPLASH_COLOUR;
    ctx.fill();
    ctx.restore();
  }
  return { draw };
}
