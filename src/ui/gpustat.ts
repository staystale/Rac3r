// ui/gpustat.ts - THE FRAME-DROP HUNT'S EXTRA REPORT (?gpustat=1 with ?report=1; report only:
// nothing drawn changes). The phone drops frames while our JS is short (sim ~4 + draw ~3 ms), so
// what eats the frame is outside what the report measured. Each frame now also carries:
// - the GPU ground's own time (WebGL EXT_disjoint_timer_query_webgl2, where the browser has it:
//   the result of a frame a few frames back, -1 none yet / no timer, -2 a disjoint result);
// - once every FENCE_EVERY frames, two FENCES timed at the end of our work: gl.finish() +
//   readPixels (how long the GPU still needed for the ground) and the screen canvas copied into a
//   1-pixel probe (how long the 2D canvas's queued drawing took to paint), each taken again at once
//   (its own cost with nothing queued) - they make that frame wait, so the frame they are in and
//   the next are perturbed (tools/phonereport.mjs knows);
// - how late our animation-frame callback began after the frame's own timestamp, and how long all
//   our work took (sim, draw, HUD): the gap between frames left over is the browser's own;
// - each draw layer's time (render/layerclock.ts; the cars and the art buffer's blits, render/
//   screen.ts) and the HUD's, and the props drawn / walked.
// Each post also carries the device's hints: the timer's name or none, visibility / focus changes,
// the battery, the CPU pressure (Compute Pressure, where there is one), long tasks, the GPU's name.
import { FIX } from '../core/fixes.ts';

/** The extra numbers each report frame carries (their order: tools/phonereport.mjs reads them). */
export const STAT_FIELDS = ['gpuMs', 'glFenceMs', 'glIdleMs', 'canvasFenceMs', 'canvasIdleMs',
  'rafLateMs', 'workMs',
  'ground', 'shade', 'deck', 'still', 'props', 'overhead', 'fx', 'rain', 'night', 'blit', 'cars',
  'hud',
  'propsDrawn', 'treesDrawn', 'propsWalked'] as const;
/** A layer bucket's name (render/layerclock.ts sorts each draw into one). */
export type LayerName = (typeof STAT_FIELDS)[number];
// where the layer buckets start in STAT_FIELDS, and how many there are (ground .. hud)
const LAYER_FIRST = STAT_FIELDS.indexOf('ground'), LAYER_COUNT = STAT_FIELDS.indexOf('hud')
  - LAYER_FIRST + 1;
// frames between two fences (one a second at 60 fps: they make their frame wait)
const FENCE_EVERY = 60;
// timer queries waiting for their result, at most (the GPU answers a few frames late)
const MAX_PENDING = 6;

/** The WebGL timer extension's parts used here. */
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

// this frame's layer ms (by bucket) and counts; the frame's start (performance.now) and lateness
const layerMs = new Float64Array(LAYER_COUNT);
const counts = { drawn: 0, trees: 0, walked: 0 };
const frame = { start: 0, late: 0, no: 0 };
// the timer: the extension (null: none, undefined: not looked for yet), the query running, the
// queries waiting, the last result (ms)
const timer: { ext?: TimerExt | null; running: WebGLQuery | null; pending: WebGLQuery[];
  lastMs: number } = { running: null, pending: [], lastMs: -1 };
// the device's hints, gathered as they come
const hints: { events: [number, string][]; longTasks: number; longMs: number;
  pressure: string | null; battery: { level: number; charging: boolean } | null;
  gpuName: string | null } = { events: [], longTasks: 0, longMs: 0, pressure: null,
  battery: null, gpuName: null };
// the 1-pixel canvas the screen is copied into (the 2D fence) and the pixel read back (GL fence)
let probe: CanvasRenderingContext2D | null = null;
const PIXEL = new Uint8Array(4);
// the GPU ground's context (its canvas, render/glground.ts, asked again: the same context)
let glContext: WebGL2RenderingContext | null | undefined;

/**
 * The GPU ground's WebGL context, found once.
 * @returns it, or null
 */
