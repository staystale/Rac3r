// edgecheck.mjs - does the track's white edge line move rigidly with the world, or does it jiggle?
// The real game at phone size (844x390, dpr 3), deterministic (renderhash's fake clock), the demo
// driver at speed, only the ground drawn (cars, props and the HUD skipped). Each frame the finished
// picture (GPU ground canvas + screen canvas) is read, and at every track point in view the white
// line's profile is sampled across the line. Per point: where the line's centre is drawn compared
// with where the camera puts it (offset, device px) and how much white it has (area, device px of
// full white). A rigid, smooth picture keeps both steady from one frame to the next; a jiggle shows
// as frame-to-frame changes. Frame pairs are split by what the zoom did: held, moved within a tile
// step, or changed step; frames that drew a stand-in tile are counted apart. JAGGEDNESS: within one
// frame, how far each point's centre and white area stray from those of its neighbours along the
// line. A line moving rigidly can still crawl: a stepped (staircase) edge sliding along a slanted
// line makes the edge at a fixed spot on screen hop by a step as each stair passes.
// node tools/edgecheck.mjs [--only brands-snatch,naffcar] [--frames 300] [--warm 240] [--control]
//   --control: measure a perfect line drawn over the frame instead (the tool's noise floor)
import { startServer, launchBrowser, extraQuery } from './lib/browser.mjs';
import {
  openPage, launchLevel, installDriver, onlyList, SETTLE_MS,
} from './lib/determinism.mjs';

