// The NIGHT LAYER: the dark over the world and the ONLY light that cuts through it, at every hour
// (the car pictures paint lamps, never light). A light map the size of the art buffer is filled
// with the night's dark each frame; headlight beams, lamp pools and the cars' lamp glows are
// rubbed out of it (destination-out, with pictures drawn once: no gradient is made per frame),
// then the glows' colour is laid in as a tint; then it is laid over the screen canvas once, under
// the HUD. The cost is one extra full-screen image a frame.
import { DAYLIGHT } from '../world/daylight.ts';
import { activeLamps, lampsLit } from '../world/lamps.ts';
import { indicatorBlinkOn, lampLevel } from './cars.ts';
import { traceDecks } from './lightdecks.ts';
import { drawEventGlows } from './eventglows.ts';
import { BRAKE_GLOW, BRAKE_GLOW_HOT, BRAKE_GLOW_M, hotBrakes } from './brakeglow.ts';
import { HALO_X, STREAK_S } from './particles.ts';
import { traceCanopies } from './trees.ts';
import { PROPS } from '../world/state.ts';
import {
  REVERSE_BEAM_HALF_M, REVERSE_BEAM_REACH_M, REVERSE_BEAM_STRENGTH, REVERSE_GLOW,
  REVERSE_GLOW_LEVEL,
  REVERSE_SIDE_SHARE, isReversing,
} from './reverselights.ts';
import type { RenderCar, RenderGame, View } from './types.ts';

// the night's dark at darkness 1 this opaque (the darkest patches still show the track's shape
// faintly); its colour is the sky's (world/daylight.ts: blue-black, or a sunrise / sunset)
const NIGHT_ALPHA = 0.9;
// a headlight beam: where it starts ahead of the car's centre, its reach and half spread, m
const BEAM_START_M = 1.8, BEAM_REACH_M = 32, BEAM_HALF_M = 9;
// each headlight's sideways offset from the car's centre line, m
const LAMP_SIDE_M = 0.7;
// how much of the dark one headlight rubs out at its brightest (two overlap to ~0.84)
const BEAM_STRENGTH = 0.6;
// a lamp's glow at night: its radius, m, and its strength at darkness 1; a tail light's share of
// a brake light's glow
const GLOW_M = 1.8, GLOW_STRENGTH = 0.7, TAIL_GLOW = 0.35;
// the glows' colours, 'r,g,b': indicators amber; brake, tail and rain lights red; a street
// light's head warm
const AMBER = '255,160,40', RED = '255,40,28', WARM = '255,217,138';
// a lit street light's head glow: its radius, m (the car glows' strength, by its brightness)
const HEAD_GLOW_M = 1.1;
// the light map reaches this many art px past every edge of the screen: it is laid at the
// frame's sub-pixel shift (up to an art px either way), which left an undarkened strip along one
// edge that jumped from side to side as the camera moved (owner: "light edges dancing")
const MAP_MARGIN = 2;
// a lamp pool's warm tint: its colour, 'r,g,b', its strength in the middle and its radius as a
// share of the pool's (a floodlight's 34 m pool is tinted out to ~18 m)
const POOL_TINT_RGB = '255,246,214', POOL_TINT_ALPHA = 0.16, POOL_TINT_SHARE = 0.53;
// the side of the beam and pool pictures, px
const PICTURE_PX = 128;

/** What the night layer reads from the renderer. */
export interface NightParts {
  view: View;
  pcanvas: HTMLCanvasElement;
  mainCtx: CanvasRenderingContext2D;
  state: { blockPx: number };
  PPMz: () => number;
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
  sparks: SparkLight[];   // render/particles.ts: the sparks flying now
}

/** A spark as the night reads it (render/particles.ts). */
interface SparkLight { x: number; y: number; vx: number; vy: number; sz: number; age: number;
  life: number }

/** The sub-pixel shift the art buffer was blitted with this frame, device px. */
export interface NightLock {
  subX: number;
  subY: number;
}

/**
 * A square picture, drawn once.
 * @param paint draws into the picture's context
 * @returns the picture
 */
