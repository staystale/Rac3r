// _aiweave.mjs - K3 (owner 11-01): AI slow down and weave as if at an invisible obstacle
// (Thruston, the menu race's track, and others). A 5-car race (you on the autopilot + 4 AI,
// difficulty 3 like the menu) for 120 s: every 0.1 s each AI's speed vs its target and what it was
// reacting to - a car ahead (follow cap), an object (dodge), a mistake, an attack / cover, off its
// line. Slow moments (speed < 80 % of its line speed there) are grouped by lap metre and cause.
// node tools/scratch/_aiweave.mjs [level] [seconds] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'thruston', secs = +(process.argv[3] || 120), extra = process.argv[4] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1${extra}`);
  await page.evaluate((lv) => window.__game.launch(lv, 'hatch-rwd', { ai: 4, diff: 3, laps: 0 }), level);
  await page.mouse.click(420, 200);
  await page.waitForTimeout(6000);
  const res = await page.evaluate(async (secs) => {
    const g = window.__game, { querySubtrack } = await import('/src/world/tyrewall.ts');
    const sub = g.level.subtrack, line = g.level._line;
    const out = { samples: 0, slow: 0, causes: {}, spots: {}, obstKinds: {} };
    const last = new Map();
    for (let i = 0; i < secs * 10; i++) {
      await new Promise((r) => setTimeout(r, 100));
      for (const e of g.ai) {
        const car = e.car, st = e.drv.state, v = Math.hypot(car.vx, car.vy);
        const lineV = line && line.pts[st.i] && line.pts[st.i].v ? line.pts[st.i].v : st.vT;
        out.samples++;
        const prev = last.get(e) || { obst: 0 };
        const dodging = (st.obst || 0) > prev.obst;
        last.set(e, { obst: st.obst || 0 });
        if (!(v < 0.8 * (st.vT || lineV)) || v < 3 && e.hurtWait != null) continue;
        out.slow++;
        const cause = e.hurtWait != null ? 'hurt' : st.follow ? 'following a car' : dodging ? 'dodging an object'
          : st.mist ? 'mistake' : st.atk ? 'attack' : st.cover ? 'cover' : (st.lastDist || 0) > 2.5 ? 'off its line'
          : 'none of these';
        out.causes[cause] = (out.causes[cause] || 0) + 1;
        const d = Math.round(querySubtrack(sub, car.x, car.y).trackDist / 25) * 25;
        const key = d + ' m ' + cause;
        out.spots[key] = (out.spots[key] || 0) + 1;
        if (dodging) for (const o of e.obs || []) {
          const k = (g.cones.list.find((c) => c.x === o.x && c.y === o.y) || {}).kind || '?';
          out.obstKinds[k] = (out.obstKinds[k] || 0) + 1;
        }
      }
    }
    out.spots = Object.entries(out.spots).sort((a, b) => b[1] - a[1]).slice(0, 12);
    return out;
  }, secs);
  console.log(level, JSON.stringify(res, null, 1));
} finally { await browser.close(); server.stop(); }
