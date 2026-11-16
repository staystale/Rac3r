// phonereport.mjs - read the owner's phone frame reports (?report=1, src/ui/report.ts; serve.mjs
// appends them to RAC3R_REPORT_LOG). Per run (session + level): frames, frame times, our JS time,
// slow frames (> 25 ms = a missed 60 Hz refresh) and what they coincided with; and, for reports
// with the zoom, slow frames by zoom band. Frames with the menu up (12-number frames: [9] = 1) are
// a run of their own per session ("menu"): frame times, plus the menu taps a new screen ignored
// (its ghost-click window) and the slowest button handlers. Runs with ?gpustat=1 (src/ui/gpustat.ts)
// also print the GPU side, our whole work and the browser's gap, each draw layer, the fences and
// the device's hints.
// node tools/phonereport.mjs <report.jsonl> [--since 2026-10-15T17:00]
// Times in the log are UTC. Each run's first frames are the level start (painting), not driving.
import { readFileSync } from 'node:fs';

const SLOW_MS = 25;      // a frame this long missed a 60 Hz refresh
const START_FRAMES = 5;  // the level start, skipped
const SLOW_TAP_MS = 100; // a button handler this long is a tap the player feels wait

const file = process.argv[2];
const sinceAt = process.argv.indexOf('--since');
const since = sinceAt > 0 ? process.argv[sinceAt + 1] : '';
if (!file) {
  console.log('usage: node tools/phonereport.mjs <report.jsonl> [--since <ISO time>]');
  process.exit(1);
}

/**
 * The runs of the log: one per session and level, and one per session for the menu, frames in
 * order.
 * @returns {object[]} the runs
 */
// a run whose median frame is this long or more was shown at 30 fps throughout: iOS Low Power Mode
// caps Safari there, and so does a hot phone (10-18: every frame 33 ms, the menu too, our JS 2-6 ms)
const CAPPED_MEDIAN_MS = 30;

/**
 * Prints a warning when the whole run was capped at ~30 fps (not the game: the phone).
 * @param {number[][]} frames the run's frames ([0] the frame gap, ms)
 */
function noteCap(frames) {
  if (median(frames.map((frame) => frame[0])) < CAPPED_MEDIAN_MS) return;
  console.log('  CAPPED AT ~30 fps for the whole run: Low Power Mode on, or a hot phone? '
    + '(not the game: turn it off / let it cool and run again)');
}

function readRuns() {
  const runs = new Map();
  const addTo = (report, menu, frames) => {
    if (!frames.length) return;
    const key = report.session + '|' + (menu ? 'menu' : report.level);
    if (!runs.has(key)) runs.set(key, { ...report, menu, frames: [], stats: [] });
    runs.get(key).frames.push(...frames);
    if (report.stat) runs.get(key).stats.push(report.stat);
  };
  for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
    const report = JSON.parse(line);
    if (report.at < since) continue;
    addTo(report, true, report.frames.filter((frame) => frame[9] === 1));
    addTo(report, false, report.frames.filter((frame) => frame[9] !== 1));
  }
  return [...runs.values()];
}

/**
 * The menu's run: frame times (no level start to skip, no physics steps needed), the taps the
 * menu ignored and its slow button handlers.
 * @param {object} run the menu run
 */
function printMenu(run) {
  const frames = run.frames;
  const slow = frames.filter((frame) => frame[0] > SLOW_MS);
  const ours = slow.filter((frame) => frame[1] + frame[2] > 12).length;
  const handlers = frames.map((frame) => frame[11]).filter((ms) => ms > 0);
  // [12] the texture warm-up (main.ts) since the frame before
  const warmed = slow.filter((frame) => frame[12] > 10);
  const slowTaps = handlers.filter((ms) => ms > SLOW_TAP_MS);
  const middle = (at) => median(frames.map((frame) => frame[at])).toFixed(1);
  const loaded = run.loadMs ? ` | menu shown ${run.loadMs} ms after the page opened` : '';
  console.log(`${run.at.slice(0, 16)}Z MENU ${run.homeScreen ? 'HOME SCREEN' : 'tab'} `
    + `${run.query} | ${run.width}x${run.height} dpr ${run.dpr}${loaded}`);
  console.log(`  ${frames.length} frames (${(frames.length / 60).toFixed(0)} s), dt median `
    + `${middle(0)} ms | sim ${middle(1)} draw ${middle(2)} ms | slow ${slow.length} `
    + `(${percent(slow.length, frames.length)}), our JS heavy ${ours}, longest frame `
    + `${Math.round(Math.max(...frames.map((f) => f[0])))} ms, slow with texture warm-up `
    + `${warmed.length}${warmed.length ? ' (' + warmed.map((f) => f[12]).join(', ') + ' ms)' : ''}`);
  console.log(`  taps: ${handlers.length} answered, `
    + `${frames.reduce((sum, frame) => sum + frame[10], 0)} ignored (new screen, first `
    + `350 ms), slowest ${Math.max(0, ...handlers)} ms, over ${SLOW_TAP_MS} ms: `
    + `${slowTaps.length ? slowTaps.join(', ') + ' ms' : 'none'}`);
  noteCap(frames);
}

