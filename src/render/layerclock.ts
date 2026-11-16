// render/layerclock.ts - with ?report=1: each draw layer's CPU time this frame, for the phone
// report (ui/gpustat.ts). The renderer's layer painters are wrapped where they are looked up (the
// renderer context), so the frame's own code is unchanged: a painter's time goes to its bucket.
// What no bucket holds - the cars, the marks, blitting the art buffer, the camera - is the draw's
// time less the buckets' (tools/phonereport.mjs).
import { addLayerMs, isStatOn, statGpuBegin, statGpuEnd } from '../ui/gpustat.ts';
import type { LayerName } from '../ui/gpustat.ts';

// the renderer context's painters, by the bucket each one's time goes to (drawProps: 'props', or
// 'overhead' when it paints the overhead layer - canopies, lamp heads, bush tops)
const BUCKETS: [LayerName, string[]][] = [
  ['ground', ['drawGround', 'drawCrossingGround']],
  ['deck', ['drawRunoff', 'drawKerb', 'drawBumps', 'drawPaint', 'drawArrows']],
  ['still', ['drawFence', 'drawBarriers', 'drawCones', 'drawTape']],
  ['fx', ['drawPuffs', 'drawChips', 'drawOverPuffs']],
  ['rain', ['drawRain']],
  ['night', ['drawNight']],
];

/** A painter: any function. */
type Painter = (...args: unknown[]) => unknown;

/**
 * Wraps one painter of an object so its time goes to a bucket.
 * @param owner the object holding it
 * @param key its name there
 * @param bucket the bucket, or a choice by its arguments
 */
function wrap(owner: Record<string, unknown>, key: string,
  bucket: LayerName | ((args: unknown[]) => LayerName)) {
  const painter = owner[key];
  if (typeof painter !== 'function') return;
  owner[key] = (...args: unknown[]) => {
    const began = performance.now();
    try {
      return (painter as Painter).apply(owner, args);
    } finally {
      addLayerMs(typeof bucket === 'string' ? bucket : bucket(args), began);
    }
  };
}

/**
 * With ?report=1: wraps the renderer's layer painters in their buckets, and the GPU ground's
 * frame in the WebGL timer (nothing without the report).
 * @param ctx the renderer context (its painters, its GPU ground)
 * @returns ctx
 */
export function timeLayers<T extends object>(ctx: T): T {
  if (!isStatOn()) return ctx;
  const owner = ctx as Record<string, unknown>;
  for (const [bucket, keys] of BUCKETS) for (const key of keys) wrap(owner, key, bucket);
  wrap(owner, 'drawProps', (args) => (args[0] ? 'overhead' : 'props'));
  const gpu = owner.gpu as Record<string, unknown>;
  wrap(gpu, 'drawField', 'shade');
  wrap(gpu, 'drawShade', 'shade');
  const begin = gpu.begin as Painter, end = gpu.end as Painter;
  gpu.begin = (...args: unknown[]) => {
    begin.apply(gpu, args);
    statGpuBegin();
  };
  gpu.end = (...args: unknown[]) => {
    statGpuEnd();
    end.apply(gpu, args);
  };
  return ctx;
}
