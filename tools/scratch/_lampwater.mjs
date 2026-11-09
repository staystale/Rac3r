// _lampwater.mjs - LAMPS BY THE WATER (?clearance=1): each lamp and each tyre stack whose spot lies
// in a level's scenery water (lakes, rivers) or within 1 m of it. node _lampwater.mjs [level]
import * as L from '../../src/lab.ts';
import { activeLamps } from '../../src/world/lamps.ts';
const lv = process.argv[2] || 'malarkey';
L.setLevel(lv);
const wet = (x, y, pad) => (L.LEVEL.covers || []).some((c) => {
  if (!c.water) return false;
  const ox = x - c.x, oy = y - c.y, cr = Math.cos(c.rot || 0), sr = Math.sin(c.rot || 0);
  const a = Math.abs(ox * cr + oy * sr) / (c.w / 2 + pad), b = Math.abs(-ox * sr + oy * cr) / (c.h / 2 + pad);
  return c.shape === 'ellipse' ? a * a + b * b <= 1 : a <= 1 && b <= 1;
});
const lamps = activeLamps().filter((lamp) => wet(lamp.x ?? lamp.solid?.x, lamp.y ?? lamp.solid?.y, 1));
const tyres = (L.LEVEL.cones || []).filter((c) => c.kind === 'tyrestack' && wet(c.x, c.y, 0));
console.log(lv, 'lamps by the water', lamps.length, '| tyre stacks in it', tyres.length);
const sub = L.LEVEL.subtrack, half = sub.width / 2;
for (const t of tyres) { const q = L.querySubtrack(sub, t.x, t.y); console.log('  tyre stack at', t.x.toFixed(1), t.y.toFixed(1), 'lap m', q.trackDist.toFixed(0), (q.dist - half).toFixed(1), 'm past the edge'); }
