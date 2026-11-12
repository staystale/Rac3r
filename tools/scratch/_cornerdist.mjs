import * as L from '../../src/lab.ts';
import { portalCorners } from '../../src/world/venuecross.ts';
const id = process.argv[2];
L.setLevel(id);
const sub = L.LEVEL.subtrack, span = sub.under.find((s) => s.over !== undefined);
const portals = L.LEVEL.props.filter((p) => p.kind === 'tunnel' && p.track);
portals.forEach((portal, pi) => {
  portalCorners(portal).forEach(([x, y], ci) => {
    // the under road's centre near the corner: the span's stretch only
    let best = Infinity, at = 0;
    for (let d = span.d0 - 20; d <= span.d1 + 20; d += 0.25) {
      const p = L.onTrack(sub, (d + sub.totalDist) % sub.totalDist, 0, {});
      const gap = Math.hypot(p.x - x, p.y - y);
      if (gap < best) { best = gap; at = d; }
    }
    console.log(id, 'portal', pi + 1, ['open A', 'open B', 'lintel A', 'lintel B'][ci], 'at', x.toFixed(1), y.toFixed(1), 'from the under road centre', best.toFixed(2), 'm, along', (at - span.d0).toFixed(1));
  });
});