function webglOf(): WebGL2RenderingContext | null {
  if (glContext === undefined) {
    const canvas = document.getElementById('glground') as HTMLCanvasElement | null;
    glContext = canvas ? canvas.getContext('webgl2') : null;
  }
  return glContext;
}

/**
 * Whether the extra report is on.
 * @returns on
 */
export const isStatOn = () => FIX.gpustat;

/**
 * The time now when the extra report is on (0 when off: no clock read).
 * @returns ms (performance.now)
 */
export const statNow = () => (FIX.gpustat ? performance.now() : 0);

/**
 * A frame begins (the animation-frame callback): its start and how late it began.
 * @param rafNow the frame's own timestamp, ms
 */
export function statFrameStart(rafNow: number) {
  if (!FIX.gpustat) return;
  frame.start = performance.now();
  frame.late = frame.start - rafNow;
  frame.no++;
  layerMs.fill(0);
  counts.drawn = counts.trees = counts.walked = 0;
}

/**
 * Adds time to a layer's bucket.
 * @param name the bucket
 * @param since performance.now when the layer began
 */
export function addLayerMs(name: LayerName, since: number) {
  if (!FIX.gpustat) return;
  layerMs[STAT_FIELDS.indexOf(name) - LAYER_FIRST] += performance.now() - since;
}

/**
 * A prop drawn this frame (render/props.ts).
 * @param isTree it is a tree
 */
export function notePropDrawn(isTree: boolean) {
  if (!FIX.gpustat) return;
  counts.drawn++;
  if (isTree) counts.trees++;
}

/**
 * The props looked at this frame to draw (the endless road walks its whole list).
 * @param walked how many
 */
export function notePropsWalked(walked: number) {
  if (FIX.gpustat) counts.walked += walked;
}

/** The GPU ground's frame begins: a timer query starts (where the browser has the timer). */
export function statGpuBegin() {
  const webgl = webglOf();
  if (!FIX.gpustat || !webgl) return;
  if (timer.ext === undefined) {
    timer.ext = webgl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    const info = webgl.getExtension('WEBGL_debug_renderer_info');
    hints.gpuName = info ? String(webgl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
  }
  if (!timer.ext || timer.running || timer.pending.length >= MAX_PENDING) return;
  timer.running = webgl.createQuery();
  if (timer.running) webgl.beginQuery(timer.ext.TIME_ELAPSED_EXT, timer.running);
}

/** The GPU ground's frame ends: its timer query ends; the results come in (oldest first). */
export function statGpuEnd() {
  const webgl = webglOf();
  if (!FIX.gpustat || !timer.ext || !webgl) return;
  if (timer.running) {
    webgl.endQuery(timer.ext.TIME_ELAPSED_EXT);
    timer.pending.push(timer.running);
    timer.running = null;
  }
  while (timer.pending.length
    && webgl.getQueryParameter(timer.pending[0], webgl.QUERY_RESULT_AVAILABLE)) {
    const query = timer.pending.shift()!;
    const isDisjoint = webgl.getParameter(timer.ext.GPU_DISJOINT_EXT);
    timer.lastMs = isDisjoint ? -2 : webgl.getQueryParameter(query, webgl.QUERY_RESULT) / 1e6;
    webgl.deleteQuery(query);
  }
}

/**
 * ms the GPU ground's queue takes to finish (gl.finish + a pixel read back), -1 with no context.
 * @param webgl the GPU ground's context, or null
 * @returns ms
 */
function glFence(webgl: WebGL2RenderingContext | null) {
  if (!webgl) return -1;
  const began = performance.now();
  webgl.finish();
  webgl.readPixels(0, 0, 1, 1, webgl.RGBA, webgl.UNSIGNED_BYTE, PIXEL);
  return performance.now() - began;
}

/**
 * ms the screen canvas's queued drawing takes to paint (a pixel of it copied into the probe and
 * read back).
 * @param screen the screen canvas
 * @returns ms
 */
function canvasFence(screen: HTMLCanvasElement) {
  if (!probe) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    probe = canvas.getContext('2d');
  }
  const began = performance.now();
  probe!.drawImage(screen, 0, 0, 1, 1, 0, 0, 1, 1);
  probe!.getImageData(0, 0, 1, 1);
  return performance.now() - began;
}

