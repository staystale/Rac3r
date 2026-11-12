// each crossover portal corner: the barrier ends exactly on it (scratch)
import * as L from '../../src/lab.ts';
import { portalCorners } from '../../src/world/venuecross.ts';
const id = process.argv[2];
L.setLevel(id);
const names = ['open A', 'open B', 'lintel A', 'lintel B'];
let missing = 0;
L.LEVEL.props.filter((p) => p.kind === 'tunnel' && p.track).forEach((portal, pi) => {
  portalCorners(portal).forEach(([x, y], ci) => {
    const on = L.LEVEL.barriers.flatMap((bar, bi) => [bar.pts[0], bar.pts[bar.pts.length - 1]]
      .filter((p) => Math.hypot(p[0] - x, p[1] - y) < 0.01).map(() => `${bi}${bar.kind[0]}`));
    if (!on.length) missing++;
    console.log(`${id} portal ${pi + 1} ${names[ci]}: ${on.join(' ') || 'NONE'}`);
  });
});
console.log(`${id}: ${missing} portal corners with no barrier`);
