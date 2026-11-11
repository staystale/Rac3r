// _mopads.mjs - a venue's grass pads kept off the race road: for each pad zone, the share of its
// size (shrunk about its centre) whose outline keeps CLEAR m from the race road on the ground; the
// spec's pads printed with that share applied (none under KEEP of its size: left out) (scratch)
import * as L from '../../src/lab.ts';
L.setLevel(process.argv[2] || 'moanaco');
const { MOANACO_SPEC } = await import('../../src/world/levels/moanaco-venue.ts');
const sub = L.LEVEL.subtrack, CLEAR = 13, KEEP = 0.35;
const zones = L.LEVEL.zones.filter((z) => z.poly && z.surface.id === 'grass');
const nearest = (poly) => {
  let near = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= len; t += 1) {
      const d = L.onGroundQuery(() => L.querySubtrack(sub, ax + (bx - ax) * t / len, ay + (by - ay) * t / len)).dist;
      if (Number.isFinite(d)) near = Math.min(near, d);
    }
  }
  return near;
};
const out = [];
MOANACO_SPEC.pads.forEach((pad, i) => {
  const poly = zones[i].poly, cx = poly.reduce((s, p) => s + p[0], 0) / 4, cy = poly.reduce((s, p) => s + p[1], 0) / 4;
  let share = 1;
  while (share >= KEEP && nearest(poly.map(([x, y]) => [cx + (x - cx) * share, cy + (y - cy) * share])) < CLEAR) share -= 0.05;
  if (share < KEEP) { console.error('left out', pad.at); return; }
  out.push(`    { at: [${pad.at[0]}, ${pad.at[1]}], w: ${Math.round(pad.w * share)}, h: ${Math.round(pad.h * share)}, rot: ${pad.rot}, surface: 'grass' },`);
});
console.log(out.join('\n'));
