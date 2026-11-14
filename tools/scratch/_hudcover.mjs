// _hudcover.mjs - IS THE PLAYER'S CAR EVER UNDER THE HUD? Every mode (circuit, rallycross, rally
// stage, highway with traffic, free drive in the Lab) at the common phone sizes, both
// orientations, touch controls on. The game runs deterministically (tools/lib/determinism.mjs)
// with the world layers skipped (the camera, the car's pose and the HUD are what matter); the
// game's autopilot drives the player car (?autopilot=1; the Lab: a held circle). Every SAMPLE frames, inside the HUD's own draw,
// the HUD is drawn again into a clear layer and the car's footprint (its length x width, turned
// to its heading, where the camera puts it) is read against it: a footprint pixel under a HUD
// pixel (alpha >= 32) is COVERED. Per run: samples, samples with any cover, the worst share of
// the car covered, and what covered it (layout rects by name, the pedals, else 'other').
// node tools/scratch/_hudcover.mjs [sizes] [modes]   sizes like 844x390,390x844 (default: all
// ten); modes from circuit,rx,stage,highway,free,hw-twisty,hw-canyon,hw-interstate,hw-walled
// (default all). RAC3R_QUERY adds switches (hudclear=1: the fix).
// Exit 1 when any sample is covered.
import { launchBrowser, startServer, extraQuery } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';
import { gotoGame } from '../lib/browser.mjs';

const SIZES = (process.argv[2] || '844x390,390x844,667x375,375x667,932x430,430x932,915x412,'
  + '412x915,740x360,360x740').split(',').map((size) => size.split('x').map(Number));
const MODES = {
  circuit: ['thruston', { ai: 3 }],
  rx: ['knobhill', { ai: 3, rx: true }],
  stage: ['gen-forest-medium-mixed-1001', { ai: 0 }],
  highway: ['highway', { ai: 3, traffic: 1, litter: 1.5 }],
  free: ['lab', { ai: 0 }],
  'hw-twisty': ['highway', { ai: 0, road: 'twisty', traffic: 1 }],
  'hw-canyon': ['highway', { ai: 3, road: 'dual', scenery: 'canyon', traffic: 1 }],
  'hw-interstate': ['highway', { ai: 0, road: 'interstate', traffic: 1 }],
  'hw-walled': ['highway', { ai: 3, road: 'walled', traffic: 1 }],
};
const modeIds = (process.argv[3] || Object.keys(MODES).join(',')).split(',');
// fake frames a run (60 a s); the highways longer (FRAMES_HW): their bends come every km or so
const FRAMES = Number(process.env.FRAMES || 2700), SAMPLE = Number(process.env.SAMPLE || 6),
  WARM = 420,
  FRAMES_HW = Number(process.env.FRAMES_HW || 5400);

