// _cityshot.mjs - GETAWAY STOCKHOLM (?stockholm, highway/city.ts) on the autopilot: a photo at the
// game's own zoom in the middle of the first stretch of each kind (highway/cityplan.ts: the city,
// a tunnel, the water, raised, a cutting, a park) or at each road distance in SHOTS; at each what
// is laid in the window (lots, buildings, parked cars, noise walls, tunnel slats, water, yachts,
// litter, signs, trees), the stretch, the speed and the car's offset; page errors.
// [VIEW=390x844] [SHOTS=300,800,...] [ROAD=motorway] [TRAFFIC=0] [Q=&x=1]
// node tools/scratch/_cityshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
let shots = process.env.SHOTS ? process.env.SHOTS.split(',').map(Number) : null;
const ROAD = process.env.ROAD || 'motorway';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&stockholm=1${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, traffic]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'stockholm', traffic, weather: { mode: 'dry', season: 2, seed: 4 } }),
  [ROAD, +(process.env.TRAFFIC || 0)]);
  // (the middle of the first stretch of each kind past 300 m, on the road's seed)
  shots ||= await page.evaluate(async () => {
    const { cityStretchAt } = await import('/src/highway/cityplan.ts');
    const seed = window.__game.level.seed, found = new Map();
    for (let dist = 300; dist < 20000 && found.size < 6; dist += 20) {
      const stretch = cityStretchAt(dist, seed);
      if (!found.has(stretch.kind) && stretch.along > 40)
        found.set(stretch.kind, Math.round(dist - stretch.along + stretch.len / 2));
    }
    return [...found.values()].sort((a, b) => a - b);
  });
  let worst = 0;
  for (const target of shots) {
    for (let waited = 0; waited < 120; waited += 0.25) {
      const now = await page.evaluate(() => {
        const hwQ = window.__game.level._hw?.q;
        return { dist: hwQ?.s ?? 0, off: hwQ?.off ?? 0 };
      });
      worst = Math.max(worst, Math.abs(now.off));
      if (now.dist >= target) break;
      await page.waitForTimeout(250);
    }
    await page.evaluate(async () => {
      const { cityStretchAt } = await import('/src/highway/cityplan.ts');
      window.__city = (dist) => cityStretchAt(dist, window.__game.level.seed).kind;
    });
    const res = await page.evaluate(() => {
      const game = window.__game, level = game.level, hwQ = level._hw?.q, car = game.car;
      const blocks = level.props.filter((prop) => prop.kind === 'block' && prop.field != null);
      const count = (kind) => level.props.filter((prop) => prop.kind === kind).length;
      const loose = game.cones?.list || game.cones?.objs || [];
      return { dist: Math.round(hwQ?.s ?? 0), off: +(hwQ?.off ?? 0).toFixed(1),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), scenery: level.scenery,
        stretch: window.__city(hwQ?.s ?? 0), parked: count('parkedcar'), slats: count('slat'),
        yachts: count('yacht'), water: level.covers.filter((cover) => cover.water).length,
        litter: loose.filter((obj) => ['bin', 'box', 'crate', 'pallet', 'sandbag', 'cone']
          .includes(obj.kind)).length,
        lots: level.zones.filter((zone) => zone.surface?.id === 'concrete' && zone.field != null)
          .length,
        buildings: blocks.length, old: blocks.filter((prop) => prop.house).length,
        churches: blocks.filter((prop) => prop.church).length,
        walls: level.barriers.filter((bar) => bar.kind === 'wall' && bar.field != null).length,
        streets: level.lanes.filter((lane) => lane.field != null).length,
        signs: level.props.filter((prop) => prop.kind === 'board' && !/EXIT|SERVICES/.test(
          prop.label || '')).map((prop) => (prop.blue ? 'B:' : '') + prop.label).slice(-3),
        trees: level.props.filter((prop) => prop.kind === 'tree').length };
    });
    await page.screenshot({ path: `tools/scratch/_city${process.env.TAG || ''}-${res.stretch}-`
      + `${width}x${height}.png` });
    console.log(target, JSON.stringify(res));
  }
  console.log('worst offset', worst.toFixed(1));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
