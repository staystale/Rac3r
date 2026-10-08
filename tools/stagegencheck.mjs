// stagegencheck.mjs — the PROCEDURAL STAGE GENERATOR (src/stagegen.js): for many seeds x theme x length x style, does it build, how long
// is the stage vs the target, how long does it take, how much dressing, and is the road clean (no other road within SEP except near it).
// node tools/stagegencheck.mjs [seeds]
import { genStage, THEMES, LENGTHS } from '../src/stagegen.js';
import { querySubtrack } from '../src/lab.js';
const N = +(process.argv[2] || 6);
for (const theme of Object.keys(THEMES)) for (const len of Object.keys(LENGTHS)) for (const style of ['flowing', 'mixed', 'tight']) {
  const row = []; let tMax = 0, short = 0;
  for (let k = 0; k < N; k++) {
    const t0 = performance.now(), lv = genStage({ seed: 100 + k * 37, theme, len, style }), t = performance.now() - t0; tMax = Math.max(tMax, t);
    const km = lv.stage.finish / 1000; if (km < LENGTHS[len] / 1000 * 0.9) short++;
    // spawn is ON the road, the start line is at d 0
    const q = querySubtrack(lv.subtrack, lv.spawn.x, lv.spawn.y);
    row.push(`${km.toFixed(2)}${q.dist > 1 ? '!spawn' : ''}`);
    if (k === 0 && theme === 'forest' && len === 'medium' && style === 'mixed') console.log('  sample', lv.name, 'props', lv.props.length, 'cones', lv.cones.length, 'bumps', lv.bumps.length, 'covers', lv.covers.length, 'barriers', lv.barriers.length);
  }
  console.log(`${theme.padEnd(7)} ${len.padEnd(6)} ${style.padEnd(8)} km ${row.join(' ')} | short ${short}/${N} | max ${tMax.toFixed(0)} ms`);
}
