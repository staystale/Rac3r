// scratch (2026-10-06, user: "dirt in the road on highway levels is still a bug"): the REAL game, highway, 5 AI + max traffic + litter,
// the player's car driven by the highway weaver. Every second: every worn cell (current != orig) whose centre lies ON the carriageway
// (|road offset| < half width) - what it was worn from, what it is now, what the ground there says now. node tools/_dirtroad.mjs [sec 120] [preset]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const SEC = +(process.argv[2] || 120), PRESET = process.argv[3] || 'motorway';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); p.on('console', (m) => { if (m.text().startsWith('DIAG')) console.log(m.text()); });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&rules=0&level=highway&traffic=1.5&litter=3`); await p.waitForTimeout(1500);
await p.touchscreen.tap(400, 200); await p.waitForTimeout(800);
await p.evaluate((pr) => window.__game.launch('highway', 'saloon-rwd', { ai: 5, diff: 0, traffic: 1.5, litter: 3, road: pr }), PRESET);
await p.waitForTimeout(2500);
const r = await p.evaluate((SEC) => new Promise(async (res) => {
  const g = window.__game, H = await import('/src/highwayrace.ts'), A = { ...await import('/src/ai/circuit.ts'), ...await import('/src/ai/traits.ts') }, L = await import('/src/lab.js'), HW = await import('/src/highway.js');
  const drv = A.createAIDriver(g.level, A.aiTraits(4, 0, 1));
  g.input.update = () => { const others = [...g.ai.map((a) => a.car), ...g.traffic.cars]; H.hwFrames(g.level, [g.car, ...others]);
    return { ...drv.drive(g.car, 1 / 60, { cars: others }), reverse: 0, shiftUp: false, shiftDown: false }; };
  const seen = new Map(); let worst = 0, scans = 0, maxCells = 0;
  // BIRTH of every cell: where the road window was, the cell's road frame, the ground then (DIRTBIRTH)
  const birth = new Map(), set0 = L.wearMap.set.bind(L.wearMap);
  L.wearMap.set = (k, c) => { const x = (c.cx + 0.5) * L.WEAR_CELL, y = (c.cy + 0.5) * L.WEAR_CELL, sp = HW.roadSpan(g.level), f = HW.roadFrame(g.level, x, y, null);
    birth.set(k, { s0: sp.s0 | 0, s1: sp.s1 | 0, cs: f ? f.s | 0 : null, coff: f ? +f.off.toFixed(1) : null, was: c.orig, cleanThen: L.cleanAt(x, y), qd: +L.querySubtrack(g.level.subtrack, x, y).dist.toFixed(2) });
    // BORN ON THE ROAD: brute-force distance to the ribbon vs what the game's lookup said
    if (f && Math.abs(f.off) < hw - 0.2 && f.s > sp.s0 + 5 && f.s < sp.s1 - 5) { let bd = Infinity, bi = -1; const sg = g.level.subtrack.segs;
      for (let i = 0; i < sg.length; i++) { const q = sg[i]; if (q.ghost) continue; let t = ((x - q.ax) * q.dx + (y - q.ay) * q.dy) / (q.l2 || 1); t = Math.max(0, Math.min(1, t)); const d = Math.hypot(x - q.ax - t * q.dx, y - q.ay - t * q.dy); if (d < bd) { bd = d; bi = i; } }
      const car = g.car, cf = HW.roadFrame(g.level, car.x, car.y, null), own = [g.car, ...g.ai.map((a) => a.car), ...g.traffic.cars].map((v) => Math.hypot(v.x - x, v.y - y)).sort((a, b) => a - b)[0];
      onRoad.push({ k, was: c.orig, s: f.s | 0, off: +f.off.toFixed(1), brute: +bd.toFixed(2), bseg: bi, nsegs: sg.length, game: birth.get(k).qd, carS: cf ? cf.s | 0 : null, nearestCar: +own.toFixed(1), t: ((performance.now() - t0) / 1000) | 0 }); }
    return set0(k, c); };
  const onRoad = [];
  const hw = g.level._hw.geo.hw;
  const t0 = performance.now();
  const iv = setInterval(() => {
    scans++; let n = 0; maxCells = Math.max(maxCells, L.wearMap.size);
    const q = g.level._hw.q, s = q ? q.s : null;
    for (const [key, c] of L.wearMap) {
      if (c.current === c.orig) continue;
      const x = (c.cx + 0.5) * L.WEAR_CELL, y = (c.cy + 0.5) * L.WEAR_CELL, f = HW.roadFrame(g.level, x, y, s);
      if (!f || Math.abs(f.off) > hw - L.WEAR_CELL / 2) continue;   // centre at least half a cell inside the edge
      { const sp = HW.roadSpan(g.level); if (f.s < sp.s0 + 5 || f.s > sp.s1 - 5) continue; }   // outside the window: roadFrame clamps, off is junk
      n++;
      if (!seen.has(key) && seen.size < 3) { const q = L.querySubtrack(g.level.subtrack, x, y), lv = g.level;
        const pat = (lv.allPatches || []).filter((pp) => Math.hypot(pp.x - x, pp.y - y) < Math.max(pp.w, pp.h)).map((pp) => pp.surface.id + ':' + (pp.src || '') + ':' + pp.w.toFixed(1));
        const lan = (lv.lanes || []).length, zs = lv.zones.filter((z) => Math.hypot(z.x - x, z.y - y) < Math.hypot(z.w, z.h) / 2).map((z) => z.surface.id + (z.field ? '#f' : ''));
        console.log('DIAG', JSON.stringify({ seed: lv.seed, x, y, qd: q.dist, w: lv.subtrack.width, secs: lv.subtrack.sectors && lv.subtrack.sectors.length, cover: L.coverAt(x, y), pat, nPatches: (lv.allPatches || []).length, zs, lan, clean: L.cleanAt(x, y), zone: L.zoneSurfaceAt(x, y).id })); }
      if (!seen.has(key)) seen.set(key, { orig: c.orig, now: c.current, clean: L.cleanAt(x, y), off: +f.off.toFixed(1), s: f.s | 0, zone: L.zoneSurfaceAt(x, y).id, born: birth.get(key), win: [HW.roadSpan(g.level).s0 | 0, HW.roadSpan(g.level).s1 | 0], t: ((performance.now() - t0) / 1000) | 0 });
    }
    worst = Math.max(worst, n);
    if (performance.now() - t0 > SEC * 1000) { clearInterval(iv); res({ worst, scans, maxCells, km: g.hwDist / 1000, list: [...seen.values()].slice(0, 12), total: seen.size, hw, onRoad: onRoad.slice(0, 15), onRoadN: onRoad.length }); }
  }, 1000);
}), SEC);
console.log(`${PRESET} ${SEC}s ${r.km.toFixed(1)} km | half width ${r.hw} | wear map max ${r.maxCells} | worn cells ON the road: worst at once ${r.worst}, distinct ${r.total}`);
for (const c of r.list) console.log('  ', JSON.stringify(c));
console.log(`cells BORN on the carriageway: ${r.onRoadN}`);
for (const c of r.onRoad) console.log('  born', JSON.stringify(c));
console.log('errors', errs.length ? errs.slice(0, 3).join(' || ') : 'none');
console.log(r.total ? 'DIRT ON ROAD' : 'ALL OK');
await b.close();
