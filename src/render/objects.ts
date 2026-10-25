// The OBJECTS layer of the renderer: pixel objects (cones, tyres), rally tape, roadside debris,
// animals, knockable boards and flags, and the banger, caravan and podium props.
import { parkMiller } from "../core/random.ts";
import { SPRITE_PPM, fxRandom } from "./shared.ts";
import type { Cam, Chip, RenderCone, RenderTape, TapeCar, TapeGame, View } from "./types.ts";
import { drawBanger, drawCaravan, drawPodium } from "./objectsProps.ts";
import { shade } from "../render.ts";   // read only at draw time (no load-time cycle)

// what createObjects destructures from the renderer and the particles
interface ObjectsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  roundRect: (
    g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
  ) => void;
  chips: Chip[];
  MAX_CHIPS: number;
}

// a cached pixel sprite: its canvas and its size in px
interface ObjSprite {
  c: HTMLCanvasElement;
  size: number;
}

// what the objects layer keeps between frames
interface ObjectsState {
  objCache: Map<string, ObjSprite>;   // generated pixel sprites by key
}

// the view, the helpers and the state every moved function reads
interface ObjectsCtx extends ObjectsHelpers {
  view: View;
  state: ObjectsState;
}

// a rect drawer in metres: x, y, width, height, colour
type RectFn = (x: number, y: number, width: number, height: number, col: string) => void;

// ---------------------------------------------------------------- cones
//
// STANDING and TOPPLED must be unmistakable at a glance and at phone size (§4: if the player
// cannot read it, it did not happen). Standing reads as concentric rings — the cone seen from
// directly above. Toppled reads as a LONG shape lying in the direction it was hit, which is a
// completely different silhouette rather than the same blob in a different colour.
// ---------------------------------------------------------------- PIXEL OBJECTS (cones, tyres)
// Generated pixel sprites, cached, drawn at the car's art scale (SPRITE_PPM) with smoothing off.
// Round things are PIXEL-round — rasterised square by square (pdisc), never an anti-aliased arc.

/**
 * Returns the cached sprite for a key, painting it on first use.
 * @param env the objects context (its state holds the cache)
 * @param key the cache key
 * @param size the sprite size in px
 * @param paint paints the sprite on a fresh canvas
 * @returns the sprite
 */
function objSprite(
  env: ObjectsCtx, key: string, size: number,
  paint: (g: CanvasRenderingContext2D, n: number) => void
): ObjSprite {
  let sprite = env.state.objCache.get(key);
  if (!sprite) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    // ! : a fresh canvas always has a 2d context
    paint(canvas.getContext('2d')!, size);
    sprite = { c: canvas, size };
    env.state.objCache.set(key, sprite);
  }
  return sprite;
}

/**
 * Paints a pixel disc of radius rr centred in a size x size sprite (pixel centres inside the
 * circle).
 * @param ctx the sprite's 2d context
 * @param size the sprite size in px
 * @param radius the disc radius in px
 * @param col the fill colour
 */
function pdisc(ctx: CanvasRenderingContext2D, size: number, radius: number, col: string) {
  ctx.fillStyle = col; const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - mid) ** 2 + (y
    - mid) ** 2 <= radius * radius) ctx.fillRect(x, y, 1, 1);
}

/**
 * Returns the sprite of a cone lying on its side or standing top-down.
 * @param env the objects context
 * @param cone the cone
 * @returns the sprite
 */
function coneSprite(env: ObjectsCtx, cone: RenderCone): ObjSprite {
  // lying on its side, tip to +x
  if (cone.down > 0.5) return objSprite(env, 'cone-down', 11, (ctx) => {
    ctx.fillStyle = '#b8410c'; ctx.fillRect(0, 2, 2, 7);                      // base
    for (let x = 2; x < 11; x++) {
      const half = Math.max(1, Math.round(3.4 - (x - 2) * 0.36));
      ctx.fillStyle = '#f26a1b';
      ctx.fillRect(x, 5 - half, 1, half * 2 + 1);
    }
    // reflective band
    ctx.fillStyle = '#f4f4f6'; ctx.fillRect(5, 3, 2, 5);
    ctx.fillStyle = '#ff9a55'; ctx.fillRect(2, 4, 7, 1);                       // highlight
  });
  // top-down: base, band, tip
  return objSprite(env, 'cone-up', 9, (ctx, size) => {
    pdisc(ctx, size, 4.4, '#b8410c');
    pdisc(ctx, size, 3.6, '#f26a1b');
    pdisc(ctx, size, 2.4, '#f4f4f6');
    pdisc(ctx, size, 1.4, '#f26a1b');
    ctx.fillStyle = '#ffb27a'; ctx.fillRect(4, 4, 1, 1);
  });
}

