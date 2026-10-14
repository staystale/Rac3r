// the GROUND TILES cache of render.ts (phase 4 of the render.js split): the floor, zones and track
// ribbon painted into world-aligned tiles, blitted each frame. Moved verbatim.
import { BUMPS, LEVEL } from "../world/state.ts";
import type { Settings } from "../core/settings.ts";
import { COL } from "../world/colours.ts";
import { WEAR_CELL, wearDirty, wearEpoch, groundAt } from "../world/wear.ts";
import { visualHeightAt } from "../world/terrain.ts";
import type { Level } from "../world/types.ts";
import type {
  Cam, CamCar, Fly, Overview, SurfaceArt, Tile, TileBudget, TileState, View,
} from "./types.ts";

// what createTiles destructures from the renderer
interface TilesHelpers {
  PPMz: () => number;
  sx: (wx: number) => number;
  sy: (wy: number) => number;
  drawFloor: () => void;
  drawZones: () => void;
  drawLanes: () => void;
  drawTrackRibbon: () => void;
  drawLaneDashes: () => void;
  drawPatches: () => void;
  drawCovers: () => void;
  drawWear: (pass?: string) => void;
  drawCurvedKerbs: () => void;
  SURFACE_ART: Record<string, SurfaceArt | null>;
  PUDDLE_TINT: Record<string, string>;
  getFly: () => Fly | null;
  FLY_HANDOVER: number;
  FLY_PREFETCH: number;
  levelOverview: () => Overview | null;
  artBase: (id: string, fallback: string) => string;
}