/** Page side: wrap the HUD's draw so a sample can be asked for (window.__cover). */
async function installCover() {
  const { shared } = await import('/src/game/state.ts');
  const { PEDAL } = await import('/src/input.ts');
  const draw = shared.hud.draw;
  const cover = { want: false, samples: 0, covered: 0, worst: 0, by: {}, where: [],
    box: [Infinity, Infinity, -Infinity, -Infinity], fastest: 0, hudPx: 0, carPx: 0,
    drawn: 0, last: null, step: null, maxJerk: 0, jerkAt: 0, appear: 0, jumps: [] };
  // THE VIEW'S SMOOTHNESS: the car's place on screen every frame; the jerk is the change of its
  // per-frame move (px / frame / frame): a camera jump shows as a spike
  const track = (game) => {
    const renderer = shared.renderer;
    const here = [renderer.toScreenX(game.car.x), renderer.toScreenY(game.car.y)];
    if (cover.last && !shared.renderer.flying) {
      const step = [here[0] - cover.last[0], here[1] - cover.last[1]];
      if (cover.step && cover.drawn > 60) {
        const jerk = Math.hypot(step[0] - cover.step[0], step[1] - cover.step[1]);
        if (jerk > cover.maxJerk) { cover.maxJerk = jerk; cover.jerkAt = cover.drawn; }
        // every jump over 4 px (a teleport - a reset - shows here on both sides of a comparison)
        if (jerk > 4 && cover.jumps.length < 12) cover.jumps.push([cover.drawn, Math.round(jerk)]);
      }
      cover.step = step;
    }
    cover.last = here;
  };
  // APPEAR=<draw>: the car's aid chips vanish at that drawn frame and come back 120 frames on
  // (a piece that goes and comes, as on a car change)
  const appearAt = window.__appear || 0;
  const aidsKept = { value: null };
  window.__cover = cover;
  const named = (x, y, width, height) => {
    const rects = shared.hud.layout(width, height);
    for (const [name, rect] of Object.entries(rects)) {
      if (rect && rect.w > 0 && x >= rect.x && x <= rect.x + rect.w && y >= rect.y
        && y <= rect.y + rect.h) return name;
    }
    const pedalX = width - PEDAL.margin - PEDAL.r, pedalY = height - PEDAL.margin - PEDAL.r;
    const pedals = [[pedalX, pedalY], [pedalX, pedalY - 2 * PEDAL.r - PEDAL.gap],
      [pedalX - 2 * PEDAL.r - PEDAL.gap, pedalY],
      [pedalX - 2 * PEDAL.r - PEDAL.gap, pedalY - 2 * PEDAL.r - PEDAL.gap]];
    if (pedals.some(([px, py]) => Math.hypot(x - px, y - py) <= PEDAL.r + 2)) return 'pedals';
    return 'other';
  };
  const measure = (game, width, height) => {
    const layer = document.createElement('canvas');
    layer.width = width; layer.height = height;
    draw(layer.getContext('2d'), game, width, height, 0);
    const alpha = layer.getContext('2d').getImageData(0, 0, width, height).data;
    const car = game.car, renderer = shared.renderer, ppm = renderer.PPM;
    const centreX = renderer.toScreenX(car.x), centreY = renderer.toScreenY(car.y);
    const halfL = (car.spec.len || 4.3) * ppm / 2, halfW = (car.spec.wid || 1.8) * ppm / 2;
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    let total = 0, hit = 0, first = null;
    for (let along = -halfL; along <= halfL; along += 1) {
      for (let across = -halfW; across <= halfW; across += 1) {
        const x = Math.round(centreX + along * cos - across * sin);
        const y = Math.round(centreY + along * sin + across * cos);
        total++;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (alpha[(y * width + x) * 4 + 3] < 32) continue;
        hit++;
        if (!first) first = [x, y];
      }
    }
    cover.samples++;
    cover.box = [Math.min(cover.box[0], centreX), Math.min(cover.box[1], centreY),
      Math.max(cover.box[2], centreX), Math.max(cover.box[3], centreY)].map(Math.round);
    cover.fastest = Math.max(cover.fastest, Math.round(Math.hypot(car.vx, car.vy)));
    cover.carPx = Math.max(cover.carPx, Math.round(2 * halfL));
    let opaque = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] >= 32) opaque++;
    cover.hudPx = Math.max(cover.hudPx, opaque);
    if (!hit) return;
    cover.covered++;
    if (hit / total > cover.worst) cover.worstAt = cover.frame;
    cover.worst = Math.max(cover.worst, hit / total);
    const name = named(first[0], first[1], width, height);
    cover.by[name] = (cover.by[name] || 0) + 1;
    if (cover.where.length < 8) {
      cover.where.push([Math.round(centreX), Math.round(centreY), name, cover.frame,
        Math.round((100 * hit) / total)]);
    }
  };
  shared.hud.draw = (ctx, game, width, height, wallDt) => {
    draw(ctx, game, width, height, wallDt);
    cover.drawn++;
    if (appearAt && cover.drawn === appearAt) {
      aidsKept.value = game.car.spec.aids;
      game.car.spec.aids = null;
    }
    if (appearAt && cover.drawn === appearAt + 120) game.car.spec.aids = aidsKept.value;
    if (game.car) track(game);
    if (!cover.want || shared.renderer.flying || !game.car) return;
    cover.want = false;
    measure(game, width, height);
  };
}

