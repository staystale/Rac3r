// _gridlen.mjs - ?gridlen (game/gridlen.ts): grids laid by length, off and on, in the real game.
// Per case: each car's distance back from the pole along the road (yours marked, its length),
// how many pairs of bodies (a rig's tractor and trailer each a body) stand closer than 1 m;
// whether your trailer touches a barrier or a solid at the start; a photo. Cases:
// the Scanyah towing with 5 AI at Thruston, the school bus with 5 AI (all buses) at Thruston, the
// hatch with 5 AI (unchanged), and the Scanyah towing alone on the Lab (the solo slide).
// node tools/scratch/_gridlen.mjs <dir> [cases]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/gridlen', casesArg = 'rig,bus,hatch,solo'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const CASES = {
  rig: { level: 'thruston', car: 'scanyah-r450', ai: 5 },
  bus: { level: 'thruston', car: 'skool-bus', ai: 5 },
  hatch: { level: 'thruston', car: 'hatch-rwd', ai: 5 },
  solo: { level: 'lab', car: 'scanyah-r450', ai: 0 },
};
const server = await startServer();
const browser = await launchBrowser();

/**
 * One case, one switch setting: the grid as laid.
 * @param name the case
 * @param query the switches
 * @returns its line
 */
async function runCase(name, query) {
  const { level, car, ai } = CASES[name];
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  const out = await page.evaluate(async ([id, carId, count]) => {
    const game = window.__game;
    game.launch(id, carId, { ai: count, laps: 3, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 2500));
    const { querySubtrack } = await import('/src/world/tyrewall.ts');
    const { solidClamp, barrierClamp } = await import('/src/world/barriers.ts');
    const sub = game.level.subtrack, spawn = game.level.spawn;
    const cars = [{ car: game.car, you: true }, ...game.ai.map((entry) => ({ car: entry.car }))];
    const rows = cars.map(({ car, you }) => ({ you: !!you, len: car.spec.len,
      back: sub ? querySubtrack(sub, car.x, car.y).trackDist : 0 }));
    const top = Math.max(...rows.map((row) => row.back));
    rows.forEach((row) => { row.back = top - row.back; });
    rows.sort((one, two) => one.back - two.back);
    // every body's box (a rig's tractor and trailer each), and the pairs closer than 1 m (each box
    // grown 0.5 m: the separating-axis test)
    const boxes = [];
    for (const { car } of cars) {
      boxes.push({ x: car.x, y: car.y, h: car.heading, len: car.spec.len, wid: car.spec.wid });
      if (car.trailer) boxes.push({ x: car.trailer.x, y: car.trailer.y, h: car.trailer.heading,
        len: car.trailer.spec.len, wid: car.trailer.spec.wid, own: boxes.length - 1 });
    }
    const axes = (box) => [[Math.cos(box.h), Math.sin(box.h)], [-Math.sin(box.h), Math.cos(box.h)]];
    const reach = (box, [ax, ay]) => (box.len / 2 + 0.5) * Math.abs(Math.cos(box.h) * ax
      + Math.sin(box.h) * ay) + (box.wid / 2 + 0.5) * Math.abs(-Math.sin(box.h) * ax
      + Math.cos(box.h) * ay);
    let close = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[j].own === i) continue;
      const one = boxes[i], two = boxes[j], dx = two.x - one.x, dy = two.y - one.y;
      const apart = [...axes(one), ...axes(two)].some(([ax, ay]) =>
        Math.abs(dx * ax + dy * ay) > reach(one, [ax, ay]) + reach(two, [ax, ay]));
      if (!apart) close++;
    }
    const least = close;
    let touching = 'no trailer';
    const trailer = game.car.trailer;
    if (trailer) {
      const probe = { ...trailer, vx: 0, vy: 0, spec: { ...trailer.spec } };
      solidClamp(probe);
      barrierClamp(probe);
      touching = Math.hypot(probe.x - trailer.x, probe.y - trailer.y) > 0.01 ? 'TOUCHING' : 'clear';
    }
    const fromSpawn = Math.hypot(game.car.x - spawn.x, game.car.y - spawn.y);
    return { rows: rows.map((row) => `${row.you ? 'YOU' : 'ai'} ${row.back.toFixed(1)}m`
      + `(${row.len.toFixed(1)})`).join(' '), least, touching,
    fromSpawn: fromSpawn.toFixed(1) };
  }, [level, car, ai]);
  const tag = `${name}-${query.includes('gridlen') ? 'on' : 'off'}`;
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  await page.close();
  return `${tag}: ${out.rows} | bodies closer than 1 m ${out.least} | trailer ${out.touching}`
    + ` | you ${out.fromSpawn} m from the spawn` + (errors.length ? ' ERRORS ' + errors[0] : '');
}

try {
  for (const name of casesArg.split(',')) {
    for (const query of ['trailer=1', 'trailer=1&gridlen=1']) {
      console.log(await runCase(name, query));
    }
  }
} finally {
  await browser.close();
  server.stop();
}
