// _tunnelshot.mjs - A SLATTED TUNNEL AT THE GAME'S ZOOM, day or night (Q=&night=0.8), the real
// game on the autopilot: GETAWAY STOCKHOLM's first tunnel (WHERE=city: ?stockholm, the endless
// road, traffic) or MOANACO's (WHERE=moanaco: the circuit, AI cars). A photo before its slats, in
// the middle, at the last slat and past the exit; at each the car's place, speed, its lights and
// the field's, the slats / roof zones / street lights loaded, the lit lamps near; page errors.
// [WHERE=city|moanaco] [VIEW=390x844] [TRAFFIC=1] [AI=3] [Q=&night=0.8] [TAG=] [ROAD=motorway]
// [SEQ=10: ten frames 0.2 s apart at the middle] [HAZ=1: every car's hazards on]
// node tools/scratch/_tunnelshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const WHERE = process.env.WHERE || 'city', ROAD = process.env.ROAD || 'motorway';
const NAMES = ['before', 'middle', 'last', 'exit'];

/** Page side: what is at the car now. */
function readHere() {
  const game = window.__game, level = game.level, car = game.car;
  const slats = level.props.filter((prop) => prop.kind === 'slat');
  const lamps = (level.lamps || []).filter((lamp) => Math.hypot(lamp.x - car.x, lamp.y - car.y)
    < 60);
  return { x: +car.x.toFixed(1), y: +car.y.toFixed(1),
    kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), lightsOn: !!car.lightsOn,
    fieldLights: (game.ai || []).filter((entry) => entry.car.lightsOn).length + '/'
      + (game.ai || []).length, slats: slats.length,
    roofs: (level._roofs || []).length, lampsNear: lamps.length,
    lampsLit: lamps.filter((lamp) => lamp.lit !== false && !lamp.broken).length };
}

/**
 * The tunnel's four photo spots as road distances (city) or as slat indices (Moanaco).
 * @param page the page
 * @returns the spots
 */
async function spotsOf(page) {
  if (WHERE === 'city') return page.evaluate(async () => {
    const { cityStretchAt } = await import('/src/highway/cityplan.ts');
    const level = window.__game.level, seed = level._hw?.seed ?? level.seed;
    for (let dist = 300; dist < 30000; dist += 10) {
      const stretch = cityStretchAt(dist, seed);
      if (stretch.kind !== 'tunnel') continue;
      const from = dist - stretch.along, to = from + stretch.len;
      return [from + 35, (from + to) / 2, to - 70, to + 25];
    }
    return null;
  });
  return null;
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const city = WHERE === 'city' ? '&stockholm=1' : '';
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `${city}${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  if (WHERE === 'city') await page.evaluate(([road, traffic, ai]) => window.__game.launch(
    'highway', 'hatch-rwd', { ai, road, scenery: 'stockholm', traffic,
      weather: { mode: 'dry', season: 2, seed: 4 } }),
  [ROAD, +(process.env.TRAFFIC ?? 1), +(process.env.AI ?? 0)]);
  else await page.evaluate((ai) => window.__game.launch('moanaco', 'hatch-rwd', { ai,
    weather: { mode: 'dry', season: 2, seed: 4 } }), +(process.env.AI ?? 3));
  // (the player's own lights on, as a player at night would have them)
  await page.evaluate(() => { window.__game.car.lightsOn = true; });
  const spots = await spotsOf(page);
  for (let shot = 0; shot < 4; shot++) {
    for (let waited = 0; waited < 240; waited += 0.1) {
      const done = await page.evaluate(([where, target, index]) => {
        const game = window.__game, level = game.level, car = game.car;
        if (where === 'city') return (level._hw?.q?.s ?? 0) >= target;
        // Moanaco: the slats the car has passed over (within 4 m) - the first one it reaches, half
        // of them, all but one, then 25 m clear of every slat (whichever way the lap runs)
        const slats = level.props.filter((prop) => prop.kind === 'slat');
        // (a venue loads its map first: no slats yet)
        if (!slats.length) return false;
        const seen = (window.__slatsSeen ||= new Set());
        let best = Infinity;
        slats.forEach((slat, i) => {
          const dist = Math.hypot(slat.x - car.x, slat.y - car.y);
          best = Math.min(best, dist);
          if (dist < 4) seen.add(i);
        });
        if (index === 0) return seen.size >= 1;
        if (index === 1) return seen.size >= slats.length >> 1;
        if (index === 2) return seen.size >= slats.length - 2;
        return best > 25;
      }, [WHERE, spots ? spots[shot] : 0, shot]);
      if (done) break;
      await page.waitForTimeout(100);
    }
    // (HAZ=1: every car's hazards on - an amber glow on a slat top shows at once)
    if (process.env.HAZ) await page.evaluate(() => {
      const game = window.__game;
      for (const car of [...(game.traffic?.cars || []), ...(game.ai || []).map((e) => e.car)])
        car.hazard = true;
    });
    const here = await page.evaluate(`(${readHere.toString()})()`);
    // (SEQ=n at the middle: n frames 0.2 s apart, driving on - a flicker shows frame to frame)
    const frames = shot === 1 && process.env.SEQ ? +process.env.SEQ : 1;
    for (let frame = 0; frame < frames; frame++) {
      if (frame) await page.waitForTimeout(200);
      await page.screenshot({ path: `tools/scratch/_tunnel-${WHERE}${process.env.TAG || ''}-`
        + `${NAMES[shot]}${frames > 1 ? '-f' + String(frame).padStart(2, '0') : ''}-${width}x`
        + `${height}.png` });
    }
    console.log(WHERE, NAMES[shot], JSON.stringify(here));
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