/**
 * Returns the sprite of a tyre or a tyre stack.
 * @param env the objects context
 * @param mode the tyre mode (stack / flat / roll / flip / wobble)
 * @returns the sprite
 */
function tyreSprite(env: ObjectsCtx, mode: string): ObjSprite {
  // on its tread
  if (mode === 'roll' || mode === 'flip' || mode === 'wobble') return objSprite(env, 'tyre-side',
    15, (ctx) => {
    ctx.fillStyle = '#16171c'; ctx.fillRect(0, 5, 15, 5);
    ctx.fillStyle = '#3a3d47'; for (let x = 1; x < 15; x += 3) ctx.fillRect(x, 5, 1, 5);
    ctx.fillStyle = '#6b6f7a'; ctx.fillRect(4, 6, 7, 1);
  });
  const stack = mode === 'stack';
  return objSprite(env, stack ? 'tyre-stack' : 'tyre-flat', 17, (ctx, size) => {
    pdisc(ctx, size, stack ? 8.2 : 7.2, '#0f1014');
    pdisc(ctx, size, stack ? 7.2 : 6.3, '#2a2c33');
    pdisc(ctx, size, stack ? 5.0 : 4.2, '#6b6f7a');
    pdisc(ctx, size, stack ? 3.6 : 3.0, '#1d1f25');
    // top ring glint, sponsor fleck
    if (stack) {
      ctx.fillStyle = '#4a4e58';
      for (let x = 4; x < 13; x++) ctx.fillRect(x, 2, 1, 1);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(12, 6, 1, 2);
    }
    // the hole: ground shows through
    ctx.clearRect(7, 7, 3, 3);
  });
}

/**
 * Returns the pixel sprite of a cone, tyre or tyre stack.
 * @param env the objects context
 * @param cone the object
 * @returns the sprite, or null for any other kind
 */
function pixelObjectSprite(env: ObjectsCtx, cone: RenderCone): ObjSprite | null {
  const mode = cone.mode || (cone.kind === 'tyrestack' ? 'stack' : cone.kind === 'tyre' ? 'flat'
    : 'cone');
  if (cone.kind === 'cone') return coneSprite(env, cone);
  if (cone.kind === 'tyre' || cone.kind === 'tyrestack') return tyreSprite(env, mode);
  return null;
}

/**
 * Draws a cone, tyre or tyre stack as its pixel sprite.
 * @param env the objects context
 * @param cone the object
 * @returns whether it was a pixel object and was drawn
 */
function drawPixelObject(env: ObjectsCtx, cone: RenderCone) {
  const sprite = pixelObjectSprite(env, cone);
  if (!sprite) return false;
  const unit = env.PPMz() / SPRITE_PPM;
  env.view.ctx.rotate(cone.ang || 0);
  env.view.ctx.scale(unit, unit);
  env.view.ctx.drawImage(sprite.c, -sprite.size / 2, -sprite.size / 2);
  return true;
}

// RALLY TAPE (cones.js sections): red / white between its posts; a SNAPPED section hangs as two
// short loose ends; tape STUCK to a car trails behind it as a fluttering streamer (wall-clock
// flutter, fades after ~14 s)

/**
 * Emits a burst of red / white flecks (TAPE PUFFS: a section gone after its second hit, and a
 * streamer coming off a car).
 * @param env the objects context
 * @param x the world x of the burst
 * @param y the world y of the burst
 * @param vx the velocity x added to each fleck
 * @param vy the velocity y added to each fleck
 * @param count the number of flecks
 */
