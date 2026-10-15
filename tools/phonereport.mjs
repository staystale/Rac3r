// phonereport.mjs - read the owner's phone frame reports (?report=1, src/ui/report.ts; serve.mjs
// appends them to RAC3R_REPORT_LOG). Per run (session + level): frames, frame times, our JS time,
// slow frames (> 25 ms = a missed 60 Hz refresh) and what they coincided with; and, for reports
// with the zoom, slow frames by zoom band.
// node tools/phonereport.mjs <report.jsonl> [--since 2026-10-15T17:00]
// Times in the log are UTC. Each run's first frames are the level start (painting), not driving.
import { readFileSync } from 'node:fs';

const SLOW_MS = 25;      // a frame this long missed a 60 Hz refresh
const START_FRAMES = 5;  // the level start, skipped

const file = process.argv[2];
const sinceAt = process.argv.indexOf('--since');
const since = sinceAt > 0 ? process.argv[sinceAt + 1] : '';
if (!file) {
  console.log('usage: node tools/phonereport.mjs <report.jsonl> [--since <ISO time>]');
  process.exit(1);
}

/**
 * The runs of the log: one per session and level, frames in order.
 * @returns {object[]} the runs
 */
function readRuns() {
  const runs = new Map();
  for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
    const report = JSON.parse(line);
    if (report.at < since) continue;
    const key = report.session + '|' + report.level;
    if (!runs.has(key)) runs.set(key, { ...report, frames: [] });
    runs.get(key).frames.push(...report.frames);
  }
  return [...runs.values()];
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

for (const run of readRuns()) {
  const frames = run.frames.filter((frame) => frame[3] > 0).slice(START_FRAMES);
  if (frames.length < 100) continue;
  const slow = frames.filter((frame) => frame[0] > SLOW_MS);
  const ours = slow.filter((frame) => frame[1] + frame[2] > 12).length;
  console.log(`${run.at.slice(0, 16)}Z ${run.level} ${run.homeScreen ? 'HOME SCREEN' : 'tab'} `
    + `${run.query} | ${run.width}x${run.height} dpr ${run.dpr}`);
  console.log(`  ${frames.length} frames, dt median ${median(frames.map((f) => f[0]))} ms | sim `
    + `${median(frames.map((f) => f[1]))} draw ${median(frames.map((f) => f[2]))} ms | slow `
    + `${slow.length} (${percent(slow.length, frames.length)}), our JS heavy ${ours}, with tiles `
    + `${slow.filter((f) => f[4] > 0).length}, with road build ${slow.filter((f) => f[5] > 0).length}`);
  zoomBands(frames);
}