const LEVELS = ['brands-snatch', 'castle-cum', 'naffcar'];
const CPU_RASTER_ARGS = [
  '--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];

/**
 * The value of a command line option.
 * @param {string} name option name such as "--frames"
 * @param {string} fallback value when the option is absent
 * @returns {string} the value
 */
function option(name, fallback) {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
}

/**
 * Page side: steps the game frame by frame and measures the white edge line in each frame. The
 * CONTROL draws a perfect line (the same width and white, at screen resolution, placed by the true
 * camera) 1 m inside the road edge over each finished frame and measures that instead: it moves
 * rigidly by construction, so its numbers are the tool's own noise over the real ground.
 * @param {[number, boolean]} args how many frames to measure, and whether to measure the control
 * @returns {{frames: object[]}} per frame: zoom (px per metre), tile step, stand-in flag and the
 *   samples {key, offset, area}
 */
function measureFrames([frames, control]) {
  const game = window.__game, renderer = game.renderer, sub = game.level.subtrack;
  const screen = document.getElementById('c'), ground = document.getElementById('glground');
  const picture = document.createElement('canvas');
  picture.width = screen.width;
  picture.height = screen.height;
  const gfx = picture.getContext('2d', { willReadFrequently: true });
  const blockPx = Math.max(2, Math.round(1.3 * Math.min(2, devicePixelRatio)));
  // the game's line is 0.22 m wide, its centre 0.2 m inside the road edge (road.ts
  // strokeRibbonEdge); the profile runs 0.32 m inward and 0.16 m outward, so both of its ends lie
  // on the road
  const lineInsetMetres = sub.width / 2 - (control ? 1 : 0.2), marginPx = 24;
  const inwardMetres = 0.32, outwardMetres = 0.16;
  const rows = [];
  // the control line along both sides, as strokeRibbonEdge strokes the game's
  const drawControlLine = () => {
    const devPerMetre = renderer.PPM * renderer.dpr * blockPx;
    const centreX = renderer.dpr * renderer.W / 2 * blockPx;
    const centreY = renderer.dpr * renderer.H / 2 * blockPx;
    gfx.strokeStyle = 'rgba(255,255,255,0.72)';
    gfx.lineWidth = 0.22 * devPerMetre;
    for (const side of [1, -1]) {
      gfx.beginPath();
      for (const point of [...sub.pts, sub.pts[0]]) {
        gfx.lineTo((point.x + side * point.nx * lineInsetMetres - renderer.cam.x) * devPerMetre
          + centreX, (point.y + side * point.ny * lineInsetMetres - renderer.cam.y)
          * devPerMetre + centreY);
      }
      gfx.stroke();
    }
  };
  for (let frame = 0; frame < frames; frame++) {
    window.__rt.step(1);
    gfx.clearRect(0, 0, picture.width, picture.height);
    if (ground) gfx.drawImage(ground, 0, 0);
    gfx.drawImage(screen, 0, 0);
    if (control) drawControlLine();
    const pixels = gfx.getImageData(0, 0, picture.width, picture.height).data;
    const devPerMetre = renderer.PPM * renderer.dpr * blockPx;
    const centreX = renderer.dpr * renderer.W / 2 * blockPx;
    const centreY = renderer.dpr * renderer.H / 2 * blockPx;
    // whiteness of a device pixel, bilinear: the smallest channel (white is high in all three;
    // tarmac grey is lower, grass and red kerb are low in at least one)
    const whiteAt = (x, y) => {
      const left = Math.floor(x), top = Math.floor(y), fracX = x - left, fracY = y - top;
      const at = (px, py) => {
        const index = (py * picture.width + px) * 4;
        return Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
      };
      const upper = at(left, top) * (1 - fracX) + at(left + 1, top) * fracX;
      const lower = at(left, top + 1) * (1 - fracX) + at(left + 1, top + 1) * fracX;
      return upper * (1 - fracY) + lower * fracY;
    };
    const samples = [];
    sub.pts.forEach((point, index) => {
      for (const side of [1, -1]) {
        const worldX = point.x + side * point.nx * lineInsetMetres;
        const worldY = point.y + side * point.ny * lineInsetMetres;
        const screenX = (worldX - renderer.cam.x) * devPerMetre + centreX;
        const screenY = (worldY - renderer.cam.y) * devPerMetre + centreY;
        const reachPx = inwardMetres * devPerMetre, outPx = outwardMetres * devPerMetre;
        if (screenX < marginPx + reachPx || screenY < marginPx + reachPx
          || screenX > picture.width - marginPx - reachPx
          || screenY > picture.height - marginPx - reachPx) continue;
        const profile = [], stepPx = 0.25;
        for (let along = -reachPx; along <= outPx; along += stepPx) {
          profile.push([along, whiteAt(screenX + side * point.nx * along,
            screenY + side * point.ny * along)]);
        }
        // the road under the line: the median of the inward tail (the line is 0.11 m half wide
        // plus about a pixel of blend), so one speckle of the road texture does not move it
        const tailPx = 0.18 * devPerMetre;
        const tail = profile.filter((entry) => entry[0] < -tailPx).map((entry) => entry[1])
          .sort((first, second) => first - second);
        const road = tail[Math.floor(tail.length / 2)];
        const peak = Math.max(...profile.map((entry) => entry[1]));
        // a drawn line: clearly whiter than the road beside it
        if (peak - road < 40) continue;
        let weight = 0, moment = 0;
        for (const [along, white] of profile) {
          if (along < -tailPx) continue;
          const above = Math.max(0, white - road);
          weight += above;
          moment += above * along;
        }
        samples.push({ key: index * 2 + (side > 0 ? 0 : 1), offset: moment / weight,
          area: weight * stepPx / 255 });
      }
    });
    rows.push({ ppm: renderer.PPM, step: renderer.tileStats.lastStep,
      standIn: renderer.standInFrame, kph: Math.hypot(game.car.vx, game.car.vy) * 3.6, samples });
  }
  return { frames: rows };
}

/**
 * A percentile of a list of numbers.
 * @param {number[]} values the numbers
 * @param {number} fraction 0..1
 * @returns {number} the value at that fraction, or NaN for an empty list
 */
function percentile(values, fraction) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(fraction * (sorted.length - 1))];
}

/**
 * Compares each frame with the one before, point by point, and groups the changes by what the
 * zoom did between the two frames.
 * @param {object[]} frames the page's rows
 * @returns {Map<string, {pairs: number, moves: number[], areas: number[]}>} per group
 */
