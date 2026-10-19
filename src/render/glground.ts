// The GPU ground: the cached ground tiles drawn by WebGL2 on a canvas under the 2D canvas, at full
// screen resolution. In the art-pixel buffer a tile is shrunk to the camera's exact zoom with
// smoothing off, which drops a different set of pixels at every zoom (a flicker). Here a tile is
// only ever enlarged (2-4 screen pixels per tile pixel) and drawn with a sharp-pixel filter: each
// art pixel stays a crisp square and its edges blend over one screen pixel, so the ground looks the
// same at every zoom. Pictures shrunk below one screen pixel per pixel (the fly-in overview) use
// mipmaps. Everything else (deck, marks, props, cars, HUD) stays 2D, drawn over a transparent art
// buffer. The floor and zones are painted here in world space first (glpaint.ts), and the tiles
// only carry what is drawn over them. It is THE ground: the game needs WebGL2 (the iPhone's Safari
// has it since iOS 15), and a lost context is rebuilt when the browser gives it back.
import { createGlPaint } from "./glpaint.ts";
import type { GroundPatch, PaintCamera } from "./glpaint.ts";
import { createGlShade } from "./glshade.ts";
import { createGlField } from "./glfield.ts";
import type { GlField } from "./glfield.ts";
import { buildProgram, WET_GLSL } from "./glprogram.ts";
import { WEATHER } from "../world/weather.ts";
import type { GlShade, ShadeRect } from "./glshade.ts";

/** Where the ground pass draws: the 2D art buffer or the GPU canvas. CSS px of the view. */
export interface GroundSink {
  fill(colour: string): void;
  image(source: HTMLCanvasElement, x: number, y: number, width: number, height: number): void;
  /**
   * Keeps a picture's texture from expiring; with `upload`, also uploads it (with mipmaps) if
   * that is not done yet. Returns true when it uploaded or built mipmaps.
   */
  preload(source: HTMLCanvasElement, upload: boolean): boolean;
}

/** How a CSS px of the view maps to a screen device pixel this frame. */
export interface GroundFrame {
  width: number;     // screen canvas width, device px
  height: number;    // screen canvas height, device px
  artDpr: number;    // art px per CSS px (view.dpr in pixel mode)
  blockPx: number;   // device px per art px
  subX: number;      // the sub-pixel camera shift, device px
  subY: number;
}

/** A cached texture of a tile or overview canvas. */
interface TexEntry { tex: WebGLTexture; mip: boolean; used: number }

// a texture not drawn for this many frames is deleted (tiles are evicted by the tile cache)
const TEX_IDLE_FRAMES = 90;

const VERTEX = `#version 300 es
in vec2 corner;
uniform vec4 rect;       // x, y, w, h in device px
uniform vec2 screen;     // canvas size in device px
out vec2 uv;
void main() {
  uv = corner;
  vec2 pos = rect.xy + corner * rect.zw;
  gl_Position = vec4(pos / screen * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;

// sharp-pixel filter: inside a texel the colour is flat; across a texel edge it blends over about
// one screen pixel, so a texel drawn 2.6 px wide never becomes 2 or 3 whole pixels by chance
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tex;
uniform vec2 texSize;
uniform float scale;     // screen px per texel
uniform bool snapTexels; // GPU paint: each opaque texel snapped to the palette before blending
uniform highp usampler3D palette;   // the palette lookup (glpaint.ts, texture unit 1)
out vec4 colour;
${WET_GLSL}

// PIXEL MODE on the GPU: an opaque texel as its nearest palette colour (tilesPalette.ts); the
// CPU tiles read their pixels back to do this, about half of a tile's cost
vec4 snappedTexel(ivec2 at) {
  vec4 texel = texelFetch(tex, clamp(at, ivec2(0), ivec2(texSize) - 1), 0);
  if (texel.a < 0.999) return texel;
  ivec3 index = ivec3(floor(texel.bgr * 255.0 + 0.5)) >> 3;
  uint packed = texelFetch(palette, index, 0).r;
  return vec4(uvec4(packed, packed >> 8, packed >> 16, 255u) & 255u) / 255.0;
}

vec4 groundColour() {
  if (scale < 1.0) return texture(tex, uv);
  vec2 texel = uv * texSize;
  vec2 base = floor(texel);
  vec2 centre = fract(texel) - 0.5;
  vec2 region = vec2(0.5 - 0.5 / scale);
  vec2 offset = (centre - clamp(centre, -region, region)) * scale + 0.5;
  // tiles have mipmaps (built with the upload), so the sharp filter reads level 0
  if (!snapTexels) return textureLod(tex, (base + offset) / texSize, 0.0);
  // the same bilinear blend as the texture filter, of the snapped texels
  vec2 corner = base + offset - 0.5;
  ivec2 first = ivec2(floor(corner));
  vec2 weight = corner - floor(corner);
  return mix(
    mix(snappedTexel(first), snappedTexel(first + ivec2(1, 0)), weight.x),
    mix(snappedTexel(first + ivec2(0, 1)), snappedTexel(first + ivec2(1, 1)), weight.x),
    weight.y);
}

void main() {
  colour = wetten(groundColour());
}`;

