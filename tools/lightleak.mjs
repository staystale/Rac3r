// lightleak.mjs - A CAR'S LIGHT WHERE IT MUST NOT FALL, at every tunnel and overhead deck: per
// level, the player car is driven at night through each tunnel (a track tunnel along the race
// road, any other along its own line) and under each overhead deck over the race road (a
// footbridge, a road bridge), and stopped at points before, in and past it - at each stop facing
// along the way and turned TURN_RAD toward each side. At each a photo with its lamps off and one
// with them on: the difference is its light. World points round the car are sampled and each lit
// one (its gain over GAIN_MIN in its whole 3x3 px, so the camera's sub-pixel settle on edges does
// not count) is checked against where light must not fall:
//   - on a slatted cover's slats, from any car;
//   - from a car in a straight tunnel: its underground stretch, or past its walls;
//   - from a car in a bent tunnel: past its walls within its cover's box;
//   - from a car on the ground: an overhead deck's top.
// A stop with more than LEAK_POINTS such points is a LEAK (its photo, the leak points marked, is
// kept). And DARK: a car in a tunnel, facing along, lighting almost none of the open road 4-16 m
// ahead (in a cut, between slats) or behind it (its brake lights' glow in the cut it is leaving) -
// its lamps out where they should show.
// node tools/lightleak.mjs [level ...] [query]   (no level: every level; query: e.g. night=0.8)
// (CHECK_PORT; one browser; memory: one page at a time)
import fs from 'node:fs';
import { startServer, launchBrowser } from './lib/browser.mjs';

const args = process.argv.slice(2);
const query = args.find((arg) => arg.includes('=')) || '';
let levelIds = args.filter((arg) => !arg.includes('='));
// rad a stopped car is turned toward each side; m apart the world points are sampled, and how far
// round the car (its light's reach); px gain a lit point has all round it; m round the car's centre
// not sampled (its body, its own lamps)
const TURN_RAD = 0.9, SAMPLE_M = 0.5, REACH_M = 36, GAIN_MIN = 10, BODY_M = 2.6;
// leak points a stop may have (~3 m2 of light): MEASURED on Moanaco, clean stops 0-7 (a beam's soft
// edge on a boundary), the real leaks 52-319
const LEAK_POINTS = 12;
// m a point must lie inside a forbidden area to count: the night layer is drawn at the art
// buffer's blocks, so light up to an edge spills ~one block over it (not a leak)
const EDGE_M = 0.4;
// px of the photo's top and bottom not sampled: the HUD (the LIGHTS button lights with the lamps)
const HUD_TOP_PX = 200, HUD_BOTTOM_PX = 80;
// m past a tunnel's wall face light counts as through the wall (its portal, lintel and cover; a
// lamp-lit barrier further off is not the tunnel's)
const WALL_BAND_M = 6;
// m ahead of the car the road it should light is sampled to (a beam's bright part; at 20 m and past
// it is faint, and under a stadium's floodlights it adds next to nothing)
const AHEAD_M = 16;
// at the stop just under a cover: m behind the car's centre its brake lights sit, and m round them
// their glow is sampled (a photo brakes held against one brakes off; the tail is still in the cut)
const TAIL_BACK_M = 2.1, TAIL_GLOW_M = 1.4;
// the camera's zoom pinned for the photos: out far enough that the road AHEAD_M ahead is on the
// phone-size screen below the HUD (MEASURED: ~14 m at rest, ~17 m at 0.6; 0.30 is the game's own
// zoom at speed)
const ZOOM = 0.35;
// a car in a tunnel, facing along, with this many open (not hidden) points ahead (or a quarter as
// many round its brake lights, just under a cover) and under DARK_SHARE of them lit is DARK: lamps
// out where its light should show (owner 11-12: a car going under The Bird's Mess's crossover lost
// its lights while its tail was still out in the open cut)
const DARK_MIN_POINTS = 20, DARK_SHARE = 0.05;
// ms the camera takes to come to rest on the stopped car; the lamps to settle in the photo; a stop
// may take to reach
const CAMERA_MS = 1500, SETTLE_MS = 450, DRIVE_MS = 45000;
// m/s the car is driven at to a stop (a long tunnel's far end in time, steady through a bend)
const DRIVE_MPS = 14;
const OUT_DIR = 'tools/scratch/lightleak';