/**
 * Percent, two decimals.
 * @param {number} part the part
 * @param {number} whole the whole
 * @returns {string} the percentage
 */
const percent = (part, whole) => (whole ? (100 * part / whole).toFixed(2) : '0') + '%';

/**
 * The middle value.
 * @param {number[]} values the values
 * @returns {number} the median
 */
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1] || 0;

/**
 * Slow frames by zoom band (reports with 9-number frames: [6] css px per metre).
 * @param {number[][]} frames the run's frames
 */
function zoomBands(frames) {
  const zoomed = frames.filter((frame) => frame.length >= 9);
  if (zoomed.length < 100) return;
  const widest = Math.max(...zoomed.map((frame) => frame[6]));
  for (const [low, high, name] of [[0.85, 2, 'zoomed in'], [0.55, 0.85, 'middle'],
    [0, 0.55, 'zoomed out']]) {
    const band = zoomed.filter((frame) => frame[6] / widest >= low && frame[6] / widest < high);
    if (!band.length) continue;
    const slow = band.filter((frame) => frame[0] > SLOW_MS);
    const withUploads = slow.filter((frame) => frame[7] > 0 || frame[8] > 0).length;
    console.log(`    ${name.padEnd(10)} ${String(band.length).padStart(6)} frames, slow `
      + `${percent(slow.length, band.length)}, slow with GPU uploads ${withUploads}/${slow.length}`);
  }
}

/**
 * The p-th fraction's value.
 * @param {number[]} values the values
 * @param {number} share 0..1
 * @returns {number} the value there
 */
const atShare = (values, share) => [...values].sort((a, b) => a - b)[
  Math.min(values.length - 1, Math.floor(values.length * share))] ?? 0;

/**
 * ?gpustat=1: the device's hints over the run's posts.
 * @param {object} run the run (its stats: each post's extras)
 */
function printHints(run) {
  const last = run.stats[run.stats.length - 1];
  const events = run.stats.flatMap((stat) => stat.events);
  const pressures = [...new Set(run.stats.map((stat) => stat.pressure).filter(Boolean))];
  console.log(`  GPUSTAT timer ${last.timer} | GPU ${last.gpuName ?? 'not given'} | cores `
    + `${last.cores ?? '?'} memory ${last.memoryGb ?? '?'} GB | battery ${last.batteryApi
      ? JSON.stringify(last.battery) : 'no API'} | CPU pressure ${last.pressureApi
      ? (pressures.join(' -> ') || 'none read') : 'no API (no thermal hint)'} | long tasks `
    + `${last.longTask ? run.stats.reduce((sum, stat) => sum + stat.longTasks, 0) + ' ('
      + run.stats.reduce((sum, stat) => sum + stat.longMs, 0) + ' ms)' : 'no API'}`);
  if (events.length) console.log(`  page events: ${events.map(([at, what]) => `${(at / 1000)
    .toFixed(1)} s ${what}`).join(', ')}`);
}

/**
 * ?gpustat=1: the run's extra numbers - all frames and the slow ones (the frames a fence made wait
 * and the next one left out), the fences on their own.
 * @param {object} run the run
 * @param {number[][]} frames its frames
 */
