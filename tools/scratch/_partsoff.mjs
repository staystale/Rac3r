// _partsoff.mjs - a car STANDING WITH ITS PANELS OFF, in the game (the Lab, dry, daylight), close
// up at 844x390 and 390x844: what each hole shows (render/carparts.ts withoutParts; with
// ?underskin=1 render/underskin.ts). Two sets, each its own shot: FRONT - the bonnet, the front
// bumper and both front wings; REAR - the boot lid (or nothing), the rear bumper, both rear wings
// and a door. An open car loses its wings (bumpers) and sidepods (panels) the same way.
// node tools/scratch/_partsoff.mjs [cars] [query]    OUT=<folder> (default tools/scratch/partsoff)
// tools/newcar.mjs runs it for one car.
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [carsArg = 'hatch-rwd', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch/partsoff';
// the phone shots: CSS px and a phone's device px per CSS px; then the close-up (one per set)
const SHOTS = [
  { name: '844x390', width: 844, height: 390, dpr: 3, zoom: null },
  { name: '390x844', width: 390, height: 844, dpr: 3, zoom: null },
  { name: 'close', width: 844, height: 390, dpr: 8, zoom: 1.2, clip: 110 },
];
// (an open car - a single-seater, the buggy - loses its wings / nose as 'bumpers', its sidepods
// as 'panels': world/debris.ts)
const SETS = {
  front: (bits, open) => (open ? ['bumper:0', 'panel:0']
    : [bits.front === 'bonnet' ? 'bonnet:0' : '', 'bumper:0', 'wing:0', 'wing:1']),
  rear: (bits, open) => (open ? ['bumper:2', 'panel:1']
    : [bits.rear === 'boot' ? 'boot:2' : '', 'bumper:2', 'wing:2', 'wing:3', 'panel:1']),
};

/** Page side: the car in the Lab, still, its set of parts off; the camera pinned if asked. */
async function standWithPartsOff([id, lost, zoom]) {
  const game = window.__game;
  game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
  await new Promise((done) => setTimeout(done, 1500));
  const car = game.car;
  car.vx = 0; car.vy = 0; car.heading = 0;
  car.partLost = lost;
  if (zoom) game.renderer.debugZoom(zoom);
  await new Promise((done) => setTimeout(done, 600));
  return { lost: car.partLost };
}

/**
 * One shot of one car with one set off.
 * @returns {Promise<string[]>} page errors
 */
async function shoot(browser, base, carId, setName, lost, shot) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.dpr });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${base}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query ? '&' + query : ''}`);
  await page.mouse.click(shot.width / 2, shot.height / 2);
  await page.waitForTimeout(1200);
  await page.evaluate(standWithPartsOff, [carId, lost, shot.zoom]);
  const file = `${OUT}/_partsoff-${carId}-${setName}-${shot.name}.png`;
  // (the close-up: the car at the screen's middle, the camera on it)
  const clip = shot.clip ? { x: shot.width / 2 - shot.clip / 2, y: shot.height / 2 - shot.clip / 3,
    width: shot.clip, height: Math.round(shot.clip * 2 / 3) } : undefined;
  await page.screenshot({ path: file, clip });
  console.log(`${file} ${lost}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
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
  for (const carId of carsArg.split(',')) {
    for (const [setName, partsOf] of Object.entries(SETS)) {
      const kind = ROSTER.find((row) => row.id === carId)?.kind;
      const lost = partsOf(bitsOf(carId), kind === 'track' || kind === 'grass').filter(Boolean)
        .join(',');
      for (const shot of SHOTS) {
        if ((await shoot(browser, server.url, carId, setName, lost, shot)).length) failed = true;
      }
    }
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
