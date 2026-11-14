// throwaway: the night layer's canopy trace, the walk (traceCanopies) vs the prop grid's
// (traceCanopiesNear), rect for rect, at camera spots along each level's track, three zooms, every
// season. node tools/scratch/_canopycheck.mjs [levels]  (BREAK=1: the query box shrunk 60 m)
import * as L from '../../src/lab.ts';
import * as WORLD from '../../src/world/state.ts';
import { CLOCK } from '../../src/world/clock.ts';
import { traceCanopies, traceCanopiesNear } from '../../src/render/trees.ts';
const W = 844 * 3 + 4, H = 390 * 3 + 4;
const recorder = () => { const rects = []; return { rects, canvas: { width: W, height: H },
  rect: (...args) => rects.push(args.join(',')) }; };
const ids = (process.argv[2] || L.LEVELS.map((lv) => lv.id).join(',')).split(',');
const DAY_S = 86400, SEASON_S = 7 * DAY_S;
let spots = 0, traced = 0, differ = 0, levels = 0;
for (const id of ids) {
  L.setLevel(id);
  const props = WORLD.PROPS || [], sub = WORLD.LEVEL.subtrack;
  if (!sub || !props.some((prop) => prop.kind === 'tree') || WORLD.LEVEL.endless) continue;
  levels++;
  for (let season = 0; season < 4; season++) {
    CLOCK.globalS = season * SEASON_S + 100;
    for (let i = 0; i < sub.pts.length; i += Math.max(1, Math.floor(sub.pts.length / 40))) {
      for (const scale of [6, 12, 24]) {
        const { x: cx, y: cy } = sub.pts[i];
        const map = { artX: (x) => (x - cx) * scale + W / 2, artY: (y) => (y - cy) * scale + H / 2,
          artPerMetre: () => scale, isNear: (x, y, reach) => x > -reach && y > -reach
            && x < W + reach && y < H + reach };
        const walk = recorder(), grid = recorder();
        traceCanopies(walk, props, map);
        traceCanopiesNear(grid, props, map, true);
        spots++; traced += walk.rects.length;
        if (walk.rects.join(';') !== grid.rects.join(';')) differ++;
      }
    }
  }
}
console.log(`${levels} levels with trees, ${spots} spots, ${traced} canopies traced, ${differ} spots differ`);
