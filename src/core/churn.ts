// ?churn=pictures|objects: a judder MECHANISM test (memory churn), off unless ?churn is given.
// Why: on the phone the highway drops a frame about once per 170 m of new ground, not from
// drawing, touch or the road slide. Untested: the steady stream of picture memory the highway
// allocates per metre (ground tile canvases + getImageData buffers). This creates churn on
// purpose while driving a circuit that is smooth, so the phone shows which kind makes it drop.
// Rate: 12 events a second (never more than 3 in one frame), the highway's rate.
//  'pictures': per event a 171 x 171 scratch canvas with a few rects, getImageData of all of
//    it, a second 171 x 171 "tile" canvas filled by putImageData. The tile goes in a ring of 72
//    (the tile cache size); scratch and ImageData are dropped at once. The tile is drawn once
//    at 4 x 4 px bottom-left so the GPU uploads it, as the game does with every tile.
//  'objects': per event about 350 KB of small objects { x, y, a, b } (9000 of them), kept in
//    a ring of 60 (5 s at 12 a second, the "mid-life" pattern).

export type ChurnKind = 'pictures' | 'objects';

const RATE = 12;
const MAX_PER_FRAME = 3;
const TILE = 171;
const TILE_RING = 72;
const OBJECT_COUNT = 9000;
const OBJECT_RING = 60;

interface Bits { x: number; y: number; a: number; b: number }

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE; canvas.height = TILE;
  return canvas;
}

function pictureEvent(ring: HTMLCanvasElement[], ctx: CanvasRenderingContext2D): void {
  const scratch = makeCanvas();
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  if (!scratchCtx) return;
  for (let i = 0; i < 6; i++) {
    scratchCtx.fillStyle = `rgb(${(Math.random() * 256) | 0},${(Math.random() * 256) | 0},`
      + `${(Math.random() * 256) | 0})`;
    scratchCtx.fillRect(Math.random() * TILE, Math.random() * TILE,
      20 + Math.random() * 100, 20 + Math.random() * 100);
  }
  const data = scratchCtx.getImageData(0, 0, TILE, TILE);
  const tile = makeCanvas();
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return;
  tileCtx.putImageData(data, 0, 0);
  ring.push(tile);
  if (ring.length > TILE_RING) ring.shift();
  const matrix = ctx.getTransform();
  ctx.drawImage(tile, 0, ctx.canvas.height / matrix.d - 4, 4, 4);
}

function objectEvent(ring: Bits[][]): void {
  const list: Bits[] = [];
  for (let i = 0; i < OBJECT_COUNT; i++) {
    list.push({ x: i, y: Math.random(), a: Math.random(), b: i * 0.5 });
  }
  ring.push(list);
  if (ring.length > OBJECT_RING) ring.shift();
}

export function createChurn(kind: ChurnKind) {
  const tiles: HTMLCanvasElement[] = [];
  const lists: Bits[][] = [];
  let acc = 0;
  return {
    step(dt: number, ctx: CanvasRenderingContext2D): void {
      acc += dt * RATE;
      let left = Math.min(MAX_PER_FRAME, Math.floor(acc));
      acc -= Math.floor(acc);
      while (left-- > 0) {
        if (kind === 'pictures') pictureEvent(tiles, ctx);
        else objectEvent(lists);
      }
    },
  };
}
