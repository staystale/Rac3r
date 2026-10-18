// The NIGHT LAYER (?night=): the dark over the world and the light that cuts through it. A light
// map the size of the art buffer is filled with the night's dark each frame; headlight beams and
// floodlight pools are rubbed out of it (destination-out, with pictures drawn once: no gradient
// is made per frame); then it is laid over the screen canvas once, under the HUD. The cost is one
// extra full-screen image a frame, which the owner's held-frame recording measures.
import { PROPS } from '../world/state.ts';
import { DAYLIGHT } from '../world/daylight.ts';
import { activeLamps, lampsEnabled, lampsLit } from '../world/lamps.ts';
import { lampLevel } from './cars.ts';
import type { RenderCar, RenderGame, View } from './types.ts';

// the night's dark at darkness 1: a deep blue-black this opaque (the darkest patches still show
// the track's shape faintly)
const NIGHT_RGB = '4,8,22', NIGHT_ALPHA = 0.9;
// a headlight beam: where it starts ahead of the car's centre, its reach and half spread, m
const BEAM_START_M = 1.8, BEAM_REACH_M = 32, BEAM_HALF_M = 9;
// each headlight's sideways offset from the car's centre line, m
const LAMP_SIDE_M = 0.7;
// how much of the dark one headlight rubs out at its brightest (two overlap to ~0.84)
const BEAM_STRENGTH = 0.6;
// a floodlight pylon's pool radius without ?lamps=1, m (world/lamps.ts has the lamps' own)
const POOL_PYLON_M = 34;
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
}

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

/**
 * A headlight beam facing +x from the middle of the left edge: a cone, brightest near the lamp.
 * @param pictureCtx the picture's context
 */
function paintBeam(pictureCtx: CanvasRenderingContext2D) {
  const mid = PICTURE_PX / 2;
  const glow = pictureCtx.createRadialGradient(0, mid, 0, 0, mid, PICTURE_PX);
  glow.addColorStop(0.05, 'rgba(255,255,255,1)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  pictureCtx.fillStyle = glow;
  pictureCtx.beginPath();
  pictureCtx.moveTo(0, mid - 3);
  pictureCtx.lineTo(PICTURE_PX, 0);
  pictureCtx.lineTo(PICTURE_PX, PICTURE_PX);
  pictureCtx.lineTo(0, mid + 3);
  pictureCtx.closePath();
  pictureCtx.fill();
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

/** What the pools are painted with: the light map, the pool picture and the art-px mapping. */
interface PoolPainter {
  lightCtx: CanvasRenderingContext2D;
  pool: HTMLCanvasElement;
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
function drawPool(painter: PoolPainter, x: number, y: number, size: number) {
  if (!painter.isNear(x, y, size / 2)) return;
  painter.lightCtx.drawImage(painter.pool, x - size / 2, y - size / 2, size, size);
}

/**
 * The pools of light: below each lit lamp (?lamps=1), else around each floodlight pylon.
 * @param painter the light map and the mapping
 */
function drawPools(painter: PoolPainter) {
  const { lightCtx, artX, artY, artPerMetre } = painter;
  if (lampsEnabled()) {
    if (!lampsLit()) return;
    for (const lamp of activeLamps()) {
      lightCtx.globalAlpha = lamp.level;
      drawPool(painter, artX(lamp.headX), artY(lamp.headY), 2 * lamp.poolM * artPerMetre());
    }
    lightCtx.globalAlpha = 1;
    return;
  }
  const size = 2 * POOL_PYLON_M * artPerMetre();
  for (const prop of PROPS) {
    if (prop.kind === 'pylon') drawPool(painter, artX(prop.x), artY(prop.y), size);
  }
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
  let darkFill = '', darkFor = -1;

  // art px per metre and a world point in art px
  const artPerMetre = () => parts.PPMz() * parts.view.dpr;
  const artX = (worldX: number) => parts.toScreenX(worldX) * parts.view.dpr;
  const artY = (worldY: number) => parts.toScreenY(worldY) * parts.view.dpr;
  const isNear = (x: number, y: number, reach: number) =>
    x > -reach && y > -reach && x < canvas.width + reach && y < canvas.height + reach;

  const pools: PoolPainter = { lightCtx, pool, artX, artY, artPerMetre, isNear };
  function drawBeams(car: RenderCar) {
    if (!car.lightsOn) return;
    const scale = artPerMetre(), cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    const reach = BEAM_REACH_M * scale;
    if (!isNear(artX(car.x), artY(car.y), reach)) return;
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

  function paintLightMap(game: RenderGame) {
    const { pcanvas } = parts;
    if (canvas.width !== pcanvas.width || canvas.height !== pcanvas.height) {
      canvas.width = pcanvas.width;
      canvas.height = pcanvas.height;
    }
    if (darkFor !== DAYLIGHT.darkness) {
      darkFor = DAYLIGHT.darkness;
      darkFill = 'rgba(' + NIGHT_RGB + ',' + (NIGHT_ALPHA * darkFor).toFixed(3) + ')';
    }
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = 'copy';
    lightCtx.fillStyle = darkFill;
    lightCtx.fillRect(0, 0, canvas.width, canvas.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    drawPools(pools);
    if (game.traffic) for (const car of game.traffic.cars) drawBeams(car);
    for (const rival of game.ai || []) drawBeams(rival.car);
    drawBeams(game.car);
    lightCtx.globalCompositeOperation = 'source-over';
  }

  return (game: RenderGame, lock: NightLock) => {
    if (DAYLIGHT.darkness <= 0) return;
    paintLightMap(game);
    const { mainCtx, state } = parts;
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(canvas, lock.subX, lock.subY, canvas.width * state.blockPx,
      canvas.height * state.blockPx);
    mainCtx.restore();
  };
}