/** CSS colours already read, and the one canvas they are read through */
interface ColourCache {
  rgba: Map<string, number[]>;
  probe: CanvasRenderingContext2D | null;
}

/**
 * The 1x1 canvas a colour is read through. A fresh canvas per colour (GPU-backed, then read
 * back) cost ~1 ms each: the GPU painter's first frame reads every surface colour, 43 ms at the
 * race start's fly-in hand-over (laptop profile). One canvas of the same kind is reused
 * (0.06 ms a colour), cleared and reset to a fresh canvas's fill first, so every colour reads
 * the same (checked: all 570 colours in src/).
 * @param cache the colour cache
 * @returns the canvas context
 */
function colourProbe(cache: ColourCache) {
  if (!cache.probe) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    cache.probe = canvas.getContext('2d')!;
  }
  cache.probe.clearRect(0, 0, 1, 1);
  cache.probe.fillStyle = '#000000';
  return cache.probe;
}

/**
 * A CSS colour as RGBA in 0..1, read once through a 1x1 2D canvas and cached.
 * @param cache the colour cache
 * @param colour the CSS colour
 * @returns the RGBA
 */
function parseColour(cache: ColourCache, colour: string) {
  let rgba = cache.rgba.get(colour);
  if (!rgba) {
    const probe = colourProbe(cache);
    probe.fillStyle = colour;
    probe.fillRect(0, 0, 1, 1);
    rgba = Array.from(probe.getImageData(0, 0, 1, 1).data, (value) => value / 255);
    cache.rgba.set(colour, rgba);
  }
  return rgba;
}

/**
 * The texture of a canvas, uploaded once; mipmaps are built the first time it is drawn shrunk, or
 * with the upload. MEASURED (Castle Cum zoom glide): the first zoom-out past one
 * screen px per tile px built them for every tile in view in one frame (14 on a landscape phone;
 * tiles painted while zoomed in have none); sharpness 1.5 put that zoom at ~0.5, mid speed.
 * @param webgl the WebGL2 context
 * @param cache the texture cache
 * @param source the canvas
 * @param frame the frame number
 * @param shrunk true when drawn at less than one screen pixel per pixel, or mipmaps wanted now
 * @param counts uploads and mipmap builds so far (the phone report reads them)
 * @returns the texture
 */
function textureOf(webgl: WebGL2RenderingContext, cache: Map<HTMLCanvasElement, TexEntry>,
    source: HTMLCanvasElement, frame: number, shrunk: boolean, counts: GpuCounts) {
  let entry = cache.get(source);
  if (!entry) {
    counts.uploads++;
    const tex = webgl.createTexture()!;
    webgl.bindTexture(webgl.TEXTURE_2D, tex);
    webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, webgl.RGBA, webgl.UNSIGNED_BYTE, source);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);
    entry = { tex, mip: false, used: frame };
    cache.set(source, entry);
  }
  webgl.bindTexture(webgl.TEXTURE_2D, entry.tex);
  if (shrunk && !entry.mip) {
    counts.mipmaps++;
    webgl.generateMipmap(webgl.TEXTURE_2D);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR_MIPMAP_LINEAR);
    entry.mip = true;
  }
  entry.used = frame;
  return entry.tex;
}