function compareFrames(frames) {
  const groups = new Map();
  for (let at = 1; at < frames.length; at++) {
    const before = frames[at - 1], now = frames[at];
    const zoomRatio = now.ppm / before.ppm;
    const group = now.standIn || before.standIn ? 'stand-in'
      : now.step !== before.step ? 'step change'
        : Math.abs(zoomRatio - 1) < 1e-9 ? 'zoom held' : 'zoom moving';
    if (!groups.has(group)) groups.set(group, { pairs: 0, moves: [], areas: [] });
    const entry = groups.get(group);
    entry.pairs++;
    const earlier = new Map(before.samples.map((sample) => [sample.key, sample]));
    for (const sample of now.samples) {
      const old = earlier.get(sample.key);
      if (!old) continue;
      // the line's centre moves with the zoom about its own centre: compare offsets as drawn
      entry.moves.push(Math.abs(sample.offset - old.offset * zoomRatio));
      // the width scales with the zoom
      entry.areas.push(100 * Math.abs(sample.area / (old.area * zoomRatio) - 1));
    }
  }
  return groups;
}

/**
 * Within each frame, how far each sample strays from its neighbours along the line (the mean of
 * the samples before and after it on the same side): the centre in device px, the white area in %.
 * @param {object[]} frames the page's rows
 * @returns {{centres: number[], areas: number[]}} every sample's stray
 */
function measureJaggedness(frames) {
  const centres = [], areas = [];
  for (const frame of frames) {
    const byKey = new Map(frame.samples.map((sample) => [sample.key, sample]));
    for (const sample of frame.samples) {
      const before = byKey.get(sample.key - 2), after = byKey.get(sample.key + 2);
      if (!before || !after) continue;
      centres.push(Math.abs(sample.offset - (before.offset + after.offset) / 2));
      const around = (before.area + after.area) / 2;
      areas.push(100 * Math.abs(sample.area / around - 1));
    }
  }
  return { centres, areas };
}

/**
 * Measures one level and prints its table.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {string} id level id
 * @returns {Promise<void>} resolves when printed
 */
async function runLevel(browser, base, id) {
  const errors = [];
  const page = await openPage(browser, base, id, errors, '&skip=world,car,hud' + extraQuery());
  // the same start as renderhash: a key press, the launch, and a real wait for the start's timer
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate(launchLevel, [id, { ai: 0 }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installDriver);
  await page.evaluate((frames) => window.__rt.step(frames), +option('--warm', '240'));
  const { frames } = await page.evaluate(measureFrames,
    [+option('--frames', '300'), process.argv.includes('--control')]);
  await page.context().close();
  if (errors.length) throw new Error(`${id}: page error: ${errors[0]}`);
  const samples = frames.reduce((sum, frame) => sum + frame.samples.length, 0);
  const steps = [...new Set(frames.map((frame) => frame.step))].join(',');
  const speeds = frames.map((frame) => frame.kph);
  console.log(`${id}: ${frames.length} frames, ${(samples / frames.length).toFixed(0)} line `
    + `samples a frame, tile steps ${steps}, ${percentile(speeds, 0).toFixed(0)}-`
    + `${percentile(speeds, 1).toFixed(0)} km/h`);
  console.log('  group          pairs   centre move px (med p95 max)   white area % (med p95 max)');
  const show = (values) => [0.5, 0.95, 1].map((fraction) =>
    percentile(values, fraction).toFixed(2).padStart(6)).join(' ');
  const jagged = measureJaggedness(frames);
  console.log(`  jaggedness           ${show(jagged.centres)}          ${show(jagged.areas)}`);
  for (const [group, entry] of compareFrames(frames)) {
    console.log(`  ${group.padEnd(13)} ${String(entry.pairs).padStart(6)}   ${show(entry.moves)}`
      + `          ${show(entry.areas)}`);
  }
}

/**
 * Runs the levels asked for (--only), default LEVELS.
 * @returns {Promise<void>} resolves when done
 */
async function main() {
  const ids = onlyList() || LEVELS;
  const server = await startServer();
  let browser;
  try {
    browser = await launchBrowser({ args: CPU_RASTER_ARGS });
    for (const id of ids) await runLevel(browser, server.url, id);
  } finally {
    await browser?.close();
    server.stop();
  }
}

await main();
