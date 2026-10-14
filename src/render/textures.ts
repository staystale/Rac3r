// PRE-PAINTED SURFACE TEXTURES (default; ?tex=0 = live). WHAT: each surface's pattern layers are
// painted ONCE per surface, at the fixed art density TEX_PPM (the car sprites' SPRITE_PPM), into a
// seamless, REPEATING canvas; paintLayers then fills its area with createPattern(texture,
// 'repeat'), scaled to the zoom, in one operation. WHY (MEASURED, task 091): the floor and zones
// layers cost 15-32 ms per tile on grass levels, ~1,800 grass strokes a tile, drawn mark by mark:
// that is the highway / Killder / rally-stage judder. One painting also means the ground is the
// same picture at every zoom, only bigger or smaller, never repainted.
// THE PERIOD: the texture is T x T px, T = round(TEX_M * TEX_PPM), so it repeats every
// period = T / TEX_PPM metres (about TEX_M) in x and y: the look repeats every TEX_M m (the
// owner judges that on the phone). SEAMLESS = PERIODIC: the painters below round every spacing /
// wave / band so a whole number fits in the period, hash the integer cell index wrapped mod the
// count, and redraw the marks that cross an edge from the cells just outside it.
import { LEVEL } from "../world/state.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { ArtLayer } from "./types.ts";

export const TEX_M = 24;        // the repeat distance in metres (owner judges it on the phone)
export const TEX_MAX = 24;      // most textures cached (least recently used goes first)
export const TEX_PPM = SPRITE_PPM;  // art px per metre of every texture (as the car sprites)

type Mark = (
  posX: number, posY: number, rndA: number, rndB: number, rndC: number, ppm: number
) => void;
type Gfx = CanvasRenderingContext2D;
const wrap = (idx: number, cnt: number) => ((idx % cnt) + cnt) % cnt;
const frac = (val: number) => val - Math.floor(val);
const num = (layer: ArtLayer, idx: number) => layer[idx] as number;

// cnt cells across the period and the cell size that makes them fit exactly (<= ~2 % off)
function grid(period: number, spacing: number) {
  const cnt = Math.max(1, Math.round(period / spacing));
  return { cnt, cell: period / cnt };
}

// lattice(): every cell in a band outside [0, period) (one cell, plus what the mark reaches),
// hashed by its WRAPPED integer index, so the pattern repeats exactly
export function latticePeriodic(
  period: number, ppm: number, spacing: number, prob: number, reach: number, mark: Mark
) {
  const { cnt, cell } = grid(period, spacing), band = 1 + Math.ceil(reach / cell);
  for (let idxU = -band; idxU < cnt + band; idxU++) {
    const posU = wrap(idxU, cnt) * cell;
    for (let idxV = -band; idxV < cnt + band; idxV++) {
      const posV = wrap(idxV, cnt) * cell;
      const rndA = frac(Math.sin(posU * 12.9898 + posV * 78.233) * 43758.5453);
      const rndB = frac(Math.sin(posU * 39.3468 + posV * 11.135) * 24634.6345);
      const rndC = frac(Math.sin(posU * 7.1231 + posV * 51.719) * 15731.743);
      if (rndC > prob) continue;
      mark((idxU * cell + (rndA - 0.5) * cell) * ppm, (idxV * cell + (rndB - 0.5) * cell) * ppm,
        rndA, rndB, rndC, ppm);
    }
  }
}

// grain (speckle): the same wrapped cells, one square mark each
function grain(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const spacing = num(layer, 2), side = Math.max(1, num(layer, 3) * ppm);
  if (side < 1.1 && spacing * ppm < 3) return;
  const { cnt, cell } = grid(period, spacing);
  gfx.fillStyle = layer[1];
  for (let idxU = -1; idxU <= cnt; idxU++) {
    for (let idxV = -1; idxV <= cnt; idxV++) {
      const posU = wrap(idxU, cnt) * cell, posV = wrap(idxV, cnt) * cell;
      const jitX = frac(Math.sin(posU * 12.9898 + posV * 78.233) * 43758.5453) - 0.5;
      const jitY = frac(Math.sin(posU * 39.3468 + posV * 11.135) * 24634.6345) - 0.5;
      gfx.fillRect((idxU + jitX) * cell * ppm, (idxV + jitY) * cell * ppm, side, side);
    }
  }
}

