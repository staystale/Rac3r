import { LEVELS } from '../../src/world/levels/index.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
for (const lv of LEVELS.filter((l) => l.joker)) {
  const arrows = (lv.joker.arrows || []).filter(Boolean);
  console.log(lv.id, 'lap', lv.subtrack && lv.subtrack.totalDist.toFixed(0), arrows.map((a) => querySubtrack(lv.subtrack, a.x, a.y).trackDist.toFixed(0)).join(' / '));
}
