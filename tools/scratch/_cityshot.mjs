// _cityshot.mjs - GETAWAY STOCKHOLM (?stockholm, highway/city.ts) on the autopilot: a photo at the
// game's own zoom at each road distance in SHOTS as it drives the city and green stretches; at each
// what is laid (lots, buildings - old houses, churches -, noise walls, streets, blue signs, trees),
// the stretch, the speed and the car's offset off the centre line; page errors.
// [VIEW=390x844] [SHOTS=300,800,...] [ROAD=motorway] [TRAFFIC=0] [Q=&x=1]
// node tools/scratch/_cityshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const shots = (process.env.SHOTS || '300,900,1500,2100,2700').split(',').map(Number);
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
    const res = await page.evaluate(() => {
      const game = window.__game, level = game.level, hwQ = level._hw?.q, car = game.car;
      const blocks = level.props.filter((prop) => prop.kind === 'block' && prop.field != null);
      return { dist: Math.round(hwQ?.s ?? 0), off: +(hwQ?.off ?? 0).toFixed(1),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), scenery: level.scenery,
        theme: level._cfg.theme,
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
    await page.screenshot({ path: `tools/scratch/_city${process.env.TAG || ''}-${target}-`
      + `${width}x${height}.png` });
    console.log(target, JSON.stringify(res));
  }
  console.log('worst offset', worst.toFixed(1));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
