// stageseeds.mjs — pick SEEDS for the fixed rally stages (user: "rally stages should be set"). Per theme x style, seeds 1..N at medium:
// length, the attempt that won (0 = cheap to rebuild at boot), corners / hairpins / crests+jumps; prints the best few per theme.
// node tools/stageseeds.mjs [N]
import { genStage, addStageLevels } from '../src/stagegen.js';
import { autoKerbs, onTrack } from '../src/lab.js';
// the levels importing these modules used to add (task 078 made it explicit)
addStageLevels();
const N = +(process.argv[2] || 60);
for (const theme of ['forest', 'alpine', 'snow', 'desert']) {
  const rows = [];
  for (const style of ['mixed', 'tight', 'flowing']) for (let seed = 1; seed <= N; seed++) {
    const t0 = performance.now(), lv = genStage({ seed, theme, len: 'medium', style }), ms = performance.now() - t0;
    const sub = lv.subtrack, F = lv.stage.finish;
    const cs = autoKerbs(sub, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 }).filter((c) => c.startDist > 25 && c.endDist < F - 10);
    const turn = (c) => { let t = onTrack(sub, c.endDist, 0, {}).rot - onTrack(sub, c.startDist, 0, {}).rot; return Math.abs(Math.atan2(Math.sin(t), Math.cos(t))); };
    const hp = cs.filter((c) => turn(c) > 2.4).length, crests = lv.props.filter((p) => p.kind === 'board' && /JUMP|CREST/.test(p.label)).length;
    const km = F / 1000, score = (km >= 1.9 ? 10 : 0) + (lv.gen.attempt === 0 ? 4 : 0) + Math.min(cs.length, 30) * 0.3 + Math.min(hp, 4) * 1.2 + Math.min(crests, 3) - ms / 200;
    rows.push({ seed, style, km: km.toFixed(2), att: lv.gen.attempt, ms: ms | 0, corners: cs.length, hp, crests, name: lv.name, score: +score.toFixed(1) });
  }
  rows.sort((a, b) => b.score - a.score);
  console.log(theme); for (const r of rows.slice(0, 6)) console.log('  ', JSON.stringify(r));
}