function puffTape(env: ObjectsCtx, x: number, y: number, vx: number, vy: number, count: number) {
  const { chips, MAX_CHIPS } = env;
  for (let i = 0; i < count; i++) {
    const angle = fxRandom() * 6.2832, speed = 0.8 + fxRandom() * 3.2;
    if (chips.length >= MAX_CHIPS) chips.shift();
    chips.push({ x: x + (fxRandom() - 0.5) * 0.6, y: y + (fxRandom() - 0.5) * 0.6,
      vx: vx + Math.cos(angle) * speed, vy: vy + Math.sin(angle) * speed, age: 0, life: 0.5
      + fxRandom() * 1.1, col: fxRandom() < 0.5 ? '#e23b2e' : '#f2f2f2', sz: 2 });
  }
}

/**
 * Draws one dashed red / white tape segment between two screen points.
 * @param env the objects context
 * @param ppm the pixels per metre
 * @param from the start screen point
 * @param to the end screen point
 */
function strokeTapeSeg(
  env: ObjectsCtx, ppm: number, start: { x: number; y: number }, end: { x: number; y: number }
) {
  const { view } = env;
  view.ctx.setLineDash([0.5 * ppm, 0.5 * ppm]);
  view.ctx.strokeStyle = '#e23b2e';
  view.ctx.beginPath();
  view.ctx.moveTo(start.x, start.y);
  view.ctx.lineTo(end.x, end.y);
  view.ctx.stroke();
  view.ctx.lineDashOffset = 0.5 * ppm;
  view.ctx.strokeStyle = '#f2f2f2';
  view.ctx.beginPath();
  view.ctx.moveTo(start.x, start.y);
  view.ctx.lineTo(end.x, end.y);
  view.ctx.stroke();
  view.ctx.lineDashOffset = 0;
}

/**
 * Draws the tape sections in view: whole, or a snapped section as two loose ends.
 * @param env the objects context
 * @param tapes the tape sections
 * @param ppm the pixels per metre
 */
function drawTapeSections(env: ObjectsCtx, tapes: RenderTape[], ppm: number) {
  const { view, toScreenX, toScreenY } = env;
  for (const sct of tapes) {
    if (sct.gone) continue;
    const startX = toScreenX(sct.a.x), startY = toScreenY(sct.a.y), endX = toScreenX(sct.b.x),
      endY = toScreenY(sct.b.y);
    if ((startX < -40 && endX < -40) || (startX > view.W + 40 && endX > view.W + 40)
      || (startY < -40 && endY < -40) || (startY > view.H + 40 && endY > view.H + 40)) continue;
    if (!sct.broken) strokeTapeSeg(env, ppm, { x: startX, y: startY }, { x: endX, y: endY });
    else {
      const dx = endX - startX, dy = endY - startY, span = Math.hypot(dx, dy) || 1,
        tail = Math.min(span * 0.35, 1.3 * ppm);
      strokeTapeSeg(env, ppm, { x: startX, y: startY }, { x: startX + dx / span * tail
        + dy / span * tail * 0.3, y: startY + dy / span * tail - dx / span * tail * 0.3 });
      strokeTapeSeg(env, ppm, { x: endX, y: endY }, { x: endX - dx / span * tail
        + dy / span * tail * 0.3, y: endY - dy / span * tail - dx / span * tail * 0.3 });
    }
  }
}

// where a car's streamers start and which way it faces
interface StreamerBase {
  bxW: number;
  byW: number;
  cosHeading: number;
  sinHeading: number;
  speed: number;
}

// the pixels per metre, the base line width and the wall-clock seconds of one tape draw
interface TapeLook {
  ppm: number;
  lineWidth: number;
  now: number;
}

/**
 * Draws one fluttering tape streamer behind a car.
 * @param env the objects context
 * @param car the car it trails
 * @param streamer the streamer (phase, len)
 * @param index the streamer's index on the car
 * @param base where the streamers start and the car's heading
 * @param look the pixels per metre, the base line width and the wall-clock seconds
 */
