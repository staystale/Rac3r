// scratch (2026-10-06, user: "occasionally leaves patches of dirt on highway levels ... after longer drives / with ai on"): wear cells
// live at WORLD positions; the endless road is rebuilt as you go. Drive 40 km, chew the verge both sides every 20 m (what spun AI do),
// and after every rebuild count cells whose ground has CHANGED under them (e.g. the road came back over an old dirt cell) - they would
// show / drive as the old dirt. Also the wear map's size (memory). node tools/_wearleak.mjs [srcDir] [preset]
const SRC = process.argv[2] || '../src', PRESET = process.argv[3] || 'motorway';
const L = await import(SRC + '/lab.js'), H = await import(SRC + '/highway.js'), V = await import(SRC + '/vehicle.js');
let worst = 0, onRoad = 0, maxCells = 0, eg = '';
for (const seed of [4242, 77, 1234]) {
  const lv = H.createHighway(seed, PRESET); lv.id = `wl-${seed}`; L.LEVELS.push(lv); L.setLevel(lv.id); L.clearWear();
  const c = V.makeCar('saloon-rwd'), hw = lv._hw.geo.hw;
  let s = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, stale = 0, road = 0;
  for (let k = 0; k < 40000 / 5; k++) {
    s += 5; const p = H.roadPose(lv, s, lv._hw.geo.centres[0]); V.reset(c, p.x, p.y, p.h);
    const ds = H.stepHighway(lv, c); s -= ds;
    if (k % 4 === 0) for (const off of [-(hw + 3), hw + 3, hw + 6]) { const q = H.roadPose(lv, s, off); for (let n = 0; n < 6; n++) L.recordWearAt(q.x, q.y, null, k * 1000 + n * 300); }
    if (ds) {   // a rebuild just happened: how many cells no longer match what is under them?
      stale = 0; road = 0;
      for (const cell of L.wearMap.values()) {
        const x = (cell.cx + 0.5) * L.WEAR_CELL, y = (cell.cy + 0.5) * L.WEAR_CELL, z = L.zoneSurfaceAt(x, y).id;
        if (cell.current !== cell.orig && z === 'tarmac') { const f = H.roadFrame(lv, x, y, s); if (f && Math.abs(f.off) < hw) { road++; eg = `seed ${seed} cell ${cell.current} on the motorway at s ${f.s | 0}`; } }
        // what the cell WAS worn from vs the ground there now (zone + patches + covers): L.cleanAt = the static layers, ignoring wear
        if (cell.current !== cell.orig && L.cleanAt(x, y) !== cell.orig) { stale++; if (process.env.WLDBG) console.log('  stale', cell.orig, '->', cell.current, 'now', L.cleanAt(x, y)); }
      }
      worst = Math.max(worst, stale); onRoad = Math.max(onRoad, road); maxCells = Math.max(maxCells, L.wearMap.size);
    }
  }
  console.log(`${PRESET} ${seed}: worn cells on the motorway now ${road} | stale (ground changed under them) ${stale} | wear map ${L.wearMap.size} cells`);
}
console.log(`WORST: on-road ${onRoad}, stale ${worst}, cells ${maxCells}${eg ? ' | e.g. ' + eg : ''}`);
console.log(onRoad || worst ? 'LEAK' : 'ALL OK');
