// _pittunnelshots.mjs - YASS MARINA'S PIT EXIT TUNNEL in the live game (VenueSpec.pitTunnel,
// world/venuecross.ts pitTunnelPortals): the player car put down on the pit road before the tunnel
// and driven through it by pure pursuit down the pit lanes (the 9 m lanes chained, as
// _pitdrive.mjs), a phone-size shot every SHOT_S s (into the cut, hidden under the track, out up
// the far ramp), with what the game says at each: the car's level (crossing), its speed, the
// nearest barrier and solid, and its distance along the pit path.
// node tools/scratch/_pittunnelshots.mjs [query] (env VIEW, ZOOM, SHOTS, SHOT_S, BACK_M, KMH;
// CHECK_PORT)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'yasmarina=1'] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.6), SHOTS = +(process.env.SHOTS || 10);
const SHOT_S = +(process.env.SHOT_S || 0.8), BACK_M = +(process.env.BACK_M || 45);
const KMH = +(process.env.KMH || 40);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=yasmarina&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.launch('yasmarina', window.__game.car.spec.id, { ai: 0 }));
  // (past the start's lights: a car on the grid is held until the green)
  await page.waitForTimeout(+(process.env.SETTLE_MS || 9000));
  await page.evaluate(async ({ back, kmh }) => {
    const game = window.__game, level = game.level;
    const { YASMARINA_SPEC } = await import('/src/world/levels/yasmarina-venue.ts');
    const { a, b } = YASMARINA_SPEC.pitTunnel;
    // the pit path: the 9 m lanes chained end to end, each the way round that meets the last
    const pieces = level.lanes.filter((lane) => lane.width === 9).map((lane) => lane.pts);
    const path = [...pieces.shift()];
    const gap = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    while (pieces.length) {
      const last = path[path.length - 1];
      pieces.sort((p, q) => Math.min(gap(p[0], last), gap(p[p.length - 1], last))
        - Math.min(gap(q[0], last), gap(q[q.length - 1], last)));
      const next = pieces.shift();
      path.push(...(gap(next[0], last) <= gap(next[next.length - 1], last) ? next : next.slice().reverse()));
    }
    const lengthAt = [0];
    for (let i = 1; i < path.length; i++) lengthAt.push(lengthAt[i - 1] + gap(path[i], path[i - 1]));
    // put down BACK_M before the tunnel's first mouth
    let mouth = 0;
    path.forEach((point, i) => { if (gap(point, a) < gap(path[mouth], a)) mouth = i; });
    let from = mouth;
    while (from > 0 && lengthAt[mouth] - lengthAt[from] < back) from--;
    const head = Math.atan2(path[from + 2][1] - path[from][1], path[from + 2][0] - path[from][0]);
    const { repair } = await import('/src/damage.ts');
    repair(game.car);
    const { reset } = await import('/src/vehicle.ts');
    game.car.crossing = -1;
    reset(game.car, path[from][0], path[from][1], head);
    const limit = kmh / 3.6;
    Object.assign(game.car, { vx: limit * Math.cos(head), vy: limit * Math.sin(head) });
    let idx = from;
    window.__pitPath = { path, lengthAt, mouth, b };
    game.input.update = () => {
      const car = game.car;
      for (let k = idx; k < Math.min(path.length, idx + 40); k++)
        if (gap(path[k], [car.x, car.y]) < gap(path[idx], [car.x, car.y])) idx = k;
      let aim = idx;
      while (aim < path.length - 1 && lengthAt[aim] - lengthAt[idx] < 8) aim++;
      const want = Math.atan2(path[aim][1] - car.y, path[aim][0] - car.x);
      const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
      const speed = Math.hypot(car.vx, car.vy);
      window.__pitPath.idx = idx;
      return { steer: Math.max(-1, Math.min(1, err * 2)), throttle: speed < limit ? 0.6 : 0,
        brake: speed > limit + 1 ? 0.4 : 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false };
    };
  }, { back: BACK_M, kmh: KMH });
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
  for (let shot = 0; shot < SHOTS; shot++) {
    await page.waitForTimeout(SHOT_S * 1000);
    const state = await page.evaluate(() => {
      const game = window.__game, car = game.car, pit = window.__pitPath;
      const way = car.crossing ?? -1, crossing = way >= 0 ? game.level.crossings[way] : null;
      const seg = (pts, px, py) => { let best = Infinity; for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
        const share = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(px - ax - dx * share, py - ay - dy * share)); } return best; };
      let wall = { kind: '-', d: Infinity };
      for (const bar of game.level.barriers || []) { const d = seg(bar.pts, car.x, car.y); if (d < wall.d) wall = { kind: bar.kind, d: +d.toFixed(1) }; }
      let solid = { d: Infinity };
      for (const s of game.level.solids || []) { const d = Math.hypot(s.x - car.x, s.y - car.y); if (d < solid.d) solid = { d: +d.toFixed(1), w: s.w, h: s.h }; }
      return { level: crossing ? crossing.kind : 'ground', at: [+car.x.toFixed(1), +car.y.toFixed(1)],
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), wall, solid, hit: car._hitKind || null,
        pathM: Math.round(pit.lengthAt[pit.idx] - pit.lengthAt[pit.mouth]) };
    });
    const name = `tools/scratch/_pittunnel-${shot}-${viewW}x${viewH}.png`;
    await page.screenshot({ path: name });
    console.log(shot, JSON.stringify(state));
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