function drawStreamer(
  env: ObjectsCtx, car: TapeCar, streamer: { phase: number; len: number }, index: number,
  base: StreamerBase, look: TapeLook
) {
  const { view, toScreenX, toScreenY } = env;
  const { bxW, byW, cosHeading, sinHeading, speed } = base;
  const { ppm, lineWidth, now } = look;
  // trails BEHIND the direction of travel (or the car's back when slow), fluttering
  const dirx = speed > 1 ? -car.vx / speed : -cosHeading, diry = speed > 1 ? -car.vy / speed
    : -sinHeading, side = (index - 1) * 0.35;
  view.ctx.beginPath();
  view.ctx.moveTo(toScreenX(bxW - sinHeading * side), toScreenY(byW + cosHeading * side));
  for (let step = 1; step <= 6; step++) {
    const along = step / 6, flutter = Math.sin(now * 14 + streamer.phase
      + along * 5) * 0.35 * along;
    view.ctx.lineTo(toScreenX(bxW - sinHeading * side + dirx * streamer.len * along
      - diry * flutter), toScreenY(byW + cosHeading * side + diry * streamer.len * along
      + dirx * flutter));
  }
  // streamers drawn thicker (photographed thin)
  view.ctx.lineWidth = lineWidth * 1.8;
  view.ctx.setLineDash([0.5 * ppm, 0.5 * ppm]);
  view.ctx.strokeStyle = '#e23b2e';
  view.ctx.stroke();
  view.ctx.lineDashOffset = 0.5 * ppm;
  view.ctx.strokeStyle = '#f2f2f2';
  view.ctx.stroke();
  view.ctx.lineDashOffset = 0;
  view.ctx.setLineDash([]);
  view.ctx.lineWidth = lineWidth;
}

/**
 * Draws the tape streamers stuck to one car, and puffs for any lost since the last frame.
 * @param env the objects context
 * @param car the car
 * @param clock the cones clock in seconds
 * @param look the pixels per metre, the base line width and the wall-clock seconds
 */
function drawCarStreamers(env: ObjectsCtx, car: TapeCar, clock: number, look: TapeLook) {
  // null = reset (the car was teleported): no puff, just forget the count
  if (!car.streamers) { car._stN = 0; return; }
  car.streamers = car.streamers.filter((streamer) => clock - streamer.born < 14);
  // a streamer lost since last frame (timed out, or knocked off by an impact in damage.ts)
  // goes up in a puff behind the car
  if (car._stN != null && car.streamers.length < car._stN) {
    const ch0 = Math.cos(car.heading), sh0 = Math.sin(car.heading);
    for (let index = car.streamers.length; index < car._stN; index++) puffTape(env, car.x
      - ch0 * car.spec.len * 0.5, car.y - sh0 * car.spec.len * 0.5, car.vx * 0.5,
      car.vy * 0.5, 12);
  }
  car._stN = car.streamers.length;
  const cosHeading = Math.cos(car.heading), sinHeading = Math.sin(car.heading),
    speed = Math.hypot(car.vx, car.vy);
  const bxW = car.x - cosHeading * car.spec.len * 0.45, byW = car.y
    - sinHeading * car.spec.len * 0.45;
  const base = { bxW, byW, cosHeading, sinHeading, speed };
  car.streamers.forEach((streamer, index) => {
    drawStreamer(env, car, streamer, index, base, look);
  });
}

/**
 * Draws the rally tape between its posts and the streamers stuck to cars.
 * @param env the objects context
 * @param game the game (cones, car, ai)
 */
function drawTape(env: ObjectsCtx, game: TapeGame) {
  const tapes = game.cones.tapes; if (!tapes || !tapes.length) return;
  const { view } = env;
  const ppm = env.PPMz(), lineWidth = Math.max(1.5, 0.12 * ppm);
  view.ctx.save(); view.ctx.lineWidth = lineWidth; view.ctx.lineCap = 'butt';
  const puffQueue = game.cones.tapePuffs;
  if (puffQueue && puffQueue.length) {
    for (const burst of puffQueue) puffTape(env, burst.x, burst.y, burst.vx, burst.vy, 22);
    puffQueue.length = 0;
  }
  drawTapeSections(env, tapes, ppm);
  view.ctx.setLineDash([]);
  const now = performance.now() / 1000, clock = game.cones.clock || 0;
  const look = { ppm, lineWidth, now };
  for (const car of [game.car, ...(game.ai || []).map((rival) => rival.car)]) {
    drawCarStreamers(env, car, clock, look);
  }
  view.ctx.restore();
}

