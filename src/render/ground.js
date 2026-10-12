// the GROUND PAINTER of render.js (phase 4 of the render.js split): floor, surface art and
// patterns, zones, covers, wear, bumps and the runoff ring. Moved verbatim.
import { FLOOR, FX0, FX1, FY0, FY1, GRID, RUNOFF_W } from "../world/bounds.ts";
import { ZONES, BUMPS, LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import { VERGE_W } from "../world/surfaces.ts";
import { wearMap, WEAR_CELL, groundAt, coverCut } from "../world/wear.ts";
import { PIXEL } from "../render.js";   // a const read only at draw time (no load-time cycle)

export function createGround(view, cam, helpers) {
  const { PPMz, sx, sy, roundRect, forSide } = helpers;

  // ---------------------------------------------------------------- floor
  function drawFloor() {
    view.ctx.fillStyle = COL.outside;
    view.ctx.fillRect(0, 0, view.W, view.H);
    const p = PPMz();

    // the floor RECTANGLE (S-B): FX0..FX1 x FY0..FY1, the square +-FLOOR on every level without bounds
    const fw = (FX1 - FX0) * p, fh = (FY1 - FY0) * p;
    if (LEVEL.base && LEVEL.base.id !== 'lab') {
      view.ctx.fillStyle = artBase(LEVEL.base.id, COL.floor);
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);
      view.ctx.save();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(LEVEL.base.id, FX0, FY0, FX1, FY1);
      view.ctx.restore();
    } else {
      view.ctx.fillStyle = COL.floor;
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);

      // a soft warm pool so a big pale floor is not dead flat. Since the ground TILES (2026-10-03) it is
      // centred on the WORLD ORIGIN (the skidpad), not on the car: tiles are painted separately, so a
      // screen-centred gradient would come out as one blotch per tile. It stays UNDER the zones.
      const gr = view.ctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), FLOOR * 0.9 * p);
      gr.addColorStop(0, 'rgba(255,252,246,0.55)');
      gr.addColorStop(1, 'rgba(226,226,234,0)');
      view.ctx.fillStyle = gr;
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);

      // grid — only the lines actually on screen
      const x0 = Math.floor((cam.x - view.W / 2 / PPMz()) / GRID) * GRID;
      const x1 = cam.x + view.W / 2 / PPMz();
      const y0 = Math.floor((cam.y - view.H / 2 / PPMz()) / GRID) * GRID;
      const y1 = cam.y + view.H / 2 / PPMz();
      view.ctx.strokeStyle = COL.grid;
      view.ctx.lineWidth = 1;
      view.ctx.beginPath();
      for (let x = x0; x <= x1; x += GRID) {
        if (x < FX0 || x > FX1) continue;
        const px = Math.round(sx(x)) + 0.5;
        view.ctx.moveTo(px, sy(Math.max(FY0, y0 - GRID)));
        view.ctx.lineTo(px, sy(Math.min(FY1, y1 + GRID)));
      }
      for (let y = y0; y <= y1; y += GRID) {
        if (y < FY0 || y > FY1) continue;
        const py = Math.round(sy(y)) + 0.5;
        view.ctx.moveTo(sx(Math.max(FX0, x0 - GRID)), py);
        view.ctx.lineTo(sx(Math.min(FX1, x1 + GRID)), py);
      }
      view.ctx.stroke();
    }
  }

  // GROUND TEXTURE. A fixed lattice (never an RNG — that crawls between frames), CULLED TO THE VIEW.
  //
  // MEASURED BUG, 2026-09-28 (photographed): this looped the whole 260 m quadrant, so it could only
  // afford ~3 m spacing and the result was a field of 1 m polka dots rather than ground. Culling to the
  // visible rectangle first makes the count depend on the SCREEN, not the world, so the grain can be as
  // fine as it needs to be and costs the same at any zoom. Squares, not arcs: at grain size they read
  // identically and they are far cheaper.
  const MARKS_MAX = 30000;      // most marks one pattern layer may place in one call (see speckle)
  function speckle(x0, y0, x1, y1, colour, spacing, size) {
    const p = PPMz();
    const px = Math.max(1, size * p);
    if (px < 1.1 && spacing * p < 3) return;      // too far out to resolve: skip it entirely
    // intersect the region with what is actually on screen, snapped to the lattice so the pattern is
    // world-locked and does not swim as the camera moves
    const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
    const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    // MARK CAP (2026-10-03): the fly-in's whole-level overview asked one call for ~188,000 squares of grass grain
    // (1.1 s to record, 4.9 s to rasterise at 4x throttle). Any call that would place more than MARKS_MAX marks
    // thins its lattice to fit — invisible at the zoom where it happens, since that much grain is sub-pixel noise.
    const n0 = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing);
    if (n0 > MARKS_MAX) spacing *= Math.sqrt(n0 / MARKS_MAX);
    const ax = Math.floor(vx0 / spacing) * spacing, ay = Math.floor(vy0 / spacing) * spacing;
    view.ctx.fillStyle = colour;
    for (let u = ax; u < vx1; u += spacing) {
      for (let v = ay; v < vy1; v += spacing) {
        // deterministic scatter from the world position, so a speck belongs to the GROUND
        const h = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
        const jx = (h - Math.floor(h)) - 0.5;
        const h2 = Math.sin(u * 39.3468 + v * 11.135) * 24634.6345;
        const jy = (h2 - Math.floor(h2)) - 0.5;
        view.ctx.fillRect((u + jx * spacing) * p, (v + jy * spacing) * p, px, px);
      }
    }
  }

  // ---------------------------------------------------------------- SURFACE PAINTER (2026-10-03)
  // User: "All surfaces should have unique and noticeable graphics so we can easily and instantly tell
  // them apart." PHOTOGRAPHED BEFORE: every surface was a base colour plus the same square speckle, so
  // grass/short grass, tarmac/race tarmac, wet/broken, sand/gravel and mud/dirt read as pairs. Colour
  // alone does not survive a glance at speed; SHAPE does. So each surface now gets its own pattern
  // vocabulary — stripes, blades, stones, ripples, glossy blobs, cracks, sheen — on top of its colour.
  //
  // Every primitive below shares the speckle rules: a FIXED world lattice (never an RNG, or it crawls),
  // CULLED to the view so cost depends on the screen not the world, skipped entirely when the feature
  // would be under ~1 px, and BATCHED into one path per layer (one fill/stroke call, not one per mark).
  // Callers have translated the context to the world origin, so coordinates are world metres * p.
  function lattice(x0, y0, x1, y1, spacing, prob, fn) {
    const p = PPMz();
    const vx0 = Math.max(x0, cam.x - view.W / 2 / p - spacing), vx1 = Math.min(x1, cam.x + view.W / 2 / p + spacing);
    const vy0 = Math.max(y0, cam.y - view.H / 2 / p - spacing), vy1 = Math.min(y1, cam.y + view.H / 2 / p + spacing);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    const n0 = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing) * prob;
    if (n0 > MARKS_MAX) spacing *= Math.sqrt(n0 / MARKS_MAX);      // the same MARK CAP as speckle
    const ax = Math.floor(vx0 / spacing) * spacing, ay = Math.floor(vy0 / spacing) * spacing;
    for (let u = ax; u < vx1; u += spacing) {
      for (let v = ay; v < vy1; v += spacing) {
        const h1 = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453, a = h1 - Math.floor(h1);
        const h2 = Math.sin(u * 39.3468 + v * 11.135) * 24634.6345, b = h2 - Math.floor(h2);
        const h3 = Math.sin(u * 7.1231 + v * 51.719) * 15731.743, c = h3 - Math.floor(h3);
        if (c > prob) continue;
        fn((u + (a - 0.5) * spacing) * p, (v + (b - 0.5) * spacing) * p, a, b, c, p);
      }
    }
  }
  // the layer kinds. [kind, colour, ...numbers in metres]
  const PRIM = {
    // fine square grain — aggregate, grit, sparkle
    grain(L, x0, y0, x1, y1) { speckle(x0, y0, x1, y1, L[1], L[2], L[3]); },
    // round stones, radius rMin..rMax — gravel, dirt pebbles
    stones(L, x0, y0, x1, y1) {
      const [, col, sp, rMin, rMax, prob = 1] = L, p = PPMz();
      if (rMax * p < 0.8 || sp * p < 2.5) return;
      view.ctx.fillStyle = col; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a) => {
        const r = (rMin + (rMax - rMin) * a) * p;
        if (PIXEL) { view.ctx.rect(x - r, y - r, r * 2, r * 2); return; }      // square stones in pixel art
        view.ctx.moveTo(x + r, y); view.ctx.arc(x, y, r, 0, Math.PI * 2);
      });
      view.ctx.fill();
    },
    // grass blades — a little V tuft per lattice point
    blades(L, x0, y0, x1, y1) {
      const [, col, sp, len, wid, prob = 1] = L, p = PPMz();
      if (len * p < 2 || sp * p < 2.5) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.lineCap = 'round'; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b) => {
        const l = len * p * (0.7 + 0.6 * b), t = (a - 0.5) * 0.9;
        view.ctx.moveTo(x, y); view.ctx.lineTo(x + Math.sin(t - 0.35) * l, y - Math.cos(t - 0.35) * l);
        view.ctx.moveTo(x, y); view.ctx.lineTo(x + Math.sin(t + 0.35) * l, y - Math.cos(t + 0.35) * l);
      });
      view.ctx.stroke(); view.ctx.lineCap = 'butt';
    },
    // mown stripes: alternate bands along world y, `band` metres wide
    stripes(L, x0, y0, x1, y1) {
      const [, col, band] = L, p = PPMz();
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      view.ctx.fillStyle = col;
      for (let k = Math.floor(vy0 / band); k * band < vy1; k++) {
        if (k & 1) continue;
        view.ctx.fillRect(vx0 * p, k * band * p, (vx1 - vx0) * p, band * p);
      }
    },
    // wavy lines — wind ripples in sand, ridges in thick mud
    ripples(L, x0, y0, x1, y1) {
      const [, col, sp, amp, wave, wid] = L, p = PPMz();
      if (sp * p < 4) return;
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p - amp), vy1 = Math.min(y1, cam.y + view.H / 2 / p + amp);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      const step = wave / 6;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      for (let k = Math.floor(vy0 / sp); k * sp < vy1; k++) {
        const ph = Math.sin(k * 12.9898) * 437.5;
        for (let x = Math.floor(vx0 / step) * step, first = true; x <= vx1 + step; x += step, first = false) {
          const y = k * sp + amp * Math.sin((x / wave) * Math.PI * 2 + ph);
          if (first) view.ctx.moveTo(x * p, y * p); else view.ctx.lineTo(x * p, y * p);
        }
      }
      view.ctx.stroke();
    },
    // soft ellipses — puddles, mud pools, glossy highlights, drift shadows, repair patches
    blobs(L, x0, y0, x1, y1) {
      const [, col, sp, rx, ry, prob = 1, spin = 1] = L, p = PPMz();
      if (ry * p < 0.8 || sp * p < 3) return;
      view.ctx.fillStyle = col; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b) => {
        const s = 0.7 + 0.6 * b, rot = (a - 0.5) * Math.PI * spin;
        if (PIXEL) { const ww = rx * s * p, hh = ry * s * p; view.ctx.rect(x - ww, y - hh, ww * 2, hh * 2); return; }   // square blobs in pixel art
        view.ctx.moveTo(x + Math.cos(rot) * rx * s * p, y + Math.sin(rot) * rx * s * p);
        view.ctx.ellipse(x, y, rx * s * p, ry * s * p, rot, 0, Math.PI * 2);
      });
      view.ctx.fill();
    },
    // thin rings — rain ripples on standing water
    rings(L, x0, y0, x1, y1) {
      const [, col, sp, r, wid, prob = 1] = L, p = PPMz();
      if (r * p < 2 || sp * p < 4) return;
      if (PIXEL) return;     // as hollow squares they read as UI glitches (photographed on the wet pad) — sheen + puddles carry it
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a) => {
        const rr = r * (0.6 + 0.8 * a) * p;
        if (PIXEL) { view.ctx.rect(x - rr, y - rr, rr * 2, rr * 2); return; }   // square ripples in pixel art
        view.ctx.moveTo(x + rr, y); view.ctx.arc(x, y, rr, 0, Math.PI * 2);
      });
      view.ctx.stroke();
    },
    // jagged cracks with a side branch — ice, broken tarmac
    cracks(L, x0, y0, x1, y1) {
      const [, col, sp, len, wid, prob = 1] = L, p = PPMz();
      if (len * p < 4 || sp * p < 4) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b, c) => {
        let ang = a * Math.PI * 2, px = x, py = y;
        view.ctx.moveTo(px, py);
        for (let s = 0; s < 4; s++) {
          ang += ((s % 2 ? b : c) - 0.5) * 1.4;
          px += Math.cos(ang) * len * 0.3 * p; py += Math.sin(ang) * len * 0.3 * p;
          view.ctx.lineTo(px, py);
          if (s === 1) { view.ctx.lineTo(px + Math.cos(ang + 1.1) * len * 0.25 * p, py + Math.sin(ang + 1.1) * len * 0.25 * p); view.ctx.moveTo(px, py); }
        }
      });
      view.ctx.stroke();
    },
    // long diagonal sheen bands — polish on ice, reflection on standing water
    sheen(L, x0, y0, x1, y1) {
      const [, col, sp, wid, slope] = L, p = PPMz();
      // extended past the view by a band's width: a square-cut diagonal band ending exactly at a TILE edge
      // left a visible notch at every tile seam (photographed 2026-10-03 on the lab ice sheet)
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p - wid * 2), vx1 = Math.min(x1, cam.x + view.W / 2 / p + wid * 2);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      const kA = (vy0 - slope * Math.max(vx0, vx1)) / sp, kB = (vy1 - slope * Math.min(vx0, vx1)) / sp;
      for (let k = Math.floor(Math.min(kA, kB)); k <= Math.ceil(Math.max(kA, kB)); k++) {
        view.ctx.moveTo(vx0 * p, (k * sp + slope * vx0) * p); view.ctx.lineTo(vx1 * p, (k * sp + slope * vx1) * p);
      }
      view.ctx.stroke();
    },
  };

  // HOW EACH SURFACE IS PAINTED: a base colour, then layers drawn in order. One table — a new surface is a
  // row here and a row in lab.js (SURFACES) and nothing else. Read by drawFloor, drawZones,
  // drawTrackRibbon and drawWear, so a surface looks the same wherever it appears. Each surface has a
  // SIGNATURE SHAPE so no two are told apart by colour alone:
  //   tarmac — fine light aggregate        race tarmac — smooth, dark, long rubber streaks
  //   broken — pale, cracked, dark patches dirt — warm brown, pale pebbles
  //   mud — dark wet pools + gloss         thick mud — near-black, ridged ruts + gloss
  //   gravel — dense round stones          sand — pale yellow, wind ripples
  //   grass / short grass — mown stripes   long grass — dark, blade tufts
  //   snow — white, blue drift shadows     ice — blue, polish sheen + white cracks
  //   wet — dark, puddles, reflections, rain rings
  const SURFACE_ART = {
    lab: null,                                   // the lab surface IS the floor colour already
    tarmac: { base: '#3a3c46', layers: [['grain', '#5a5d6a', 0.9, 0.09], ['grain', '#2b2d35', 1.7, 0.12]] },
    racetarmac: { base: '#2a2d36', layers: [['blobs', 'rgba(16,17,22,0.55)', 3.2, 1.6, 0.10, 0.6, 0.08]] },
    // circles (repair patches) removed 2026-10-03 — user: "the circles on broken concrete look weird, just keep the cracks"
    broken: { base: '#8e9099', layers: [['cracks', '#4a4b54', 2.2, 1.7, 0.07], ['grain', '#a3a5ad', 1.0, 0.10]] },
    concrete: { base: '#a9a7a0', layers: [['grain', '#bdbbb4', 0.8, 0.10], ['cracks', '#8c8a83', 6.0, 3.0, 0.05]] },   // pale slabs, faint joints
    dirt: { base: '#8a6e50', layers: [['grain', '#74593d', 0.7, 0.12], ['stones', '#b59672', 1.5, 0.06, 0.13], ['grain', '#5d4329', 2.2, 0.22]] },
    mud: { base: '#5a4231', layers: [['blobs', '#3f2d20', 2.2, 0.95, 0.70, 0.6, 0.25], ['blobs', 'rgba(255,238,215,0.20)', 1.9, 0.30, 0.08, 0.45, 0.25], ['grain', '#4a3626', 0.9, 0.12]] },
    thickMud: { base: '#3a291d', layers: [['ripples', '#24180f', 0.9, 0.16, 3.0, 0.20], ['blobs', 'rgba(255,238,215,0.30)', 1.3, 0.30, 0.08, 0.6]] },
    gravel: { base: '#a99c84', layers: [['stones', '#d4cab5', 0.75, 0.05, 0.11], ['stones', '#7d725d', 0.85, 0.05, 0.10]] },
    // sand REDONE 2026-10-03 (user: "I don't love how sand looks") — the bold squiggles read as cartoon.
    // Now fine two-tone grains with faint, long, soft wind ripples.
    sand: { base: '#e0c994', layers: [['ripples', 'rgba(176,146,92,0.30)', 0.85, 0.10, 3.6, 0.07], ['grain', '#c9ad74', 0.5, 0.06], ['grain', '#f3e5bf', 0.62, 0.06]] },
    grass: { base: '#7e9c5e', layers: [['stripes', '#89a868', 4], ['grain', '#6a8850', 1.2, 0.18]] },
    grassShort: { base: '#7e9c5e', layers: [['stripes', '#89a868', 4], ['grain', '#6a8850', 1.2, 0.18]] },
    grassLong: { base: '#4d6b33', layers: [['blades', '#6f904a', 0.5, 0.42, 0.07], ['blades', '#3a5226', 0.62, 0.48, 0.07]] },
    // (field looks: added below SURFACE_ART - the grass / long grass / mud textures recoloured, highway.js FIELD_SURF)
    snow: { base: '#f3f7fb', layers: [['blobs', 'rgba(140,170,210,0.20)', 3.0, 1.9, 0.5, 0.6, 0.15], ['grain', '#ffffff', 0.9, 0.12]] },
    packedSnow: { base: '#c4cfda', layers: [['blobs', 'rgba(96,118,150,0.22)', 2.6, 1.3, 0.4, 0.6, 0.15], ['grain', '#e9eff5', 0.8, 0.14], ['grain', '#9fb0c2', 1.6, 0.10]] },
    ice: { base: '#b9daee', layers: [['sheen', 'rgba(255,255,255,0.32)', 4.5, 0.55, 0.5], ['cracks', 'rgba(255,255,255,0.80)', 3.6, 1.7, 0.05]] },
    // wet tarmac REDONE 2026-10-03 (user: "I don't love how wet tarmac looks") — the blue blobs read as
    // paint. Real wet asphalt is DARKER tarmac with its aggregate still showing, broad soft reflections and
    // dark glossy standing water in the low spots.
    // + BLUE-ISH PUDDLES (user, 2026-10-03: "wet tarmac isn't clear enough, maybe needs blue-ish puddles")
    wet: { base: '#2c3039', layers: [['grain', '#454a57', 0.9, 0.08], ['blobs', 'rgba(86,120,176,0.55)', 4.2, 1.6, 0.8, 0.55, 0.2], ['sheen', 'rgba(205,218,238,0.10)', 6.0, 1.6, -0.35], ['sheen', 'rgba(230,238,250,0.16)', 6.0, 0.18, -0.35], ['rings', 'rgba(200,220,250,0.35)', 4.6, 0.35, 0.03, 0.4]] },
  };
  // FIELD LOOKS (highway.js fields, zone.art; the zone DRIVES as its own surface). User, 2026-10-06: "jsut reuse mud and grass or long
  // grass textures for field, and maybe colour them" - so each is an existing texture with only its COLOURS swapped (same layers).
  const recolour = (id, base, cols) => ({ base, layers: SURFACE_ART[id].layers.map((L, k) => [L[0], cols[k] || L[1], ...L.slice(2)]) });
  SURFACE_ART.wheat = recolour('grassLong', '#bf9f4e', ['#dcc074', '#9c7f38']);      // long grass, ripe gold
  SURFACE_ART.rapeseed = recolour('grassLong', '#c9b02a', ['#ecd84a', '#8f9a2e']);   // long grass, yellow flower over green
  SURFACE_ART.pastureG = recolour('grass', '#86a35c', ['#92b068', '#6f8c4c']);       // grass, a fresher green than the verge
  SURFACE_ART.plough = recolour('mud', '#6a4c34', ['#4e3624', 'rgba(255,238,215,0.14)', '#5a412c']);   // mud, a lighter turned-earth brown
  SURFACE_ART.hedgerow = recolour('grassLong', '#3c5a28', ['#5a7c3a', '#2c4220']);   // the long-grass BORDER round each field, darker
  // Paint one surface's layers over a region. The caller has set any clip and translated to the world
  // origin; this only adds the pattern (the caller fills the base colour, since it knows the shape).
  function paintLayers(id, x0, y0, x1, y1) {
    if (view.noPatterns) return;
    const art = SURFACE_ART[id];
    if (!art) return;
    for (const L of art.layers) PRIM[L[0]](L, x0, y0, x1, y1);
  }
  const artBase = (id, fallback) => (SURFACE_ART[id] ? SURFACE_ART[id].base : fallback);

  // EVERY PATCH OF SURFACE, from the same ZONES list the physics reads — so what you see is by
  // construction what you drive on, with no second copy of the layout to drift out of step. (That drift
  // is exactly the bug that cost me an afternoon in the ground sampling earlier today.)
  //
  // Drawn back to front, so the first-hit-wins order in lab.js is honoured visually too: a panel laid
  // ON a quadrant is listed first and must therefore be painted LAST.
  function drawZones() {
    const p = PPMz();
    for (let i = ZONES.length - 1; i >= 0; i--) {
      const q = ZONES[i];
      const aid = q.art || q.surface.id, art = SURFACE_ART[aid];   // q.art: drawn as another look (a wheat field drives as long grass)
      if (!art) continue;
      const x0 = q.x - q.w / 2, y0 = q.y - q.h / 2;
      // off screen? On the ROTATED footprint. MEASURED BUG (user, 2026-10-04: "the old runway bugs in and out of existence"): this
      // tested the unrotated w x h box, so a long thin rotated runway (432 x 22 m at -22 deg) was skipped by every ground tile more
      // than 11 m from its centre line — painted in some tiles, missing in others, changing as tiles reloaded.
      const ca = Math.abs(Math.cos(q.rot || 0)), sa = Math.abs(Math.sin(q.rot || 0));
      const ex = (q.w / 2) * ca + (q.h / 2) * sa, ey = (q.w / 2) * sa + (q.h / 2) * ca;
      if (sx(q.x - ex) > view.W || sx(q.x + ex) < 0 || sy(q.y - ey) > view.H || sy(q.y + ey) < 0) continue;

      if (q.rounded) {
        const rad = Math.min(5 * p, q.w * p * 0.15);
        // Outer asphalt perimeter apron
        view.ctx.fillStyle = COL.tarmac;
        view.ctx.beginPath();
        // the apron is PHYSICAL tarmac (lab.js PAD_APRON, zoneAt) — change the two together
        roundRect(view.ctx, sx(x0 - 1.2), sy(y0 - 1.2), (q.w + 2.4) * p, (q.h + 2.4) * p, rad + 1.2 * p);
        view.ctx.fill();

        view.ctx.save();
        view.ctx.beginPath();
        roundRect(view.ctx, sx(x0), sy(y0), q.w * p, q.h * p, rad);
        view.ctx.fillStyle = art.base;
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        paintLayers(q.surface.id, x0, y0, x0 + q.w, y0 + q.h);
        view.ctx.restore();

        view.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        view.ctx.lineWidth = Math.max(1, 0.20 * p);
        view.ctx.beginPath();
        roundRect(view.ctx, sx(x0), sy(y0), q.w * p, q.h * p, rad);
        view.ctx.stroke();

        const fs = 3.2 * p;
        if (fs > 7) {
          view.ctx.font = `700 ${Math.round(fs)}px ui-sans-serif, system-ui, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillStyle = 'rgba(255,255,255,0.75)';
          view.ctx.fillText(q.surface.label, sx(q.x), sy(y0 + 4.5));
        }
        continue;
      }

      if (q.rot) {
        // ROTATED zone: clip in the zone's frame, then step back to the world frame (the clip stays) and paint the texture
        // over the zone's bounding box, so it lines up with the ground exactly where zoneAt says the surface is.
        const r = Math.hypot(q.w, q.h) / 2;
        if (sx(q.x + r) < 0 || sx(q.x - r) > view.W || sy(q.y + r) < 0 || sy(q.y - r) > view.H) continue;
        view.ctx.save();
        view.ctx.translate(sx(q.x), sy(q.y)); view.ctx.rotate(q.rot);
        view.ctx.beginPath(); view.ctx.rect((-q.w / 2) * p, (-q.h / 2) * p, q.w * p, q.h * p);
        view.ctx.fillStyle = art.base; view.ctx.fill(); view.ctx.clip();
        view.ctx.rotate(-q.rot); view.ctx.translate(-sx(q.x), -sy(q.y));
        view.ctx.translate(sx(0), sy(0));
        // only the part IN VIEW (in a tile: the tile). MEASURED 2026-10-04: once the culling fix let the 432 m runway into every tile
        // it crosses, each tile repainted its whole 430 m square of texture — ground tile 22 -> 26 ms, slow frames 71 -> ~90.
        const vx0 = cam.x - view.W / 2 / p, vy0 = cam.y - view.H / 2 / p;
        paintLayers(aid, Math.max(q.x - r, vx0), Math.max(q.y - r, vy0), Math.min(q.x + r, vx0 + view.W / p), Math.min(q.y + r, vy0 + view.H / p));
        view.ctx.restore();
        continue;
      }
      view.ctx.save();
      view.ctx.beginPath();
      view.ctx.rect(sx(x0), sy(y0), q.w * p, q.h * p);
      view.ctx.fillStyle = art.base;
      view.ctx.fill();
      view.ctx.clip();       // so the texture cannot spill outside the region the physics uses
      view.ctx.translate(sx(0), sy(0));
      paintLayers(q.surface.id, x0, y0, x0 + q.w, y0 + q.h);
      view.ctx.restore();
      // `boxed` marks a deliberate TEST PANEL: give it a rim and paint its FULL NAME on.
      if (q.boxed) {
        view.ctx.strokeStyle = 'rgba(40,42,50,0.35)';
        view.ctx.lineWidth = Math.max(1, 0.25 * p);
        view.ctx.strokeRect(sx(x0), sy(y0), q.w * p, q.h * p);
        const fs = 3.4 * p;
        if (fs > 7) {
          view.ctx.font = `700 ${Math.round(fs)}px ui-sans-serif, system-ui, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillStyle = 'rgba(30,32,40,0.32)';
          view.ctx.fillText(q.surface.label, sx(q.x), sy(y0 + 5.5));
        }
      }
    }
    // A soft seam where the quarters meet, so the join reads as a real transition and not a UI edge.
    if (LEVEL.seams) {
      view.ctx.strokeStyle = 'rgba(80,80,92,0.20)';
      view.ctx.lineWidth = Math.max(1, 0.3 * p);
      view.ctx.beginPath();
      // the old square's quarters only (S-B: the lab's extension south of FLOOR is one floor, no quarter seam)
      view.ctx.moveTo(sx(-FLOOR), sy(0)); view.ctx.lineTo(sx(FLOOR), sy(0));
      view.ctx.moveTo(sx(0), sy(-FLOOR)); view.ctx.lineTo(sx(0), sy(FLOOR));
      view.ctx.stroke();
    }
  }

  // COVERS (2026-10-03) — snow, ice and puddles lying ON any surface (LEVEL.covers, lab.js). Static, so
  // they are painted into the ground tiles. Snow and ice are opaque and use their own SURFACE_ART; a puddle
  // is TRANSLUCENT water over whatever is under it, so you can see it is a puddle on grass, on dirt or on
  // tarmac. When wear changes a cell under a cover (snow packed to ice, ice scrubbed through), drawWear
  // paints that cell's new state over this.
  // PIXEL mode: a cover is drawn as the 0.5 m world-grid squares whose centre is inside it (the same inside test as
  // lab.js coverAt), cached per cover — squares, not ovals (user, pixel pass: "no circles"). Physics keeps the exact
  // shape; the drawn edge is within ~0.35 m of it, the same as the square blend patches. `rim` = squares with an
  // outside neighbour, filled as the edge line (stroking the squares would outline every one of them).
  function coverCells(c) {
    if (c._cells) return c._cells;
    const G = 0.5, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), hx = c.w / 2, hy = c.h / 2;
    // scan the ROTATED box's extents, not a square of the long side (a 160 x 14 m river was a 160 m square: 100k tests -> ~10k)
    const RX = hx * Math.abs(co) + hy * Math.abs(si) + G, RY = hx * Math.abs(si) + hy * Math.abs(co) + G;
    const inside = (x, y) => {
      if (c.cut && coverCut(c, x, y)) return false;   // the river's dry band under the motorway (lab.js coverAt)
      const ex = x - c.x, ey = y - c.y, dx = ex * co + ey * si, dy = -ex * si + ey * co;
      return c.shape === 'ellipse' ? (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) <= 1 : Math.abs(dx) <= hx && Math.abs(dy) <= hy;
    };
    const all = [], rim = [];
    for (let x = Math.floor((c.x - RX) / G) * G; x < c.x + RX; x += G) for (let y = Math.floor((c.y - RY) / G) * G; y < c.y + RY; y += G) {
      const mx = x + G / 2, my = y + G / 2;
      if (!inside(mx, my)) continue;
      all.push(x, y);
      if (!inside(mx + G, my) || !inside(mx - G, my) || !inside(mx, my + G) || !inside(mx, my - G)) rim.push(x, y);
    }
    return (c._cells = { all, rim, G });
  }
  function cellsPath(list, G) {
    const p = PPMz(); view.ctx.beginPath();
    for (let i = 0; i < list.length; i += 2) view.ctx.rect(sx(list[i]), sy(list[i + 1]), G * p, G * p);
  }
  function coverPath(c) {
    if (PIXEL) { const k = coverCells(c); cellsPath(k.all, k.G); return; }
    const p = PPMz();
    view.ctx.beginPath();
    if (c.shape === 'ellipse') view.ctx.ellipse(sx(c.x), sy(c.y), (c.w / 2) * p, (c.h / 2) * p, c.rot || 0, 0, Math.PI * 2);
    else { view.ctx.save(); view.ctx.translate(sx(c.x), sy(c.y)); view.ctx.rotate(c.rot || 0); view.ctx.rect((-c.w / 2) * p, (-c.h / 2) * p, c.w * p, c.h * p); view.ctx.restore(); }
  }
  const PUDDLE_TINT = {
    dirt: 'rgba(86,64,42,0.62)', mud: 'rgba(62,46,32,0.66)', thickMud: 'rgba(46,34,24,0.70)',
    sand: 'rgba(150,128,90,0.55)', gravel: 'rgba(96,90,78,0.58)',
    // on hard ground, water is a dark mirror, not blue (user, 2026-10-03: puddles on tarmac looked wrong)
    tarmac: 'rgba(16,19,26,0.62)', racetarmac: 'rgba(12,14,20,0.62)', broken: 'rgba(30,33,42,0.60)', lab: 'rgba(120,128,142,0.45)',
    // water on grass reads BLUE (it vanished into the grass as dark green — photographed 2026-10-03)
    grass: 'rgba(74,104,150,0.62)', grassShort: 'rgba(74,104,150,0.62)', grassLong: 'rgba(66,96,140,0.64)',
  };
  // RANDOM PATCHES (Grass Track, re-rolled every load — lab.js randomiseGrassTrack): small ellipses of another
  // base surface, drawn with that surface's own SURFACE_ART so a mud spot looks like mud.
  function drawPatches() {
    const list = LEVEL.allPatches || LEVEL.patches;     // random spots + blend patches (lab.js prepareLevel)
    if (!list || !list.length) return;
    const p = PPMz();
    for (const c of list) {
      const r = Math.max(c.w, c.h) / 2;
      if (sx(c.x + r) < 0 || sx(c.x - r) > view.W || sy(c.y + r) < 0 || sy(c.y - r) > view.H) continue;
      view.ctx.save();
      view.ctx.beginPath();
      if (c.sq) view.ctx.rect(sx(c.x - c.w / 2), sy(c.y - c.h / 2), c.w * p, c.h * p);
      else view.ctx.ellipse(sx(c.x), sy(c.y), (c.w / 2) * p, (c.h / 2) * p, c.rot || 0, 0, Math.PI * 2);
      view.ctx.fillStyle = artBase(c.surface.id, '#6b5644');
      view.ctx.fill();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(c.surface.id, c.x - r, c.y - r, c.x + r, c.y + r);
      view.ctx.restore();
    }
  }
  // MERGED COVERS (user, 2026-10-04: "puddles, streams or bodies of water should CONNECT together if touching"). Each cover used to be
  // drawn on its own — its own translucent fill and dark rim — so overlapping puddles darkened twice and showed rims inside each other:
  // a stream read as a string of beads. Now, per cover KIND, the union of every cover's 0.5 m cells (the same cells coverAt answers
  // for, so it still matches the physics); each tint fills once, the pattern is clipped to the union, one rim round the outside.
  function mergedCovers(list) {
    if (LEVEL._mergedOf === list) return LEVEL._merged;
    const G = 0.5, kinds = new Map();
    for (const c of list) {
      let m = kinds.get(c.cover); if (!m) kinds.set(c.cover, (m = new Map()));
      const k = coverCells(c);
      const tint = c.cover === 'wet' ? (PUDDLE_TINT[(groundAt(c.x, c.y).surface.under) || 'tarmac'] || 'rgba(52,66,92,0.58)') : null;
      for (let i = 0; i < k.all.length; i += 2) { const gx = Math.round(k.all[i] / G), gy = Math.round(k.all[i + 1] / G), key = gx * 131071 + gy; if (!m.has(key)) m.set(key, { x: k.all[i], y: k.all[i + 1], gx, gy, tint }); }
    }
    const out = [];
    for (const [kind, m] of kinds) {
      const cells = [...m.values()], rim = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of cells) {
        if (!m.has((c.gx + 1) * 131071 + c.gy) || !m.has((c.gx - 1) * 131071 + c.gy) || !m.has(c.gx * 131071 + c.gy + 1) || !m.has(c.gx * 131071 + c.gy - 1)) rim.push(c);
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + G); y1 = Math.max(y1, c.y + G);
      }
      out.push({ kind, cells, rim, bb: [x0, y0, x1, y1], G });
    }
    LEVEL._mergedOf = list; LEVEL._merged = out;
    return out;
  }
  function drawCoversMerged(list) {
    const p = PPMz(), vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    for (const grp of mergedCovers(list)) {
      const [x0, y0, x1, y1] = grp.bb, G = grp.G;
      if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
      const vis = grp.cells.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1);
      if (!vis.length) continue;
      const path = (cells) => { view.ctx.beginPath(); for (const c of cells) view.ctx.rect(sx(c.x), sy(c.y), G * p, G * p); };
      const bx0 = Math.max(x0, vx0), by0 = Math.max(y0, vy0), bx1 = Math.min(x1, vx1), by1 = Math.min(y1, vy1);
      if (grp.kind === 'wet') {
        const byTint = new Map(); for (const c of vis) { let a = byTint.get(c.tint); if (!a) byTint.set(c.tint, (a = [])); a.push(c); }
        for (const [tint, cells] of byTint) { path(cells); view.ctx.fillStyle = tint; view.ctx.fill(); }
        view.ctx.save(); path(vis); view.ctx.clip(); view.ctx.translate(sx(0), sy(0));
        PRIM.sheen(['sheen', 'rgba(215,228,248,0.09)', 4.0, 0.9, -0.45], bx0, by0, bx1, by1);
        PRIM.sheen(['sheen', 'rgba(235,242,252,0.18)', 4.0, 0.10, -0.45], bx0, by0, bx1, by1);
        PRIM.rings(['rings', 'rgba(220,232,250,0.30)', 2.8, 0.30, 0.03, 0.45], bx0, by0, bx1, by1);
        view.ctx.restore();
        path(grp.rim.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1)); view.ctx.fillStyle = 'rgba(30,40,58,0.30)'; view.ctx.fill();
      } else {
        path(vis); view.ctx.fillStyle = artBase(grp.kind, '#ffffff'); view.ctx.fill();
        view.ctx.save(); view.ctx.clip(); view.ctx.translate(sx(0), sy(0)); paintLayers(grp.kind, bx0, by0, bx1, by1); view.ctx.restore();
        path(grp.rim.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1));
        view.ctx.fillStyle = grp.kind === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.55)'; view.ctx.fill();
      }
    }
  }
  function drawCovers() {
    const list = LEVEL.covers;
    if (!list) return;
    if (PIXEL) { drawCoversMerged(list); return; }
    const p = PPMz();
    for (const c of list) {
      const r = Math.max(c.w, c.h) / 2;
      if (sx(c.x + r) < 0 || sx(c.x - r) > view.W || sy(c.y + r) < 0 || sy(c.y - r) > view.H) continue;
      coverPath(c);
      view.ctx.save();
      if (c.cover === 'wet') {
        // water takes the colour of what it lies in: brown in dirt and mud, so it reads as part of them
        const under = (groundAt(c.x, c.y).surface.under) || 'tarmac';
        view.ctx.fillStyle = PUDDLE_TINT[under] || 'rgba(52,66,92,0.58)';
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        // reflections: broad and faint with one thin bright edge, sparse rain rings — the first cut (tight
        // regular bands) read as hatching on the dark tarmac puddles (photographed 2026-10-03)
        PRIM.sheen(['sheen', 'rgba(215,228,248,0.09)', 4.0, 0.9, -0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        PRIM.sheen(['sheen', 'rgba(235,242,252,0.18)', 4.0, 0.10, -0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        PRIM.rings(['rings', 'rgba(220,232,250,0.30)', 2.8, 0.30, 0.03, 0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        view.ctx.restore();
        if (PIXEL) { const k = coverCells(c); cellsPath(k.rim, k.G); view.ctx.fillStyle = 'rgba(30,40,58,0.30)'; view.ctx.fill(); continue; }
        coverPath(c);
        view.ctx.strokeStyle = 'rgba(30,40,58,0.35)'; view.ctx.lineWidth = Math.max(1, 0.12 * p); view.ctx.stroke();
      } else {
        view.ctx.fillStyle = artBase(c.cover, '#ffffff');
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        paintLayers(c.cover, c.x - r, c.y - r, c.x + r, c.y + r);
        view.ctx.restore();
        if (PIXEL) { const k = coverCells(c); cellsPath(k.rim, k.G); view.ctx.fillStyle = c.cover === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.55)'; view.ctx.fill(); continue; }
        coverPath(c);
        view.ctx.strokeStyle = c.cover === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.7)';
        view.ctx.lineWidth = Math.max(1, 0.16 * p); view.ctx.stroke();
      }
    }
  }

  // Dynamic surface wear patches: grass worn to short grass, dirt, and mud
  // Drawn ON TOP OF the track ribbon and ground, but UNDER the kerbs and marks!
  // TWO PASSES around the covers. MEASURED BUG, 2026-10-03 (user: "puddles on the grass track ... vanish
  // when driven over and turned dirt into mud"): wear was drawn AFTER the covers, so every 1.5 m dirt cell
  // turning to mud beside a puddle painted its square over the puddle's edge until the puddle was gone.
  //   'base'  — cells that started with no cover (dirt -> mud ...): drawn UNDER the covers
  //   'cover' — cells whose cover itself changed (snow packed to ice, ice scrubbed through): drawn OVER
  function drawWear(pass = 'base') {
    if (!wearMap || wearMap.size === 0) return;
    // 2026-10-03: a worn cell now LOOKS like what it has become (the same SURFACE_ART as everywhere else)
    // instead of a flat tinted square. Visible cells are grouped by surface, and each group is one path:
    // fill its base, clip to it, paint its layers once — so 1000 worn cells cost a handful of draw calls.
    const groups = new Map();
    for (const cell of wearMap.values()) {
      if (cell.current === cell.orig) continue;
      const startedCovered = cell.orig === 'snow' || cell.orig === 'ice' || cell.orig === 'wet';
      if ((pass === 'cover') !== startedCovered) continue;
      const x0 = Math.round(sx(cell.cx * WEAR_CELL)), y0 = Math.round(sy(cell.cy * WEAR_CELL));
      const x1 = Math.round(sx((cell.cx + 1) * WEAR_CELL)), y1 = Math.round(sy((cell.cy + 1) * WEAR_CELL));
      if (x1 < 0 || x0 > view.W || y1 < 0 || y0 > view.H) continue;
      // water on a cell is drawn as its BASE with a puddle over it, so meltwater on grass looks like water on grass
      const gkey = cell.current === 'wet' ? 'wet|' + cell.base : cell.current;
      let g = groups.get(gkey);
      if (!g) groups.set(gkey, (g = { r: [], bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity }));
      g.r.push(x0, y0, x1 - x0, y1 - y0);
      // world bbox of the group, so its pattern is painted over these cells only. MEASURED 2026-10-03:
      // painting each group across the whole view (clip-only) cost the lab panels run 236 -> 192 frames.
      g.bx0 = Math.min(g.bx0, cell.cx * WEAR_CELL); g.bx1 = Math.max(g.bx1, (cell.cx + 1) * WEAR_CELL);
      g.by0 = Math.min(g.by0, cell.cy * WEAR_CELL); g.by1 = Math.max(g.by1, (cell.cy + 1) * WEAR_CELL);
    }
    for (const [gk, g] of groups) {
      const r = g.r;
      const wetOn = gk.startsWith('wet|') ? gk.slice(4) : null, id = wetOn || gk;
      view.ctx.save();
      view.ctx.beginPath();
      // a soft DISC per cell (radius 0.72 of the cell, so neighbours overlap) rather than a hard square:
      // worn ground then spreads as organic ruts instead of a blocky staircase (photographed 2026-10-03)
      for (let i = 0; i < r.length; i += 4) {
        if (PIXEL) { view.ctx.rect(r[i], r[i + 1], r[i + 2], r[i + 3]); continue; }     // squares in pixel art
        const rr = r[i + 2] * 0.72, cx = r[i] + r[i + 2] / 2, cy = r[i + 1] + r[i + 3] / 2;
        view.ctx.moveTo(cx + rr, cy); view.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      }
      view.ctx.fillStyle = artBase(id, '#6b5644');
      view.ctx.fill();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(id, g.bx0, g.by0, g.bx1, g.by1);
      if (wetOn) {
        view.ctx.fillStyle = PUDDLE_TINT[wetOn] || 'rgba(52,66,92,0.58)';
        // grown by a cell: the discs reach past the cells' squares, and the clip keeps it inside them
        const m = WEAR_CELL;
        view.ctx.fillRect((g.bx0 - m) * PPMz(), (g.by0 - m) * PPMz(), (g.bx1 - g.bx0 + 2 * m) * PPMz(), (g.by1 - g.by0 + 2 * m) * PPMz());
        PRIM.sheen(['sheen', 'rgba(220,232,250,0.12)', 3.0, 0.5, -0.45], g.bx0, g.by0, g.bx1, g.by1);
      }
      view.ctx.restore();
    }
  }


  // BUMPS, JUMPS AND KERBS. A top-down view has no height, so a jump you cannot SEE coming is an unfair
  // one — and unavoidable is a bug, not difficulty (CLAUDE.md §1). Each kind gets a shape that tells you
  // what it will do: a ramp is a wedge that brightens toward a RED LIP where the ground stops, a table
  // has a flat bright top and two edges, a hump is a lit dome, a kerb is the familiar red and white.
  function drawBumps() {
    const p = PPMz();
    for (const b of BUMPS) {
      if (Math.abs(b.x - cam.x) * p > view.W / 2 + 200 || Math.abs(b.y - cam.y) * p > view.H / 2 + 200) continue;
      view.ctx.save();
      view.ctx.translate(sx(b.x), sy(b.y));
      view.ctx.rotate(b.rot || 0);
      // TERRAIN SHAPES ARE SHOWN BY HILL-SHADING NOW (step 3, 2026-10-03; user chose "rebuild the old jumps as terrain" and
      // "pixel hill-shading"). The hand-drawn dome / wedge / table art went: photographed together with the shading it
      // read as two layers of mud. Kept: the KERB (it is paint, not height) and the ramp's RED LIP — the ground really does
      // fall away there, which no shading can show, and a jump you cannot see coming is unfair (CLAUDE.md §1).
      if (b.kind === 'kerb') {
        const n = Math.max(2, Math.round(b.len / 2.4));
        for (let i = 0; i < n; i++) {
          view.ctx.fillStyle = i % 2 ? COL.kerbB : COL.kerbA;
          view.ctx.fillRect((-b.len / 2 + (i * b.len) / n) * p, (-b.wid / 2) * p, (b.len / n) * p + 1, b.wid * p);
        }
        view.ctx.fillStyle = 'rgba(255,255,255,0.35)';
        view.ctx.fillRect((-b.len / 2) * p, -0.3 * p, b.len * p, 0.6 * p);
      } else if (b.kind === 'ramp') {
        view.ctx.fillStyle = 'rgba(214,69,60,0.85)';
        view.ctx.fillRect((b.len / 2 - 0.6) * p, (-b.wid / 2) * p, 0.6 * p, b.wid * p);
      }
      view.ctx.restore();
    }
  }

  function drawRunoff() {
    if (LEVEL.endless) return;   // the lab's border ring is drawn along the WHOLE world edge: 100 km a side on the highway
    for (let i = 0; i < 4; i++) forSide(i, (p, D, Lh) => {
      const E = Lh + RUNOFF_W, F = D + RUNOFF_W;   // along: the side plus both corners; out: the fence
      // GRASS VERGE first — the strip between the kerb and the gravel where you can still save it.
      view.ctx.fillStyle = COL.grass;
      view.ctx.fillRect(-E * p, D * p, E * 2 * p, VERGE_W * p);
      speckle(-E, D, E, D + VERGE_W, COL.grassDark, 0.8, 0.16);
      // then the TRAP: the full width of the side, plus the corner so the ring closes with no seam.
      view.ctx.fillStyle = COL.gravel;
      view.ctx.fillRect(-E * p, (D + VERGE_W) * p, E * 2 * p, (RUNOFF_W - VERGE_W) * p);
      speckle(-E, D + VERGE_W, E, F, COL.gravelGrit, 0.85, 0.15);
      speckle(-E, D + VERGE_W, E, F, COL.gravelDark, 2.4, 0.24);
    });
  }

  // JOKER ARROWS (user spec 2026-10-03: "a TRANSLUCENT WHITE ARROW, gently pulsing" at joker / pit entries). Hidden once the joker
  // is done in an RX race. Wall clock: the pulse is something the player watches.
  function drawArrows(game, wallT) {
    const J = LEVEL.joker; if (!J || !J.arrows) return;
    if (game.jokerTaken) return;
    // stronger + OUTLINED (user: "needs to be closed and more clearly pointing") — at 0.28-0.5 alpha it faded into the grey tarmac
    const p = PPMz(), a = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin((wallT || 0) * 3.2));
    for (const ar of J.arrows) {
      if (sx(ar.x) < -200 || sx(ar.x) > view.W + 200 || sy(ar.y) < -200 || sy(ar.y) > view.H + 200) continue;
      const L = ar.len || 7;
      view.ctx.save(); view.ctx.translate(sx(ar.x), sy(ar.y)); view.ctx.rotate(ar.rot);
      view.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      view.ctx.beginPath();
      view.ctx.moveTo(L * 0.5 * p, 0); view.ctx.lineTo(0, -L * 0.42 * p); view.ctx.lineTo(0, -L * 0.16 * p); view.ctx.lineTo(-L * 0.5 * p, -L * 0.16 * p);
      view.ctx.lineTo(-L * 0.5 * p, L * 0.16 * p); view.ctx.lineTo(0, L * 0.16 * p); view.ctx.lineTo(0, L * 0.42 * p); view.ctx.closePath(); view.ctx.fill();
      view.ctx.strokeStyle = `rgba(20,22,28,${(a * 0.8).toFixed(3)})`; view.ctx.lineWidth = Math.max(1.5, 0.25 * p); view.ctx.lineJoin = "miter"; view.ctx.stroke();
      view.ctx.restore();
    }
  }

  return {
    drawFloor, SURFACE_ART, paintLayers, artBase, drawZones, PUDDLE_TINT, drawPatches,
    drawCovers, drawWear, drawBumps, drawRunoff, drawArrows,
  };
}
