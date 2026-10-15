// The pattern primitives of the ground painter: speckles, lattices and the layer kinds
// (stones, blades, stripes, ripples, blobs, cracks, sheen) that surface art is made of.
import type { ArtLayer, PrimFn } from "../types.ts";
import type { GroundCtx } from "./types.ts";

// most marks one pattern layer may place in one call (see speckle)
const MARKS_MAX = 30000;

// GROUND TEXTURE. A fixed lattice (never an RNG — that crawls between frames), CULLED TO THE
// VIEW.
//
// MEASURED BUG, (photographed): this looped the whole 260 m quadrant, so it could only
// afford ~3 m spacing and the result was a field of 1 m polka dots rather than ground. Culling to
// the visible rectangle first makes the count depend on the SCREEN, not the world, so the grain
// can be as fine as it needs to be and costs the same at any zoom. Squares, not arcs: at grain
// size they read identically and they are far cheaper.

/**
 * Scatters square grain over a region, culled to the view and thinned to MARKS_MAX.
 *
 * @param groundCtx the shared ground painter context
 * @param minX west edge in world metres
 * @param minY north edge in world metres
 * @param maxX east edge in world metres
 * @param maxY south edge in world metres
 * @param colour the grain colour
 * @param spacing lattice spacing in metres
 * @param size mark size in metres
 */
export function speckle(
  groundCtx: GroundCtx, minX: number, minY: number, maxX: number, maxY: number,
  colour: string, spacing: number, size: number
) {
  const { view, cam, PPMz } = groundCtx;
  const ppm = PPMz();
  const markPx = Math.max(1, size * ppm);
  // too far out to resolve: skip it entirely
  if (markPx < 1.1 && spacing * ppm < 3) return;
  // intersect the region with what is actually on screen, snapped to the lattice so the pattern
  // is world-locked and does not swim as the camera moves
  const vx0 = Math.max(minX, cam.x - view.W / 2 / ppm),
    vx1 = Math.min(maxX, cam.x + view.W / 2 / ppm);
  const vy0 = Math.max(minY, cam.y - view.H / 2 / ppm),
    vy1 = Math.min(maxY, cam.y + view.H / 2 / ppm);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  // MARK CAP: the fly-in's whole-level overview asked one call for ~188,000 squares
  // of grass grain (1.1 s to record, 4.9 s to rasterise at 4x throttle). Any call that would
  // place more than MARKS_MAX marks thins its lattice to fit — invisible at the zoom where it
  // happens, since that much grain is sub-pixel noise.
  const markCount = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing);
  if (markCount > MARKS_MAX) spacing *= Math.sqrt(markCount / MARKS_MAX);
  const startU = Math.floor(vx0 / spacing) * spacing,
    startV = Math.floor(vy0 / spacing) * spacing;
  view.ctx.fillStyle = colour;
  for (let latU = startU; latU < vx1; latU += spacing) {
    for (let latV = startV; latV < vy1; latV += spacing) {
      // deterministic scatter from the world position, so a speck belongs to the GROUND
      const hashA = Math.sin(latU * 12.9898 + latV * 78.233) * 43758.5453;
      const jitterX = (hashA - Math.floor(hashA)) - 0.5;
      const hashB = Math.sin(latU * 39.3468 + latV * 11.135) * 24634.6345;
      const jitterY = (hashB - Math.floor(hashB)) - 0.5;
      view.ctx.fillRect(
        (latU + jitterX * spacing) * ppm, (latV + jitterY * spacing) * ppm, markPx, markPx
      );
    }
  }
}

// ---------------------------------------------------------------- SURFACE PAINTER
// User: "All surfaces should have unique and noticeable graphics so we can easily and instantly
// tell them apart." PHOTOGRAPHED BEFORE: every surface was a base colour plus the same square
// speckle, so grass/short grass, tarmac/race tarmac, wet/broken, sand/gravel and mud/dirt read as
// pairs. Colour alone does not survive a glance at speed; SHAPE does. So each surface now gets
// its own pattern vocabulary — stripes, blades, stones, ripples, glossy blobs, cracks, sheen — on
// top of its colour.
//
// Every primitive below shares the speckle rules: a FIXED world lattice (never an RNG, or it
// crawls), CULLED to the view so cost depends on the screen not the world, skipped entirely when
// the feature would be under ~1 px, and BATCHED into one path per layer (one fill/stroke call,
// not one per mark). Callers have translated the context to the world origin, so coordinates are
// world metres * p.