/**
 * The unit quad every picture is drawn with, and the program's uniform locations.
 * @param webgl the WebGL2 context
 * @param program the ground program
 * @returns the uniforms and the vertex array
 */
function buildQuad(webgl: WebGL2RenderingContext, program: WebGLProgram) {
  const where = (name: string) => webgl.getUniformLocation(program, name);
  const uniforms = {
    rect: where('rect'), screen: where('screen'), texSize: where('texSize'), scale: where('scale'),
    snapTexels: where('snapTexels'), palette: where('palette'), wet: where('wet'),
  };
  const vao = webgl.createVertexArray();
  webgl.bindVertexArray(vao);
  webgl.bindBuffer(webgl.ARRAY_BUFFER, webgl.createBuffer());
  webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    webgl.STATIC_DRAW);
  const corner = webgl.getAttribLocation(program, 'corner');
  webgl.enableVertexAttribArray(corner);
  webgl.vertexAttribPointer(corner, 2, webgl.FLOAT, false, 0, 0);
  return { uniforms, vao };
}

/** What the sink and the frame calls share. */
interface SinkState {
  lost: boolean;
  frameNo: number;
  frame: GroundFrame | null;
  painted: boolean;    // the GPU painter drew the floor this frame, so a fill would wipe it
  counts: GpuCounts;   // tile / picture uploads and mipmap builds so far
}

/** Texture uploads and mipmap builds so far (the phone report, ui/report.ts). */
export interface GpuCounts { uploads: number; mipmaps: number }

/**
 * A fresh frame state for the GPU ground.
 * @returns the state
 */
const newSinkState = (): SinkState => ({
  lost: false, frameNo: 0, frame: null, painted: false, counts: { uploads: 0, mipmaps: 0 },
});

/**
 * The sink the tile cache draws through: a fill colour and canvases at CSS px rectangles.
 * @param webgl the WebGL2 context
 * @param program the ground program
 * @param colours the colour cache
 * @param state the shared frame state
 * @returns the sink and its texture cache
 */
function createSink(webgl: WebGL2RenderingContext, program: WebGLProgram,
    colours: ColourCache, state: SinkState) {
  const { uniforms, vao } = buildQuad(webgl, program);
  const textures = new Map<HTMLCanvasElement, TexEntry>();
  const sink: GroundSink = {
    fill(colour) {

      if (state.painted) return;
      const [red, green, blue] = parseColour(colours, colour);
      webgl.clearColor(red, green, blue, 1);
      webgl.clear(webgl.COLOR_BUFFER_BIT);
    },
    preload(source, upload) {
      const entry = textures.get(source);
      if (entry) entry.used = state.frameNo;
      if (!upload || (entry && entry.mip)) return false;
      textureOf(webgl, textures, source, state.frameNo, true, state.counts);
      return true;
    },
    image(source, x, y, width, height) {
      const frame = state.frame;
      if (!frame || !source.width || !source.height) return;
      const art = frame.artDpr * frame.blockPx;
      const scale = (width * art) / source.width;
      webgl.useProgram(program);
      webgl.bindVertexArray(vao);
      textureOf(webgl, textures, source, state.frameNo, true, state.counts);
      webgl.uniform4f(uniforms.rect, x * art + frame.subX, y * art + frame.subY, width * art,
        height * art);
      webgl.uniform2f(uniforms.screen, frame.width, frame.height);
      webgl.uniform2f(uniforms.texSize, source.width, source.height);
      webgl.uniform1f(uniforms.scale, scale);
      // over the GPU painter's ground the tiles are not palette-snapped on the CPU (tiles.ts)
      webgl.uniform1i(uniforms.snapTexels, state.painted ? 1 : 0);
      webgl.uniform1i(uniforms.palette, 1);
      webgl.uniform1f(uniforms.wet, WEATHER.wetness);
      webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
    },
  };
  return { sink, textures };
}

