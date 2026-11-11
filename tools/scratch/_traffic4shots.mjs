// _traffic4shots.mjs - THE TRAFFIC'S MANNERS in the real game (?moveover=1, ?roadrage=1,
// ?stationstops=1): WHAT=moveover - the autopilot with 2 stars held (?police=1), a photo once a car
// near you moves over for the chaser behind it; WHAT=rage - the car ahead of you in your lane
// flashed 3 times (the LIGHTS toggled), a photo once the angry car is close; WHAT=pumps - the dual
// carriageway, a photo once a car stands at a station's pumps near you.
// WHAT=moveover|rage|pumps [VIEW=844x390] node tools/scratch/_traffic4shots.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const WHAT = process.env.WHAT || 'moveover';
// (the pumps: the autopilot held to 50 km/h - the traffic comes past and stops ahead of you)
const QUERY = { moveover: '&autopilot=1&police=1&moveover=1', rage: '&autopilot=1&roadrage=1',
  pumps: '&autopilot=50&stationstops=1' };
const ROAD = { moveover: 'motorway', rage: 'motorway', pumps: 'dual' };
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
const shot = async (page, name) => {
  const path = `tools/scratch/_traffic4-${name}-${width}x${height}.png`;
  await page.screenshot({ path });
  console.log('photo', path);
};
// waits (polling every 200 ms, up to seconds) for a page test to be true
const until = async (page, test, seconds, arg) => {
  for (let waited = 0; waited < seconds * 5; waited++) {
    const found = await page.evaluate(test, arg);
    if (found) return found;
    await page.waitForTimeout(200);
  }
  return null;
};
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${QUERY[WHAT]}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'countryside', traffic: 0.6 }), ROAD[WHAT]);
  await page.waitForTimeout(4000);
  if (WHAT === 'moveover') {
    await page.evaluate(() => {
      window.__holder = setInterval(() => {
        const orders = window.__game.traffic.police(), heat = orders.heats.get(window.__game.car);
        if (!heat) return;
        heat.stars = Math.max(heat.stars, 2);
        heat.escapeT = 0;
      }, 50);
    });
    const found = await until(page, () => {
      const game = window.__game, car = game.car, list = game.traffic.list;
      const cops = list.filter((slot) => !slot.parked && slot.police?.mode === 'chase');
      const slot = list.find((each) => !each.parked && !each.police && (each.dir ?? 1) > 0
        && ((each.laneT < each.lane) || (each.edge ?? 0) < -0.6)
        && Math.hypot(each.car.x - car.x, each.car.y - car.y) < 45
        && cops.some((cop) => each.s - cop.s > 0 && each.s - cop.s < 90));
      return slot ? { lane: slot.lane, laneT: slot.laneT, edge: slot.edge ?? 0 } : null;
    }, 120);
    console.log('moving over:', JSON.stringify(found));
    await shot(page, 'moveover');
  }
  if (WHAT === 'rage') {
    // a car ahead in your lane within 50 m, then the LIGHTS on and off six times
    const ahead = await until(page, () => {
      const game = window.__game, here = game.level._hw.q;
      return game.traffic.list.some((slot) => !slot.parked && !slot.police && (slot.dir ?? 1) > 0
        && slot.s - here.s > 10 && slot.s - here.s < 50 && Math.abs(slot.off - here.off) < 1.6);
    }, 120);
    for (let flick = 0; flick < 6; flick++) {
      await page.evaluate(() => { window.__game.car.lightsOn = !window.__game.car.lightsOn; });
      await page.waitForTimeout(250);
    }
    const angry = await until(page, () => {
      const game = window.__game, car = game.car;
      const slot = game.traffic.list.find((each) => !each.parked && each.police?.angry);
      return slot && Math.hypot(slot.car.x - car.x, slot.car.y - car.y) < 25 ? true : null;
    }, 40);
    console.log('a car ahead:', ahead, 'angry and close:', angry);
    await shot(page, 'rage-a');
    await page.waitForTimeout(110);
    await shot(page, 'rage-b');
  }
  if (WHAT === 'pumps') {
    // a roadside station ahead (the autopilot on to one), then you held at the roadside short of it
    // and a car put at its pumps - as mayPlaceAtPump does (the station's middle, 5.2 m in) -
    // left to the fuel stop's own code: waiting, then pulling out
    const station = await until(page, () => {
      const game = window.__game, car = game.car;
      return game.level.props.findIndex((prop) => prop.kind === 'gasstation'
        && Math.hypot(prop.x - car.x, prop.y - car.y) < 250
        && (prop.x - car.x) * car.vx + (prop.y - car.y) * car.vy > 0) + 1 || null;
    }, 400);
    const placed = station && await page.evaluate(async (index) => {
      const game = window.__game, level = game.level, prop = level.props[index - 1];
      const { roadFrame, roadPose } = await import('/src/highway.ts');
      const frame = roadFrame(level, prop.x, prop.y, prop._s), stopOff = frame.off + 5.2;
      game.setAutopilot(false);
      // (you on the forecourt's edge 25 m short of it, the traffic cleared from round you)
      const you = roadPose(level, frame.s - 25, -level._hw.geo.hw - 1.5), car = game.car;
      Object.assign(car, { x: you.x, y: you.y, heading: you.h, vx: 0, vy: 0, yawRate: 0 });
      game.traffic.clearAround(you.x, you.y, 30);
      const slot = game.traffic.list.find((each) => !each.parked && !each.police && !each.broke
        && (each.dir ?? 1) > 0);
      const pump = roadPose(level, frame.s, stopOff);
      Object.assign(slot.car, { x: pump.x, y: pump.y, heading: pump.h, vx: 0, vy: 0 });
      Object.assign(slot, { s: frame.s, off: stopOff, lane: 0, laneT: 0, laneOff: stopOff,
        kOff: stopOff, vAl: 0, stationAt: frame.s, broke: { stopOff, v: 0, off: stopOff,
          stopped: true, at: frame.s, wait: 8, out: false } });
      window.__pumpSlot = slot;
      return { s: Math.round(frame.s), off: +frame.off.toFixed(1) };
    }, station);
    console.log('station:', JSON.stringify(placed));
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    await shot(page, 'pumps');
    const out = await until(page, () => window.__pumpSlot.broke?.out || !window.__pumpSlot.broke
      ? true : null, 30);
    await page.waitForTimeout(1500);
    console.log('pulling out:', out, JSON.stringify(await page.evaluate(() => ({
      broke: !!window.__pumpSlot.broke, indicator: window.__pumpSlot.car.indicator }))));
    await shot(page, 'pumps-out');
    await page.keyboard.up('Space');
  }
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