export function createTiles(view: View, cam: Cam, settings: Settings, helpers: TilesHelpers) {
  const {
    PPMz, sx, sy, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawLaneDashes, drawPatches,
    drawCovers, drawWear, drawCurvedKerbs, SURFACE_ART, PUDDLE_TINT,
    getFly, FLY_HANDOVER, FLY_PREFETCH, levelOverview, artBase,
  } = helpers;

  // ---------------------------------------------------------------- GROUND TILES (2026-10-03)
  // The floor, the surface zones and the track ribbon never change while you drive (wear and marks
  // are drawn separately, on top), so they are painted into cached TILES and each frame just blits
  // tiles.
  //
  // MEASURED, in order (Stock Car, 4x CPU throttle, 4 s full-throttle run; 240 frames = a clean
  // 60 fps):
  //   no patterns, painted live ............ 229 frames
  //   new patterns, painted live ........... 130 frames (draw 20.6 ms/frame)
  // one big cache, repainted when stale .. 193 frames — every repaint was a 100-200 ms hitch,
  // because the browser RASTERISES thousands of pattern shapes in one go
  //   tiles, <= TILE_BUDGET painted/frame .. see ENGINE.md for the figure after this change
  // Tiles are world-aligned squares at a few fixed ZOOM STEPS. A zoom between steps draws the
  // nearest step's tiles scaled (<= 13% — invisible on ground texture). A tile not ready yet is
  // painted in at most TILE_BUDGET per frame; until then the previous zoom step's tiles stand in
  // (scaled), so a zoom change never shows a hole and never repaints the whole screen in one frame.
  // css px per tile side (?tilepx= for A/B, tools/hwjudder.mjs)
  const TILE_PX = settings.tilePx;
  // 2 -> 1 (perf, 2026-10-03): at phone-ish CPU a tile is ~22 ms, so two in one frame was ~44 ms —
  // a slow frame every time. tiles painted per frame: ONE always, then more while the frame has
  // spent < TILE_MS painting, up to TILE_BUDGET (a fast phone fills a gap in a frame or two, a slow
  // one never stalls); the level overview stands in for the rest. (tileBudget() / takeTile() below)
  const TILE_BUDGET = 4, TILE_MS = 6;
  const tileBudget = (count = TILE_BUDGET) => ({ n: count, first: true, until: performance.now()
      + TILE_MS });
  // may this frame paint one more tile? (the first always; then only inside the time budget)
  function takeTile(budget: TileBudget) {
    if (budget.n <= 0 || (!budget.first && budget.until != null && performance.now()
        > budget.until)) return false;
    budget.n--;
    budget.first = false;
    return true;
  }
  // cached tiles kept; oldest dropped first (~1 MB each at dpr 2). 48 -> 72 so the fly-in's
  // pre-painted close-up steps (~60 tiles) survive to be used. Scaled with the tile AREA, so
  // smaller tiles keep the same ground in memory.
  const TILE_MAX = Math.round(72 * (256 / TILE_PX) ** 2);
  // 3 -> 2 steps per doubling (perf, 2026-10-03): the speed zoom crosses steps all lap and every
  // step is a fresh set of tiles. MEASURED at CPU x4, Test Track lap: 3 steps 51 slow frames / 187
  // tiles; 2 steps 37 / 170. Tiles stretch up to 1.41x.
  const ZSTEP = 2;                // zoom steps per doubling: 1, 0.71, 0.5, 0.35
  // key "level|k|i|j" -> { c: canvas, used: frame number }
  const tiles = new Map<string, Tile>();
  const tileState: TileState = {
    tileFrame: 0, tilesPainted: 0,
    tileMs: 0,                  // total ms spent painting tiles (tools: perf)
    staleRepaints: 0,           // of those, repaints of a tile wear made stale (tools: hwjudder)
    // ms drawing the layers of tiles, incl. scratch set-up (tools/tilecost.mjs)
    msLayers: 0,
    msSnap: 0,                  // ms in paletteSnap (tools/tilecost.mjs)
    msShade: 0,                 // ms in hillShade (tools/tilecost.mjs)
    // tiles painted because none existed at that key (tools/tilecost.mjs)
    newTiles: 0,
    perStep: {},                // tiles painted per zoom step k (tools/tilecost.mjs)
    prefetched: 0,              // tiles painted by prefetch() (tools/tilecost.mjs)
    lastStep: null,
    drawnN: 0,                  // art px per tile the last frame was DRAWN at (tools/hwwobble.mjs)
    standIn: false,             // this frame showed a stand-in somewhere (tools: tile pop-in)
  };
  let tileLevel: Level | null = null, tileDpr = 0, tilePPM = 0, tileLayout = 0;
  const zStepOf = (z: number) => Math.round(ZSTEP * Math.log2(z));
  const zOfStep = (step: number) => Math.pow(2, step / ZSTEP);
  // PIXEL MODE: snap every pixel of a freshly painted ground tile to a LIMITED PALETTE — the
  // surfaces' own colours (SURFACE_ART + COL), plus every translucent layer already blended over
  // every base. Removes the anti-aliased in-between shades that made stones and blob edges soft and
  // blurry in pass 1. Done ONCE per tile (cached), via a 32768-entry lookup (5 bits a channel), so
  // it costs nothing per frame.
  let paletteLUT: Uint32Array | null = null;
  function parseCol(text: unknown) {
    if (typeof text !== 'string') return null;
    let match = text.match(/^#([0-9a-f]{6})$/i);
    if (match) {
      const rgb = parseInt(match[1], 16);
      return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 1];
    }
    match = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (match) return [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]];
    return null;
  }
  function buildPalette() {
    const pal = [];
    const over = (under: number[], overlay: number[]) =>
      [0, 1, 2].map((i) => Math.round(under[i] * (1 - overlay[3]) + overlay[i] * overlay[3]));
    // MEASURED (pass 2): blending every translucent layer over every base gave ~1,500 shades on
    // screen and the blur survived. Now each layer is blended only over ITS OWN surface's base.
    for (const [surfaceId, art] of Object.entries(SURFACE_ART)) {
      if (!art) continue;
      const base = parseCol(art.base)!; pal.push(base.slice(0, 3));
      for (const layer of art.layers) {
        const layerColour = parseCol(layer[1]);
        if (layerColour) pal.push(layerColour[3] >= 0.999 ? layerColour.slice(0, 3) : over(base,
            layerColour));
      }
      const tint = parseCol(PUDDLE_TINT[surfaceId]); if (tint) pal.push(over(base, tint));
    }
    for (const value of Object.values(COL)) {
      const colour = parseCol(value);
      if (colour && colour[3] >= 0.999) pal.push(colour.slice(0, 3));
    }
    ['#f2f2f4', '#d9d9e2', '#ffffff', '#14161c', '#c9c4bc',
        '#fff6e6'].forEach((hex) => pal.push(parseCol(hex)!.slice(0, 3)));
    const lut = new Uint32Array(32768);
    for (let index = 0; index < 32768; index++) {
      const red = ((index >> 10) & 31) * 8 + 4, green = ((index >> 5) & 31) * 8 + 4, blue = (index
          & 31) * 8 + 4;
      let best = 0, bestDist = 1e9;
      for (let i = 0; i < pal.length; i++) {
        const entry = pal[i], dist = (entry[0] - red) ** 2 * 3 + (entry[1] - green) ** 2 * 4
            + (entry[2] - blue) ** 2 * 2;
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      const chosen = pal[best];
      lut[index] = (255 << 24) | (chosen[2] << 16) | (chosen[1] << 8) | chosen[0];
    }
    return lut;
  }
  // snaps cv; with `to`, reads cv and writes the snapped pixels into `to` instead (the tile
  // scratch -> the tile, paintTileInner)
  function paletteSnap(source: HTMLCanvasElement, target = source) {
    if (!paletteLUT) paletteLUT = buildPalette();
    const img = source.getContext('2d')!.getImageData(0, 0, source.width, source.height),
        d32 = new Uint32Array(img.data.buffer);
    for (let i = 0; i < d32.length; i++) {
      const pixel = d32[i]; if ((pixel >>> 24) < 8) continue;
      d32[i] = paletteLUT[(((pixel & 255) >> 3) << 10) | ((((pixel >> 8) & 255) >> 3) << 5)
          | (((pixel >> 16) & 255) >> 3)];
    }
    target.getContext('2d')!.putImageData(img, 0, 0);
  }
  // ?tilegpu=1: the old path (tiles painted + read back on their own GPU canvas) — perf A/B for
  // tools/hwjudder.mjs
  const TILE_GPU = settings.tileGpu;
  // running average ms per tile (starts pessimistic = phone)
  let tileAvg = 20;
  function paintTile(step: number, i: number, j: number) {
    const tp0 = performance.now();
    try {
      return paintTileInner(step, i, j);
    } finally { const dt = performance.now() - tp0; tileState.tileMs += dt; tileAvg += (dt
        - tileAvg) * 0.2; }
  }
  // TILES ARE PAINTED ON A CPU SCRATCH, KEPT ON THE GPU (perf, 2026-10-06; user: "judder on mobile
  // on infinite levels - guess thats as chunks load"). MEASURED (tools/hwjudder.mjs +
  // hwprofile.mjs, highway at 130-240 km/h, CPU x4, phone landscape): the road window moving
  // (stepHighway, ~2 ms) is NOT it; ground tiles are - ~10 a second scroll in at speed and each
  // cost 45 ms, of which paletteSnap's getImageData was ~half: reading back a GPU canvas stalls the
  // GPU pipeline. A tile canvas with willReadFrequently halved the tile (23.6 ms) but then every
  // frame re-uploaded every CPU tile it drew (drawImage 4.8 -> 11.4 % of the run). So: draw + snap
  // on ONE reusable CPU scratch (no readback stall), putImageData once into the tile's own GPU
  // canvas (one upload). a FRESH scratch per tile: a reused one would carry drawing state (line
  // dash, font, smoothing ...) from the last tile
  function tileScratch(size: number) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    return { c: canvas, g: canvas.getContext('2d', { willReadFrequently: true })! };
  }
  // the layers of a ground tile, in drawing order - ONE place, used by the whole-tile and the
  // strip path
  function layerCalls() {
    drawFloor();
    drawZones();
    // UNDER the ribbon: where a lane meets the track, the track wins (lab.js zoneAt does the
    // same)
    drawLanes();
    // ENDLESS: wear UNDER the ribbon (2026-10-06, "dirt in the road"; tools/_dirtroad.mjs): the
    // motorway is all tarmac (it never wears),
    // but a worn verge cell's disc (0.72 x 1.5 m radius) reached ~1 m over the carriageway edge
    // and read as dirt ON the road
    const endless = !!LEVEL.endless;
    if (endless) drawWear('base');
    drawTrackRibbon();
    drawLaneDashes();
    drawPatches();
    // baked in (2026-10-03): see wearDirty below. Under the covers ...
    if (!endless) drawWear('base');
    drawCovers();
    drawWear('cover');    // ... except where the cover itself has changed
    drawCurvedKerbs();    // kerbs last: no surface ever paints over a kerb
  }
  // STRIPS: a tile is painted in this many bands of device rows, one band per stepTile
  // (so a frame can do one strip)
  const STRIPS = 4;
  type TileJob = {
    k: number; i: number; j: number; c: HTMLCanvasElement;
    sc: ReturnType<typeof tileScratch> | null;
    g: CanvasRenderingContext2D; px: number; tw: number; strip: number; strips: number; t0: number;
  };
  function startTile(step: number, i: number, j: number): TileJob {
    const startedAt = performance.now();      // start of the layers stage
    const tileWidth = TILE_PX / (view.PPM * zOfStep(step));     // world metres per tile
    const size = Math.round(TILE_PX * view.dpr);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const scratch = TILE_GPU ? null : tileScratch(size);
    const ctx = scratch ? scratch.g : canvas.getContext('2d')!;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    return {
      k: step, i, j, c: canvas, sc: scratch, g: ctx, px: size, tw: tileWidth, strip: 0,
          strips: STRIPS, t0: startedAt
    };
  }
  // paints the layers into the job's canvas; with `band`, only the device rows [y0px, y1px)
  function layersInto(job: TileJob, y0px: number, y1px: number, band = true) {
    const ctx = job.g;
    const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
    view.ctx = ctx; view.W = view.H = TILE_PX; view.zoom = zOfStep(job.k);
    cam.x = (job.i + 0.5) * job.tw; cam.y = (job.j + 0.5) * job.tw;
    if (band) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath();
      ctx.rect(0, y0px, job.px, y1px - y0px); ctx.clip();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    }
    try {
      layerCalls();
    } finally {
      if (band) ctx.restore();
      Object.assign(view, { ctx: keep.ctx, W: keep.W, H: keep.H, zoom: keep.zoom });
      cam.x = keep.cx; cam.y = keep.cy;
    }
    // canvas 2D defers drawing until pixels are read: this makes the strip's cost land in this
    // call
    if (band) ctx.getImageData(0, y0px, 1, 1);
  }
  function finishTile(job: TileJob) {
    tileState.tilesPainted++;
    tileState.perStep[job.k] = (tileState.perStep[job.k] || 0) + 1;
    const ts0 = performance.now();
    tileState.msLayers += ts0 - job.t0;
    if (job.sc) paletteSnap(job.sc.c, job.c);
    else paletteSnap(job.c);
    const th0 = performance.now();
    tileState.msSnap += th0 - ts0;
    hillShade(job.c, job.tw, (job.i + 0.5) * job.tw, (job.j + 0.5) * job.tw);
    tileState.msShade += performance.now() - th0;
    return job.c;
  }
  // paints the next strip; true when all strips are done
  function stepTile(job: TileJob) {
    const rows = Math.ceil(job.px / job.strips), top = job.strip * rows;
    const bottom = job.strip === job.strips - 1 ? job.px : Math.min(job.px, top + rows);
    layersInto(job, top, bottom);
    job.strip++;
    return job.strip >= job.strips;
  }
  function paintTileInner(step: number, i: number, j: number) {
    const job = startTile(step, i, j);
    layersInto(job, 0, job.px, false);
    return finishTile(job);
  }
  // HILL-SHADING (step 3, 2026-10-03; user: "make sure banked surfaces are clearly shown with
  // brighter spots and shadowing, same with bumps and dips"; chose PIXEL HILL-SHADING). Light from
  // the TOP-LEFT: ground sloping toward it is brighter, away from it darker, in STEPPED bands on
  // square cells (pixel art: squares, no smooth gradients). It reads the SAME height the physics
  // drives on (lab.js bumpAt), so what you see is what you drive. Applied AFTER the palette snap so
  // a shaded patch of grass can never snap to another surface's colour. Baked once per tile: costs
  // nothing per frame. depth: how far a full band moves a colour toward white (lit) or black
  // (shadow). MEASURED (photographed): a plain brightness MULTIPLY of 1.2 was invisible on dark
  // race tarmac (#2d303a), so light is ADDED toward white instead.
  // height outweighs slope so a bump reads LIGHTER overall and a dip DARKER (user)
  // 4 bands: at 3 the Naffcar bank flipped a whole band at the turn apex and read as a seam
  const SHADE = {
    cellM: 0.5, maxCells: 64, gain: 3.0, bands: 4, depth: 0.36, hRef: 0.25, hGain: 0.9,
    slopeK: 0.55
  };
  // toward the light, world frame (screen up-left)
  const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];
  // warm (bright ground only), neutral, cool shadow
  const LIT = [255, 226, 150], LIT_N = [255, 255, 255], SHD = [26, 34, 58];
  const NO_SHADE = settings.noShade;   // perf A/B
  function hillShade(canvas: HTMLCanvasElement, tileWidth: number, centreX: number,
      centreY: number) {
    if (NO_SHADE) return;
    const cells = Math.max(1, Math.min(SHADE.maxCells, Math.ceil(tileWidth / SHADE.cellM)));
    const cell = tileWidth / cells, minX = centreX - tileWidth / 2, minY = centreY - tileWidth / 2;
    // HEIGHTS ONCE on a grid of cell centres with a one-cell border; slopes from the neighbours.
    // MEASURED: 5 lookups per cell (4 for the slope, 1 for the tint) made a Test Track tile ~12 ms
    // on a PC; now (n+2)^2 lookups in all. SAMPLED ON A 2x COARSER GRID and interpolated (perf,
    // 2026-10-03): terrain changes over metres, so heights every 1 m are enough — 4x fewer lookups.
    // MEASURED at CPU x4: ~12 ms of a 26 ms tile was this. Tiles that contain WASHBOARD (0.9 m
    // ripples) keep the full grid so the ripples still show.
    const side = cells + 2, heights = new Float32Array(side * side);
    const fine = BUMPS.some((bump) => bump.kind === 'washboard' && Math.abs(bump.x - centreX)
        < tileWidth / 2 + bump.len! / 2 && Math.abs(bump.y - centreY) < tileWidth / 2 + bump.len!
        / 2);
    if (fine || cells < 8) {
      for (let rowNum = 0; rowNum < side; rowNum++) for (let colNum = 0; colNum
          < side; colNum++) heights[rowNum * side + colNum] = visualHeightAt(minX + (colNum - 0.5)
          * cell, minY + (rowNum - 0.5) * cell);
    } else {
      const coarseSide = Math.ceil(side / 2) + 1, coarse = new Float32Array(coarseSide
          * coarseSide);
      for (let rowNum = 0; rowNum < coarseSide; rowNum++) for (let colNum = 0; colNum
          < coarseSide; colNum++) coarse[rowNum * coarseSide + colNum] = visualHeightAt(minX + (2
          * colNum - 0.5) * cell, minY + (2 * rowNum - 0.5) * cell);
      for (let rowNum = 0; rowNum < side; rowNum++) for (let colNum = 0; colNum < side; colNum++) {
        const coarseCol = colNum >> 1, coarseRow = rowNum >> 1, fracCol = (colNum & 1) * 0.5,
            fracRow = (rowNum & 1) * 0.5;
        const h00 = coarse[coarseRow * coarseSide + coarseCol], h10 = coarse[coarseRow
            * coarseSide + coarseCol + 1], h01 = coarse[(coarseRow + 1) * coarseSide + coarseCol],
            h11 = coarse[(coarseRow + 1) * coarseSide + coarseCol + 1];
        heights[rowNum * side + colNum] = (h00 * (1 - fracCol) + h10 * fracCol) * (1 - fracRow)
            + (h01 * (1 - fracCol) + h11 * fracCol) * fracRow;
      }
    }
    const levels = new Float32Array(cells * cells);
    let any = false;
    for (let rowNum = 0; rowNum < cells; rowNum++) for (let colNum = 0; colNum < cells; colNum++) {
      const centre = (rowNum + 1) * side + (colNum + 1);
      const slope = {
        gx: (heights[centre + 1] - heights[centre - 1]) / (2 * cell), gy: (heights[centre + side]
            - heights[centre - side]) / (2 * cell)
      };
      const raw = (-slope.gx * LIGHT[0] - slope.gy * LIGHT[1]) * SHADE.gain;
      const height = heights[centre];
      const shade = Math.max(-1, Math.min(1, Math.sign(raw) * Math.sqrt(Math.abs(raw))
          * SHADE.slopeK + Math.tanh(height / SHADE.hRef) * SHADE.hGain));
      const quant = Math.round(shade * SHADE.bands) / SHADE.bands;
      if (quant !== 0) any = true;
      // + toward white, - toward black
      levels[rowNum * cells + colNum] = SHADE.depth * quant;
    }
    if (!any) return;                                   // flat tile: nothing to do
    // DRAWN AS TRANSLUCENT SQUARES, not per-pixel (perf, 2026-10-03). "Move toward white by k" IS
    // "draw white at opacity k", so the colours are identical — but there is no getImageData /
    // putImageData readback. MEASURED at CPU x4: once the natural ground put gentle hills on every
    // grass tile, that readback ran on EVERY tile and shading cost ~15 ms of a 29 ms tile. The warm
    // light (for near-white ground, where white cannot show) is chosen per cell from the surface
    // underneath. ONE PATH PER SHADE, not one fillRect per cell (perf, 2026-10-06, the highway
    // judder). MEASURED (tools/hwprofile.mjs, highway, CPU x4): up to 4096 fillRects a tile, each
    // with a fresh rgba() string, were ~half of every ground tile. A cell's style is one of ~9 (2 x
    // SHADE.bands levels x lit / lit-lab / shadow): the same integer-edged rects are gathered per
    // style and filled once. Same pixels (tools/tilediff.mjs): the rects abut, never overlap, so
    // one fill blends each pixel exactly once, as before.
    const ctx = canvas.getContext('2d')!;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pxPerCell = canvas.width / cells, groups = new Map();
    for (let rowNum = 0; rowNum < cells; rowNum++) for (let colNum = 0; colNum < cells; colNum++) {
      const level = levels[rowNum * cells + colNum];
      if (level === 0) continue;
      let col;
      if (level > 0) {
        // only the lab level has the near-white floor; a full ground lookup per cell cost more
        // than the shading itself
        col = LEVEL.id === 'lab' && groundAt(minX + (colNum + 0.5) * cell, minY + (rowNum + 0.5)
            * cell).surface.id === 'lab' ? LIT : LIT_N;
      } else col = SHD;
      const key = (col === SHD ? 0 : col === LIT ? 1 : 2) * 1000 + Math.round(Math.abs(level)
          * 1000);
      let group = groups.get(key);
      if (!group) { group = { col, k: Math.abs(level), r: [] }; groups.set(key, group); }
      const px0 = Math.round(colNum * pxPerCell), py0 = Math.round(rowNum * pxPerCell);
      group.r.push(px0, py0, Math.round((colNum + 1) * pxPerCell) - px0, Math.round((rowNum + 1)
          * pxPerCell) - py0);
    }
    for (const group of groups.values()) {
      ctx.fillStyle = `rgba(${group.col[0]},${group.col[1]},${group.col[2]},${
        group.k.toFixed(3)})`;
      ctx.beginPath();
      const rects = group.r;
      for (let pos = 0; pos < rects.length; pos += 4) ctx.rect(rects[pos], rects[pos + 1],
          rects[pos + 2], rects[pos + 3]);
      ctx.fill();
    }
    ctx.restore();
  }
  // How many tiles of zoom step k that cover the view are not painted yet. Draws nothing.
  function countMissing(step: number) {
    const tileWidth = TILE_PX / (view.PPM * zOfStep(step)), ppm = PPMz();
    const vx0 = cam.x - view.W / 2 / ppm, vx1 = cam.x + view.W / 2 / ppm, vy0 = cam.y - view.H / 2
        / ppm, vy1 = cam.y + view.H / 2 / ppm;
    let missing = 0;
    for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1; i++)
      for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1; j++) if (!tiles.has(step
          + '|' + i + '|' + j)) missing++;
    return missing;
  }
  // Blit every tile of zoom step k that covers the view. Returns how many were missing. With
  // `paint` it paints missing tiles (budget permitting); without, it only draws what exists.
  function blitStep(step: number, paint: boolean, budget: TileBudget) {
    const stepZoom = zOfStep(step), tileWidth = TILE_PX / (view.PPM * stepZoom), ppm = PPMz();
    const vx0 = cam.x - view.W / 2 / ppm, vx1 = cam.x + view.W / 2 / ppm, vy0 = cam.y - view.H / 2
        / ppm, vy1 = cam.y + view.H / 2 / ppm;
    let missing = 0;
    for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1; i++) {
      for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1; j++) {
        const key = step + '|' + i + '|' + j;
        let tile = tiles.get(key);
        if (!tile && paint && takeTile(budget)) {
          tile = { c: paintTile(step, i, j), used: 0 }; tiles.set(key, tile);
          tileState.newTiles++;
        }
        // a STALE tile (wear changed under it) keeps showing until the budget lets it be repainted
        else if (tile && tile.stale && paint && takeTile(budget)) {
          tile.c = paintTile(step, i, j);
          tile.stale = false;
          tileState.staleRepaints++;
        }
        if (!tile) { missing++; continue; }
        tile.used = tileState.tileFrame;
        // integer edges, so neighbouring tiles meet with no hairline seam
        // edges on whole ART pixels (dpr = art px per css px); with the pixel-locked view every
        // tile is the same width
        const left = Math.round(sx(i * tileWidth) * view.dpr) / view.dpr, right = Math.round(sx((i
            + 1) * tileWidth) * view.dpr) / view.dpr;
        const top = Math.round(sy(j * tileWidth) * view.dpr) / view.dpr, bottom = Math.round(sy((j
            + 1) * tileWidth) * view.dpr) / view.dpr;
        view.ctx.drawImage(tile.c, left, top, right - left, bottom - top);
      }
    }
    return missing;
  }
  // WEAR IS BAKED INTO THE TILES (2026-10-03). MEASURED: drawing worn cells live every frame cost
  // the lab panels run 238 -> 197 frames (4x throttle). Now a changed cell only marks the tiles
  // over it STALE; they keep showing until repainted within TILE_BUDGET, so wear appears within a
  // frame or two and costs nothing while it is not changing. Dirty cells are drained at most every
  // WEAR_DRAIN s, which batches a drift that changes many cells into one repaint of the tiles
  // involved.
  const WEAR_DRAIN = 0.15;
  let wearDrainT = 0, seenEpoch = -1;
  function drainWear(wallDt: number) {
    if (seenEpoch !== wearEpoch) {
      seenEpoch = wearEpoch;
      for (const tile of tiles.values()) tile.stale = true;
      wearDirty.length = 0;
      return;
    }
    wearDrainT += wallDt;
    if (wearDrainT < WEAR_DRAIN || wearDirty.length === 0) return;
    wearDrainT = 0;
    for (const [key, tile] of tiles) {
      if (tile.stale) continue;
      const [step, i, j] = key.split('|').map(Number);
      const tileWidth = TILE_PX / (view.PPM * zOfStep(step)), left = i * tileWidth, top = j
          * tileWidth;
      for (const cell of wearDirty) {
        const cellX = cell.cx * WEAR_CELL, cellY = cell.cy * WEAR_CELL;
        if (cellX + WEAR_CELL >= left && cellX <= left + tileWidth && cellY + WEAR_CELL >= top
            && cellY <= top + tileWidth) {
          tile.stale = true;
          break;
        }
      }
    }
    wearDirty.length = 0;
  }
  function drawGround(wallDt = 0, car: CamCar | null = null) {
    drainWear(wallDt);
    tileState.tileFrame++;
    // a re-randomised track (Grass Track)
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
    if (tileLevel !== LEVEL || tileDpr !== view.dpr || tilePPM !== view.PPM || tileLayout
        !== layout) {
      tiles.clear();
      tileLevel = LEVEL;
      tileDpr = view.dpr;
      tilePPM = view.PPM;
      tileLayout = layout;
      tileState.lastStep = null;
    }
    const fly = getFly();
    if (fly && fly.ov && view.zoom < FLY_HANDOVER) {
      const overview = fly.ov;
      view.ctx.fillStyle = COL.outside; view.ctx.fillRect(0, 0, view.W, view.H);
      view.ctx.drawImage(overview.c, sx(overview.x0), sy(overview.y0), (overview.x1 - overview.x0)
          * PPMz(), (overview.y1 - overview.y0) * PPMz());
      if (car) {
        const budget = { n: FLY_PREFETCH };
        // the steps the camera will pass through after the hand-over, nearest-to-final first
        // only the EVEN steps are used during the flight (see below) — three steps, ~60 tiles,
        // not ~90
        for (let step = 0; step >= zStepOf(FLY_HANDOVER) - 1 && budget.n
            > 0; step -= 2) prefetch(step, car.x, car.y, zOfStep(step) / 1.6, budget);
      }
      tileState.lastStep = null;
      return;
    }
    // HYSTERESIS on the zoom step (perf, 2026-10-03): the speed zoom wanders across step boundaries
    // all the time and every switch repaints the whole view. Stay on the current step until the
    // zoom is 0.75 of a step away from it.
    // flight: even steps only, finer side
    let step = fly ? 2 * Math.ceil(zStepOf(view.zoom) / 2) : zStepOf(view.zoom);
    if (!fly && tileState.lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom)
        - tileState.lastStep) < 0.75) step = tileState.lastStep;
    const budget = tileBudget();
    // count what the wanted step is missing BEFORE painting, to decide whether a stand-in is
    // needed
    if (tileState.lastStep !== null && tileState.lastStep !== step && countMissing(step) > 0) {
      // the stand-in: the step we were on, scaled. Drawn first, then whatever of k exists goes
      // over it.
      view.ctx.fillStyle = standInFill(); view.ctx.fillRect(0, 0, view.W, view.H);
      blitStep(tileState.lastStep, false, budget);
      const left = blitStep(step, true, budget);
      tileState.standIn = left > 0;
      if (left === 0) tileState.lastStep = step;
    } else {
      // STAND-IN FOR NEW GROUND (perf, 2026-10-03; user: "still seeing lag at high speeds"). This
      // used to paint EVERY missing tile in the frame it appeared — MEASURED at CPU x4: frames up
      // to ~150 ms when ground scrolled in at speed. Now: the whole- level overview (the fly-in's
      // flat painting, kept per level) goes down first, then at most TILE_BUDGET real tiles; the
      // rest arrive over the next frames, so a frame or two shows a softer patch at the edge
      // instead of a stall.
      if (countMissing(step) > 1) {
        const overview = levelOverview();
        if (overview) {
          view.ctx.fillStyle = standInFill();
          view.ctx.fillRect(0, 0, view.W, view.H);
          view.ctx.drawImage(overview.c, sx(overview.x0), sy(overview.y0), (overview.x1
              - overview.x0) * PPMz(), (overview.y1 - overview.y0) * PPMz());
        }
        tileState.standIn = blitStep(step, true, budget) > 0;
      } else { blitStep(step, true, { n: Infinity }); tileState.standIn = false; }
      tileState.lastStep = step;
    }
    // (A LOOK-AHEAD painter was tried here, 2026-10-03: one tile per spare frame from where the car
    // is heading. MEASURED at CPU x4 it made things WORSE — 97 slow frames per lap vs 51 without,
    // and more tiles in total. Removed.) BACK, GATED ON TILE COST (user, 2026-10-04: "block loading
    // is chunky / visible on PC"). A big PC screen needs ~3x the tiles of a phone, so at 1 tile a
    // frame 27% of frames showed the flat stand-in (1600x900, 159 of 600). On a device that paints
    // a tile in < AHEAD_MAX_MS, a frame with NOTHING missing paints one tile from the view AHEAD of
    // the car. Phones (12-20 ms a tile at CPU x4) never qualify, so they keep the measured-better
    // behaviour above.
    if (!tileState.standIn && !fly && car && tileAvg < AHEAD_MAX_MS && Math.hypot(car.vx, car.vy)
        > 3) {
      prefetch(step, cam.x + car.vx * AHEAD_S, cam.y + car.vy * AHEAD_S, view.zoom, { n: 1 });
    }
    if (tiles.size > TILE_MAX) {
      const old = [...tiles.entries()].sort((first, second) => first[1].used - second[1].used);
      for (let index = 0, drop = tiles.size - TILE_MAX; index < drop; index++) {
        tiles.delete(old[index][0]);
      }
    }
  }
  // look-ahead painting: only below this tile cost; view shifted this many s of travel
  const AHEAD_MAX_MS = 9, AHEAD_S = 0.6;

  // under a stand-in: the level's own ground colour where it has one (a missing patch reads as
  // grass, not as a hole)
  const standInFill = () => (LEVEL.base && LEVEL.base.id !== 'lab' ? artBase(LEVEL.base.id,
      COL.floor) : COL.outside);
  // paint (without drawing) the tiles of step k covering a view centred on (cx, cy) at zoom z
  function prefetch(step: number, centreX: number, centreY: number, z: number,
      budget: TileBudget) {
    const tileWidth = TILE_PX / (view.PPM * zOfStep(step)), ppm = view.PPM * z;
    const vx0 = centreX - view.W / 2 / ppm, vx1 = centreX + view.W / 2 / ppm, vy0 = centreY
        - view.H / 2 / ppm, vy1 = centreY + view.H / 2 / ppm;
    for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1 && budget.n > 0; i++)
      for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1 && budget.n > 0; j++) {
        const key = step + '|' + i + '|' + j;
        if (!tiles.has(key)) {
          budget.n--; tiles.set(key, { c: paintTile(step, i, j), used: tileState.tileFrame });
          tileState.prefetched++;
        }
      }
  }

  return {
    tileState, tiles, TILE_PX, ZSTEP, zStepOf, zOfStep, paletteSnap, paintTile, startTile,
        stepTile, finishTile, drawGround,
    prefetch,
  };
}