// stripes: an even number of bands fits the period, so the bands repeat
function stripes(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const bands = 2 * Math.max(1, Math.round(period / (2 * num(layer, 2))));
  const band = period / bands;
  gfx.fillStyle = layer[1];
  for (let idx = 0; idx < bands; idx += 2) {
    gfx.fillRect(0, idx * band * ppm, period * ppm, band * ppm);
  }
}

// ripples: whole wavelengths across the period, whole line spacings down it, the phase hashed
// by the line index mod the line count
function ripples(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const gap = num(layer, 2), amp = num(layer, 3), wave = num(layer, 4), wid = num(layer, 5);
  if (gap * ppm < 4) return;
  const { cnt, cell } = grid(period, gap);
  const waves = Math.max(1, Math.round(period / wave)), step = period / waves / 6;
  gfx.strokeStyle = layer[1]; gfx.lineWidth = Math.max(1, wid * ppm); gfx.beginPath();
  for (let line = -1; line <= cnt; line++) {
    const phase = Math.sin(wrap(line, cnt) * 12.9898) * 437.5;
    for (let idx = -1; idx <= waves * 6 + 1; idx++) {
      const posY = line * cell + amp * Math.sin((idx / 6) * Math.PI * 2 + phase);
      if (idx < 0) gfx.moveTo(idx * step * ppm, posY * ppm);
      else gfx.lineTo(idx * step * ppm, posY * ppm);
    }
  }
  gfx.stroke();
}

// sheen: the line spacing divides the period, and the slope is nudged so a shift of one period
// moves a line by a whole number of spacings
function sheen(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const gap = num(layer, 2), wid = num(layer, 3), slope0 = num(layer, 4);
  const { cell } = grid(period, gap);
  const slope = Math.round(slope0 * period / cell) * cell / period;
  const left = -wid * 2, right = period + wid * 2;
  const low = Math.min(slope * left, slope * right), high = Math.max(slope * left, slope * right);
  gfx.strokeStyle = layer[1]; gfx.lineWidth = Math.max(1, wid * ppm); gfx.beginPath();
  const first = Math.floor((-wid - high) / cell), last = Math.ceil((period + wid - low) / cell);
  for (let idx = first; idx <= last; idx++) {
    gfx.moveTo(left * ppm, (idx * cell + slope * left) * ppm);
    gfx.lineTo(right * ppm, (idx * cell + slope * right) * ppm);
  }
  gfx.stroke();
}

function stones(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const gap = num(layer, 2), rMin = num(layer, 3), rMax = num(layer, 4), prob = layer[5] ?? 1;
  if (rMax * ppm < 0.8 || gap * ppm < 2.5) return;
  gfx.fillStyle = layer[1]; gfx.beginPath();
  latticePeriodic(period, ppm, gap, prob as number, rMax, (posX, posY, rndA) => {
    const rad = (rMin + (rMax - rMin) * rndA) * ppm;
    gfx.rect(posX - rad, posY - rad, rad * 2, rad * 2);
  });
  gfx.fill();
}

function blobs(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const gap = num(layer, 2), radX = num(layer, 3), radY = num(layer, 4), prob = layer[5] ?? 1;
  if (radY * ppm < 0.8 || gap * ppm < 3) return;
  gfx.fillStyle = layer[1]; gfx.beginPath();
  const reach = Math.max(radX, radY) * 1.3;
  latticePeriodic(period, ppm, gap, prob as number, reach, (posX, posY, rndA, rndB) => {
    const scale = 0.7 + 0.6 * rndB, wid = radX * scale * ppm, hgt = radY * scale * ppm;
    gfx.rect(posX - wid, posY - hgt, wid * 2, hgt * 2);
  });
  gfx.fill();
}

function blades(gfx: Gfx, period: number, ppm: number, layer: ArtLayer, square: boolean) {
  const gap = num(layer, 2), len = num(layer, 3), wid = num(layer, 4), prob = layer[5] ?? 1;
  if (len * ppm < 2 || gap * ppm < 2.5) return;
  gfx.strokeStyle = layer[1]; gfx.lineWidth = Math.max(1, wid * ppm);
  gfx.lineCap = square ? 'butt' : 'round'; gfx.beginPath();
  latticePeriodic(period, ppm, gap, prob as number, len * 1.4, (posX, posY, rndA, rndB) => {
    const size = len * ppm * (0.7 + 0.6 * rndB), tilt = (rndA - 0.5) * 0.9;
    gfx.moveTo(posX, posY);
    gfx.lineTo(posX + Math.sin(tilt - 0.35) * size, posY - Math.cos(tilt - 0.35) * size);
    gfx.moveTo(posX, posY);
    gfx.lineTo(posX + Math.sin(tilt + 0.35) * size, posY - Math.cos(tilt + 0.35) * size);
  });
  gfx.stroke(); gfx.lineCap = 'butt';
}