function printStats(run, frames) {
  printHints(run);
  const fields = run.stats[0].fields, at = (name) => 13 + fields.indexOf(name);
  const fenced = new Set();
  frames.forEach((frame, i) => {
    if (frame[at('canvasFenceMs')] >= 0) {
      fenced.add(i);
      fenced.add(i + 1);
    }
  });
  const clean = frames.filter((frame, i) => !fenced.has(i) && frame.length > at('propsWalked'));
  const slow = clean.filter((frame) => frame[0] > SLOW_MS);
  const layers = fields.slice(fields.indexOf('ground'), fields.indexOf('hud') + 1);
  const columns = {
    dt: (frame) => frame[0], work: (frame) => frame[at('workMs')],
    gap: (frame) => frame[0] - frame[at('workMs')], late: (frame) => frame[at('rafLateMs')],
    draw: (frame) => frame[2], gpu: (frame) => frame[at('gpuMs')],
    ...Object.fromEntries(layers.map((name) => [name, (frame) => frame[at(name)]])),
    rest: (frame) => frame[2] - layers.filter((name) => name !== 'hud')
      .reduce((sum, name) => sum + frame[at(name)], 0),
    propsN: (frame) => frame[at('propsDrawn')], treesN: (frame) => frame[at('treesDrawn')],
    walkedN: (frame) => frame[at('propsWalked')],
  };
  // (a column with no reading - no GPU timer: -1 every frame - prints "-")
  const show = (values, pick) => (values.length ? pick(values).toFixed(1) : '-');
  const row = (label, set, pick) => `${label} ${Object.entries(columns).map(([name, read]) =>
    `${name} ${show(set.map(read).filter((value) => value >= 0), pick)}`).join(' ')}`;
  console.log(`  ms (gpu: the ground's WebGL; gap: dt less our work; rest: draw less the layers) `
    + `over ${clean.length} frames, ${slow.length} slow:`);
  console.log('    ' + row('median all ', clean, median));
  if (slow.length) console.log('    ' + row('median slow', slow, median));
  console.log('    ' + row('p95 all    ', clean, (values) => atShare(values, 0.95)));
  const samples = frames.filter((frame) => frame[at('canvasFenceMs')] >= 0);
  if (!samples.length) return;
  const fence = (name) => samples.map((frame) => frame[at(name)]).filter((value) => value >= 0);
  // (the work queued: the fence less the same fence taken at once after, with nothing queued)
  const work = (name, idle) => samples.filter((frame) => frame[at(idle)] >= 0)
    .map((frame) => frame[at(name)] - frame[at(idle)]);
  const say = (values) => `median ${median(values).toFixed(1)} p90 ${atShare(values, 0.9)
    .toFixed(1)} max ${Math.max(0, ...values).toFixed(1)}`;
  console.log(`  fences (${samples.length}, 1 in ${run.stats[0].fenceEvery}): GPU ground finish `
    + `${say(fence('glFenceMs'))} (idle ${say(fence('glIdleMs'))}; work `
    + `${say(work('glFenceMs', 'glIdleMs'))})`);
  console.log(`    2D screen paint ${say(fence('canvasFenceMs'))} (idle `
    + `${say(fence('canvasIdleMs'))}; work ${say(work('canvasFenceMs', 'canvasIdleMs'))}) ms`);
}

for (const run of readRuns()) {
  if (run.menu) {
    if (run.frames.length >= 30) printMenu(run);
    continue;
  }
  const frames = run.frames.filter((frame) => frame[3] > 0).slice(START_FRAMES);
  if (frames.length < 100) continue;
  const slow = frames.filter((frame) => frame[0] > SLOW_MS);
  const ours = slow.filter((frame) => frame[1] + frame[2] > 12).length;
  console.log(`${run.at.slice(0, 16)}Z ${run.level} ${run.homeScreen ? 'HOME SCREEN' : 'tab'} `
    + `${run.query} | ${run.width}x${run.height} dpr ${run.dpr}`);
  // the weather the run started in (reports from 2026-10-18 carry it)
  const sky = run.weather;
  if (sky) {
    console.log(`  weather ${sky.kind}, track ${sky.trackC} C, air ${sky.airC} C, rain ${sky.rain}, snow `
      + `${sky.snow}, wet ${sky.wetness}; field water ${sky.field.water} snow ${sky.field.snow} ice `
      + `${sky.field.ice}`
      + (sky.dark !== undefined ? `; hour ${sky.hour}, dark ${sky.dark}` : ''));
  }
  console.log(`  ${frames.length} frames, dt median ${median(frames.map((f) => f[0]))} ms | sim `
    + `${median(frames.map((f) => f[1]))} draw ${median(frames.map((f) => f[2]))} ms | slow `
    + `${slow.length} (${percent(slow.length, frames.length)}), our JS heavy ${ours}, with tiles `
    + `${slow.filter((f) => f[4] > 0).length}, with road build ${slow.filter((f) => f[5] > 0).length}`);
  noteCap(frames);
  zoomBands(frames);
  if (run.stat) printStats(run, frames);
}
