// _dtlake.mjs - Dieatona's lakes: the trees standing on scenery water, and Lake Lloyd's gaps
// (the slices along its long axis that laid nothing). DIEATONA=1 node tools/scratch/_dtlake.mjs
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'dieatona')));
const water = level.covers.filter((cover) => cover.water);
const inCover = (covers, x, y, pad) => covers.some((c) => {
  const cos = Math.cos(-(c.rot || 0)), sin = Math.sin(-(c.rot || 0));
  const u = (x - c.x) * cos - (y - c.y) * sin, v = (x - c.x) * sin + (y - c.y) * cos;
  return (u / (c.w / 2 + pad)) ** 2 + (v / (c.h / 2 + pad)) ** 2 < 1;
});
const onWater = level.props.filter((prop) => inCover(water, prop.x, prop.y, 2));
console.log('covers', water.length, 'props within 2 m of water', onWater.length,
  JSON.stringify(onWater.map((p) => [p.kind, Math.round(p.x), Math.round(p.y)])));
// Lake Lloyd: the covers in its box (game m), its slices' x and the gaps
const lloyd = water.filter((c) => c.x > -260 && c.x < 230 && c.y > -175 && c.y < -65);
const xs = [...new Set(lloyd.map((c) => Math.round(c.x)))].sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 6) gaps.push([xs[i - 1], xs[i]]);
console.log('Lake Lloyd covers', lloyd.length, 'x', xs[0], xs[xs.length - 1], 'gaps', JSON.stringify(gaps));