function cracks(gfx: Gfx, period: number, ppm: number, layer: ArtLayer) {
  const gap = num(layer, 2), len = num(layer, 3), wid = num(layer, 4), prob = layer[5] ?? 1;
  if (len * ppm < 4 || gap * ppm < 4) return;
  gfx.strokeStyle = layer[1]; gfx.lineWidth = Math.max(1, wid * ppm); gfx.beginPath();
  latticePeriodic(period, ppm, gap, prob as number, len, (posX, posY, rndA, rndB, rndC) => {
    let ang = rndA * Math.PI * 2, curX = posX, curY = posY;
    gfx.moveTo(curX, curY);
    for (let seg = 0; seg < 4; seg++) {
      ang += ((seg % 2 ? rndB : rndC) - 0.5) * 1.4;
      curX += Math.cos(ang) * len * 0.3 * ppm; curY += Math.sin(ang) * len * 0.3 * ppm;
      gfx.lineTo(curX, curY);
      if (seg === 1) {
        gfx.lineTo(curX + Math.cos(ang + 1.1) * len * 0.25 * ppm,
          curY + Math.sin(ang + 1.1) * len * 0.25 * ppm);
        gfx.moveTo(curX, curY);
      }
    }
  });
  gfx.stroke();
}

// the whole texture of one surface: its layers in order, every kind periodic ('rings' draws
// nothing in the live code either), so no layer stays live
export function paintTexture(
  gfx: Gfx, period: number, ppm: number, layers: ArtLayer[], square: boolean
) {
  for (const layer of layers) {
    const kind = layer[0];
    if (kind === 'grain') grain(gfx, period, ppm, layer);
    else if (kind === 'stripes') stripes(gfx, period, ppm, layer);
    else if (kind === 'ripples') ripples(gfx, period, ppm, layer);
    else if (kind === 'sheen') sheen(gfx, period, ppm, layer);
    else if (kind === 'stones') stones(gfx, period, ppm, layer);
    else if (kind === 'blobs') blobs(gfx, period, ppm, layer);
    else if (kind === 'blades') blades(gfx, period, ppm, layer, square);
    else if (kind === 'cracks') cracks(gfx, period, ppm, layer);
  }
}

// fill [x0, x1] x [y0, y1] (world m; the context is at the world origin) with the texture: one
// texel is ppm / TEX_PPM of the context's units, so every zoom shows the same picture, nearest
// neighbour (smoothing off), anchored at the world origin
export function fillTexture(gfx: Gfx, tex: HTMLCanvasElement, ppm: number, rect: number[]) {
  const pat = gfx.createPattern(tex, 'repeat');
  if (!pat) return;
  const unit = ppm / TEX_PPM;
  pat.setTransform(new DOMMatrix().scale(unit, unit));
  const smooth = gfx.imageSmoothingEnabled;
  gfx.imageSmoothingEnabled = false;
  gfx.fillStyle = pat;
  const [left, top, right, bottom] = rect as [number, number, number, number];
  gfx.fillRect(left * ppm, top * ppm, (right - left) * ppm, (bottom - top) * ppm);
  gfx.imageSmoothingEnabled = smooth;
}

// the texture cache: key -> canvas, one painting per surface at TEX_PPM whatever the zoom or dpr,
// dropped when the level changes, at most TEX_MAX entries, least recently used evicted first
export function createTextureCache() {
  const cache = new Map<string, HTMLCanvasElement>();
  let level: unknown = null;
  function get(key: string, paint: (gfx: Gfx, period: number) => void) {
    if (level !== LEVEL) { cache.clear(); level = LEVEL; }
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
    const size = Math.round(TEX_M * TEX_PPM);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    // CPU-backed on purpose - the tiles are painted on a CPU scratch, and a GPU texture would be
    // read back on every pattern fill (MEASURED, task 096: rally stage tile 24 -> 10 ms at CPU x4).
    const gfx = canvas.getContext('2d', { willReadFrequently: true })!;
    paint(gfx, size / TEX_PPM);
    cache.set(key, canvas);
    while (cache.size > TEX_MAX) cache.delete(cache.keys().next().value!);
    return canvas;
  }
  return { get };
}