// ROADSIDE DEBRIS (cones.js DEBRIS): top-down squares, rotated with the object; broken ones are
// a scatter of bits (seeded by home)
const DEBRIS_KINDS = new Set(['pallet', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust',
  'bumper', 'tarp', 'splinters', 'cardboard', 'sand', 'fluff']);

/**
 * Makes a drawer of filled rects in metres at the given pixels per metre.
 * @param env the objects context
 * @param ppm the pixels per metre
 * @returns the drawer (x, y, width, height, colour)
 */
function makeRect(env: ObjectsCtx, ppm: number): RectFn {
  return (x, y, width, height, col) => {
    env.view.ctx.fillStyle = col;
    env.view.ctx.fillRect(x * ppm, y * ppm, width * ppm, height * ppm);
  };
}

/**
 * Draws the first group of debris: pallet, box, crate, bin and sandbag.
 * @param cone the debris
 * @param rect the rect drawer
 * @param shadow the shadow drawer
 * @returns whether the kind was one of this group
 */
function drawDebrisStacks(
  cone: RenderCone, rect: RectFn, shadow: (w: number, h: number) => void
) {
  switch (cone.kind) {
    case 'pallet': shadow(1.2, 1.0);
    rect(-0.6, -0.5, 1.2, 1.0, '#8a6a43');
    for (let plank = 0; plank < 4; plank++) rect(-0.6, -0.42 + plank * 0.26, 1.2, 0.08,
      '#5e4529');
    return true;
    case 'box': shadow(0.8, 0.6);
    rect(-0.4, -0.3, 0.8, 0.6, '#b8925e');
    rect(-0.4, -0.04, 0.8, 0.08, '#d9c08a');
    return true;
    case 'crate': shadow(1.0, 1.0);
    rect(-0.5, -0.5, 1.0, 1.0, '#7d5a32');
    rect(-0.42, -0.42, 0.84, 0.84, '#9b7444');
    rect(-0.5, -0.05, 1.0, 0.1, '#5e4529');
    rect(-0.05, -0.5, 0.1, 1.0, '#5e4529');
    return true;
    case 'bin': shadow(0.7, 0.8);
    rect(-0.35, -0.4, 0.7, 0.8, cone.col || '#2f5d3a');
    rect(-0.35, -0.4, 0.7, 0.14, '#1f3d27');
    return true;
    case 'sandbag': shadow(0.9, 0.5);
    rect(-0.45, -0.25, 0.9, 0.5, '#a89470');
    rect(-0.45, -0.25, 0.9, 0.08, '#c4b28c');
    return true;
    default: return false;
  }
}

/**
 * Draws the second group of debris: barrel, exhaust, bumper and tarp.
 * @param cone the debris
 * @param rect the rect drawer
 * @param shadow the shadow drawer
 * @returns whether the kind was one of this group
 */
function drawDebrisParts(
  cone: RenderCone, rect: RectFn, shadow: (w: number, h: number) => void
) {
  switch (cone.kind) {
    case 'barrel': shadow(0.8, 0.8);
    rect(-0.4, -0.4, 0.8, 0.8, cone.col || '#2b56b5');
    rect(-0.25, -0.25, 0.5, 0.5, shade(cone.col || '#2b56b5', 0.8));
    rect(-0.07, -0.07, 0.14, 0.14, '#1c1d20');
    return true;
    case 'exhaust': shadow(1.0, 0.25);
    rect(-0.5, -0.07, 0.8, 0.14, '#6a7077');
    rect(0.3, -0.13, 0.25, 0.26, '#4a4f57');
    return true;
    case 'bumper': shadow(1.6, 0.3);
    rect(-0.8, -0.15, 1.6, 0.3, cone.col || '#c8302c');
    rect(-0.8, -0.15, 1.6, 0.07, 'rgba(255,255,255,0.3)');
    return true;
    case 'tarp': rect(-0.9, -0.7, 1.8, 1.4, cone.col || '#2f6fb0');
    rect(-0.9, -0.2, 1.8, 0.12, 'rgba(255,255,255,0.18)');
    rect(0.2, -0.7, 0.12, 1.4, 'rgba(0,0,0,0.15)');
    return true;
    default: return false;
  }
}