const server = await startServer();
let browser;
const leaks = [];
try {
  browser = await launchBrowser();
  const page = await (await browser.newContext({ viewport: { width: 440, height: 738 },
    deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message).split('\n')[0]));
  await page.goto(`${server.url}/?menu=1&guide=0&noaudio=1&night=0.9&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 90000 });
  if (!levelIds.length) {
    levelIds = await page.evaluate(async () => (await import('/src/lab.js')).LEVELS
      .map((level) => level.id));
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const levelId of levelIds) await checkLevel(page, levelId, errors);
  console.log(`lightleak: ${leaks.length} leaking stops${leaks.length ? ` - ${leaks.join(', ')}`
    : ''}; page errors ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
  if (leaks.length) process.exitCode = 1;
} finally {
  await browser?.close();
  server.stop();
}

/**
 * Lists a level's checks, then runs every stop of each.
 * @param page the page
 * @param levelId the level
 * @param errors the page's errors so far
 */
async function checkLevel(page, levelId, errors) {
  const ways = await page.evaluate(async ({ id, zoom }) => {
    const game = window.__game;
    game.menu.hide();
    game.launch(id, 'hatch-rwd', { ai: 0 });
    await new Promise((done) => setTimeout(done, 2500));
    game.renderer.debugZoom(zoom);
    const { overheadDeck } = await import('/src/render/props/bridges.ts');
    const { PROPS } = await import('/src/world/state.ts');
    const sub = game.level.subtrack, list = [];
    (game.level.crossings || []).forEach((way, index) => {
      if (way.kind === 'tunnel') list.push({ kind: 'tunnel', index, track: !!way.track,
        bent: !!way.hidden });
    });
    for (const prop of PROPS || []) {
      const deck = overheadDeck(prop);
      if (!deck || !sub) continue;
      let best = null, bestGap = 3;
      for (const point of sub.pts) {
        const gap = Math.hypot(point.x - prop.x, point.y - prop.y);
        if (gap < bestGap) { bestGap = gap; best = point; }
      }
      if (best) list.push({ kind: 'deck', prop: prop.kind, dist: best.dist,
        at: [+prop.x.toFixed(1), +prop.y.toFixed(1)] });
    }
    return list;
  }, { id: levelId, zoom: ZOOM });
  if (!ways.length) return;
  console.log(`${levelId}: ${ways.filter((way) => way.kind === 'tunnel').length} tunnels, `
    + `${ways.filter((way) => way.kind === 'deck').length} decks over the road`);
  for (const way of ways) {
    const stops = way.kind === 'deck' ? [['before', -6], ['under', 0], ['past', 3]]
      : [['before', -8], ['cut', 'cut'], ['just in', 'justin'], ['middle', 'middle'],
        ['last cut', 'lastcut'], ['past', 'past']];
    for (const [label, at] of stops) {
      for (const turn of [0, TURN_RAD, -TURN_RAD]) {
        const name = (`${levelId}-${way.kind}${way.index ?? way.at.join('_')}-${label}`
          + `-${turn ? (turn > 0 ? 'left' : 'right') : 'along'}`).replace(/ /g, '');
        const result = await runStop(page, way, at, turn);
        if (!result) {
          console.log(`  ${name}: not reached`);
          continue;
        }
        const leaked = result.leak > LEAK_POINTS;
        const tail = result.tail;
        const dark = !turn && result.crossing >= 0
          && ((result.ahead >= DARK_MIN_POINTS && result.aheadLit < DARK_SHARE * 100)
            || (tail && tail.points >= DARK_MIN_POINTS / 4 && tail.lit < DARK_SHARE * 100));
        if (leaked) leaks.push(name);
        if (dark) leaks.push(`${name} (dark)`);
        if (leaked || dark) {
          fs.writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(result.marked, 'base64'));
        }
        console.log(`  ${name}: crossing ${result.crossing}, leak ${result.leak} points`
          + `${turn ? '' : `, ahead lit ${result.aheadLit}% of ${result.ahead}`
            + ` (skipped: ${result.skipped.off} off the photo, ${result.skipped.hidden} hidden)`
            + (tail ? `, brake lights lit ${tail.lit}% of ${tail.points}` : '')}`
          + `${leaked ? '  LEAK' : ''}${dark ? '  DARK' : ''}`);
      }
    }
  }
  if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
}