function makePicture(paint: (pictureCtx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = PICTURE_PX;
  canvas.height = PICTURE_PX;
  paint(canvas.getContext('2d')!);
  return canvas;
}

// the beam's soft sides: cones nested from the full spread inwards, each adding this much (a hard
// cone edge stepped and crawled across the art pixels as the car turned)
const BEAM_SPREADS = [1, 0.8, 0.6, 0.4], BEAM_LAYER_ALPHA = 0.25;

/**
 * A headlight beam facing +x from the middle of the left edge: a cone, brightest near the lamp
 * and along its middle, fading to nothing at its sides and its end.
 * @param pictureCtx the picture's context
 */
function paintBeam(pictureCtx: CanvasRenderingContext2D) {
  const mid = PICTURE_PX / 2;
  const glow = pictureCtx.createRadialGradient(0, mid, 0, 0, mid, PICTURE_PX);
  glow.addColorStop(0.05, 'rgba(255,255,255,1)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.globalAlpha = BEAM_LAYER_ALPHA;
  for (const spread of BEAM_SPREADS) {
    pictureCtx.beginPath();
    pictureCtx.moveTo(0, mid - 3);
    pictureCtx.lineTo(PICTURE_PX, mid - mid * spread);
    pictureCtx.lineTo(PICTURE_PX, mid + mid * spread);
    pictureCtx.lineTo(0, mid + 3);
    pictureCtx.closePath();
    pictureCtx.fill();
  }
  pictureCtx.globalAlpha = 1;
}

// a glow picture's profile, [share of the radius, alpha]: the rub-out lights the halo; the tint is
// tighter and fuller, so its colour sits on the lamp as a hot core
const GLOW_STOPS: [number, number][] = [[0, 0.9], [0.3, 0.35], [1, 0]];
const TINT_STOPS: [number, number][] = [[0, 1], [0.15, 0.7], [0.5, 0]];

/**
 * A lamp's glow picture in one colour, full in the middle, fading to its rim.
 * @param rgb the colour, 'r,g,b'
 * @param stops its profile
 * @returns paints the picture
 */
function glowOf(rgb: string, stops: [number, number][]) {
  return (pictureCtx: CanvasRenderingContext2D) => {
    const mid = PICTURE_PX / 2;
    const glow = pictureCtx.createRadialGradient(mid, mid, 0, mid, mid, mid);
    for (const [share, alpha] of stops) {
      glow.addColorStop(share, 'rgba(' + rgb + ',' + alpha + ')');
    }
    pictureCtx.fillStyle = glow;
    pictureCtx.fillRect(0, 0, PICTURE_PX, PICTURE_PX);
  };
}

/**
 * What the lamp glows are drawn with: the light map, the glow pictures (white to rub the dark
 * out, coloured to tint it) and the art-px mapping.
 */
interface GlowPainter {
  ctx: CanvasRenderingContext2D;
  glow: HTMLCanvasElement;      // indicators (amber, or white for the rub-out)
  redGlow: HTMLCanvasElement;   // brake, tail and rain lights (red, or white)
  reverseGlow: HTMLCanvasElement;   // reversing lights (cool white, or white)
  brakeGlow: HTMLCanvasElement;   // hot brake discs (orange, or white)
  brakeHotGlow: HTMLCanvasElement;   // the hottest brake discs (deep red, or white)
  headGlow: HTMLCanvasElement;  // a street light's head (warm, or white)
  strength: number;             // this frame's glow strength (by the dark)
  mapX: (worldX: number) => number;
  mapY: (worldY: number) => number;
  perMetre: () => number;
  sparks?: SparkLight[];   // the rub-out painter only: sparks open the dark along their streaks
}

/**
 * SPARKS ARE LIGHT (owner: "they should glow"; no glow patch beside the rim): each spark opens the
 * dark along its streak, as wide as its halo, so it shows at full brightness at night and lights
 * the road it flies over - the one light map, no second light.
 * @param painter the rub-out painter
 * @param sparks the sparks flying now
 */
function openSparks(painter: GlowPainter, sparks: SparkLight[]) {
  if (!sparks.length) return;
  const ctx = painter.ctx, perMetre = painter.perMetre();
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (const spark of sparks) {
    const gone = spark.age / spark.life;
    ctx.globalAlpha = 1 - gone * gone;
    ctx.lineWidth = Math.max(1, spark.sz * HALO_X * perMetre);
    ctx.beginPath();
    ctx.moveTo(painter.mapX(spark.x), painter.mapY(spark.y));
    ctx.lineTo(painter.mapX(spark.x - spark.vx * STREAK_S),
      painter.mapY(spark.y - spark.vy * STREAK_S));
    ctx.stroke();
  }
}

/**
 * Draws every car's lamp glows with the painter (stronger the darker it is), in the canvas's
 * current blend.
 * @param painter the canvas and the mapping
 * @param game the game drawn
 */
function paintGlows(painter: GlowPainter, game: RenderGame) {
  paintCarGlows(painter, game);
  if (lampsLit()) drawHeadGlows(painter);
}

/**
 * Draws every car's lamp glows with the painter (stronger the darker it is), in the canvas's
 * current blend.
 * @param painter the canvas and the mapping
 * @param game the game drawn
 */
function paintCarGlows(painter: GlowPainter, game: RenderGame) {
  const isBlinkOn = indicatorBlinkOn();
  painter.strength = GLOW_STRENGTH * DAYLIGHT.darkness;
  if (painter.sparks) openSparks(painter, painter.sparks);
  if (game.traffic) for (const car of game.traffic.cars) drawCarGlows(painter, car, isBlinkOn);
  for (const rival of game.ai || []) drawCarGlows(painter, rival.car, isBlinkOn);
  drawCarGlows(painter, game.car, isBlinkOn);
}

/**
 * Each lit street light's head glows warm (a pylon's heads are small: its pool is its light).
 * @param painter the light map and the mapping
 */
function drawHeadGlows(painter: GlowPainter) {
  painter.strength = GLOW_STRENGTH * DAYLIGHT.darkness;
  const size = 2 * HEAD_GLOW_M * painter.perMetre();
  for (const lamp of activeLamps()) {
    if (lamp.kind !== 'street' || lamp.down || lamp.shown <= 0) continue;
    painter.ctx.globalAlpha = painter.strength * lamp.shown;
    painter.ctx.drawImage(painter.headGlow, painter.mapX(lamp.headX) - size / 2,
      painter.mapY(lamp.headY) - size / 2, size, size);
  }
}

/**
 * One glow at a point of the car's body.
 * @param painter the light map and the mapping
 * @param car the car
 * @param along metres ahead of the car's centre (negative: behind)
 * @param across metres to its +y side
 * @param picture the glow picture
 * @param level its brightness, 0..1
 * @param radiusM its radius, m (a lamp's GLOW_M)
 */
function glowAt(painter: GlowPainter, car: RenderCar, along: number, across: number,
    picture: HTMLCanvasElement, level: number, radiusM = GLOW_M) {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const size = 2 * radiusM * painter.perMetre();
  const x = painter.mapX(car.x + cos * along - sin * across);
  const y = painter.mapY(car.y + sin * along + cos * across);
  painter.ctx.globalAlpha = painter.strength * level;
  painter.ctx.drawImage(picture, x - size / 2, y - size / 2, size, size);
}

/**
 * One car's lamp glows over the dark: lit indicators (hazards both sides) amber; brake lights,
 * tail lights (dimmer, with the headlights) and the rain light red. A broken lamp does not glow.
 * @param painter the light map and the mapping
 * @param car the car
 * @param isBlinkOn the indicators are in the lit half of their blink
 */
function drawCarGlows(painter: GlowPainter, car: RenderCar, isBlinkOn: boolean) {
  if (isBlinkOn) drawIndicatorGlows(painter, car);
  drawRearGlows(painter, car);
  // hot brake discs glow at their wheels (render/brakeglow.ts): orange, redder the hotter
  for (const wheel of hotBrakes(car)) {
    const red = wheel.level;
    glowAt(painter, car, wheel.along, wheel.across, painter.brakeGlow, wheel.level * (1 - red),
      BRAKE_GLOW_M);
    glowAt(painter, car, wheel.along, wheel.across, painter.brakeHotGlow, wheel.level * red,
      BRAKE_GLOW_M);
  }
}

/**
 * A car's lit indicators glow amber (hazards: both sides).
 * @param painter the light map and the mapping
 * @param car the car
 */
function drawIndicatorGlows(painter: GlowPainter, car: RenderCar) {
  const halfLen = car.spec.len / 2, halfWid = car.spec.wid / 2;
  const side = car.hazard ? 0 : car.indicator || 0;
  if (!side && !car.hazard) return;
  // corners (damage.ts): 0 front -y, 1 front +y, 2 rear -y, 3 rear +y
  for (const along of [halfLen, -halfLen]) {
    for (const across of side ? [side * halfWid] : [-halfWid, halfWid]) {
      if (lampLevel(car, (along > 0 ? 0 : 2) + (across > 0 ? 1 : 0)))
        glowAt(painter, car, along, across, painter.glow, 1);
    }
  }
}

/**
 * A car's brake lights, tail lights (dimmer, with the headlights) and rain light glow red.
 * @param painter the light map and the mapping
 * @param car the car
 */
function drawRearGlows(painter: GlowPainter, car: RenderCar) {
  const halfLen = car.spec.len / 2, halfWid = car.spec.wid / 2;
  const rear = car.brakeLight! > 0.05 ? 1 : car.lightsOn ? TAIL_GLOW : 0;
  if (rear) {
    if (lampLevel(car, 2)) glowAt(painter, car, -halfLen, -halfWid * 0.7, painter.redGlow, rear);
    if (lampLevel(car, 3)) glowAt(painter, car, -halfLen, halfWid * 0.7, painter.redGlow, rear);
  }
  if (car.rainLight) glowAt(painter, car, -halfLen, 0, painter.redGlow, 0.8);
  if (!isReversing(car)) return;
  const side = halfWid * REVERSE_SIDE_SHARE;
  const level = REVERSE_GLOW_LEVEL;
  if (lampLevel(car, 2)) glowAt(painter, car, -halfLen, -side, painter.reverseGlow, level);
  if (lampLevel(car, 3)) glowAt(painter, car, -halfLen, side, painter.reverseGlow, level);
}

/**
 * A round pool of light, full in the middle, fading to its rim.
 * @param pictureCtx the picture's context
 */
function paintPool(pictureCtx: CanvasRenderingContext2D) {
  const mid = PICTURE_PX / 2;
  const glow = pictureCtx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.fillRect(0, 0, PICTURE_PX, PICTURE_PX);
}

/**
 * A pool's warm tint, full in the middle, fading to its rim.
 * @param pictureCtx the picture's context
 */
function paintPoolTint(pictureCtx: CanvasRenderingContext2D) {
  const mid = PICTURE_PX / 2;
  const glow = pictureCtx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, 'rgba(' + POOL_TINT_RGB + ',1)');
  glow.addColorStop(0.5, 'rgba(' + POOL_TINT_RGB + ',0.5)');
  glow.addColorStop(1, 'rgba(' + POOL_TINT_RGB + ',0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.fillRect(0, 0, PICTURE_PX, PICTURE_PX);
}

/** What the pools are painted with: the light map, the pool pictures and the art-px mapping. */
interface PoolPainter {
  lightCtx: CanvasRenderingContext2D;
  pool: HTMLCanvasElement;
  tint: HTMLCanvasElement;
  artX: (worldX: number) => number;
  artY: (worldY: number) => number;
  artPerMetre: () => number;
  isNear: (x: number, y: number, reach: number) => boolean;
}

/**
 * Rubs one pool of light out of the dark when it reaches the light map.
 * @param painter the light map and the mapping
 * @param x the pool's centre, art px
 * @param y the pool's centre, art px
 * @param size its diameter, art px
 */
function drawPool(painter: PoolPainter, picture: HTMLCanvasElement, x: number, y: number,
    size: number) {
  if (!painter.isNear(x, y, size / 2)) return;
  painter.lightCtx.drawImage(picture, x - size / 2, y - size / 2, size, size);
}

/**
 * The pools of light below each lit lamp (world/lamps.ts; the light is where its head is): in
 * the rub-out blend the pool lights the dark; in source-over its warm tint colours it.
 * @param painter the light map and the mapping
 * @param isTint true for the warm tint (source-over), false for the rub-out
 */
function drawPools(painter: PoolPainter, isTint: boolean) {
  const { lightCtx, artX, artY, artPerMetre } = painter;
  if (!lampsLit()) return;
  const picture = isTint ? painter.tint : painter.pool;
  const share = isTint ? POOL_TINT_SHARE : 1;
  for (const lamp of activeLamps()) {
    if (lamp.shown <= 0) continue;
    lightCtx.globalAlpha = lamp.shown * (isTint ? POOL_TINT_ALPHA : 1);
    drawPool(painter, picture, artX(lamp.headX), artY(lamp.headY),
      2 * lamp.poolM * share * artPerMetre());
  }
  lightCtx.globalAlpha = 1;
}

/**
 * The light map's glows: the glow's shape in white rubs the dark out, then the tighter coloured
 * pictures tint it. Art px, no shift: the map is laid at the shift.
 * @param pools the light map and its art-px mapping
 * @returns paint(game, tintFirst): called in the map's rub-out blend; tintFirst paints the
 *   other tints (the pools') under the glows' once the blend is source-over; leaves it in
 *   source-over, alpha 1
 */
function makeMapGlows(pools: PoolPainter, sparks: SparkLight[]) {
  const whiteGlow = makePicture(glowOf('255,255,255', GLOW_STOPS));
  const tint: GlowPainter = { ctx: pools.lightCtx, strength: 0,
    glow: makePicture(glowOf(AMBER, TINT_STOPS)), redGlow: makePicture(glowOf(RED, TINT_STOPS)),
    headGlow: makePicture(glowOf(WARM, TINT_STOPS)),
    reverseGlow: makePicture(glowOf(REVERSE_GLOW, TINT_STOPS)),
    brakeGlow: makePicture(glowOf(BRAKE_GLOW, TINT_STOPS)),
    brakeHotGlow: makePicture(glowOf(BRAKE_GLOW_HOT, TINT_STOPS)),
    mapX: pools.artX, mapY: pools.artY, perMetre: pools.artPerMetre };
  const out: GlowPainter = { ...tint, glow: whiteGlow, redGlow: whiteGlow, headGlow: whiteGlow,
    reverseGlow: whiteGlow, brakeGlow: whiteGlow, brakeHotGlow: whiteGlow, sparks };
  const paint = (game: RenderGame, tintFirst: () => void) => {
    paintGlows(out, game);
    pools.lightCtx.globalCompositeOperation = 'source-over';
    tintFirst();
    paintGlows(tint, game);
    pools.lightCtx.globalAlpha = 1;
  };
  // the cars' glows and the lamp heads' apart, for the decks' order (paintUnderDecks)
  const parts = {
    rubCars: (game: RenderGame) => paintCarGlows(out, game),
    rubHeads: () => lampsLit() && drawHeadGlows(out),
    tintCars: (game: RenderGame) => paintCarGlows(tint, game),
    tintHeads: () => lampsLit() && drawHeadGlows(tint),
  };
  return { paint, parts };
}

/**
 * Rubs a car's headlight beams out of the dark (a broken lamp has none).
 * @param painter the light map and the mapping
 * @param beam the beam picture
 * @param car the car
 */
function drawBeams(painter: PoolPainter, beam: HTMLCanvasElement, car: RenderCar) {
  if (!car.lightsOn) return;
  const { lightCtx, artX, artY } = painter;
  const scale = painter.artPerMetre(), cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const reach = BEAM_REACH_M * scale;
  if (!painter.isNear(artX(car.x), artY(car.y), reach)) return;
  const along = reach / PICTURE_PX, across = (2 * BEAM_HALF_M * scale) / PICTURE_PX;
  for (let corner = 0; corner < 2; corner++) {
    const level = lampLevel(car, corner);
    if (!level) continue;
    const side = corner === 0 ? -LAMP_SIDE_M : LAMP_SIDE_M;
    const lampX = car.x + cos * BEAM_START_M - sin * side;
    const lampY = car.y + sin * BEAM_START_M + cos * side;
    lightCtx.globalAlpha = BEAM_STRENGTH * level;
    lightCtx.setTransform(cos * along, sin * along, -sin * across, cos * across,
      artX(lampX), artY(lampY));
    lightCtx.drawImage(beam, 0, -PICTURE_PX / 2);
  }
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
  lightCtx.globalAlpha = 1;
}

/**
 * Rubs every car's headlight beams out of the dark: traffic, the AI, the player.
 * @param painter the light map and the mapping
 * @param beam the beam picture
 * @param game the game drawn
 */
function drawFieldBeams(painter: PoolPainter, beam: HTMLCanvasElement, game: RenderGame) {
  const each = (car: RenderCar) => {
    drawBeams(painter, beam, car);
    drawReverseBeams(painter, beam, car);
  };
  if (game.traffic) for (const car of game.traffic.cars) each(car);
  for (const rival of game.ai || []) each(rival.car);
  each(game.car);
}

/**
 * Rubs a reversing car's short, dim reversing beams out of the dark behind it (a broken rear
 * lamp has none; render/reverselights.ts).
 * @param painter the light map and the mapping
 * @param beam the beam picture
 * @param car the car
 */
function drawReverseBeams(painter: PoolPainter, beam: HTMLCanvasElement, car: RenderCar) {
  if (!isReversing(car)) return;
  const { lightCtx, artX, artY } = painter;
  const scale = painter.artPerMetre(), reach = REVERSE_BEAM_REACH_M * scale;
  if (!painter.isNear(artX(car.x), artY(car.y), reach)) return;
  // facing backwards: the beam picture turned round
  const cos = -Math.cos(car.heading), sin = -Math.sin(car.heading);
  const along = reach / PICTURE_PX, across = (2 * REVERSE_BEAM_HALF_M * scale) / PICTURE_PX;
  const halfLen = car.spec.len / 2, side = (car.spec.wid / 2) * REVERSE_SIDE_SHARE;
  for (const [corner, offset] of [[2, side], [3, -side]]) {
    const level = lampLevel(car, corner);
    if (!level) continue;
    const lampX = car.x + cos * halfLen - sin * offset;
    const lampY = car.y + sin * halfLen + cos * offset;
    lightCtx.globalAlpha = REVERSE_BEAM_STRENGTH * level;
    lightCtx.setTransform(cos * along, sin * along, -sin * across, cos * across,
      artX(lampX), artY(lampY));
    lightCtx.drawImage(beam, 0, -PICTURE_PX / 2);
  }
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
  lightCtx.globalAlpha = 1;
}

/**
 * Puts the night's dark back over the tree canopies, after every light and tint: a
 * canopy hangs above the cars, the lamps' and signs' light below it never reaches its top.
 * @param pools the light map and its art-px mapping
 * @param darkFill the night's dark this frame
 */
function darkenCanopies(pools: PoolPainter, darkFill: string) {
  if (!PROPS) return;
  const lightCtx = pools.lightCtx;
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
  lightCtx.globalAlpha = 1;
  lightCtx.beginPath();
  if (!traceCanopies(lightCtx, PROPS, pools)) return;
  lightCtx.globalCompositeOperation = 'destination-out';
  lightCtx.fillStyle = '#000';
  lightCtx.fill();
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = darkFill;
  lightCtx.fill();
}

/** What the decks' order paints with (createNight's parts). */
interface DeckPainter {
  pools: PoolPainter;
  mapGlows: ReturnType<typeof makeMapGlows>;
  darkFill: string;
  drawAllBeams: (game: RenderGame) => void;
}

/**
 * The light map with a deck on it (the decks' path traced, the map dark, in the rub-out blend):
 * the cars' beams and glows rubbed out, the dark put back over the decks (cleared, then filled),
 * then the lamps' pools and heads (they hang above), then the tints - the cars' kept off the
 * decks. Leaves it in source-over, alpha 1.
 * @param painter the light map's parts
 * @param game the game drawn
 */
function paintUnderDecks(painter: DeckPainter, game: RenderGame) {
  const { pools, mapGlows } = painter, lightCtx = pools.lightCtx, canvas = lightCtx.canvas;
  painter.drawAllBeams(game);
  mapGlows.parts.rubCars(game);
  lightCtx.globalAlpha = 1;
  lightCtx.fillStyle = '#000';
  lightCtx.fill();
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = painter.darkFill;
  lightCtx.fill();
  lightCtx.globalCompositeOperation = 'destination-out';
  drawPools(pools, false);
  drawEventGlows(pools, false, game);
  mapGlows.parts.rubHeads();
  lightCtx.globalCompositeOperation = 'source-over';
  drawPools(pools, true);
  drawEventGlows(pools, true, game);
  lightCtx.save();
  lightCtx.beginPath();
  lightCtx.rect(0, 0, canvas.width, canvas.height);
  traceDecks(lightCtx, pools);
  lightCtx.clip('evenodd');
  mapGlows.parts.tintCars(game);
  lightCtx.restore();
  mapGlows.parts.tintHeads();
  lightCtx.globalAlpha = 1;
}

/**
 * Builds the night layer.
 * @param parts what it reads from the renderer
 * @returns draw(game, lock): lays this frame's night over the screen (nothing in daylight)
 */
export function createNight(parts: NightParts) {
  const canvas = document.createElement('canvas');
  const lightCtx = canvas.getContext('2d')!;
  const beam = makePicture(paintBeam), pool = makePicture(paintPool);
  const tint = makePicture(paintPoolTint);
  let darkFill = '', darkFor = -1, rgbFor = '';

  // art px per metre and a world point in art px
  const artPerMetre = () => parts.PPMz() * parts.view.dpr;
  const artX = (worldX: number) => parts.toScreenX(worldX) * parts.view.dpr + MAP_MARGIN;
  const artY = (worldY: number) => parts.toScreenY(worldY) * parts.view.dpr + MAP_MARGIN;
  const isNear = (x: number, y: number, reach: number) =>
    x > -reach && y > -reach && x < canvas.width + reach && y < canvas.height + reach;

  const pools: PoolPainter = { lightCtx, pool, tint, artX, artY, artPerMetre, isNear };
  const mapGlows = makeMapGlows(pools, parts.sparks);
  const drawAllBeams = (game: RenderGame) => drawFieldBeams(pools, beam, game);

  function paintLightMap(game: RenderGame) {
    const { pcanvas } = parts;
    if (canvas.width !== pcanvas.width + 2 * MAP_MARGIN
      || canvas.height !== pcanvas.height + 2 * MAP_MARGIN) {
      canvas.width = pcanvas.width + 2 * MAP_MARGIN;
      canvas.height = pcanvas.height + 2 * MAP_MARGIN;
    }
    if (darkFor !== DAYLIGHT.darkness || rgbFor !== DAYLIGHT.rgb) {
      darkFor = DAYLIGHT.darkness;
      rgbFor = DAYLIGHT.rgb;
      darkFill = 'rgba(' + rgbFor + ',' + (NIGHT_ALPHA * darkFor).toFixed(3) + ')';
    }
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = 'copy';
    lightCtx.fillStyle = darkFill;
    lightCtx.fillRect(0, 0, canvas.width, canvas.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    lightCtx.beginPath();
    if (traceDecks(lightCtx, pools) > 0) {
      paintUnderDecks({ pools, mapGlows, darkFill, drawAllBeams }, game);
    } else {
      drawPools(pools, false);
      drawEventGlows(pools, false, game);
      drawAllBeams(game);
      mapGlows.paint(game, () => {
        drawPools(pools, true);
        drawEventGlows(pools, true, game);
      });
    }
    darkenCanopies(pools, darkFill);
  }

  return (game: RenderGame, lock: NightLock) => {
    if (DAYLIGHT.darkness <= 0) return;
    paintLightMap(game);
    const { mainCtx, state } = parts;
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    // light is smooth: scaled up with blending (nearest made every edge of a beam or pool a
    // staircase that crawled as the car turned and the camera zoomed)
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.imageSmoothingQuality = 'low';
    const margin = MAP_MARGIN * state.blockPx;
    mainCtx.drawImage(canvas, lock.subX - margin, lock.subY - margin,
      canvas.width * state.blockPx, canvas.height * state.blockPx);
    mainCtx.restore();
  };
}
