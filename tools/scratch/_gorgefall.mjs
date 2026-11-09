// _gorgefall.mjs - a car driven over a DEAF VALLEY gorge's unguarded lip (highway/gorge.ts: the
// ground falling DEPTH m over FALL m, owner 11-09 "so you can crash fall in it"): the hatch put on
// the HIGH road's open side heading off at SPEED km/h, then each 0.25 s its distance off the
// centre line, the ground height under it, its body height (z) and airtime, speed, rolled or not,
// damage; and whether the highway put it back on the road. Page errors.
// [SPEED=70] node tools/scratch/_gorgefall.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const speed = Number(process.env.SPEED || 70) / 3.6;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&canyon=1`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: 'canyon' }));
  // a road seed whose first HIGH stretch falls open (no Armco) on a side
  console.log('seed', await page.evaluate(async () => {
    const { ledgeOf } = await import('/src/highway/gorge.ts');
    const level = window.__game.level;
    for (let seed = 1; seed < 500; seed++) if ([-1, 1].some((side) => ledgeOf(0, side, seed).drop
      && !ledgeOf(0, side, seed).armco)) { level.seed = seed; break; }
    window.__game.restart();
    return level.seed;
  }));
  await page.waitForTimeout(1500);
  // a point on the HIGH road whose side falls with no Armco, within the window
  const spot = await page.evaluate(async (fwd) => {
    const game = window.__game, level = game.level, road = level._hw.pts;
    const { gorgeAt, ledgeOf } = await import('/src/highway/gorge.ts');
    const { stretchAt } = await import('/src/highway/desertplan.ts');
    for (let i = 5; i < road.length - 5; i++) {
      const st = stretchAt(road[i].s, level._hw.seed);
      if (st.kind !== 'high') continue;
      for (const side of [-1, 1]) {
        const cut = gorgeAt(road[i].s, side, level._hw.seed);
        if (!cut || cut.ease < 0.99 || ledgeOf(st.index, side, level._hw.seed).armco) continue;
        const hdg = Math.atan2(road[i + 1].y - road[i - 1].y, road[i + 1].x - road[i - 1].x);
        // on the road edge's lane, turned 35 deg off the road toward the drop
        const off = side * 2, turn = hdg + side * 0.6;
        // (game.reset puts a highway car back at its respawn: the car is moved directly)
        Object.assign(game.car, { x: road[i].x - Math.sin(hdg) * off, y: road[i].y + Math.cos(hdg) * off,
          heading: turn, vx: Math.cos(turn) * fwd, vy: Math.sin(turn) * fwd, yawRate: 0, groundInit: false,
          roll: null });
        return { s: Math.round(road[i].s), side, depth: +cut.depth.toFixed(1) };
      }
    }
    return null;
  }, speed);
  console.log('spot', JSON.stringify(spot));
  if (!spot) throw new Error('no open drop in the window');
  for (let step = 0; step < 24; step++) {
    await page.waitForTimeout(250);
    const row = await page.evaluate(async () => {
      const game = window.__game, car = game.car, q = game.level._hw.q;
      return { s: Math.round(q?.s ?? 0), off: +(q?.off ?? 0).toFixed(1), ground: +(car.groundF ?? 0).toFixed(1), hook: +game.level.roadside(q.s, q.off, game.level.subtrack.width / 2).toFixed(1), surf: car.surface?.id, zF: +(car.zF ?? 0).toFixed(1),
        z: +(car.z ?? 0).toFixed(1), air: +(car.air ?? 0).toFixed(2),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), roll: car.roll ? car.roll.phase : '-', rolls: car._rolls || 0,
        dmg: +(car.dmgBill || 0).toFixed(0), notice: game.notice?.text || '' };
    });
    console.log(((step + 1) * 0.25).toFixed(2), JSON.stringify(row));
    if (step === 7) await page.screenshot({ path: 'tools/scratch/_gorgefall-2s.png' });
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