/** Page side: the Lab has no road to follow: a held circle at a cruising throttle. */
function installCircle() {
  window.__game.input.update = () => ({ steer: 0.35, throttle: 0.7, brake: 0, handbrake: 0,
    reverse: 0, shiftUp: false, shiftDown: false });
}

/** One mode at one size: the cover statistics. */
async function runOne(browser, base, [width, height], modeId) {
  const [level, opts] = MODES[modeId];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${base}/?touch=1&guide=0&menu=0&rules=0&level=${level}`
    + `&skip=world,ground,car${level === 'lab' ? '' : '&autopilot=1'}${extraQuery()}`,
    'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate(() => window.__rt.seed(7));
  await page.evaluate(launchLevel, [level, opts]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate((at) => { window.__appear = at; }, Number(process.env.APPEAR || 0));
  await page.evaluate(installCover);
  if (level === 'lab') await page.evaluate(installCircle);
  await page.evaluate((count) => window.__rt.step(count), WARM);
  const frames = process.env.AT ? Number(process.env.AT) : level === 'highway' ? FRAMES_HW
    : FRAMES;
  for (let frame = WARM; frame < frames; frame += SAMPLE) {
    await page.evaluate(([count, at]) => {
      window.__cover.want = true;
      window.__cover.frame = at;
      window.__rt.step(count);
    }, [SAMPLE, frame + SAMPLE]);
  }
  // AT=<frame> with SHOT: the world drawn again for a photo at that frame
  if (process.env.AT) {
    await page.evaluate(async () => {
      const { shared } = await import('/src/game/state.ts');
      shared.settings.skipLayers.clear();
      window.__rt.step(40);
      // the player's car outlined (magenta) so the photo shows which car and where
      const car = window.__game.car, renderer = shared.renderer, ppm = renderer.PPM;
      const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
      const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([along, across]) => {
        const dx = along * car.spec.len / 2, dy = across * car.spec.wid / 2;
        return `${renderer.toScreenX(car.x + dx * cos - dy * sin)},${
          renderer.toScreenY(car.y + dx * sin + dy * cos)}`;
      });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;'
        + 'pointer-events:none;z-index:9');
      svg.innerHTML = `<polygon points="${corners.join(' ')}" fill="none" stroke="#ff00ff"
        stroke-width="2"/>`;
      document.body.appendChild(svg);
    });
  }
  if (process.env.SHOT) {
    const tag = process.env.AT ? `-${process.env.AT}${extraQuery() ? '-on' : '-off'}` : '';
    await page.screenshot({ path: `${process.env.SHOT}/_hudcover-${modeId}-${width}x${height}${tag}.png` });
  }
  const result = await page.evaluate(() => window.__cover);
  await context.close();
  return { ...result, errors };
}

const server = await startServer();
const browser = await launchBrowser();
let anyCovered = 0;
try {
  for (const size of SIZES) {
    for (const modeId of modeIds) {
      const res = await runOne(browser, server.url, size, modeId);
      anyCovered += res.covered;
      console.log(`${size.join('x').padEnd(8)} ${modeId.padEnd(8)} samples ${res.samples}`
        + ` covered ${res.covered} worst ${(100 * res.worst).toFixed(0)}% (frame ${res.worstAt}) by `
        + `${JSON.stringify(res.by)} at ${JSON.stringify(res.where)} centre box ${JSON.stringify(res.box)}`
        + ` car ${res.carPx} px, top ${res.fastest} m/s, HUD ${res.hudPx} px, jerk max ${
          res.maxJerk.toFixed(1)} px at draw ${res.jerkAt}, jumps >4 px ${JSON.stringify(res.jumps)}`
        + (res.errors.length ? ` ERRORS ${res.errors[0]}` : ''));
    }
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(anyCovered ? `COVERED in ${anyCovered} samples` : 'never covered');
process.exitCode = anyCovered ? 1 : 0;
