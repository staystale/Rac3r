// The GPU ground: the cached ground tiles drawn by WebGL2 on a canvas under the 2D canvas, at
// full screen resolution. In the art-pixel buffer a tile is shrunk to the camera's exact zoom
// with smoothing off, which drops a different set of pixels at every zoom (a flicker). Here a
// tile is only ever enlarged (2-4 screen pixels per tile pixel) and drawn with a sharp-pixel
// filter: each art pixel stays a crisp square and its edges blend over one screen pixel, so the
// ground looks the same at every zoom. Pictures shrunk below one screen pixel per pixel (the
// fly-in overview) use mipmaps. Everything else (deck, marks, props, cars, HUD) stays 2D, drawn
// over a transparent art buffer. With the GPU painter (glpaint.ts, ?gpupaint=1) the floor and
// zones are painted here in world space first, and the tiles only carry what is drawn over them.
import { createGlPaint } from "./glpaint.ts";
import type { GroundPatch, PaintCamera } from "./glpaint.ts";
import { createGlShade } from "./glshade.ts";
import type { GlShade, ShadeRect } from "./glshade.ts";

/** Where the ground pass draws: the 2D art buffer or the GPU canvas. CSS px of the view. */
export interface GroundSink {
  fill(colour: string): void;
  image(source: HTMLCanvasElement, x: number, y: number, width: number, height: number): void;
  /** 'write': what is drawn masks the area; 'under': draw only where nothing masked; 'off' */
  mask(mode: 'write' | 'under' | 'off'): void;
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

// PIXEL MODE on the GPU: an opaque texel as its nearest palette colour (tilesPalette.ts); the
// CPU tiles read their pixels back to do this, about half of a tile's cost
vec4 snappedTexel(ivec2 at) {
  vec4 texel = texelFetch(tex, clamp(at, ivec2(0), ivec2(texSize) - 1), 0);
  if (texel.a < 0.999) return texel;
  ivec3 index = ivec3(floor(texel.bgr * 255.0 + 0.5)) >> 3;
  uint packed = texelFetch(palette, index, 0).r;
  return vec4(uvec4(packed, packed >> 8, packed >> 16, 255u) & 255u) / 255.0;
}

void main() {
  if (scale < 1.0) { colour = texture(tex, uv); return; }
  vec2 texel = uv * texSize;
  vec2 base = floor(texel);
  vec2 centre = fract(texel) - 0.5;
  vec2 region = vec2(0.5 - 0.5 / scale);
  vec2 offset = (centre - clamp(centre, -region, region)) * scale + 0.5;
  if (!snapTexels) { colour = texture(tex, (base + offset) / texSize); return; }
  // the same bilinear blend as the texture filter, of the snapped texels
  vec2 corner = base + offset - 0.5;
  ivec2 first = ivec2(floor(corner));
  vec2 weight = corner - floor(corner);
  colour = mix(
    mix(snappedTexel(first), snappedTexel(first + ivec2(1, 0)), weight.x),
    mix(snappedTexel(first + ivec2(0, 1)), snappedTexel(first + ivec2(1, 1)), weight.x),
    weight.y);
}`;

/**
 * Compiles and links the ground shader program.
 * @param webgl the WebGL2 context
 * @returns the program
 */
function buildProgram(webgl: WebGL2RenderingContext) {
  const program = webgl.createProgram()!;
  for (const [kind, source] of [[webgl.VERTEX_SHADER, VERTEX], [webgl.FRAGMENT_SHADER, FRAGMENT]] as
      const) {
    const shader = webgl.createShader(kind)!;
    webgl.shaderSource(shader, source);
    webgl.compileShader(shader);
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
      throw new Error('ground shader: ' + webgl.getShaderInfoLog(shader));
    }
    webgl.attachShader(program, shader);
  }
  webgl.linkProgram(program);
  if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
    throw new Error('ground program: ' + webgl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * A CSS colour as RGBA in 0..1, read once through a 1x1 2D canvas and cached.
 * @param cache the colour cache
 * @param colour the CSS colour
 * @returns the RGBA
 */
function parseColour(cache: Map<string, number[]>, colour: string) {
  let rgba = cache.get(colour);
  if (!rgba) {
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.fillStyle = colour;
    probe.fillRect(0, 0, 1, 1);
    rgba = Array.from(probe.getImageData(0, 0, 1, 1).data, (value) => value / 255);
    cache.set(colour, rgba);
  }
  return rgba;
}

/**
 * The texture of a canvas, uploaded once; mipmaps are built the first time it is drawn shrunk.
 * @param webgl the WebGL2 context
 * @param cache the texture cache
 * @param source the canvas
 * @param frame the frame number
 * @param shrunk true when drawn at less than one screen pixel per pixel
 * @returns the texture
 */
function textureOf(webgl: WebGL2RenderingContext, cache: Map<HTMLCanvasElement, TexEntry>,
    source: HTMLCanvasElement, frame: number, shrunk: boolean) {
  let entry = cache.get(source);
  if (!entry) {
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
    snapTexels: where('snapTexels'), palette: where('palette'),
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

/**
 * Sets the stencil mask for what is drawn next (GroundSink.mask).
 * @param webgl the WebGL2 context
 * @param mode 'write' marks every pixel drawn, 'under' draws only on unmarked pixels, 'off'
 */
function setMask(webgl: WebGL2RenderingContext, mode: 'write' | 'under' | 'off') {
  if (mode === 'off') { webgl.disable(webgl.STENCIL_TEST); return; }
  webgl.enable(webgl.STENCIL_TEST);
  if (mode === 'write') {
    webgl.stencilFunc(webgl.ALWAYS, 1, 0xff);
    webgl.stencilOp(webgl.KEEP, webgl.KEEP, webgl.REPLACE);
  } else {
    webgl.stencilFunc(webgl.EQUAL, 0, 0xff);
    webgl.stencilOp(webgl.KEEP, webgl.KEEP, webgl.KEEP);
  }
}

/** What the sink and the frame calls share. */
interface SinkState {
  lost: boolean;
  frameNo: number;
  frame: GroundFrame | null;
  painted: boolean;    // the GPU painter drew the floor this frame, so a fill would wipe it
}

/**
 * The sink the tile cache draws through: a fill colour and canvases at CSS px rectangles.
 * @param webgl the WebGL2 context
 * @param program the ground program
 * @param colours the colour cache
 * @param state the shared frame state
 * @returns the sink and its texture cache
 */
function createSink(webgl: WebGL2RenderingContext, program: WebGLProgram,
    colours: Map<string, number[]>, state: SinkState) {
  const { uniforms, vao } = buildQuad(webgl, program);
  const textures = new Map<HTMLCanvasElement, TexEntry>();
  const sink: GroundSink = {
    fill(colour) {

      if (state.painted) return;
      const [red, green, blue] = parseColour(colours, colour);
      webgl.clearColor(red, green, blue, 1);
      webgl.clear(webgl.COLOR_BUFFER_BIT);
    },
    mask(mode) { setMask(webgl, mode); },
    image(source, x, y, width, height) {
      const frame = state.frame;
      if (!frame || !source.width || !source.height) return;
      const art = frame.artDpr * frame.blockPx;
      const scale = (width * art) / source.width;
      webgl.useProgram(program);
      webgl.bindVertexArray(vao);
      textureOf(webgl, textures, source, state.frameNo, scale < 1);
      webgl.uniform4f(uniforms.rect, x * art + frame.subX, y * art + frame.subY, width * art,
        height * art);
      webgl.uniform2f(uniforms.screen, frame.width, frame.height);
      webgl.uniform2f(uniforms.texSize, source.width, source.height);
      webgl.uniform1f(uniforms.scale, scale);
      // over the GPU painter's ground the tiles are not palette-snapped on the CPU (tiles.ts)
      webgl.uniform1i(uniforms.snapTexels, state.painted ? 1 : 0);
      webgl.uniform1i(uniforms.palette, 1);
      webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
    },
  };
  return { sink, textures };
}

/**
 * The GPU hill shading calls of the GPU ground (no-ops without the painter).
 * @param shade the hill shading (glshade.ts), or null
 * @param state the shared frame state
 * @returns the calls
 */
function shadeCalls(shade: GlShade | null, state: SinkState) {
  return {
    /**
     * Brings the GPU hill shading up to date (glshade.ts update).
     * @param view the world rectangle on screen now, m
     * @param widest the world rectangle the widest zoom would show, m
     */
    updateShade(view: ShadeRect, widest: ShadeRect) { shade?.update(view, widest); },
    /**
     * Forgets the hill shading over a world rectangle (the ground height changed there).
     * @param rect the rectangle, m
     */
    invalidateShade(rect: ShadeRect) { shade?.invalidate(rect); },
    /**
     * Draws the hill shading over the whole GPU ground (after the tiles).
     * @param camera where the world lands on the canvas this frame
     */
    drawShade(camera: PaintCamera) {
      if (shade && state.frame) shade.draw(state.frame, camera);
    },
    /**
     * The GPU hill shading's chunk count and ms (tools). A function, not a getter: this object is
     * spread into the GPU ground, which would copy a getter's value once.
     * @returns the stats, or null
     */
    shadeStats: () => (shade ? shade.stats : null),
  };
}

/**
 * Creates the GPU ground under the screen canvas, or returns null when WebGL2 is not available
 * (the ground then stays in the 2D art buffer, as before).
 * @param screen the screen canvas
 * @param withPainter true to paint the floor and zones on the GPU too (glpaint.ts)
 * @returns the GPU ground, or null
 */
export function createGlGround(screen: HTMLCanvasElement, withPainter = false) {
  const canvas = document.createElement('canvas');
  canvas.id = 'glground';
  // preserveDrawingBuffer: the test tools read the finished frame back after it is shown
  const webgl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, preserveDrawingBuffer: true, stencil: true,
  });
  if (!webgl) return null;
  let program: WebGLProgram;
  try { program = buildProgram(webgl); } catch { return null; }
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;'
    + 'touch-action:none;pointer-events:none';
  screen.style.position = 'relative';
  screen.style.zIndex = '1';
  screen.parentNode!.insertBefore(canvas, screen);
  const colours = new Map<string, number[]>();
  const painter = withPainter
    ? createGlPaint(webgl, (colour) => parseColour(colours, colour)) : null;
  const shade = withPainter ? createGlShade(webgl) : null;
  const state: SinkState = { lost: false, frameNo: 0, frame: null, painted: false };
  canvas.addEventListener('webglcontextlost', () => { state.lost = true; });
  const { sink, textures } = createSink(webgl, program, colours, state);

  return {
    canvas,
    sink,
    /** true while the GPU ground can draw (no lost context) */
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
      webgl.clear(webgl.STENCIL_BUFFER_BIT);
    },
    /** true when the floor and zones are painted on the GPU (glpaint.ts) */
    get painting() { return !!painter; },
    /**
     * Paints the floor and zone patches in world space, under everything the tiles draw.
     * @param camera where the world lands on the canvas this frame
     * @param patches the patches, back to front
     * @param count how many of the patches to draw
     * @param palette the pixel-mode palette lookup (tilesPalette.ts)
     */
    paint(camera: PaintCamera, patches: GroundPatch[], count: number, palette: Uint32Array) {
      if (!painter || !state.frame) return;
      painter.paint(state.frame, camera, { patches, count, palette });
      state.painted = true;
    },
    ...shadeCalls(shade, state),
    /** Ends a frame: drops textures no tile has drawn for a while. */
    end() {
      for (const [source, entry] of textures) {
        if (state.frameNo - entry.used > TEX_IDLE_FRAMES) {
          webgl.deleteTexture(entry.tex);
          textures.delete(source);
        }
      }
    },
    /** how many textures are on the GPU (for the tools) */
    get textureCount() { return textures.size; },
  };
}

export type GlGround = NonNullable<ReturnType<typeof createGlGround>>;
