// _gorgeprofile.mjs - DEAF VALLEY's ground across the road (highway/gorge.ts through world/terrain.ts
// heightAt): for road distances in DISTS, the height at offsets either side of the centre line,
// the stretch, and whether each side falls (a gorge) - so the drops, washes and rises are measured,
// not guessed. node tools/scratch/_gorgeprofile.mjs [dists]
import { createHighway } from '../../src/highway.ts';
import { setActiveLevel } from '../../src/world/state.ts';
import { heightAt } from '../../src/world/terrain.ts';
import { stretchAt } from '../../src/highway/desertplan.ts';
import { growTo, stateOf } from '../../src/highway/road.ts';
const dists = (process.argv[2] || '700,1000,1100,1300,1500,1700,1850,2000,2200').split(',').map(Number);
const level = createHighway(4242, 'canyon');
setActiveLevel(level);
const state = stateOf(level), road = state.pts;
const offs = [-48, -40, -32, -24, -18, -12, -8, -5, 0, 5, 8, 12, 18, 24, 32, 40, 48];
console.log('window', Math.round(road[0].s), '..', Math.round(road[road.length - 1].s));
for (const dist of dists) {
  const i = road.findIndex((pt) => pt.s >= dist);
  if (i < 1) { console.log(dist, 'outside the window'); continue; }
  const before = road[i - 1], after = road[i + 1], hdg = Math.atan2(after.y - before.y, after.x - before.x);
  const row = offs.map((off) => heightAt(road[i].x - Math.sin(hdg) * off, road[i].y + Math.cos(hdg) * off));
  console.log(String(dist).padStart(5), stretchAt(dist, level.seed).kind.padEnd(7), row.map((h) => h.toFixed(1).padStart(6)).join(''));
}
console.log('offsets', offs.join(' '));
