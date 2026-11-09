// _desertroom.mjs - DEAF VALLEY'S ROOM OFF THE ROAD (?desertroom=1; owner 11-09: "a tiny bit more
// breathing room off the road between rocky walls or gullies ... so passing off the road is more
// possible but keep the features", "More cactus on the side of the road / in the sand dunes",
// "Make sure signs don't go across petrol station entrance or exits"): over the first window of
// the canyon road for each of SEEDS, the room from the road edge to the rock face (the canyon's
// walls, the high road's uphill wall: the least, the tenth, the middle), to where the ground first
// falls 0.5 m (a gorge, a wash), the cacti by the road (within 8 m of the edge) and on the dunes
// per km, and anything standing in a petrol station's way in or out.
// [DESERTROOM=1] node tools/scratch/_desertroom.mjs [seeds]
import { createHighway, stepHighway } from '../../src/highway.ts';
import { setActiveLevel } from '../../src/world/state.ts';
import { heightAt } from '../../src/world/terrain.ts';
import { stateOf, roadFrame } from '../../src/highway/road.ts';
import { stretchAt } from '../../src/highway/desertplan.ts';
const seeds = (process.argv[2] || '4242,7,99,1234,555,31337').split(',').map(Number);
const rooms = { canyon: [], high: [] }, falls = { high: [], desert: [] };
let roadKm = 0, dunesKm = 0, byRoad = 0, onDunes = 0, inMouth = [], stations = 0;
for (const seed of seeds) {
  const level = createHighway(seed, 'canyon');
  setActiveLevel(level);
  const state = stateOf(level), road = state.pts, hw = state.geo.hw;
  roadKm += (road[road.length - 1].s - road[0].s) / 1000;
  // the rock faces: each wall point's room off the road edge, by the stretch it stands by
  for (const bar of level.barriers) if (bar.kind === 'rock') for (const [x, y] of bar.pts) {
    const frame = roadFrame(level, x, y, null);
    if (!frame) continue;
    const kind = stretchAt(frame.s, seed).kind;
    if (rooms[kind]) rooms[kind].push(Math.abs(frame.off) - hw);
  }
  // the ground: the first 0.5 m fall off each side, every 20 m
  for (let i = 0; i < road.length; i += 5) {
    const kind = stretchAt(road[i].s, seed).kind;
    if (kind === 'dunes') dunesKm += 5 * 4 / 1000;
    if (!falls[kind]) continue;
    const before = road[Math.max(0, i - 1)], after = road[Math.min(road.length - 1, i + 1)];
    const hdg = Math.atan2(after.y - before.y, after.x - before.x);
    for (const side of [-1, 1]) for (let past = 0; past < 30; past += 0.5) {
      const off = side * (hw + past), x = road[i].x - Math.sin(hdg) * off,
        y = road[i].y + Math.cos(hdg) * off;
      if (heightAt(x, y) < -0.5) { falls[kind].push(past); break; }
    }
  }
  // the cacti: by the road, on the dunes
  for (const obj of level.cones || []) {
    if (obj.kind !== 'cactus' && obj.kind !== 'barrelcactus') continue;
    const frame = roadFrame(level, obj.x, obj.y, null);
    if (!frame) continue;
    if (Math.abs(frame.off) - hw < 8) byRoad++;
    if (stretchAt(frame.s, seed).kind === 'dunes') onDunes++;
  }
  // a petrol station's way in and out: its forecourt's span along the road, its side, out to 19 m
  // (the road driven on SHIFTS x 600 m, each window's new stations)
  const seen = new Set();
  for (let shift = 0; shift <= +(process.env.SHIFTS || 8); shift++) {
    if (shift) {
      // (the window's points now: it moves on)
      const pts = stateOf(level).pts, ahead = pts.find((pt) => pt.s > (state.q?.s ?? pts[0].s)
        + 600) || pts[Math.max(0, pts.length - 300)];
      for (let step = 0; step < 40; step++) stepHighway(level, { x: ahead.x, y: ahead.y, vx: 0, vy: 0 });
    }
    for (const station of level.props.filter((prop) => prop.kind === 'gasstation')) {
      if (seen.has(station)) continue;
      seen.add(station);
      stations++;
      const at = roadFrame(level, station.x, station.y, null), side = Math.sign(at.off);
      for (const thing of [...level.props, ...(level.cones || [])]) {
        if (thing === station || thing.kind === 'canopy') continue;
        const frame = roadFrame(level, thing.x, thing.y, at.s);
        if (frame && Math.abs(frame.s - at.s) < 30 && Math.sign(frame.off) === side
          && Math.abs(frame.off) - hw < 20) inMouth.push(`${thing.kind}${thing.label ? ' "'
            + thing.label + '"' : ''} ${Math.round(frame.s - at.s)} m along, ${(Math.abs(frame.off)
            - hw).toFixed(1)} m off`);
      }
    }
  }
}
const spread = (list) => {
  const sorted = [...list].sort((a, b) => a - b), at = (share) => sorted.length
    ? sorted[Math.floor(share * (sorted.length - 1))].toFixed(1) : '-';
  return `least ${at(0)}, a tenth ${at(0.1)}, middle ${at(0.5)} m (${sorted.length})`;
};
console.log(`${seeds.length} roads, ${roadKm.toFixed(1)} km${process.env.DESERTROOM === '1'
  ? ' (?desertroom=1)' : ''}`);
console.log(`  room to the canyon walls: ${spread(rooms.canyon)}`);
console.log(`  room to the high road's uphill wall: ${spread(rooms.high)}`);
console.log(`  room to a gorge's fall: ${spread(falls.high)}`);
console.log(`  room to a wash's fall: ${spread(falls.desert)}`);
console.log(`  cacti within 8 m of the road ${(byRoad / roadKm).toFixed(1)} a km; on the dunes`
  + ` ${dunesKm ? (onDunes / dunesKm).toFixed(1) : '-'} a km of dunes`);
console.log(`  petrol stations ${stations}; in their way in or out: ${inMouth.length ? inMouth
  .join('; ') : 'nothing'}`);
