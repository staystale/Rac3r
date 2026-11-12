// _portalflare.mjs - HOW EACH BARRIER MEETS A CROSSOVER PORTAL (scratch; owner 11-12 "Armco are
// close to the tunnel too and a bit messy still"): for every barrier with an end on a portal's
// corner - which corner, how far its points 3-20 m back from that end stand from the portal's
// walls (nearest), the sharpest turn over those last 20 m (deg), and how far out to the side the
// run stands 15 m back from the corner (across the wall's line) - plus the nearest any other
// barrier comes to a portal's walls. node tools/scratch/_portalflare.mjs <level> [level...]
import * as L from '../../src/lab.ts';
import { portalCorners } from '../../src/world/venuecross.ts';

const NAMES = ['mouth A', 'mouth B', 'lintel A', 'lintel B'];
const boxGap = (box, x, y) => {
  const cosR = Math.cos(box.rot || 0), sinR = Math.sin(box.rot || 0);
  const along = Math.abs((x - box.x) * cosR + (y - box.y) * sinR) - box.w / 2;
  const across = Math.abs(-(x - box.x) * sinR + (y - box.y) * cosR) - box.h / 2;
  return Math.max(along, across) > 0 ? Math.hypot(Math.max(along, 0), Math.max(across, 0))
    : Math.max(along, across);
};
const back = (pts, metres) => {
  const out = [];
  let run = 0;
  for (let i = pts.length - 1; i > 0 && run <= metres; i--) {
    const [ax, ay] = pts[i], [bx, by] = pts[i - 1], step = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < step; t += 0.25) out.push([ax + (bx - ax) * t / step, ay + (by - ay) * t / step, run + t]);
    run += step;
  }
  return out;
};
for (const levelId of process.argv.slice(2)) {
  L.setLevel(levelId);
  const portals = L.LEVEL.props.filter((prop) => prop.kind === 'tunnel' && prop.track);
  const walls = (L.LEVEL.solids || []).filter((solid) => solid.kind === 'tunnel');
  const ends = new Set();
  portals.forEach((portal, pi) => portalCorners(portal).forEach(([cx, cy], ci) => {
    L.LEVEL.barriers.forEach((bar, bi) => {
      for (const first of [true, false]) {
        const pts = first ? bar.pts.slice().reverse() : bar.pts;
        const [ex, ey] = pts[pts.length - 1];
        if (Math.hypot(ex - cx, ey - cy) > 0.05) continue;
        ends.add(bi);
        const samples = back(pts, 20).filter(([, , run]) => run >= 3);
        const nearest = Math.min(...samples.map(([x, y]) => Math.min(...walls.map((box) => boxGap(box, x, y)))));
        let sharpest = 0;
        for (let i = 8; i + 8 < samples.length; i += 2) {
          const [ax, ay] = samples[i - 8], [bx, by] = samples[i], [qx, qy] = samples[i + 8];
          const turn = Math.abs(Math.atan2((bx - ax) * (qy - by) - (by - ay) * (qx - bx),
            (bx - ax) * (qx - bx) + (by - ay) * (qy - by))) * 180 / Math.PI;
          sharpest = Math.max(sharpest, turn);
        }
        const cosR = Math.cos(portal.rot || 0), sinR = Math.sin(portal.rot || 0);
        const far = back(pts, 15).at(-1);
        const side = far ? Math.abs(-(far[0] - cx) * sinR + (far[1] - cy) * cosR) : NaN;
        console.log(`${levelId} portal ${pi + 1} ${NAMES[ci]}: ${bar.kind} ${bi}, 3-20 m back`
          + ` ${nearest.toFixed(2)} m from the walls at the nearest, sharpest turn ${sharpest.toFixed(0)}`
          + ` deg, 15 m back ${side.toFixed(1)} m off the wall's line`);
      }
    });
  }));
  let other = Infinity;
  L.LEVEL.barriers.forEach((bar, bi) => {
    if (ends.has(bi)) return;
    for (const [x, y] of bar.pts) for (const box of walls) other = Math.min(other, boxGap(box, x, y));
  });
  console.log(`${levelId}: any other barrier at the nearest ${other.toFixed(2)} m from a portal wall`);
}