/**
 * Draws broken debris: a scatter of bits in its colour, seeded by its home.
 * @param cone the debris
 * @param rect the rect drawer
 */
function drawDebrisScatter(cone: RenderCone, rect: RectFn) {
  const rand = parkMiller(Math.floor(Math.abs((cone.hx || 0) * 73.1 + (cone.hy
    || 0) * 19.7)) % 9973 + 1);
  const cols = cone.kind === 'fluff' ? ['#f6f5ef', '#dcdbd2'] : cone.kind === 'sand'
    ? ['#c4b28c', '#a89470'] : cone.kind === 'cardboard' ? ['#b8925e', '#d9c08a']
    : ['#8a6a43', '#5e4529'];
  for (let bit = 0; bit < 14; bit++) {
    const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 1.2, width = 0.12
      + rand() * 0.3, height = cone.kind === 'splinters' ? 0.08 : width;
    rect(Math.cos(angle) * radius - width / 2, Math.sin(angle) * radius - height / 2, width,
      height, cols[bit % 2]);
  }
}

/**
 * Draws one piece of roadside debris, rotated with the object.
 * @param env the objects context
 * @param cone the debris
 */
function drawDebris(env: ObjectsCtx, cone: RenderCone) {
  const ppm = env.PPMz(), rect = makeRect(env, ppm);
  const shadow = (width: number, height: number) => {
    env.view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
    env.view.ctx.fillRect((-width / 2 + 0.15) * ppm, (-height / 2 + 0.25) * ppm, width * ppm,
      height * ppm);
  };
  env.view.ctx.rotate(cone.ang || 0);
  if (drawDebrisStacks(cone, rect, shadow)) return;
  if (drawDebrisParts(cone, rect, shadow)) return;
  drawDebrisScatter(cone, rect);   // broken: a scatter of bits in its colour
}

/**
 * Draws a round hay bale (top-down) or burst straw.
 * @param env the objects context
 * @param cone the bale or straw
 */
function drawBale(env: ObjectsCtx, cone: RenderCone) {
  const { view, PPMz } = env;
  const rect = makeRect(env, PPMz());
  view.ctx.rotate(cone.ang || 0);
  if (cone.kind === 'bale') {
    // ROUND HAY BALE from the top: straw square, darker spiral ring (squares — the pixel
    // rule)
    view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
    view.ctx.fillRect(-0.8 * PPMz() + 0.3 * PPMz(), -0.8 * PPMz() + 0.45 * PPMz(),
      1.6 * PPMz(), 1.6 * PPMz());
    rect(-0.8, -0.8, 1.6, 1.6, '#c9a85a');
    rect(-0.55, -0.55, 1.1, 1.1, '#b48f45');
    rect(-0.3, -0.3, 0.6, 0.6, '#d8bb6e');
    rect(-0.08, -0.08, 0.16, 0.16, '#9a7836');
  } else {
    // BURST STRAW: a spread of loose straw squares, the same every frame (seeded by its home
    // position)
    const rand = parkMiller(Math.floor(Math.abs(cone.hx * 73.1 + cone.hy * 19.7)) % 9973
      + 1);
    for (let bit = 0; bit < 26; bit++) {
      const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 1.8, width = 0.2
        + rand() * 0.35;
      rect(Math.cos(angle) * radius - width / 2, Math.sin(angle) * radius - width / 2,
        width, width, bit % 3 ? '#cfae62' : '#a8873f');
    }
  }
}

