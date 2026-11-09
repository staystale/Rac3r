// _khinfo.mjs - Knobhill / Slidden Hill venue facts: lap, sectors, joker lane, props by kind. SLIDDENHILLVENUE=1
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
for (const id of ['slidden-hill', 'slidden-hill-circuit']) {
  const level = buildLevel(LEVELS.find((entry) => entry.id === id));
  const sub = level.subtrack;
  console.log(id, 'lap', sub.totalDist.toFixed(0), 'sectors', sub.sectors.map((s) => `${s.surface.id} ${s.startDist.toFixed(0)}-${Math.min(s.endDist, sub.totalDist).toFixed(0)}`).join(', '));
  const kinds = {};
  for (const prop of level.props) kinds[prop.kind] = (kinds[prop.kind] || 0) + 1;
  const cones = {};
  for (const cone of level.cones) cones[cone.kind || 'cone'] = (cones[cone.kind || 'cone'] || 0) + 1;
  console.log('  props', JSON.stringify(kinds), 'cones', JSON.stringify(cones), 'barriers', level.barriers.length, 'lanes', level.lanes.length, 'kerbs', sub.curvedKerbs.length);
  if (level.joker) {
    const lane = level.lanes[0], len = lane.pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - lane.pts[i][0], p[1] - lane.pts[i][1]), 0);
    console.log('  joker lane', len.toFixed(0), 'm', JSON.stringify(lane.pts[0].map(Math.round)), '->', JSON.stringify(lane.pts.at(-1).map(Math.round)), 'gate', JSON.stringify(level.joker.gate), 'arrows', level.joker.arrows.length);
  }
}
