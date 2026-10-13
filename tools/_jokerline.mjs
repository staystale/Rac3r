// _jokerline.mjs — the Knobhill JOKER detection (2026-10-07, user: "easy to come off the road shoot wide ... it doesn't detect you've done
// it, and then when you do it again it gives penalty for multiple jokers"). The real game: crossings of the joker lane at the gate at many
// offsets across it (the lane is 12 m wide), and a few that must NOT count (the main road; far outside). Then the ONCE-A-LAP rule: drive
// over the line, reverse back over it, over it again -> 1 joker. node tools/_jokerline.mjs [base]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const base = (process.argv[2] || '').replace(/^live$/, '');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'BAD  ') + m); if (!c) bad++; };
for (const lv of ['knobhill', 'slidden-hill']) {
  await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=${lv}`); await p.touchscreen.tap(422, 195); await p.waitForTimeout(2500);
  const r = await p.evaluate(async (lv) => {
    const g = window.__game, L = await import(document.querySelector('script[type=module]') ? new URL('src/lab.js', location.href).href : '/src/lab.js');
    const J = L.LEVEL.joker, lane = (L.LEVEL.lanes || []).find((n) => n.out == null && n.pts.some(([x, y]) => (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2 < J.gate.r * J.gate.r * 4));
    let k = 0, bd = Infinity; lane.pts.forEach(([x, y], i) => { const d = (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2; if (d < bd) { bd = d; k = i; } });
    const a = lane.pts[k - 2], c = lane.pts[k + 2], l = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / l, ty = (c[1] - a[1]) / l, nx = -ty, ny = tx;
    const sub = L.LEVEL.subtrack, cross = (s) => { const x = J.gate.x + nx * s, y = J.gate.y + ny * s; return g.crossedJoker(x - tx * 2, y - ty * 2, x + tx * 2, y + ty * 2); };
    const offs = [], onRoad = [];
    for (let s = -24; s <= 24; s += 1) { const x = J.gate.x + nx * s, y = J.gate.y + ny * s, q = L.querySubtrack(sub, x, y); offs.push([s, cross(s), +(q.dist - sub.width / 2).toFixed(1)]); }
    // the old circle, for comparison
    const old = offs.filter(([s]) => Math.abs(s) < J.gate.r).length;
    return { laneW: lane.width, offs, old };
  }, lv);
  const hit = r.offs.filter((o) => o[1]).map((o) => o[0]), roadHit = r.offs.filter((o) => o[1] && o[2] <= 0);
  ok(hit.length >= r.laneW + 8, `${lv}: crossings counted at ${hit.length} of 49 offsets (${Math.min(...hit)}..${Math.max(...hit)} m across a ${r.laneW} m lane; the old circle: ${r.old})`);
  ok(roadHit.length === 0, `${lv}: none counted ON the main road (${roadHit.length})`);
}
// ONCE A LAP, in the live loop: Knobhill, drive the car across the gate, back, across again
await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=knobhill`); await p.touchscreen.tap(422, 195); await p.waitForTimeout(2500);
const n = await p.evaluate(async () => {
  const g = window.__game, c = g.car, L = await import(new URL('src/lab.js', location.href).href), J = L.LEVEL.joker, w = (ms) => new Promise((r) => setTimeout(r, ms));
  const lane = (L.LEVEL.lanes || []).find((n) => n.out == null && n.pts.some(([x, y]) => (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2 < J.gate.r * J.gate.r * 4));
  let k = 0, bd = Infinity; lane.pts.forEach(([x, y], i) => { const d = (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2; if (d < bd) { bd = d; k = i; } });
  const a = lane.pts[k - 2], b2 = lane.pts[k + 2], l = Math.hypot(b2[0] - a[0], b2[1] - a[1]), tx = (b2[0] - a[0]) / l, ty = (b2[1] - a[1]) / l, nx = -ty, ny = tx;
  const put = (along, side) => { c.x = J.gate.x + tx * along + nx * side; c.y = J.gate.y + ty * along + ny * side; c.vx = 0; c.vy = 0; c.heading = Math.atan2(ty, tx); };
  const before = g.jokers || 0; const seq = [];
  // WIDE: 9 m off the lane's middle (outside the old 7 m circle)
  for (const al of [-3, 3, -3, 3]) { put(al, 9); await w(150); seq.push(g.jokers || 0); }
  return { before, seq };
});
ok(n.seq[0] === n.before && n.seq[1] === n.before + 1, `driven over WIDE (9 m out): counted (${JSON.stringify(n)})`);
ok(n.seq[3] === n.before + 1, `over, back, over again in one lap: still ONE joker (${n.seq[3] - n.before})`);
console.log(`page errors: ${errs.length ? errs.join(' / ') : 'none'}`); if (errs.length) bad++;
console.log(bad ? `JOKERLINE: ${bad} BAD` : 'JOKERLINE: ALL OK');
await b.close();