/**
 * Drives the car to one stop, turns it, takes the two photos and scores them.
 * @param page the page
 * @param way the check (a tunnel's index or a deck's road distance)
 * @param at where: m along (a deck's: from it), or 'cut' / 'middle' / 'lastcut' / 'past'
 * @param turn rad the stopped car is turned
 * @returns the score, or null when the stop was not reached
 */
async function runStop(page, way, at, turn) {
  const reached = await page.evaluate(driveToStop, { way, at, driveMs: DRIVE_MS,
    driveMps: DRIVE_MPS });
  if (!reached) return null;
  await page.evaluate((rad) => {
    const car = window.__game.car;
    car.heading += rad;
    car.lightsOn = false;
  }, turn);
  await page.waitForTimeout(CAMERA_MS);
  const off = await page.screenshot();
  await page.evaluate(() => { window.__game.car.lightsOn = true; });
  await page.waitForTimeout(SETTLE_MS);
  const on = await page.screenshot();
  // (a second photo lamps off: what differs between the two moved - the camera, an effect - and is
  // not the car's light)
  await page.evaluate(() => { window.__game.car.lightsOn = false; });
  await page.waitForTimeout(SETTLE_MS);
  const offAgain = await page.screenshot();
  // (just under a cover: the brakes let off, the handbrake holding it - its brake lights' glow is
  // the difference from the photo before)
  let brakeOff = null;
  if (at === 'justin' && !turn) {
    await page.evaluate(() => {
      window.__game.input.update = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 1,
        reverse: 0, shiftUp: false, shiftDown: false });
    });
    await page.waitForTimeout(SETTLE_MS);
    brakeOff = (await page.screenshot()).toString('base64');
  }
  return page.evaluate(scoreStop, { off: off.toString('base64'), on: on.toString('base64'),
    offAgain: offAgain.toString('base64'), brakeOff,
    turned: turn !== 0,
    opts: { SAMPLE_M, REACH_M, GAIN_MIN, BODY_M, EDGE_M, HUD_TOP_PX, HUD_BOTTOM_PX,
      WALL_BAND_M, AHEAD_M, TAIL_BACK_M, TAIL_GLOW_M } });
}

/**
 * (in the page) Puts the car before the way and drives it to the stop, then holds it there.
 * @param root the stop
 * @param root.way the check
 * @param root.at where along it
 * @param root.driveMs ms it may take
 * @param root.driveMps m/s it is driven at
 * @returns true when it got there
 */