/**
 * Calls mark once per lattice point of a region, culled to the view.
 *
 * @param groundCtx the shared ground painter context
 * @param minX west edge in world metres
 * @param minY north edge in world metres
 * @param maxX east edge in world metres
 * @param maxY south edge in world metres
 * @param spacing lattice spacing in metres
 * @param prob chance a lattice point gets a mark
 * @param mark called with the screen x, y, three random numbers and pixels per metre
 */
function lattice(
  groundCtx: GroundCtx,
  minX: number, minY: number, maxX: number, maxY: number, spacing: number, prob: number,
  mark: (x: number, y: number, a: number, b: number, c: number, p: number) => void
) {
  const { view, cam, PPMz } = groundCtx;
  const ppm = PPMz();
  const vx0 = Math.max(minX, cam.x - view.W / 2 / ppm - spacing),
    vx1 = Math.min(maxX, cam.x + view.W / 2 / ppm + spacing);
  const vy0 = Math.max(minY, cam.y - view.H / 2 / ppm - spacing),
    vy1 = Math.min(maxY, cam.y + view.H / 2 / ppm + spacing);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  const markCount = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing) * prob;
  // the same MARK CAP as speckle
  if (markCount > MARKS_MAX) spacing *= Math.sqrt(markCount / MARKS_MAX);
  const startU = Math.floor(vx0 / spacing) * spacing,
    startV = Math.floor(vy0 / spacing) * spacing;
  for (let latU = startU; latU < vx1; latU += spacing) {
    for (let latV = startV; latV < vy1; latV += spacing) {
      const hashA = Math.sin(latU * 12.9898 + latV * 78.233) * 43758.5453,
        randA = hashA - Math.floor(hashA);
      const hashB = Math.sin(latU * 39.3468 + latV * 11.135) * 24634.6345,
        randB = hashB - Math.floor(hashB);
      const hashC = Math.sin(latU * 7.1231 + latV * 51.719) * 15731.743,
        randC = hashC - Math.floor(hashC);
      if (randC > prob) continue;
      mark(
        (latU + (randA - 0.5) * spacing) * ppm, (latV + (randB - 0.5) * spacing) * ppm,
        randA, randB, randC, ppm
      );
    }
  }
}

