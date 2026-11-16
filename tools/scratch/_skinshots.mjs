// _skinshots.mjs - A DAMAGED CAR, STANDING, as a crash leaves it (dry, daylight): its
// corners crushed and dented as damage.ts leaves them after a ~0.5 hit (crushL end-on, crushS
// side-on) and the parts such a hit knocks off (world/debris.ts) gone, three sets - FRONT (the
// front crushed, the front bumper, a front wing and the bonnet off), SIDE (the +y side caved in,
// its rear door panel and front wing off), REAR (the rear crushed, the rear bumper, a rear wing
// and the boot lid off); an open car (a single-seater, the buggy) its nose / tail and a sidepod.
// Each set at the phone's two sizes (the camera's own zoom) and close up. What a hole shows,
// whether it is see-through, whether a dented panel reads (render/cardamage.ts, render/
// carparts.ts withoutParts, render/underskin.ts with ?underskin=1).
// node tools/scratch/_skinshots.mjs [cars|all] [query]   OUT=<folder> (default tools/scratch/skin)
// LEVEL=<id> (default test-track: the car on tarmac, where a see-through hole shows the road);
// SETS=front,side,rear,dent (DENT: a lighter front knock, nothing off - the dents alone)
// "all" = every car in the roster with the new cars' switches on (pass them in the query too).
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [carsArg = 'hatch-rwd', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch/skin', LEVEL = process.env.LEVEL || 'test-track';
// the sets shot (SETS=front,side,rear,dent; the dent set only when asked)
const WANTED = (process.env.SETS || 'front,side,rear').split(',');
// the phone shots (CSS px, device px per CSS px) and the close-up
const SHOTS = [
  { name: '844x390', width: 844, height: 390, dpr: 3, zoom: null },
  { name: '390x844', width: 390, height: 844, dpr: 3, zoom: null },
  { name: 'close', width: 844, height: 390, dpr: 8, zoom: 1.2, clip: 110 },
  // (CORNER=dx,dy: a closer look at one corner, CSS px off the car's middle)
  ...(process.env.CORNER ? [{ name: 'corner', width: 844, height: 390, dpr: 12, zoom: 1.2, clip: 36,
    off: process.env.CORNER.split(',').map(Number) }] : []),
  // (the phone's own view of the car, cropped round it: what the owner sees, enlarged)
  { name: 'phonecrop', width: 844, height: 390, dpr: 3, zoom: null, clip: 150 },
];
// each set: the crush per damage corner (0, 1 front; odd = +y) end-on and side-on, and the parts
// off (a closed car; an open car's own list)
const SETS = {
  front: { crushL: [0.55, 0.45, 0, 0], crushS: [0.1, 0.05, 0, 0],
    lost: (bits, open) => (open ? ['bumper:0', 'panel:0']
      : ['bumper:0', 'wing:0', bits.front === 'bonnet' ? 'bonnet:0' : '']) },
  side: { crushL: [0, 0.05, 0, 0.05], crushS: [0, 0.5, 0, 0.45],
    lost: (bits, open) => (open ? ['panel:1'] : ['panel:1', 'wing:1']) },
  // (a lighter knock, nothing off: the dented front alone)
  dent: { crushL: [0.35, 0.3, 0, 0], crushS: [0.15, 0.1, 0, 0], lost: () => [] },
  // (the owner's photo: one front corner crushed in to its wheel, nothing off; then steered left,
  // straight, right - the exposed arms turn with the wheel)
  corner: { crushL: [0, 0.6, 0, 0], crushS: [0, 0.35, 0, 0], lost: () => [] },
  cornerleft: { crushL: [0, 0.6, 0, 0], crushS: [0, 0.35, 0, 0], lost: () => [], steer: -1 },
  cornerright: { crushL: [0, 0.6, 0, 0], crushS: [0, 0.35, 0, 0], lost: () => [], steer: 1 },
  rear: { crushL: [0, 0, 0.5, 0.45], crushS: [0, 0, 0.1, 0.05],
    lost: (bits, open) => (open ? ['bumper:2', 'panel:1']
      : ['bumper:2', 'wing:2', bits.rear === 'boot' ? 'boot:2' : '']) },
};

/** Page side: the car in the Lab, still, crushed and with its parts off; the camera pinned. */
async function standDamaged([id, set, zoom, levelId]) {
  const game = window.__game;
  game.launch(levelId, id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
  await new Promise((done) => setTimeout(done, 1500));
  const car = game.car;
  car.vx = 0; car.vy = 0; car.heading = 0;
  // (held steered, the brakes on)
  game.input.update = () => ({ steer: set.steer || 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  car.dmg = set.crushL.map((end, i) => Math.max(end, set.crushS[i]));
  car.crushL = set.crushL.slice();
  car.crushS = set.crushS.slice();
  car.partLost = set.lostList;
  if (zoom) game.renderer.debugZoom(zoom);
  await new Promise((done) => setTimeout(done, 600));
  // (where the car is on the screen, CSS px: the crops are centred on it)
  const renderer = game.renderer, toCss = innerWidth / renderer.W;
  return { lost: car.partLost, x: renderer.toScreenX(car.x) * toCss,
    y: renderer.toScreenY(car.y) * toCss };
}

/**
 * One car's shots at one size, every set in turn on one page (the car launched again for each).
 * @returns {Promise<string[]>} page errors
 */
async function shootSets(browser, base, carId, sets, shot) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.dpr });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${base}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query ? '&' + query : ''}`);
  await page.mouse.click(shot.width / 2, shot.height / 2);
  await page.waitForTimeout(1200);
  for (const [setName, set] of sets) {
    const at = await page.evaluate(standDamaged, [carId, set, shot.zoom, LEVEL]);
    const file = `${OUT}/${carId}-${setName}-${shot.name}.png`;
    if (shot.off) { at.x += shot.off[0]; at.y += shot.off[1]; }
    const clipW = shot.clip, clipH = Math.round((clipW || 0) * 2 / 3);
    const clip = clipW ? { x: Math.max(0, Math.min(shot.width - clipW, at.x - clipW / 2)),
      y: Math.max(0, Math.min(shot.height - clipH, at.y - clipH / 2)), width: clipW,
      height: clipH } : undefined;
    await page.screenshot({ path: file, clip });
    console.log(`${file} ${set.lostList}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
  }
  await page.close();
  return errors;
}

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const { bitsOf } = await import('../../src/carbits.ts');
  const { ROSTER } = await import('../../src/cars.ts');
  const cars = carsArg === 'all' ? ROSTER.map((row) => row.id) : carsArg.split(',');
  for (const carId of cars) {
    const kind = ROSTER.find((row) => row.id === carId)?.kind;
    const sets = Object.entries(SETS).filter(([name]) => WANTED.includes(name)).map(([setName,
      set]) => [setName, { crushL: set.crushL, crushS: set.crushS, steer: set.steer || 0, lostList: set.lost(bitsOf(carId), kind === 'track' || kind === 'grass')
        .filter(Boolean).join(',') }]);
    for (const shot of SHOTS)
      if ((await shootSets(browser, server.url, carId, sets, shot)).length) failed = true;
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