/** The GPU ground's WebGL resources: built at start-up and again when a lost context is back. */
interface GlParts {
  sink: GroundSink;
  textures: Map<HTMLCanvasElement, TexEntry>;
  painter: NonNullable<ReturnType<typeof createGlPaint>>;
  shade: GlShade;
  field: GlField;
}

/**
 * Builds every WebGL resource of the GPU ground on a (fresh or restored) context: the ground
 * program and its quad, the floor / zone painter, the hill shading and the cover field. Textures
 * start empty: every tile uploads again when it is next drawn.
 * @param webgl the WebGL2 context
 * @param colours the colour cache (CPU data: it survives a lost context)
 * @param state the shared frame state
 * @returns the resources
 * @throws when a program does not compile or link
 */
function buildParts(webgl: WebGL2RenderingContext, colours: ColourCache,
    state: SinkState): GlParts {
  // our canvases are already in the colours we want: no colour-space conversion on upload (on a
  // wide-colour phone screen the browser may otherwise convert every texture and tile it uploads)
  webgl.pixelStorei(webgl.UNPACK_COLORSPACE_CONVERSION_WEBGL, webgl.NONE);
  const program = buildProgram(webgl, VERTEX, FRAGMENT, 'ground');
  const { sink, textures } = createSink(webgl, program, colours, state);
  const painter = createGlPaint(webgl, (rgb) => parseColour(colours, rgb));
  const shade = createGlShade(webgl), field = createGlField(webgl);
  if (!painter || !shade || !field) throw new Error('a GPU ground program did not build');
  return { sink, textures, painter, shade, field };
}

/**
 * The cover field calls of the GPU ground (render/glfield.ts), on the current resources.
 * @param parts the current resources
 * @param state the shared frame state
 * @returns the calls
 */
function fieldCalls(parts: () => GlParts, state: SinkState) {
  return {
    /**
     * Brings the field's chunks up to date (glfield.ts update).
     * @param view the world rectangle on screen now, m
     * @param widest the world rectangle the widest zoom would show, m
     */
    updateField(view: ShadeRect, widest: ShadeRect) { parts().field.update(view, widest); },
    /**
     * The wear cells over a rectangle changed: the field's mask follows.
     * @param rect the rectangle, m
     */
    fieldCellsChanged(rect: ShadeRect) { parts().field.cellsChanged(rect); },
    /**
     * Draws the field over the ground (before the hill shading).
     * @param camera where the world lands on the canvas this frame
     */
    drawField(camera: PaintCamera) {
      if (state.frame) parts().field.draw(state.frame, camera);
    },
  };
}

/**
 * The GPU hill shading calls of the GPU ground (glshade.ts), on the current resources.
 * @param parts the current resources
 * @param state the shared frame state
 * @returns the calls
 */
function shadeCalls(parts: () => GlParts, state: SinkState) {
  return {
    /** texture uploads and mipmap builds so far (the phone report; the object is live) */
    counts: state.counts,
    /**
     * Brings the GPU hill shading up to date (glshade.ts update).
     * @param view the world rectangle on screen now, m
     * @param widest the world rectangle the widest zoom would show, m
     */
    updateShade(view: ShadeRect, widest: ShadeRect) { parts().shade.update(view, widest); },
    /**
     * Forgets the hill shading over a world rectangle (the ground height changed there).
     * @param rect the rectangle, m
     */
    invalidateShade(rect: ShadeRect) { parts().shade.invalidate(rect); },
    /**
     * Readies the hill shading over a rectangle within its budget, drawing nothing (glshade.ts).
     * @param rect the rectangle, m
     */
    warmShade(rect: ShadeRect) { parts().shade.warm(rect); },
    /**
     * Draws the hill shading over the whole GPU ground (after the tiles).
     * @param camera where the world lands on the canvas this frame
     */
    drawShade(camera: PaintCamera) {
      if (state.frame) parts().shade.draw(state.frame, camera);
    },
    /**
     * The GPU hill shading's chunk count and ms (tools). A function, not a getter: this object is
     * spread into the GPU ground, which would copy a getter's value once.
     * @returns the stats
     */
    shadeStats: () => parts().shade.stats,
  };
}

