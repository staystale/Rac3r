// the GROUND TILES cache of render.js (phase 4 of the render.js split): the floor, zones and track
// ribbon painted into world-aligned tiles, blitted each frame. Moved verbatim.
import { BUMPS, LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import { WEAR_CELL, wearDirty, wearEpoch, groundAt } from "../world/wear.ts";
import { visualHeightAt } from "../world/terrain.ts";
import { PIXEL } from "../render.js";   // read only at draw time (no load-time cycle)

export function createTiles(view, cam, helpers) {
  const {
    PPMz, sx, sy, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawLaneDashes, drawPatches,
    drawCovers, drawWear, drawCurvedKerbs, SURFACE_ART, PUDDLE_TINT,
    getFly, FLY_HANDOVER, FLY_PREFETCH, prefetch, standInFill, levelOverview,
  } = helpers;

  // ---------------------------------------------------------------- GROUND TILES (2026-10-03)
  // The floor, the surface zones and the track ribbon never change while you drive (wear and marks are
  // drawn separately, on top), so they are painted into cached TILES and each frame just blits tiles.
  //
  // MEASURED, in order (Stock Car, 4x CPU throttle, 4 s full-throttle run; 240 frames = a clean 60 fps):
  //   no patterns, painted live ............ 229 frames
  //   new patterns, painted live ........... 130 frames (draw 20.6 ms/frame)
  //   one big cache, repainted when stale .. 193 frames — every repaint was a 100-200 ms hitch, because
  //                                          the browser RASTERISES thousands of pattern shapes in one go
  //   tiles, <= TILE_BUDGET painted/frame .. see ENGINE.md for the figure after this change
  // Tiles are world-aligned squares at a few fixed ZOOM STEPS. A zoom between steps draws the nearest
  // step's tiles scaled (<= 13% — invisible on ground texture). A tile not ready yet is painted in at
  // most TILE_BUDGET per frame; until then the previous zoom step's tiles stand in (scaled), so a zoom
  // change never shows a hole and never repaints the whole screen in one frame.
  // css px per tile side (?tilepx= for A/B, tools/hwjudder.mjs)
  const TILE_PX = (typeof location !== 'undefined' && +new URLSearchParams(location.search).get('tilepx')) || 256;
  // 2 -> 1 (perf, 2026-10-03): at phone-ish CPU a tile is ~22 ms, so two in one frame was ~44 ms — a slow frame every time.
  // tiles painted per frame: ONE always, then more while the frame has spent < TILE_MS painting, up to TILE_BUDGET (a fast phone fills a
  // gap in a frame or two, a slow one never stalls); the level overview stands in for the rest. (tileBudget() / takeTile() below)
  const TILE_BUDGET = 4, TILE_MS = 6;
  const tileBudget = (n = TILE_BUDGET) => ({ n, first: true, until: performance.now() + TILE_MS });
  // may this frame paint one more tile? (the first always; then only inside the time budget)
  function takeTile(b) { if (b.n <= 0 || (!b.first && b.until != null && performance.now() > b.until)) return false; b.n--; b.first = false; return true; }
  // cached tiles kept; oldest dropped first (~1 MB each at dpr 2). 48 -> 72 so the fly-in's pre-painted close-up steps (~60 tiles)
  // survive to be used. Scaled with the tile AREA, so smaller tiles keep the same ground in memory.
  const TILE_MAX = Math.round(72 * (256 / TILE_PX) ** 2);
  // 3 -> 2 steps per doubling (perf, 2026-10-03): the speed zoom crosses steps all lap and every step is a fresh set of tiles.
  // MEASURED at CPU x4, Test Track lap: 3 steps 51 slow frames / 187 tiles; 2 steps 37 / 170. Tiles stretch up to 1.41x.
  const ZSTEP = 2;                // zoom steps per doubling: 1, 0.71, 0.5, 0.35
  const tiles = new Map();        // key "level|k|i|j" -> { c: canvas, used: frame number }
  const tileState = {
    tileFrame: 0, tilesPainted: 0,
    tileMs: 0,                  // total ms spent painting tiles (tools: perf)
    staleRepaints: 0,           // of those, repaints of a tile wear made stale (tools: hwjudder)
    lastStep: null,
    drawnN: 0,                  // art px per tile the last frame was DRAWN at (tools/hwwobble.mjs)
    standIn: false,             // this frame showed a stand-in somewhere (tools: tile pop-in)
  };
  let tileLevel = null, tileDpr = 0, tilePPM = 0, tileLayout = 0;
  const zStepOf = (z) => Math.round(ZSTEP * Math.log2(z));
  const zOfStep = (k) => Math.pow(2, k / ZSTEP);
  // PIXEL MODE: snap every pixel of a freshly painted ground tile to a LIMITED PALETTE — the surfaces' own colours
  // (SURFACE_ART + COL), plus every translucent layer already blended over every base. Removes the anti-aliased
  // in-between shades that made stones and blob edges soft and blurry in pass 1. Done ONCE per tile (cached), via a
  // 32768-entry lookup (5 bits a channel), so it costs nothing per frame.
  let paletteLUT = null;
  function parseCol(sv) {
    if (typeof sv !== 'string') return null;
    let m = sv.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
    m = sv.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    return null;
  }
  function buildPalette() {
    const pal = [];
    const over = (b, s) => [0, 1, 2].map((i) => Math.round(b[i] * (1 - s[3]) + s[i] * s[3]));
    // MEASURED (pass 2): blending every translucent layer over every base gave ~1,500 shades on screen and the
    // blur survived. Now each layer is blended only over ITS OWN surface's base.
    for (const [id, a] of Object.entries(SURFACE_ART)) {
      if (!a) continue;
      const base = parseCol(a.base); pal.push(base.slice(0, 3));
      for (const L of a.layers) { const c = parseCol(L[1]); if (c) pal.push(c[3] >= 0.999 ? c.slice(0, 3) : over(base, c)); }
      const tint = parseCol(PUDDLE_TINT[id]); if (tint) pal.push(over(base, tint));
    }
    for (const v of Object.values(COL)) { const c = parseCol(v); if (c && c[3] >= 0.999) pal.push(c.slice(0, 3)); }
    ['#f2f2f4', '#d9d9e2', '#ffffff', '#14161c', '#c9c4bc', '#fff6e6'].forEach((v) => pal.push(parseCol(v).slice(0, 3)));
    const lut = new Uint32Array(32768);
    for (let q = 0; q < 32768; q++) {
      const r0 = ((q >> 10) & 31) * 8 + 4, g0 = ((q >> 5) & 31) * 8 + 4, b0 = (q & 31) * 8 + 4;
      let best = 0, bd = 1e9;
      for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r0) ** 2 * 3 + (p[1] - g0) ** 2 * 4 + (p[2] - b0) ** 2 * 2; if (d < bd) { bd = d; best = i; } }
      const p = pal[best]; lut[q] = (255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0];
    }
    return lut;
  }
  // snaps cv; with `to`, reads cv and writes the snapped pixels into `to` instead (the tile scratch -> the tile, paintTileInner)
  function paletteSnap(cv, to = cv) {
    if (!paletteLUT) paletteLUT = buildPalette();
    const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), d32 = new Uint32Array(img.data.buffer);
    for (let i = 0; i < d32.length; i++) {
      const v = d32[i]; if ((v >>> 24) < 8) continue;
      d32[i] = paletteLUT[(((v & 255) >> 3) << 10) | ((((v >> 8) & 255) >> 3) << 5) | (((v >> 16) & 255) >> 3)];
    }
    to.getContext('2d').putImageData(img, 0, 0);
  }
  // ?tilegpu=1: the old path (tiles painted + read back on their own GPU canvas) — perf A/B for tools/hwjudder.mjs
  const TILE_GPU = typeof location !== 'undefined' && new URLSearchParams(location.search).has('tilegpu');
  let tileAvg = 20;                                 // running average ms per tile (starts pessimistic = phone)
  function paintTile(k, i, j) {
    const tp0 = performance.now();
    try { return paintTileInner(k, i, j); } finally { const dt = performance.now() - tp0; tileState.tileMs += dt; tileAvg += (dt - tileAvg) * 0.2; }
  }
  // TILES ARE PAINTED ON A CPU SCRATCH, KEPT ON THE GPU (perf, 2026-10-06; user: "judder on mobile on infinite levels - guess thats
  // as chunks load"). MEASURED (tools/hwjudder.mjs + hwprofile.mjs, highway at 130-240 km/h, CPU x4, phone landscape): the road
  // window moving (stepHighway, ~2 ms) is NOT it; ground tiles are - ~10 a second scroll in at speed and each cost 45 ms, of which
  // paletteSnap's getImageData was ~half: reading back a GPU canvas stalls the GPU pipeline. A tile canvas with willReadFrequently
  // halved the tile (23.6 ms) but then every frame re-uploaded every CPU tile it drew (drawImage 4.8 -> 11.4 % of the run). So:
  // draw + snap on ONE reusable CPU scratch (no readback stall), putImageData once into the tile's own GPU canvas (one upload).
  // a FRESH scratch per tile: a reused one would carry drawing state (line dash, font, smoothing ...) from the last tile
  function tileScratch(px) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    return { c, g: c.getContext('2d', { willReadFrequently: true }) };
  }
  function paintTileInner(k, i, j) {
    const zq = zOfStep(k), pq = view.PPM * zq, tw = TILE_PX / pq;     // world metres per tile
    const px = Math.round(TILE_PX * view.dpr), c = document.createElement('canvas');
    c.width = c.height = px;
    const viaScratch = PIXEL && !TILE_GPU, sc = viaScratch ? tileScratch(px) : null;
    const g = viaScratch ? sc.g : c.getContext('2d');
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
    view.ctx = g; view.W = view.H = TILE_PX; view.zoom = zq; cam.x = (i + 0.5) * tw; cam.y = (j + 0.5) * tw;
    try {
      drawFloor();
      drawZones();
      drawLanes();          // UNDER the ribbon: where a lane meets the track, the track wins (lab.js zoneAt does the same)
      // ENDLESS: wear UNDER the ribbon (2026-10-06, "dirt in the road"; tools/_dirtroad.mjs): the motorway is all tarmac (it never wears),
      // but a worn verge cell's disc (0.72 x 1.5 m radius) reached ~1 m over the carriageway edge and read as dirt ON the road
      const endless = !!LEVEL.endless;
      if (endless) drawWear('base');
      drawTrackRibbon();
      drawLaneDashes();
      drawPatches();
      if (!endless) drawWear('base');     // baked in (2026-10-03): see wearDirty below. Under the covers ...
      drawCovers();
      drawWear('cover');    // ... except where the cover itself has changed
      drawCurvedKerbs();    // kerbs last: no surface ever paints over a kerb
    } finally {
      view.ctx = keep.ctx; view.W = keep.W; view.H = keep.H; view.zoom = keep.zoom; cam.x = keep.cx; cam.y = keep.cy;
    }
    tileState.tilesPainted++;
    if (viaScratch) paletteSnap(sc.c, c);
    else if (PIXEL) paletteSnap(c);
    hillShade(c, tw, (i + 0.5) * tw, (j + 0.5) * tw);
    return c;
  }
  // HILL-SHADING (step 3, 2026-10-03; user: "make sure banked surfaces are clearly shown with brighter spots and shadowing,
  // same with bumps and dips"; chose PIXEL HILL-SHADING). Light from the TOP-LEFT: ground sloping toward it is brighter,
  // away from it darker, in STEPPED bands on square cells (pixel art: squares, no smooth gradients). It reads the SAME
  // height the physics drives on (lab.js bumpAt), so what you see is what you drive. Applied AFTER the palette snap so a
  // shaded patch of grass can never snap to another surface's colour. Baked once per tile: costs nothing per frame.
  // depth: how far a full band moves a colour toward white (lit) or black (shadow). MEASURED (photographed): a plain
  // brightness MULTIPLY of 1.2 was invisible on dark race tarmac (#2d303a), so light is ADDED toward white instead.
  const SHADE = { cellM: 0.5, maxCells: 64, gain: 3.0, bands: 4, depth: 0.36, hRef: 0.25, hGain: 0.9, slopeK: 0.55 };   // height outweighs slope so a bump reads LIGHTER overall and a dip DARKER (user)   // 4 bands: at 3 the Naffcar bank flipped a whole band at the turn apex and read as a seam
  const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];
  const LIT = [255, 226, 150], LIT_N = [255, 255, 255], SHD = [26, 34, 58];   // warm (bright ground only), neutral, cool shadow          // toward the light, world frame (screen up-left)
  const NO_SHADE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noshade');   // perf A/B
  function hillShade(cv, tw, cx, cy) {
    if (NO_SHADE) return;
    const n = Math.max(1, Math.min(SHADE.maxCells, Math.ceil(tw / SHADE.cellM)));
    const cell = tw / n, x0 = cx - tw / 2, y0 = cy - tw / 2;
    // HEIGHTS ONCE on a grid of cell centres with a one-cell border; slopes from the neighbours. MEASURED: 5 lookups per cell
    // (4 for the slope, 1 for the tint) made a Test Track tile ~12 ms on a PC; now (n+2)^2 lookups in all.
    // SAMPLED ON A 2x COARSER GRID and interpolated (perf, 2026-10-03): terrain changes over metres, so heights every 1 m are
    // enough — 4x fewer lookups. MEASURED at CPU x4: ~12 ms of a 26 ms tile was this. Tiles that contain WASHBOARD (0.9 m
    // ripples) keep the full grid so the ripples still show.
    const m = n + 2, hg = new Float32Array(m * m);
    const fine = BUMPS.some((bp) => bp.kind === 'washboard' && Math.abs(bp.x - cx) < tw / 2 + bp.len / 2 && Math.abs(bp.y - cy) < tw / 2 + bp.len / 2);
    if (fine || n < 8) {
      for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) hg[b * m + a] = visualHeightAt(x0 + (a - 0.5) * cell, y0 + (b - 0.5) * cell);
    } else {
      const mc = Math.ceil(m / 2) + 1, hc = new Float32Array(mc * mc);
      for (let b = 0; b < mc; b++) for (let a = 0; a < mc; a++) hc[b * mc + a] = visualHeightAt(x0 + (2 * a - 0.5) * cell, y0 + (2 * b - 0.5) * cell);
      for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) {
        const ca = a >> 1, cb = b >> 1, fa = (a & 1) * 0.5, fb = (b & 1) * 0.5;
        const h00 = hc[cb * mc + ca], h10 = hc[cb * mc + ca + 1], h01 = hc[(cb + 1) * mc + ca], h11 = hc[(cb + 1) * mc + ca + 1];
        hg[b * m + a] = (h00 * (1 - fa) + h10 * fa) * (1 - fb) + (h01 * (1 - fa) + h11 * fa) * fb;
      }
    }
    const f = new Float32Array(n * n);
    let any = false;
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const k0 = (b + 1) * m + (a + 1);
      const sl = { gx: (hg[k0 + 1] - hg[k0 - 1]) / (2 * cell), gy: (hg[k0 + m] - hg[k0 - m]) / (2 * cell) };
      const raw = (-sl.gx * LIGHT[0] - sl.gy * LIGHT[1]) * SHADE.gain;
      const hh = hg[k0];
      const s = Math.max(-1, Math.min(1, Math.sign(raw) * Math.sqrt(Math.abs(raw)) * SHADE.slopeK + Math.tanh(hh / SHADE.hRef) * SHADE.hGain));
      const q = Math.round(s * SHADE.bands) / SHADE.bands;
      if (q !== 0) any = true;
      f[b * n + a] = SHADE.depth * q;            // + toward white, - toward black
    }
    if (!any) return;                                   // flat tile: nothing to do
    // DRAWN AS TRANSLUCENT SQUARES, not per-pixel (perf, 2026-10-03). "Move toward white by k" IS "draw white at opacity k", so
    // the colours are identical — but there is no getImageData / putImageData readback. MEASURED at CPU x4: once the natural
    // ground put gentle hills on every grass tile, that readback ran on EVERY tile and shading cost ~15 ms of a 29 ms tile.
    // The warm light (for near-white ground, where white cannot show) is chosen per cell from the surface underneath.
    // ONE PATH PER SHADE, not one fillRect per cell (perf, 2026-10-06, the highway judder). MEASURED (tools/hwprofile.mjs, highway,
    // CPU x4): up to 4096 fillRects a tile, each with a fresh rgba() string, were ~half of every ground tile. A cell's style is one
    // of ~9 (2 x SHADE.bands levels x lit / lit-lab / shadow): the same integer-edged rects are gathered per style and filled once.
    // Same pixels (tools/tilediff.mjs): the rects abut, never overlap, so one fill blends each pixel exactly once, as before.
    const g = cv.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const pxPerCell = cv.width / n, groups = new Map();
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const k = f[b * n + a];
      if (k === 0) continue;
      let col;
      if (k > 0) {
        // only the lab level has the near-white floor; a full ground lookup per cell cost more than the shading itself
        col = LEVEL.id === 'lab' && groundAt(x0 + (a + 0.5) * cell, y0 + (b + 0.5) * cell).surface.id === 'lab' ? LIT : LIT_N;
      } else col = SHD;
      const key = (col === SHD ? 0 : col === LIT ? 1 : 2) * 1000 + Math.round(Math.abs(k) * 1000);
      let gr = groups.get(key); if (!gr) { gr = { col, k: Math.abs(k), r: [] }; groups.set(key, gr); }
      const px0 = Math.round(a * pxPerCell), py0 = Math.round(b * pxPerCell);
      gr.r.push(px0, py0, Math.round((a + 1) * pxPerCell) - px0, Math.round((b + 1) * pxPerCell) - py0);
    }
    for (const gr of groups.values()) {
      g.fillStyle = `rgba(${gr.col[0]},${gr.col[1]},${gr.col[2]},${gr.k.toFixed(3)})`;
      g.beginPath(); const r = gr.r; for (let q = 0; q < r.length; q += 4) g.rect(r[q], r[q + 1], r[q + 2], r[q + 3]);
      g.fill();
    }
    g.restore();
  }
  // How many tiles of zoom step k that cover the view are not painted yet. Draws nothing.
  function countMissing(k) {
    const tw = TILE_PX / (view.PPM * zOfStep(k)), p = PPMz();
    const vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    let missing = 0;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1; i++)
      for (let j = Math.floor(vy0 / tw); j * tw < vy1; j++) if (!tiles.has(k + '|' + i + '|' + j)) missing++;
    return missing;
  }
  // Blit every tile of zoom step k that covers the view. Returns how many were missing. With
  // `paint` it paints missing tiles (budget permitting); without, it only draws what exists.
  function blitStep(k, paint, budget) {
    const zq = zOfStep(k), tw = TILE_PX / (view.PPM * zq), p = PPMz();
    const vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    let missing = 0;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1; i++) {
      for (let j = Math.floor(vy0 / tw); j * tw < vy1; j++) {
        const key = k + '|' + i + '|' + j;
        let t = tiles.get(key);
        if (!t && paint && takeTile(budget)) { t = { c: paintTile(k, i, j), used: 0 }; tiles.set(key, t); }
        // a STALE tile (wear changed under it) keeps showing until the budget lets it be repainted
        else if (t && t.stale && paint && takeTile(budget)) { t.c = paintTile(k, i, j); t.stale = false; tileState.staleRepaints++; }
        if (!t) { missing++; continue; }
        t.used = tileState.tileFrame;
        // integer edges, so neighbouring tiles meet with no hairline seam
        // edges on whole ART pixels (dpr = art px per css px); with the pixel-locked view every tile is the same width
        const x0 = Math.round(sx(i * tw) * view.dpr) / view.dpr, x1 = Math.round(sx((i + 1) * tw) * view.dpr) / view.dpr;
        const y0 = Math.round(sy(j * tw) * view.dpr) / view.dpr, y1 = Math.round(sy((j + 1) * tw) * view.dpr) / view.dpr;
        view.ctx.drawImage(t.c, x0, y0, x1 - x0, y1 - y0);
      }
    }
    return missing;
  }
  // WEAR IS BAKED INTO THE TILES (2026-10-03). MEASURED: drawing worn cells live every frame cost the lab
  // panels run 238 -> 197 frames (4x throttle). Now a changed cell only marks the tiles over it STALE; they
  // keep showing until repainted within TILE_BUDGET, so wear appears within a frame or two and costs
  // nothing while it is not changing. Dirty cells are drained at most every WEAR_DRAIN s, which batches a
  // drift that changes many cells into one repaint of the tiles involved.
  const WEAR_DRAIN = 0.15;
  let wearDrainT = 0, seenEpoch = -1;
  function drainWear(wallDt) {
    if (seenEpoch !== wearEpoch) { seenEpoch = wearEpoch; for (const t of tiles.values()) t.stale = true; wearDirty.length = 0; return; }
    wearDrainT += wallDt;
    if (wearDrainT < WEAR_DRAIN || wearDirty.length === 0) return;
    wearDrainT = 0;
    for (const [key, t] of tiles) {
      if (t.stale) continue;
      const [k, i, j] = key.split('|').map(Number);
      const tw = TILE_PX / (view.PPM * zOfStep(k)), x0 = i * tw, y0 = j * tw;
      for (const c of wearDirty) {
        const cx = c.cx * WEAR_CELL, cy = c.cy * WEAR_CELL;
        if (cx + WEAR_CELL >= x0 && cx <= x0 + tw && cy + WEAR_CELL >= y0 && cy <= y0 + tw) { t.stale = true; break; }
      }
    }
    wearDirty.length = 0;
  }
  function drawGround(wallDt = 0, car = null) {
    drainWear(wallDt);
    tileState.tileFrame++;
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;   // a re-randomised track (Grass Track)
    if (tileLevel !== LEVEL || tileDpr !== view.dpr || tilePPM !== view.PPM || tileLayout !== layout) {
      tiles.clear(); tileLevel = LEVEL; tileDpr = view.dpr; tilePPM = view.PPM; tileLayout = layout; tileState.lastStep = null;
    }
    const fly = getFly();
    if (fly && fly.ov && view.zoom < FLY_HANDOVER) {
      const o = fly.ov;
      view.ctx.fillStyle = COL.outside; view.ctx.fillRect(0, 0, view.W, view.H);
      view.ctx.drawImage(o.c, sx(o.x0), sy(o.y0), (o.x1 - o.x0) * PPMz(), (o.y1 - o.y0) * PPMz());
      if (car) {
        const budget = { n: FLY_PREFETCH };
        // the steps the camera will pass through after the hand-over, nearest-to-final first
        // only the EVEN steps are used during the flight (see below) — three steps, ~60 tiles, not ~90
        for (let k = 0; k >= zStepOf(FLY_HANDOVER) - 1 && budget.n > 0; k -= 2) prefetch(k, car.x, car.y, zOfStep(k) / 1.6, budget);
      }
      tileState.lastStep = null;
      return;
    }
    // HYSTERESIS on the zoom step (perf, 2026-10-03): the speed zoom wanders across step boundaries all the time and every
    // switch repaints the whole view. Stay on the current step until the zoom is 0.75 of a step away from it.
    let k = fly ? 2 * Math.ceil(zStepOf(view.zoom) / 2) : zStepOf(view.zoom);   // flight: even steps only, finer side
    if (!fly && tileState.lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom) - tileState.lastStep) < 0.75) k = tileState.lastStep;
    const budget = tileBudget();
    // count what the wanted step is missing BEFORE painting, to decide whether a stand-in is needed
    if (tileState.lastStep !== null && tileState.lastStep !== k && countMissing(k) > 0) {
      // the stand-in: the step we were on, scaled. Drawn first, then whatever of k exists goes over it.
      view.ctx.fillStyle = standInFill(); view.ctx.fillRect(0, 0, view.W, view.H);
      blitStep(tileState.lastStep, false, budget);
      const left = blitStep(k, true, budget);
      tileState.standIn = left > 0;
      if (left === 0) tileState.lastStep = k;
    } else {
      // STAND-IN FOR NEW GROUND (perf, 2026-10-03; user: "still seeing lag at high speeds"). This used to paint EVERY missing tile
      // in the frame it appeared — MEASURED at CPU x4: frames up to ~150 ms when ground scrolled in at speed. Now: the whole-
      // level overview (the fly-in's flat painting, kept per level) goes down first, then at most TILE_BUDGET real tiles; the
      // rest arrive over the next frames, so a frame or two shows a softer patch at the edge instead of a stall.
      if (countMissing(k) > 1) {
        const ov = levelOverview();
        if (ov) { view.ctx.fillStyle = standInFill(); view.ctx.fillRect(0, 0, view.W, view.H); view.ctx.drawImage(ov.c, sx(ov.x0), sy(ov.y0), (ov.x1 - ov.x0) * PPMz(), (ov.y1 - ov.y0) * PPMz()); }
        tileState.standIn = blitStep(k, true, budget) > 0;
      } else { blitStep(k, true, { n: Infinity }); tileState.standIn = false; }
      tileState.lastStep = k;
    }
    // (A LOOK-AHEAD painter was tried here, 2026-10-03: one tile per spare frame from where the car is heading. MEASURED at
    // CPU x4 it made things WORSE — 97 slow frames per lap vs 51 without, and more tiles in total. Removed.)
    // BACK, GATED ON TILE COST (user, 2026-10-04: "block loading is chunky / visible on PC"). A big PC screen needs ~3x the
    // tiles of a phone, so at 1 tile a frame 27% of frames showed the flat stand-in (1600x900, 159 of 600). On a device that
    // paints a tile in < AHEAD_MAX_MS, a frame with NOTHING missing paints one tile from the view AHEAD of the car. Phones
    // (12-20 ms a tile at CPU x4) never qualify, so they keep the measured-better behaviour above.
    if (!tileState.standIn && !fly && car && tileAvg < AHEAD_MAX_MS && Math.hypot(car.vx, car.vy) > 3) {
      prefetch(k, cam.x + car.vx * AHEAD_S, cam.y + car.vy * AHEAD_S, view.zoom, { n: 1 });
    }
    if (tiles.size > TILE_MAX) {
      const old = [...tiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let n = 0; n < tiles.size - TILE_MAX; n++) tiles.delete(old[n][0]);
    }
  }
  const AHEAD_MAX_MS = 9, AHEAD_S = 0.6;   // look-ahead painting: only below this tile cost; view shifted this many s of travel

  return {
    tileState, tiles, TILE_PX, ZSTEP, zStepOf, zOfStep, paletteSnap, paintTile, drawGround,
  };
}