/**
 * Draws a sheep or a cow: a body square, a head square at +x and a shadow. A TIPPED cow lies on
 * its side: four dark leg squares out, the head flat.
 * @param env the objects context
 * @param cone the animal
 */
function drawAnimal(env: ObjectsCtx, cone: RenderCone) {
  const ppm = env.PPMz(), rect = makeRect(env, ppm);
  env.view.ctx.rotate(cone.ang || 0);
  if (cone.kind === 'cow' && cone.tipped) {
    rect(-0.9, -0.2, 2, 0.9, 'rgba(10,12,16,0.3)');
    rect(-1.1, -0.45, 2, 0.85, '#f0eee8');
    rect(-0.6, -0.45, 0.7, 0.4, '#1c1d20');
    for (const legX of [-0.9, -0.5, 0.15, 0.55]) rect(legX, 0.4, 0.2, 0.55, '#1c1d20');
    rect(0.9, -0.3, 0.55, 0.55, '#1c1d20');
  }
  else if (cone.kind === 'cow') {
    rect(-0.9, -0.35, 2, 1, 'rgba(10,12,16,0.3)');
    rect(-1.1, -0.5, 2, 1, '#f0eee8');
    rect(-0.7, -0.5, 0.6, 0.5, '#1c1d20');
    rect(0.2, 0, 0.5, 0.5, '#1c1d20');
    rect(0.9, -0.3, 0.55, 0.6, '#1c1d20');
  }
  else {
    rect(-0.45, -0.2, 1, 0.7, 'rgba(10,12,16,0.3)');
    rect(-0.55, -0.35, 1, 0.7, '#ecebe4');
    rect(-0.45, -0.25, 0.8, 0.5, '#f7f6f0');
    rect(0.42, -0.2, 0.32, 0.4, '#2a2a2c');
  }
}

/**
 * Draws a tape POST: a dark stake (upright) or lying (knocked).
 * @param env the objects context
 * @param cone the post
 */
function drawTapePost(env: ObjectsCtx, cone: RenderCone) {
  const { view } = env;
  const ppm = env.PPMz(); view.ctx.rotate(cone.ang || 0); view.ctx.fillStyle = '#3a2d21';
  if (cone.down < 0.5) view.ctx.fillRect(-0.12 * ppm, -0.12 * ppm, 0.24 * ppm, 0.24 * ppm);
  else view.ctx.fillRect(-0.6 * ppm, -0.06 * ppm, 1.2 * ppm, 0.12 * ppm);
}

/**
 * Draws a knockable chevron board: upright as the old prop; once knocked lying flat, face up and
 * darker.
 * @param env the objects context
 * @param down 0 = upright, 1 = flat
 * @param ppm the pixels per metre
 * @param rect the rect drawer
 */
function drawChevron(env: ObjectsCtx, down: number, ppm: number, rect: RectFn) {
  const { view } = env;
  view.ctx.scale(1.6, 1.6);
  if (down < 0.5) {
    view.ctx.fillStyle = 'rgba(10,12,16,0.32)';
    view.ctx.fillRect(-1.6 * ppm + 0.3 * ppm, -0.25 * ppm + 0.5 * ppm, 3.2 * ppm,
      0.5 * ppm);
    rect(-1.6, -0.25, 3.2, 0.5, '#15171c');
    for (let col = 0; col < 3; col++) {
      rect(-1.25 + col * 1.0, -0.2, 0.25, 0.15, '#f2c21b');
      rect(-1.0 + col * 1.0, -0.075, 0.25, 0.15, '#f2c21b');
      rect(-1.25 + col * 1.0, 0.05, 0.25, 0.15, '#f2c21b');
    }
  }
  else {
    rect(-1.6, -0.5, 3.2, 1.0, '#15171c');
    for (let col = 0; col < 3; col++) {
      rect(-1.25 + col * 1.0, -0.4, 0.3, 0.3, '#b08c14');
      rect(-0.95 + col * 1.0, -0.15, 0.3, 0.3, '#b08c14');
      rect(-1.25 + col * 1.0, 0.1, 0.3, 0.3, '#b08c14');
    }
    // face up, its two posts
    rect(-1.5, 0.5, 0.15, 0.6, '#5a4632'); rect(1.35, 0.5, 0.15, 0.6, '#5a4632');
  }
}