/**
 * Paints round (square in pixel art) stones: gravel, dirt pebbles.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintStones(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, PPMz } = groundCtx;
  const [, col, spacing, rMin, rMax, prob = 1] = layer, ppm = PPMz();
  if (rMax * ppm < 0.8 || spacing * ppm < 2.5) return;
  view.ctx.fillStyle = col;
  view.ctx.beginPath();
  lattice(groundCtx, minX, minY, maxX, maxY, spacing, prob, (x, y, randA) => {
    const radius = (rMin + (rMax - rMin) * randA) * ppm;
    // square stones in pixel art
    view.ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  });
  view.ctx.fill();
}

/**
 * Paints grass blade tufts, a little V per lattice point.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintBlades(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, PPMz, grassEnds } = groundCtx;
  const [, col, spacing, len, wid, prob = 1] = layer, ppm = PPMz();
  if (len * ppm < 2 || spacing * ppm < 2.5) return;
  view.ctx.strokeStyle = col;
  view.ctx.lineWidth = Math.max(1, wid * ppm);
  view.ctx.lineCap = grassEnds === 'square' ? 'butt' : 'round';
  view.ctx.beginPath();
  lattice(groundCtx, minX, minY, maxX, maxY, spacing, prob, (x, y, randA, randB) => {
    const bladeLen = len * ppm * (0.7 + 0.6 * randB), tilt = (randA - 0.5) * 0.9;
    view.ctx.moveTo(x, y);
    view.ctx.lineTo(x + Math.sin(tilt - 0.35) * bladeLen, y - Math.cos(tilt - 0.35) * bladeLen);
    view.ctx.moveTo(x, y);
    view.ctx.lineTo(x + Math.sin(tilt + 0.35) * bladeLen, y - Math.cos(tilt + 0.35) * bladeLen);
  });
  view.ctx.stroke();
  view.ctx.lineCap = 'butt';
}

/**
 * Paints mown stripes: alternate bands along world y.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintStripes(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, cam, PPMz } = groundCtx;
  const [, col, band] = layer, ppm = PPMz();
  const vx0 = Math.max(minX, cam.x - view.W / 2 / ppm),
    vx1 = Math.min(maxX, cam.x + view.W / 2 / ppm);
  const vy0 = Math.max(minY, cam.y - view.H / 2 / ppm),
    vy1 = Math.min(maxY, cam.y + view.H / 2 / ppm);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  view.ctx.fillStyle = col;
  for (let bandIdx = Math.floor(vy0 / band); bandIdx * band < vy1; bandIdx++) {
    if (bandIdx & 1) continue;
    view.ctx.fillRect(vx0 * ppm, bandIdx * band * ppm, (vx1 - vx0) * ppm, band * ppm);
  }
}

/**
 * Paints wavy lines: wind ripples in sand, ridges in thick mud.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintRipples(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, cam, PPMz } = groundCtx;
  const [, col, spacing, amp, wave, wid] = layer, ppm = PPMz();
  if (spacing * ppm < 4) return;
  const vx0 = Math.max(minX, cam.x - view.W / 2 / ppm),
    vx1 = Math.min(maxX, cam.x + view.W / 2 / ppm);
  const vy0 = Math.max(minY, cam.y - view.H / 2 / ppm - amp),
    vy1 = Math.min(maxY, cam.y + view.H / 2 / ppm + amp);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  const step = wave / 6;
  view.ctx.strokeStyle = col;
  view.ctx.lineWidth = Math.max(1, wid * ppm);
  view.ctx.beginPath();
  for (let row = Math.floor(vy0 / spacing); row * spacing < vy1; row++) {
    const phase = Math.sin(row * 12.9898) * 437.5;
    for (
      let x = Math.floor(vx0 / step) * step, first = true;
      x <= vx1 + step;
      x += step, first = false
    ) {
      const y = row * spacing + amp * Math.sin((x / wave) * Math.PI * 2 + phase);
      if (first) view.ctx.moveTo(x * ppm, y * ppm);
      else view.ctx.lineTo(x * ppm, y * ppm);
    }
  }
  view.ctx.stroke();
}

/**
 * Paints soft (square in pixel art) blobs: puddles, mud, gloss.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintBlobs(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, PPMz } = groundCtx;
  const [, col, spacing, radiusX, radiusY, prob = 1] = layer, ppm = PPMz();
  if (radiusY * ppm < 0.8 || spacing * ppm < 3) return;
  view.ctx.fillStyle = col;
  view.ctx.beginPath();
  lattice(groundCtx, minX, minY, maxX, maxY, spacing, prob, (x, y, randA, randB) => {
    const scale = 0.7 + 0.6 * randB;
    const halfW = radiusX * scale * ppm, halfH = radiusY * scale * ppm;
    // square blobs in pixel art
    view.ctx.rect(x - halfW, y - halfH, halfW * 2, halfH * 2);
  });
  view.ctx.fill();
}

/**
 * Paints jagged cracks with a side branch: ice, broken tarmac.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintCracks(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, PPMz } = groundCtx;
  const [, col, spacing, len, wid, prob = 1] = layer, ppm = PPMz();
  if (len * ppm < 4 || spacing * ppm < 4) return;
  view.ctx.strokeStyle = col;
  view.ctx.lineWidth = Math.max(1, wid * ppm);
  view.ctx.beginPath();
  lattice(groundCtx, minX, minY, maxX, maxY, spacing, prob, (x, y, randA, randB, randC) => {
    let ang = randA * Math.PI * 2, penX = x, penY = y;
    view.ctx.moveTo(penX, penY);
    for (let seg = 0; seg < 4; seg++) {
      ang += ((seg % 2 ? randB : randC) - 0.5) * 1.4;
      penX += Math.cos(ang) * len * 0.3 * ppm;
      penY += Math.sin(ang) * len * 0.3 * ppm;
      view.ctx.lineTo(penX, penY);
      if (seg === 1) {
        view.ctx.lineTo(
          penX + Math.cos(ang + 1.1) * len * 0.25 * ppm,
          penY + Math.sin(ang + 1.1) * len * 0.25 * ppm
        );
        view.ctx.moveTo(penX, penY);
      }
    }
  });
  view.ctx.stroke();
}

/**
 * Paints long diagonal sheen bands: polish on ice, standing water.
 *
 * @param groundCtx the shared ground painter context
 * @param layer the ArtLayer row [kind, colour, ...numbers in metres]
 * @param minX west edge of the region in world metres
 * @param minY north edge of the region in world metres
 * @param maxX east edge of the region in world metres
 * @param maxY south edge of the region in world metres
 */
