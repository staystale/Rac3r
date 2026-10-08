// gridcheck.mjs — START GRIDS (user, 2026-10-05: "check grid starts, I think they're wonky / place the player too close to other cars /
// not in a starting grid formation"). For each level: launch VS AI x5 through the real launch path (several times: the player's slot is
// random), read every car's pose while held at the lights, and report: the closest pair (box gap), each car's slot as (metres back from
// the front car along the road, lateral offset), and whether the player is in the formation. node tools/gridcheck.mjs [levels,comma]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const levels = (process.argv[2] || 'thruston,brands-gp,test-track,knobhill,slidden,naffcar,castle-cum').split(',');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0'); await p.mouse.click(400, 200); await p.waitForTimeout(2500);
const ids = await p.evaluate(() => window.__game.level && (window.__LV = 1) && null);
for (const id of levels) {
  for (let run = 0; run < 3; run++) {
    const r = await p.evaluate(async (id) => {
      const g = window.__game, L = await import('/src/lab.js'); if (!L.LEVELS.some((l) => l.id === id)) return { err: 'no level ' + id };
      g.launch(id, g.car.spec.id, { ai: 5, diff: 2 }); await new Promise((r) => setTimeout(r, 400));
      const sub = g.level.subtrack, cars = [g.car, ...g.ai.map((a) => a.car)];
      const pose = cars.map((c, i) => { const q = L.querySubtrack(sub, c.x, c.y), pt = sub.pts[q.seg ?? 0], off = pt ? (c.x - pt.x) * pt.nx + (c.y - pt.y) * pt.ny : 0;
        return { who: i ? 'AI' + i : 'YOU', d: q.trackDist, off, x: c.x, y: c.y, h: c.heading, len: c.spec.len, wid: c.spec.wid }; });
      // box gap between two cars (separating axis, approximate: centre distance minus half extents along the joining line)
      const gap = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, D = Math.hypot(dx, dy) || 1, ux = dx / D, uy = dy / D;
        const ext = (c) => Math.abs(Math.cos(c.h) * ux + Math.sin(c.h) * uy) * c.len / 2 + Math.abs(-Math.sin(c.h) * ux + Math.cos(c.h) * uy) * c.wid / 2; return D - ext(a) - ext(b); };
      let min = Infinity, pair = ''; for (let i = 0; i < pose.length; i++) for (let j = i + 1; j < pose.length; j++) { const gg = gap(pose[i], pose[j]); if (gg < min) { min = gg; pair = pose[i].who + '-' + pose[j].who; } }
      const T = sub.totalDist, front = Math.max(...pose.map((q) => ((q.d - pose[0].d + T * 1.5) % T) - T / 2));
      return { rolling: !!g.level.rollingStart, slot: g.car._slot, min, pair,
        grid: pose.map((q) => `${q.who}:${(front - (((q.d - pose[0].d + T * 1.5) % T) - T / 2)).toFixed(1)}m/${q.off >= 0 ? '+' : ''}${q.off.toFixed(1)}`).join('  ') };
    }, id);
    if (r.err) { console.log(id, r.err); break; }
    console.log(`${id.padEnd(11)} slot ${r.slot}${r.rolling ? ' (rolling)' : ''} | closest ${r.pair} ${r.min.toFixed(2)} m | back/lateral: ${r.grid}`);
  }
}
console.log('page errors:', errs.length ? [...new Set(errs)].join(' / ') : 'none');
await b.close();
