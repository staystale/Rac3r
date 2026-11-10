// _junkcount.mjs - DEAF VALLEY'S ROADSIDE AS THE PLAYER SEES IT, BY KIND (owner 11-10: "I'm not seeing
// much road side junk on Death Valley levels and never seen a cow skull cactus should be in patches
// too and more single ones spread out"): the autopilot down the canyon road (ROAD) for SECONDS at
// phone size; every half second the props and loose objects in view, counted once each by kind -
// a km of road's worth, and how far past the road's edge they stood (median). Q adds a query.
// [LITTER=0..3] [ROAD=twisty] [SCENERY=canyon] [KINDS=a,b] [SECONDS=120] [Q=] node tools/scratch/_junkcount.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'twisty', SECONDS = +(process.env.SECONDS || 120);
const KINDS = (process.env.KINDS || 'skull,tumbleweed,crate,barrel,tyre,tyrestack,shack,wreck,cactus,'
  + 'barrelcactus').split(','), SCENERY = process.env.SCENERY || 'canyon';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + (process.env.Q || ''));
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery, litter]) => window.__game.launch('highway', 'hatch-rwd', { ai: 0,
    road, scenery, traffic: 0, ...(litter === '' ? {} : { litter: +litter }) }), [ROAD, SCENERY,
    process.env.LITTER ?? '']);
  await page.waitForTimeout(2000);
  const seen = new Map(), km = { at: 0 };
  for (let t = 0; t < SECONDS; t += 0.5) {
    const got = await page.evaluate((kinds) => {
      const game = window.__game, [x0, y0, x1, y1] = game.renderer.viewBounds,
        hw = game.level._hw.geo.hw, pts = game.level._hw.pts;
      const off = (x, y) => {
        let best = Infinity;
        for (let i = 0; i < pts.length; i += 2) best = Math.min(best, (x - pts[i].x) ** 2
          + (y - pts[i].y) ** 2);
        return Math.sqrt(best) - hw;
      };
      const out = [];
      for (const obj of [...game.level.props, ...game.cones.list])
        if (kinds.includes(obj.kind) && obj.x > x0 && obj.x < x1 && obj.y > y0 && obj.y < y1)
          out.push([`${obj.kind}:${(obj.hx ?? obj.x).toFixed(0)},${(obj.hy ?? obj.y).toFixed(0)}`,
            obj.kind, off(obj.hx ?? obj.x, obj.hy ?? obj.y)]);
      return { out, km: (game.hwDist || 0) / 1000 };
    }, KINDS);
    for (const [key, kind, past] of got.out) if (!seen.has(key)) seen.set(key, { kind, past });
    km.at = got.km;
    await page.waitForTimeout(500);
  }
  const rows = KINDS.map((kind) => {
    const list = [...seen.values()].filter((rec) => rec.kind === kind).map((rec) => rec.past)
      .sort((low, high) => low - high);
    return `${kind} ${(list.length / Math.max(0.1, km.at)).toFixed(1)}/km`
      + (list.length ? ` (${list[list.length >> 1].toFixed(0)} m out)` : '');
  });
  const all = [...seen.values()].length;
  console.log(`${ROAD} ${SCENERY}${process.env.Q || ''} litter ${process.env.LITTER ?? '-'}, ${km.at.toFixed(2)} km: ${rows.join(', ')}; all ${(all
    / Math.max(0.1, km.at)).toFixed(1)}/km`);
} finally {
  await browser.close();
  server.stop();
}
