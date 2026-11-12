// _portaltouch.mjs - WHERE A BARRIER MEETS A CROSSOVER PORTAL (scratch): every barrier sampled
// every 0.2 m against each portal's solid boxes (its two side walls and its lintel's face) - the
// length of barrier within TOUCH_M of a box or inside it, the deepest overlap, and where.
// node tools/scratch/_portaltouch.mjs <level>
import * as L from '../../src/lab.ts';

const levelId = process.argv[2] || 'stadeprance';
L.setLevel(levelId);
// m: a barrier this near a wall's face reads as touching it (an Armco's drawn half width)
const TOUCH_M = 0.3, STEP_M = 0.2;
const boxes = (L.LEVEL.solids || []).filter((solid) => solid.kind === 'tunnel');
// signed distance from a point to a turned box: negative inside
const boxDistance = (box, x, y) => {
  const cosR = Math.cos(box.rot || 0), sinR = Math.sin(box.rot || 0);
  const along = Math.abs((x - box.x) * cosR + (y - box.y) * sinR) - box.w / 2;
  const across = Math.abs(-(x - box.x) * sinR + (y - box.y) * cosR) - box.h / 2;
  const outside = Math.hypot(Math.max(along, 0), Math.max(across, 0));
  return outside > 0 ? outside : Math.max(along, across);
};
let touches = 0;
L.LEVEL.barriers.forEach((bar, index) => {
  boxes.forEach((box, boxIndex) => {
    let near = 0, deepest = Infinity, at = null;
    for (let i = 1; i < bar.pts.length; i++) {
      const [ax, ay] = bar.pts[i - 1], [bx, by] = bar.pts[i];
      const len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len / STEP_M));
      for (let k = 0; k <= steps; k++) {
        const x = ax + (bx - ax) * k / steps, y = ay + (by - ay) * k / steps;
        const dist = boxDistance(box, x, y);
        if (dist < TOUCH_M) near += len / steps;
        if (dist < deepest) { deepest = dist; at = [x, y]; }
      }
    }
    if (deepest < TOUCH_M) {
      touches++;
      console.log(`${levelId} barrier ${index} ${bar.kind} (${bar.pts.length} pts) vs portal box`
        + ` ${boxIndex} (${box.w.toFixed(1)} x ${box.h.toFixed(1)} at ${box.x.toFixed(1)},`
        + `${box.y.toFixed(1)}): ${near.toFixed(1)} m within ${TOUCH_M} m, deepest`
        + ` ${deepest.toFixed(2)} m at ${at[0].toFixed(1)},${at[1].toFixed(1)}`);
    }
  });
});
console.log(`${levelId}: ${boxes.length} portal boxes, ${touches} barrier touches`);
