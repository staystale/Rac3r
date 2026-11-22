// _hillshot.mjs - SPIKES PEAK AT THE GAME'S ZOOM (?hillclimb; highway/hillplan.ts), the real game:
// the E36 Peak on the autopilot up the hill climb, a photo at its first hairpin, in its first
// esses, on the outside of its first bend with a drop, and at the summit's finish (5 km on); at
// each the road kind, the car's speed and height, the props round it; page errors.
// [VIEW=390x844] [Q=&night=0.8] [TAG=] node tools/scratch/_hillshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);

/** Page side: where the car is. */
function readHere() {
  const game = window.__game, level = game.level, car = game.car, q = level._hw?.q;
  const pts = level._hw.pts, near = pts.find((point) => point.s >= (q?.s ?? 0));
  const count = (kind) => level.props.filter((prop) => prop.kind === kind
    && Math.hypot(prop.x - car.x, prop.y - car.y) < 120).length;
  return { s: Math.round(q?.s ?? 0), kind: near?.tag ?? 'straight',
    kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), z: +(car.z ?? 0).toFixed(1),
    trees: count('tree'), rocks: count('rock'), marshals: count('marshal'),
    armco: level.barriers.filter((bar) => bar.kind === 'armco').length };
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&hillclimb=1${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__game.launch('highway', 'bmv-e36peak', { ai: 0, traffic: 0,
    road: 'twisty', scenery: 'peak', weather: { mode: 'dry', season: 2, seed: 4 } }));
  // (the spots, found as the road is laid: a hairpin's apex, the esses, a bend's drop, the summit)
  const spots = { hairpin: null, esses: null, drop: null, summit: null }, shot = {};
  for (let waited = 0; waited < 400; waited += 0.25) {
    const done = await page.evaluate((found) => {
      const level = window.__game.level;
      // (the launch still loading)
      if (!level?._hw?.pts) return { found, at: 0 };
      const pts = level._hw.pts, at = level._hw.q?.s ?? 0;
      const curv = (i) => {
        const turn = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)
          - Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
        return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) / 4;
      };
      for (let i = 1; i < pts.length - 1; i++) {
        const point = pts[i];
        if (!found.hairpin && point.tag === 'switchbacks' && curv(i) > 1 / 22) found.hairpin = point.s;
        if (!found.esses && point.tag === 'esses' && curv(i) > 1 / 80) found.esses = point.s;
        if (!found.drop && (point.tag === 'sweepers' || point.tag === 'esses')
          && curv(i) > 1 / 150 && level.roadside?.(point.s, -15, level._hw.geo.hw, point) < -10)
          found.drop = point.s;
      }
      found.summit = 300 + 5000 - 15;
      return { found, at };
    }, spots);
    Object.assign(spots, done.found);
    const next = Object.entries(spots).find(([name, s]) => s !== null && !shot[name]
      && done.at >= s);
    if (next) {
      const [name] = next;
      shot[name] = true;
      const here = await page.evaluate(`(${readHere.toString()})()`);
      await page.screenshot({ path: `tools/scratch/_hill-${name}-${width}x${height}`
        + `${process.env.TAG || ''}.png` });
      console.log(name, JSON.stringify(here));
    }
    if (shot.summit) break;
    await page.waitForTimeout(250);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