async function driveToStop({ way, at, driveMs, driveMps }) {
  const game = window.__game, car = game.car, lab = await import('/src/lab.js');
  const geo = await import('/src/world/crossinggeo.ts');
  const { reset } = await import('/src/vehicle.ts');
  const sub = lab.LEVEL.subtrack, tunnel = way.kind === 'tunnel'
    ? game.level.crossings[way.index] : null;
  const roadAt = (x, y) => lab.querySubtrack(sub, x, y).trackDist;
  const total = sub ? sub.totalDist : 1;
  const onLine = (along) => [tunnel.ax + tunnel.dirX * along, tunnel.ay + tunnel.dirY * along];
  // the stop as m along the way the car runs (a track tunnel run either way by the race road)
  let forward = true;
  if (tunnel && tunnel.track) {
    const [ax, ay] = onLine(0.5), [bx, by] = onLine(tunnel.length - 0.5);
    forward = ((roadAt(bx, by) - roadAt(ax, ay) + total) % total) < total / 2;
  }
  // (just in: its centre just under the cover, its tail still out in the open cut)
  const named = { cut: tunnel?.cut * 0.5, justin: tunnel?.cut + 1.5, middle: tunnel?.length / 2,
    lastcut: tunnel ? tunnel.length - tunnel.cut * 0.5 : 0, past: tunnel ? tunnel.length + 8 : 0 };
  const stopAlong = typeof at === 'number' ? at : named[at];
  const useRoad = !tunnel || tunnel.track;
  let roadDist;
  if (useRoad) {
    const [sx, sy] = tunnel ? onLine(forward ? 0.5 : tunnel.length - 0.5) : [0, 0];
    roadDist = ((tunnel ? roadAt(sx, sy) : way.dist) - 20 + total) % total;
    const first = lab.onTrack(sub, roadDist, 0, {});
    reset(car, first.x, first.y, first.rot);
  } else {
    const [sx, sy] = onLine(-18);
    reset(car, sx, sy, Math.atan2(tunnel.dirY, tunnel.dirX));
  }
  car.crossing = -1;
  car.lightsOn = true;
  const progress = () => {
    if (!tunnel) return ((roadAt(car.x, car.y) - way.dist + total * 1.5) % total) - total / 2;
    const along = geo.alongOf(tunnel, car.x, car.y);
    return forward ? along : tunnel.length - along;
  };
  game.input.update = () => {
    const speed = Math.hypot(car.vx, car.vy);
    let target;
    if (useRoad) {
      const near = roadAt(car.x, car.y);
      if (Math.abs(near - roadDist) < 12) roadDist = near;
      const point = lab.onTrack(sub, roadDist + 8, 0, {});
      target = [point.x, point.y];
    } else target = onLine(geo.alongOf(tunnel, car.x, car.y) + 8);
    let steer = Math.atan2(target[1] - car.y, target[0] - car.x) - car.heading;
    steer = Math.atan2(Math.sin(steer), Math.cos(steer));
    return { steer: Math.max(-1, Math.min(1, steer * 2.5)), throttle: speed < driveMps ? 0.6 : 0,
      brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false };
  };
  const began = performance.now();
  const reachedStop = await new Promise((done) => {
    const tick = () => {
      if (progress() >= stopAlong) return done(true);
      if (performance.now() - began > driveMs) return done(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
  game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0,
    shiftUp: false, shiftDown: false });
  car.vx = 0;
  car.vy = 0;
  return reachedStop;
}

/**
 * (in the page) Scores a stop's two photos: the lit world points where light must not fall, the
 * share of the road ahead lit, and the lit photo with the leak points marked.
 * @param root the photos and the settings
 * @returns { crossing, leak, aheadLit, marked }
 */
async function scoreStop({ off, on, offAgain, brakeOff, turned, opts }) {
  const game = window.__game, car = game.car, renderer = game.renderer;
  const geo = await import('/src/world/crossinggeo.ts');
  const { overheadDeck } = await import('/src/render/props/bridges.ts');
  const { PROPS } = await import('/src/world/state.ts');
  const load = async (b64) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`))
      .blob());
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return { canvas, ctx, data: ctx.getImageData(0, 0, image.width, image.height) };
  };
  const [dark, lit, again] = [await load(off), await load(on), await load(offAgain)];
  // the brake lights' glow just under a cover: the brakes-held photo (offAgain) against brakes off,
  // round the tail, where it is not hidden
  const scoreTail = async () => {
    const free = await load(brakeOff), held = again.data.data, loose = free.data.data;
    const backX = car.x - Math.cos(car.heading) * opts.TAIL_BACK_M;
    const backY = car.y - Math.sin(car.heading) * opts.TAIL_BACK_M;
    let points = 0, glowing = 0;
    for (let dx = -opts.TAIL_GLOW_M; dx <= opts.TAIL_GLOW_M; dx += 0.25) {
      for (let dy = -opts.TAIL_GLOW_M; dy <= opts.TAIL_GLOW_M; dy += 0.25) {
        if (Math.hypot(dx, dy) > opts.TAIL_GLOW_M || isForbidden(backX + dx, backY + dy)) continue;
        const px = Math.round(renderer.toScreenX(backX + dx));
        const py = Math.round(renderer.toScreenY(backY + dy));
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const i = (py * width + px) * 4;
        points++;
        if (held[i] - loose[i] > opts.GAIN_MIN) glowing++;
      }
    }
    return { points, lit: points ? Math.round(100 * glowing / points) : null };
  };
  const width = dark.data.width, height = dark.data.height;
  const gainAt = (px, py) => {
    const i = (py * width + px) * 4, one = dark.data.data, two = lit.data.data;
    const three = again.data.data;
    const moved = Math.max(Math.abs(three[i] - one[i]), Math.abs(three[i + 1] - one[i + 1]),
      Math.abs(three[i + 2] - one[i + 2]));
    if (moved > opts.GAIN_MIN / 2) return 0;
    return Math.max(two[i] - one[i], two[i + 1] - one[i + 1], two[i + 2] - one[i + 2]);
  };
  const isLit = (px, py) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const sx = px + dx, sy = py + dy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;
      if (gainAt(sx, sy) <= opts.GAIN_MIN) return false;
    }
    return true;
  };
  const inPolygon = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // the distance from a point to an outline's edges, m
  const edgeGap = (pts, x, y) => {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
      const share = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy
        || 1)));
      best = Math.min(best, Math.hypot(x - ax - dx * share, y - ay - dy * share));
    }
    return best;
  };
  // inside an outline by more than the edge's spill
  const deepIn = (pts, x, y) => inPolygon(pts, x, y) && edgeGap(pts, x, y) > opts.EDGE_M;
  const ways = game.level.crossings || [], own = car.crossing ?? -1;
  // a bent tunnel's walls' faces (as render/light.ts clipToCut) and its cover's box
  const bentFaces = new Map();
  ways.forEach((way, index) => {
    if (!way.hidden) return;
    const [left, right] = way.walls.map((wall) => wall.pts);
    const face = (pts, other) => pts.map(([x, y], i) => {
      const dx = other[i][0] - x, dy = other[i][1] - y, gap = Math.hypot(dx, dy) || 1;
      return [x + dx / gap * 0.45, y + dy / gap * 0.45];
    });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const outline of way.hidden) for (const [x, y] of outline) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const walls = [...face(left, right), ...face(right, left).reverse()], ends = walls.length / 2;
    // each mouth's line (its two wall ends) and which way is out (away from the points inside)
    const mouthOf = (one, two, innerOne, innerTwo) => {
      const mid = [(one[0] + two[0]) / 2, (one[1] + two[1]) / 2];
      const inner = [(innerOne[0] + innerTwo[0]) / 2 - mid[0], (innerOne[1] + innerTwo[1]) / 2
        - mid[1]];
      const length = Math.hypot(two[0] - one[0], two[1] - one[1]) || 1;
      let out = [-(two[1] - one[1]) / length, (two[0] - one[0]) / length];
      if (out[0] * inner[0] + out[1] * inner[1] > 0) out = [-out[0], -out[1]];
      return { mid, out };
    };
    const mouths = [mouthOf(walls[0], walls[walls.length - 1], walls[1], walls[walls.length - 2]),
      mouthOf(walls[ends - 1], walls[ends], walls[ends - 2], walls[ends + 1])];
    bentFaces.set(index, { walls, mouths, box: [minX - 2, minY - 2, maxX + 2, maxY + 2] });
  });
  const decks = [];
  if (own < 0) for (const prop of PROPS || []) {
    const deck = overheadDeck(prop);
    if (!deck || Math.hypot(prop.x - car.x, prop.y - car.y) > opts.REACH_M + deck.halfLength) {
      continue;
    }
    const cos = Math.cos(prop.rot || 0), sin = Math.sin(prop.rot || 0);
    decks.push([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => [
      prop.x + cos * along * deck.halfLength - sin * across * deck.halfWidth,
      prop.y + sin * along * deck.halfLength + cos * across * deck.halfWidth]));
  }
  const isForbidden = (x, y) => {
    for (let index = 0; index < ways.length; index++) {
      const way = ways[index];
      if (way.kind !== 'tunnel') continue;
      if (way.hidden && way.hidden.some((outline) => deepIn(outline, x, y))) return true;
      if (index !== own) continue;
      const bent = bentFaces.get(index);
      if (bent) {
        const [minX, minY, maxX, maxY] = bent.box;
        // (past a mouth's line is the open ground its light may reach, as render/light.ts)
        const isPastMouth = bent.mouths.some(({ mid, out }) =>
          (x - mid[0]) * out[0] + (y - mid[1]) * out[1] > opts.EDGE_M);
        if (x > minX && y > minY && x < maxX && y < maxY && !isPastMouth
          && !inPolygon(bent.walls, x, y) && edgeGap(bent.walls, x, y) > opts.EDGE_M) {
          return true;
        }
        continue;
      }
      const along = geo.alongOf(way, x, y), across = geo.acrossOf(way, x, y);
      if (along > way.cut + opts.EDGE_M && along < way.length - way.cut - opts.EDGE_M) return true;
      const past = Math.max(way.minAcross - across, across - way.maxAcross);
      if (along > opts.EDGE_M && along < way.length - opts.EDGE_M && past > opts.EDGE_M
        && past < opts.WALL_BAND_M) return true;
    }
    return decks.some((quad) => deepIn(quad, x, y));
  };
  let leak = 0, ahead = 0, aheadLit = 0;
  // the road ahead not sampled: off the photo (or under the HUD), or hidden (under a cover)
  const skipped = { off: 0, hidden: 0 };
  const marks = [];
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  for (let dx = -opts.REACH_M; dx <= opts.REACH_M; dx += opts.SAMPLE_M) {
    for (let dy = -opts.REACH_M; dy <= opts.REACH_M; dy += opts.SAMPLE_M) {
      if (Math.hypot(dx, dy) < opts.BODY_M) continue;
      const x = car.x + dx, y = car.y + dy;
      const px = Math.round(renderer.toScreenX(x)), py = Math.round(renderer.toScreenY(y));
      const forward = dx * cos + dy * sin, side = -dx * sin + dy * cos;
      const isAhead = !turned && forward > 4 && forward < opts.AHEAD_M && Math.abs(side) < 1.5;
      if (px < 1 || py < opts.HUD_TOP_PX || px >= width - 1 || py >= height - opts.HUD_BOTTOM_PX) {
        if (isAhead) skipped.off++;
        continue;
      }
      if (isAhead && isForbidden(x, y)) skipped.hidden++;
      if (!turned && forward > 4 && forward < opts.AHEAD_M && Math.abs(side) < 1.5
        && !isForbidden(x, y)) {
        ahead++;
        if (isLit(px, py)) aheadLit++;
      }
      if (!isForbidden(x, y) || !isLit(px, py)) continue;
      leak++;
      marks.push([px, py]);
    }
  }
  lit.ctx.fillStyle = '#ff2a6d';
  for (const [px, py] of marks) lit.ctx.fillRect(px - 1, py - 1, 3, 3);
  const blob = await lit.canvas.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { crossing: own, leak, ahead, skipped, tail: brakeOff ? await scoreTail() : null,
    aheadLit: ahead ? Math.round(100 * aheadLit / ahead) : null, marked: btoa(binary) };
}
