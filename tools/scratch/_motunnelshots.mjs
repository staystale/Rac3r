// _motunnelshots.mjs - MOANACO'S TUNNEL in the live game (VenueSpec.tunnel: the race road's own
// underpass round its bend, world/crossings.ts bentTunnel): the player car put down before the
// tunnel's mouth after Portier and driven through by the demo driver, a phone-size shot every
// SHOT_S s (into the open cut, hidden under the hotels, out at the far mouth), with what the game
// says at each: the car's level (crossing), its race progress and its distance along the lap.
// node tools/scratch/_motunnelshots.mjs [query] (env VIEW, ZOOM, SHOTS, SHOT_S, KMH; CHECK_PORT)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = ''] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.6), SHOTS = +(process.env.SHOTS || 12);
const SHOT_S = +(process.env.SHOT_S || 0.9), KMH = +(process.env.KMH || 70);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=moanaco&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.launch('moanaco', window.__game.car.spec.id, { ai: 0 }));
  // (past the start's lights: a car on the grid is held until the green)
  await page.waitForTimeout(+(process.env.SETTLE_MS || 9000));
  for (const leg of ['tunnel']) {
    await page.evaluate(async ([which, kmh]) => {
      const game = window.__game, sub = game.level.subtrack, span = sub.under[0];
      // (out of Portier, before the tunnel's mouth)
      const at = span.d0 - 22;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      // (mended: a hit on one leg is not carried to the next)
      const { repair } = await import('/src/damage.ts');
      repair(game.car);
      const speed = kmh / 3.6;
      // (put down as the game resets a car: its height on the ground there, then rolling)
      const { reset } = await import('/src/vehicle.ts');
      game.car.crossing = -1;
      reset(game.car, best.x, best.y, best.heading);
      Object.assign(game.car, { vx: speed * Math.cos(best.heading), vy: speed * Math.sin(best.heading) });
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(sub);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
    }, [leg, KMH]);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    for (let shot = 0; shot < SHOTS; shot++) {
      await page.waitForTimeout(SHOT_S * 1000);
      const state = await page.evaluate(async () => {
        const game = window.__game, car = game.car, sub = game.level.subtrack;
        const { querySubtrack, onGroundQuery } = await import('/src/world/tyrewall.ts');
        const way = car.crossing ?? -1, crossing = way >= 0 ? game.level.crossings[way] : null;
        const hit = onGroundQuery(() => querySubtrack(sub, car.x, car.y));
        // what is nearest the car: a barrier, a solid, a loose object (a hit's cause)
        const seg = (pts, px, py) => { let best = Infinity; for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
          const share = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(px - ax - dx * share, py - ay - dy * share)); } return best; };
        let wall = { kind: '-', d: Infinity };
        for (const b of game.level.barriers || []) { const d = seg(b.pts, car.x, car.y); if (d < wall.d) wall = { kind: b.kind, d: +d.toFixed(1) }; }
        let solid = { kind: '-', d: Infinity };
        for (const s of game.level.solids || []) { const d = Math.hypot(s.x - car.x, s.y - car.y); if (d < solid.d) solid = { kind: s.kind || '?', d: +d.toFixed(1), r: s.r, w: s.w, h: s.h }; }
        return { level: crossing ? (crossing.track ? 'UNDERPASS' : crossing.kind) : 'ground',
          wall, solid, at: [+car.x.toFixed(1), +car.y.toFixed(1)], hit: car._hitKind || null,
          along: Math.round(hit.trackDist), prog: game.trackD == null ? null
            : Math.round(game.trackD), kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6),
          held: !!(game.start && game.start.on && !game.start.green) };
      });
      const name = `tools/scratch/_motunnel-${shot}-${viewW}x${viewH}.png`;
      await page.screenshot({ path: name });
      console.log(leg, shot, JSON.stringify(state));
    }
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