/**
 * Draws a knockable flag: upright, or once knocked the pole down with its cloth crumpled beside
 * it.
 * @param env the objects context
 * @param cone the flag
 * @param ppm the pixels per metre
 * @param rect the rect drawer
 */
function drawFlag(env: ObjectsCtx, cone: RenderCone, ppm: number, rect: RectFn) {
  const { view } = env;
  if (cone.down < 0.5) {
    view.ctx.fillStyle = 'rgba(10,12,16,0.28)';
    view.ctx.fillRect(0.2 * ppm, 0.1 * ppm, 1.8 * ppm, 0.6 * ppm);
    rect(-0.15, -0.15, 0.3, 0.3, '#3a3f47');
    rect(0.15, -0.55, 1.3, 0.75, cone.col || '#c8302c');
    rect(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
  }
  // pole down, cloth crumpled
  else {
    rect(-1.1, -0.06, 2.2, 0.12, '#5a5f68');
    rect(0.6, 0.06, 0.8, 0.5, cone.col || '#c8302c');
    rect(0.9, 0.2, 0.5, 0.3, shade(cone.col || '#c8302c', 0.7));
  }
}

/**
 * Draws a knockable chevron board or flag (cones.js).
 * @param env the objects context
 * @param cone the chevron or flag
 */
function drawBoard(env: ObjectsCtx, cone: RenderCone) {
  const ppm = env.PPMz(), rect = makeRect(env, ppm);
  env.view.ctx.rotate(cone.ang || 0);
  if (cone.kind === 'chevron') drawChevron(env, cone.down, ppm, rect);
  else drawFlag(env, cone, ppm, rect);
}

/**
 * Draws the object kinds that have their own picture, with the canvas already translated.
 * @param env the objects context
 * @param cone the object
 */
function drawConeKind(env: ObjectsCtx, cone: RenderCone) {
  if (cone.kind === 'bale' || cone.kind === 'straw') drawBale(env, cone);
  else if (cone.kind === 'sheep' || cone.kind === 'cow') drawAnimal(env, cone);
  else if (DEBRIS_KINDS.has(cone.kind)) drawDebris(env, cone);
  else if (cone.kind === 'tapepost') drawTapePost(env, cone);
  else if (cone.kind === 'chevron' || cone.kind === 'flag') drawBoard(env, cone);
  else if (drawPixelObject(env, cone)) return;
  else if (cone.kind === 'banger') drawBanger(env, cone);
  else if (cone.kind === 'caravan') drawCaravan(env, cone);
  else if (cone.kind === 'podium') drawPodium(env, cone);
}

/**
 * Draws the loose objects (cones, tyres, debris, animals, props) that are on screen.
 * @param env the objects context
 * @param cones the objects
 */
function drawCones(env: ObjectsCtx, cones: RenderCone[]) {
  const { view, toScreenX, toScreenY } = env;
  for (const cone of cones) {
    const screenX = toScreenX(cone.x), screenY = toScreenY(cone.y);
    if (screenX < -60 || screenX > view.W + 60 || screenY < -60 || screenY > view.H
      + 60) continue;
    view.ctx.save();
    view.ctx.translate(screenX, screenY);
    drawConeKind(env, cone);
    view.ctx.restore();
  }
}

/**
 * Creates the objects layer: cones, tyres, debris, animals, props and rally tape.
 * @param view the render view (canvas, context, size)
 * @param cam the camera
 * @param helpers the renderer's and particles' helpers
 * @returns drawCones and drawTape
 */
export function createObjects(view: View, cam: Cam, helpers: ObjectsHelpers) {
  void cam;
  const state: ObjectsState = { objCache: new Map<string, ObjSprite>() };
  const env: ObjectsCtx = { ...helpers, view, state };
  return {
    drawCones: (cones: RenderCone[]) => drawCones(env, cones),
    drawTape: (game: TapeGame) => drawTape(env, game),
  };
}