function paintSheen(
  groundCtx: GroundCtx, layer: ArtLayer, minX: number, minY: number, maxX: number, maxY: number
) {
  const { view, cam, PPMz } = groundCtx;
  const [, col, spacing, wid, slope] = layer, ppm = PPMz();
  // extended past the view by a band's width: a square-cut diagonal band ending exactly at a
  // TILE edge left a visible notch at every tile seam (photographed on the lab ice
  // sheet)
  const vx0 = Math.max(minX, cam.x - view.W / 2 / ppm - wid * 2),
    vx1 = Math.min(maxX, cam.x + view.W / 2 / ppm + wid * 2);
  const vy0 = Math.max(minY, cam.y - view.H / 2 / ppm),
    vy1 = Math.min(maxY, cam.y + view.H / 2 / ppm);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  view.ctx.strokeStyle = col;
  view.ctx.lineWidth = Math.max(1, wid * ppm);
  view.ctx.beginPath();
  const lineA = (vy0 - slope * Math.max(vx0, vx1)) / spacing,
    lineB = (vy1 - slope * Math.min(vx0, vx1)) / spacing;
  for (
    let line = Math.floor(Math.min(lineA, lineB));
    line <= Math.ceil(Math.max(lineA, lineB));
    line++
  ) {
    view.ctx.moveTo(vx0 * ppm, (line * spacing + slope * vx0) * ppm);
    view.ctx.lineTo(vx1 * ppm, (line * spacing + slope * vx1) * ppm);
  }
  view.ctx.stroke();
}

/**
 * Builds the table of layer kinds; each paints one [kind, colour, ...numbers] layer.
 *
 * @param groundCtx the shared ground painter context
 */
export function makePrim(groundCtx: GroundCtx): Record<string, PrimFn> {
  return {
    // fine square grain — aggregate, grit, sparkle
    grain(layer, minX, minY, maxX, maxY) {
      speckle(groundCtx, minX, minY, maxX, maxY, layer[1], layer[2], layer[3]);
    },
    // round stones, radius rMin..rMax — gravel, dirt pebbles
    stones(layer, minX, minY, maxX, maxY) {
      paintStones(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // grass blades — a little V tuft per lattice point
    blades(layer, minX, minY, maxX, maxY) {
      paintBlades(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // mown stripes: alternate bands along world y, `band` metres wide
    stripes(layer, minX, minY, maxX, maxY) {
      paintStripes(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // wavy lines — wind ripples in sand, ridges in thick mud
    ripples(layer, minX, minY, maxX, maxY) {
      paintRipples(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // soft ellipses — puddles, mud pools, glossy highlights, drift shadows, repair patches
    blobs(layer, minX, minY, maxX, maxY) {
      paintBlobs(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // thin rings (rain ripples) are NOT drawn in pixel art - as hollow squares they read as UI
    // glitches (photographed on the wet pad). The wet surface keeps its rings layer only because
    // its colour is part of the tile palette (tiles.ts paletteSnap): removing it changed the
    // ground pixels (tilediff).
    rings() {},
    // jagged cracks with a side branch — ice, broken tarmac
    cracks(layer, minX, minY, maxX, maxY) {
      paintCracks(groundCtx, layer, minX, minY, maxX, maxY);
    },
    // long diagonal sheen bands — polish on ice, reflection on standing water
    sheen(layer, minX, minY, maxX, maxY) {
      paintSheen(groundCtx, layer, minX, minY, maxX, maxY);
    },
  };
}
