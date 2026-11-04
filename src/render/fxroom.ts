// render/fxroom.ts - ROOM FOR 20 CARS' EFFECTS (passed 11-04; owner: "smoke dust and other
// things still seem to pop out / vanish sometimes"). MEASURED (tools/scratch/_puffwatch.mjs,
// _fxpools.mjs, Knobhill 60 s): 5 AI never filled the puff pool; 19 AI sat at its 640 and cut 1796
// puffs short (360 on your screen), and filled the 400 crash chips (2730 cut short, 97 by you).
// The pools grow (render/particles.ts: puffs 1600, chips 1200); the puffs are drawn for less, and
// a full chip pool lets go of the chip farthest from the camera - faded out if you can see it.
import { fxRandom } from './shared.ts';
import { airMove, windNow } from './airflow.ts';
import type { Chip, Puff } from './types.ts';
import type { ParticleCtx } from './particles.ts';

// chips a full pool may hold over its size while the ones making room fade, and how
// long that fade is, s (a chip on the screen fades out, never pops)
const CHIP_SPARE = 200, CHIP_OUT_S = 1;

/**
 * Make room in a full chip pool: the chip farthest from the camera (the oldest may lie right by
 * you) - gone at once off the screen, faded out over CHIP_OUT_S on it.
 * @param ctx particle context (the camera, the screen)
 * @param chips the pool, oldest first
 * @param maxChips the pool's size (particles.ts MAX_CHIPS)
 */
export function dropChip(ctx: ParticleCtx, chips: Chip[], maxChips: number): void {
  let far = -1, farAt = -1;
  for (let i = 0; i < chips.length; i++) {
    if (chips[i].out) continue;
    const dist = (chips[i].x - ctx.cam.x) ** 2 + (chips[i].y - ctx.cam.y) ** 2;
    if (dist > far) { far = dist; farAt = i; }
  }
  if (farAt < 0 || chips.length >= maxChips + CHIP_SPARE) { chips.shift(); return; }
  const chip = chips[farAt], chipX = ctx.toScreenX(chip.x), chipY = ctx.toScreenY(chip.y);
  if (chipX < 0 || chipY < 0 || chipX > ctx.view.W || chipY > ctx.view.H) {
    chips.splice(farAt, 1);
    return;
  }
  chip.out = true;
  chip.life = Math.min(chip.life, chip.age + CHIP_OUT_S);
}

/**
 * The puffs, drawn for less - the device transform set once a pass (was a
 * save / setTransform / restore a puff), the colour string set only when it changes, and a puff
 * off the screen moved and aged but not drawn.
 * @param ctx particle context
 * @param wallDt wall-clock frame time
 * @param puffs the pool
 * @param air the wind this frame (airflow.ts windNow)
 */
export function drawPuffsCheap(ctx: ParticleCtx, wallDt: number, puffs: Puff[],
  air: ReturnType<typeof windNow>) {
  const { view, PPMz, toScreenX, toScreenY } = ctx, ppm = PPMz(), dpr = view.dpr;
  const target = view.ctx, wide = view.W * dpr, high = view.H * dpr;
  let style = '';
  target.save(); target.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = puffs.length - 1; i >= 0; i--) {
    const puff = puffs[i];
    puff.age += wallDt;
    if (puff.age >= puff.life) { puffs.splice(i, 1); continue; }
    const fade = puff.age / puff.life;
    puff.x += puff.vx * wallDt; puff.y += puff.vy * wallDt;
    airMove(puff, wallDt, air, ctx.state.airCars, fxRandom);
    const radius = Math.max(1, Math.round((puff.r0 + fade * puff.grow) * ppm * dpr));
    const pixelX = Math.round(toScreenX(puff.x) * dpr);
    const pixelY = Math.round(toScreenY(puff.y) * dpr);
    if (pixelX + radius < 0 || pixelY + radius < 0 || pixelX - radius > wide
      || pixelY - radius > high) continue;
    if (puff.rgb !== style) { style = puff.rgb; target.fillStyle = `rgb(${style})`; }
    target.globalAlpha = Math.ceil((1 - fade) * 4) / 4 * 0.5 * (puff.alpha ?? 1);
    target.fillRect(pixelX - radius, pixelY - radius, radius * 2, radius * 2);
  }
  target.restore();
  target.globalAlpha = 1;
}