/**
 * Listens for the context being lost and coming back. Safari can drop a page's WebGL context
 * (memory pressure, the app in the background); preventDefault on the loss lets the browser give
 * it back, and then every resource is built again on it. While it is lost nothing draws on the
 * GPU ground (the screen keeps its last frame); then the game carries on as before.
 * @param canvas the GPU ground's canvas
 * @param state the shared frame state (lost)
 * @param rebuild builds the resources on the restored context
 */
function watchContext(canvas: HTMLCanvasElement, state: SinkState, rebuild: () => void) {
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    state.lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      rebuild();
      state.lost = false;
    } catch { /* it stays lost: nothing more can be done on this context */ }
  });
}

/**
 * Creates the GPU ground under the screen canvas: the floor and zones painted on the GPU
 * (glpaint.ts), the tiles drawn over them, the cover field and the hill shading on top. Null when
 * WebGL2 is not available.
 * @param screen the screen canvas
 * @returns the GPU ground, or null
 */
export function createGlGround(screen: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.id = 'glground';
  // preserveDrawingBuffer: the test tools read the finished frame back after it is shown. It looks
  // like a copy per frame, but turning it off made the owner's iPhone WORSE (?report=1, Lab, home
  // screen: 0.37 % slow frames with it, 0.6 % without): Safari composites this canvas under the 2D
  // one more smoothly when it keeps its frame
  const webgl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, preserveDrawingBuffer: true, stencil: true,
  });
  if (!webgl) return null;
  const colours: ColourCache = { rgba: new Map(), probe: null };
  const state = newSinkState();
  let parts: GlParts;
  try { parts = buildParts(webgl, colours, state); } catch { return null; }
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;'
    + 'touch-action:none;pointer-events:none';
  Object.assign(screen.style, { position: 'relative', zIndex: '1' });
  screen.parentNode!.insertBefore(canvas, screen);
  watchContext(canvas, state, () => { parts = buildParts(webgl, colours, state); });
  const current = () => parts;
  return {
    canvas,
    /** the sink the tiles draw through (the current context's) */
    get sink() { return parts.sink; },
    /** true while the GPU ground can draw (its context is not lost) */
    get active() { return !state.lost; },
    /**
     * Starts a frame: sizes the canvas to the screen and sets the CSS px -> device px mapping.
     * @param frame the mapping of this frame
     */
    begin(frame: GroundFrame) {
      if (canvas.width !== frame.width || canvas.height !== frame.height) {
        canvas.width = frame.width;
        canvas.height = frame.height;
      }
      webgl.viewport(0, 0, frame.width, frame.height);
      webgl.enable(webgl.BLEND);
      webgl.blendFunc(webgl.ONE, webgl.ONE_MINUS_SRC_ALPHA);
      state.frame = frame;
      state.frameNo++;
      state.painted = false;
    },
    /**
     * Paints the floor and zone patches in world space, under everything the tiles draw.
     * @param camera where the world lands on the canvas this frame
     * @param patches the patches, back to front
     * @param count how many of the patches to draw
     * @param palette the pixel-mode palette lookup (tilesPalette.ts)
     */
    paint(camera: PaintCamera, patches: GroundPatch[], count: number, palette: Uint32Array) {
      if (!state.frame) return;
      parts.painter.paint(state.frame, camera, { patches, count, palette });
      state.painted = true;
    },
    ...shadeCalls(current, state),
    ...fieldCalls(current, state),
    /** Ends a frame: drops textures no tile has drawn for a while. */
    end() {
      for (const [source, entry] of parts.textures) {
        if (state.frameNo - entry.used > TEX_IDLE_FRAMES) {
          webgl.deleteTexture(entry.tex);
          parts.textures.delete(source);
        }
      }
    },
    /** how many textures are on the GPU (for the tools) */
    get textureCount() { return parts.textures.size; },
  };
}

export type GlGround = NonNullable<ReturnType<typeof createGlGround>>;