/**
 * The fences (one frame in FENCE_EVERY), each taken twice: the first waits for the frame's queued
 * work, the second at once after, with nothing queued - the fence's own cost on this device
 * (MEASURED, tools/scratch/_gpustat.mjs, the laptop: ~6-9 ms a fence whatever was drawn, so the
 * work is the first less the second); -1 each on the other frames.
 * @param webgl the GPU ground's context, or null
 * @param screen the screen canvas
 * @returns [GL fence, GL idle fence, canvas fence, canvas idle fence], ms
 */
function fences(webgl: WebGL2RenderingContext | null, screen: HTMLCanvasElement) {
  if (frame.no % FENCE_EVERY) return [-1, -1, -1, -1];
  const glMs = glFence(webgl), glIdleMs = glFence(webgl);
  const canvasMs = canvasFence(screen), canvasIdleMs = canvasFence(screen);
  return [glMs, glIdleMs, canvasMs, canvasIdleMs];
}

/**
 * This frame's extra numbers (STAT_FIELDS' order), the fences taken first when it is their turn.
 * @param screen the screen canvas
 * @returns the numbers, rounded to 0.01
 */
export function takeFrameStats(screen: HTMLCanvasElement) {
  const [glMs, glIdleMs, canvasMs, canvasIdleMs] = fences(webglOf(), screen);
  const round = (value: number) => Math.round(value * 100) / 100;
  return [round(timer.lastMs), round(glMs), round(glIdleMs), round(canvasMs), round(canvasIdleMs),
    round(frame.late),
    round(performance.now() - frame.start), ...Array.from(layerMs, round), counts.drawn,
    counts.trees, counts.walked];
}

/** Starts listening for the device's hints (once, when the extra report is on). */
export function watchDeviceHints() {
  if (!FIX.gpustat) return;
  const note = (what: string) => hints.events.push([Math.round(performance.now()), what]);
  document.addEventListener('visibilitychange', () => note(document.visibilityState));
  addEventListener('blur', () => note('blur'));
  addEventListener('focus', () => note('focus'));
  if (PerformanceObserver.supportedEntryTypes?.includes('longtask'))
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        hints.longTasks++;
        hints.longMs += entry.duration;
      }
    }).observe({ type: 'longtask' });
  const Pressure = (globalThis as { PressureObserver?: new (cb: (records:
    { state: string }[]) => void) => { observe: (source: string) => Promise<void> } })
    .PressureObserver;
  if (Pressure) new Pressure((records) => {
    hints.pressure = records[records.length - 1].state;
  }).observe('cpu').catch(() => {});
}

/**
 * The battery, read again (where the browser has it).
 */
function readBattery() {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number;
    charging: boolean }> };
  nav.getBattery?.().then((battery) => {
    hints.battery = { level: battery.level, charging: battery.charging };
  }).catch(() => {});
}

/**
 * A post's extras: the field names, what the browser has, and the device's hints since the last
 * post (undefined when the extra report is off: the post is as before).
 * @returns the extras, or undefined
 */
export function takePostStats() {
  if (!FIX.gpustat) return undefined;
  readBattery();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const post = {
    fields: STAT_FIELDS, fenceEvery: FENCE_EVERY,
    timer: timer.ext ? 'EXT_disjoint_timer_query_webgl2' : timer.ext === null ? 'none'
      : 'not looked for',
    longTask: !!PerformanceObserver.supportedEntryTypes?.includes('longtask'),
    pressureApi: 'PressureObserver' in globalThis, batteryApi: 'getBattery' in navigator,
    cores: navigator.hardwareConcurrency ?? null, memoryGb: nav.deviceMemory ?? null,
    gpuName: hints.gpuName, pressure: hints.pressure, battery: hints.battery,
    events: hints.events.splice(0), longTasks: hints.longTasks, longMs: Math.round(hints.longMs),
  };
  hints.longTasks = hints.longMs = 0;
  return post;
}
