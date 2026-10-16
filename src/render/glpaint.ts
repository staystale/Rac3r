// The GPU ground painter (the default, ?gpupaint=0 = off; step B of "ground on the GPU"): the floor
// and the surface zones drawn by WebGL2 every frame at ONE fixed density, TEX_PPM texels per metre
// (the car sprites' pixel size), anchored to the world. The CPU tiles paint each zoom step as a
// separate picture at a different resolution, so the surface shifts when the camera crosses a step;
// here every screen pixel samples the same pre-painted surface texture at its world position, so a
// zoom change only makes the same texels bigger or smaller. Texels bigger than a screen pixel are
// drawn with the sharp-pixel filter of glground.ts; smaller ones through mipmaps. Shape edges are
// tested at the texel centre, so they sit on the same world texel grid at every zoom. The layers
// not moved here yet stay in the tiles, painted over a transparent background.
import { TEX_M, TEX_PPM } from "./textures.ts";

/** One shape of flat ground: a rectangle, maybe rotated and rounded, of one surface. */
export interface GroundPatch {
  x: number;          // centre, world m
  y: number;
  w: number;          // size, m
  h: number;
  rot: number;        // rotation, radians (as canvas rotate)
  radius: number;     // corner radius, m (0 = square corners)
  base: string;       // CSS colour under the texture
  texture: HTMLCanvasElement | null;   // the repeating surface texture (textures.ts), or none
  gridSpacing: number;  // the lab floor: grid lines every this many m from the origin (0 = none)
  gridColour: string;
  glowRadius: number;   // the lab floor: a glow pool round the origin, m (0 = none)
  glowInner: string;    // its colour at the origin and at glowRadius
  glowOuter: string;
}

/** The camera of this frame: where a world point lands on the GPU canvas. */
export interface PaintCamera {
  x: number;             // the camera point, world m
  y: number;
  screenX: number;       // where the camera point is drawn, device px
  screenY: number;
  devPerMetre: number;   // device px per metre
}

/** A surface texture on the GPU: uploaded once, repeating, with mipmaps. */
interface SurfaceTex { tex: WebGLTexture; used: number }

// the period the camera's texel position is wrapped to: the texture size (textures.ts), so the
// texel grid and the textures stay on the world grid (a patch without a texture too)
const WRAP_TEXELS = Math.round(TEX_M * TEX_PPM);

/**
 * A world position in texels, wrapped to WRAP_TEXELS in double precision (for the shaders).
 * @param metres the position, m
 * @returns the wrapped texel position
 */
export const wrapTexels = (metres: number) =>
  ((metres * TEX_PPM) % WRAP_TEXELS + WRAP_TEXELS) % WRAP_TEXELS;

// a surface texture not drawn for this many frames is deleted (a level change makes new ones)
const SURFACE_IDLE_FRAMES = 120;

// one quad per patch, covering its bounding box on screen (device px)
const VERTEX = `#version 300 es
in vec2 corner;
uniform vec4 rect;
uniform vec2 screen;
void main() {
  vec2 pos = rect.xy + corner * rect.zw;
  gl_Position = vec4(pos / screen * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;

// world positions are taken relative to the camera (camTexel, camFromPatch are computed in double
// precision on the CPU), so a highway many km long keeps texel precision in a 32-bit float.
// Every texel is a FINISHED colour (the texture is baked over its base and snapped to the palette
// on the CPU, glpaint.ts bakeSurface; a flat patch's base is snapped too; the lab glow per texel),
// and a pixel only blends the texels under it: snapping AFTER the blend turned each texel edge's
// one-pixel glide into whole-pixel jumps, so texels flicked between widths as they moved (owner:
// "surface texture micro judder at certain zoom levels"). Patch edges blend the same way.
const FRAGMENT = `#version 300 es
precision highp float;
uniform float canvasHeight;  // device px
uniform vec2 cameraPx;       // device px of the camera point
uniform float devPerMetre;   // device px per metre
uniform float texPerMetre;   // texels per metre (TEX_PPM)
uniform vec2 camTexel;       // camera position in texels, wrapped to the texture size
uniform vec2 camFromPatch;   // camera minus patch centre, m
uniform vec4 shape;          // half width, half height (m), cos and sin of the rotation
uniform float radius;        // corner radius, m
uniform vec4 base;           // premultiplied RGBA, snapped to the palette
uniform sampler2D tex;       // the baked surface: base + texture, snapped, opaque
uniform float texSize;       // texels per side (0 = no texture)
uniform vec2 camFromOrigin;  // the camera position, m (only the lab floor reads it)
uniform float gridSpacing;   // m, 0 = no grid
uniform vec4 gridColour;     // premultiplied
uniform float glowRadius;    // m, 0 = no glow
uniform vec4 glowInner;      // premultiplied
uniform vec4 glowOuter;
uniform highp usampler3D palette;   // 32 x 32 x 32 (blue, green, red), packed RGBA
out vec4 colour;

// PIXEL MODE: the nearest colour of the limited palette, as the CPU tiles snap (tilesPalette.ts)
vec4 snapToPalette(vec4 shade) {
  ivec3 index = ivec3(floor(shade.bgr * 255.0 + 0.5)) >> 3;
  uint packed = texelFetch(palette, index, 0).r;
  return vec4(uvec4(packed, packed >> 8, packed >> 16, 255u) & 255u) / 255.0;
}

// signed distance from a rounded rectangle, in the patch frame (m)
float patchDistance(vec2 fromCamera) {
  vec2 world = fromCamera + camFromPatch;
  vec2 local = vec2(shape.z * world.x + shape.w * world.y, -shape.w * world.x + shape.z * world.y);
  vec2 edge = abs(local) - shape.xy + radius;
  return length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
}

// a flat patch at a point: its base, or the lab floor's glow (snapped) over it
vec4 flatGround(vec2 fromOrigin) {
  if (glowRadius <= 0.0) return base;
  vec4 glow = mix(glowInner, glowOuter, clamp(length(fromOrigin) / glowRadius, 0.0, 1.0));
  return snapToPalette(glow + base * (1.0 - glow.a));
}

// one texel of the patch, by its index (camera-relative texels): the baked surface, or the flat
// ground with the lab grid lines (one texel wide, on the texel grid)
vec4 texelColour(vec2 index) {
  if (texSize > 0.0) return texelFetch(tex, ivec2(mod(index, texSize)), 0);
  vec2 fromOrigin = (index + 0.5 - camTexel) / texPerMetre + camFromOrigin;
  vec4 ground = flatGround(fromOrigin);
  if (gridSpacing <= 0.0) return ground;
  vec2 nearest = floor(fromOrigin / gridSpacing + 0.5) * gridSpacing;
  bvec2 onLine = equal(floor(fromOrigin * texPerMetre), floor(nearest * texPerMetre));
  return any(onLine) ? gridColour + ground * (1.0 - gridColour.a) : ground;
}

// texels at least a screen pixel wide: the sharp-pixel filter's blend of the up to four texels
// under the pixel, each counted only if its centre is inside the patch
vec4 magnified(vec2 texel, float scale) {
  vec2 cell = floor(texel);
  vec2 centre = fract(texel) - 0.5;
  vec2 region = vec2(0.5 - 0.5 / scale);
  vec2 corner = cell + (centre - clamp(centre, -region, region)) * scale;
  vec2 first = floor(corner), weight = corner - first;
  vec4 sum = vec4(0.0);
  for (int k = 0; k < 4; k++) {
    vec2 step = vec2(float(k & 1), float(k >> 1));
    vec2 share = mix(1.0 - weight, weight, step);
    if (share.x * share.y <= 0.0) continue;
    vec2 index = first + step;
    if (patchDistance((index + 0.5 - camTexel) / texPerMetre) > 0.0) continue;
    sum += texelColour(index) * share.x * share.y;
  }
  return sum;
}

// texels smaller than a pixel: the mipmapped surface (or the flat ground with the grid's share of
// the pixel), its edge covering the pixel by the patch's distance
vec4 minified(vec2 fromCamera, vec2 texel, float scale) {
  float cover = clamp(0.5 - patchDistance(fromCamera) * devPerMetre, 0.0, 1.0);
  if (texSize > 0.0) return texture(tex, texel / texSize) * cover;
  vec2 fromOrigin = fromCamera + camFromOrigin;
  vec4 ground = flatGround(fromOrigin);
  if (gridSpacing > 0.0) {
    vec2 nearest = floor(fromOrigin / gridSpacing + 0.5) * gridSpacing;
    vec2 pixels = abs(fromOrigin - nearest) * devPerMetre;
    float line = scale * clamp(1.0 - min(pixels.x, pixels.y), 0.0, 1.0);
    ground = gridColour * line + ground * (1.0 - gridColour.a * line);
  }
  return ground * cover;
}

void main() {
  vec2 device = vec2(gl_FragCoord.x, canvasHeight - gl_FragCoord.y);
  vec2 fromCamera = (device - cameraPx) / devPerMetre;
  vec2 texel = fromCamera * texPerMetre + camTexel;
  float scale = devPerMetre / texPerMetre;
  colour = scale >= 1.0 ? magnified(texel, scale) : minified(fromCamera, texel, scale);
  if (colour.a <= 0.0) discard;
}`;

const UNIFORMS = [
  'rect', 'screen', 'canvasHeight', 'cameraPx', 'devPerMetre', 'texPerMetre', 'camTexel',
  'camFromPatch', 'shape', 'radius', 'base', 'texSize', 'camFromOrigin', 'gridSpacing',
  'gridColour', 'glowRadius', 'glowInner', 'glowOuter', 'tex', 'palette',
] as const;
type Uniforms = Record<typeof UNIFORMS[number], WebGLUniformLocation | null>;

/**
 * Compiles and links the painter's shader program.
 * @param webgl the WebGL2 context
 * @returns the program
 */
function buildPaintProgram(webgl: WebGL2RenderingContext) {
  const program = webgl.createProgram()!;
  for (const [kind, source] of [[webgl.VERTEX_SHADER, VERTEX], [webgl.FRAGMENT_SHADER, FRAGMENT]] as
      const) {
    const shader = webgl.createShader(kind)!;
    webgl.shaderSource(shader, source);
    webgl.compileShader(shader);
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
      throw new Error('ground paint shader: ' + webgl.getShaderInfoLog(shader));
    }
    webgl.attachShader(program, shader);
  }
  webgl.linkProgram(program);
  if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
    throw new Error('ground paint program: ' + webgl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * The unit quad of the painter's program.
 * @param webgl the WebGL2 context
 * @param program the painter's program
 * @returns the vertex array
 */
function buildPaintQuad(webgl: WebGL2RenderingContext, program: WebGLProgram) {
  const vao = webgl.createVertexArray();
  webgl.bindVertexArray(vao);
  webgl.bindBuffer(webgl.ARRAY_BUFFER, webgl.createBuffer());
  webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    webgl.STATIC_DRAW);
  const corner = webgl.getAttribLocation(program, 'corner');
  webgl.enableVertexAttribArray(corner);
  webgl.vertexAttribPointer(corner, 2, webgl.FLOAT, false, 0, 0);
  return vao;
}

/**
 * The palette colour of a pixel (the tiles' 5-bit-a-channel lookup, tilesPalette.ts).
 * @param lookup the palette lookup, ABGR
 * @param pixel the pixel, ABGR
 * @returns the snapped pixel, ABGR, opaque
 */
const snapPixel = (lookup: Uint32Array, pixel: number) => lookup[(((pixel & 255) >> 3) << 10)
  | ((((pixel >> 8) & 255) >> 3) << 5) | (((pixel >> 16) & 255) >> 3)];

/**
 * A surface baked for the GPU: its base colour, the texture over it, every pixel snapped to the
 * palette - finished texels, so the shader only blends them (snapping after a blend made texel
 * edges jump whole pixels).
 * @param source the texture canvas (textures.ts)
 * @param base the CSS base colour under it
 * @param lookup the palette lookup
 * @returns the pixels, opaque
 */
function bakeSurface(source: HTMLCanvasElement, base: string, lookup: Uint32Array) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const gfx = canvas.getContext('2d', { willReadFrequently: true })!;
  gfx.fillStyle = base;
  gfx.fillRect(0, 0, canvas.width, canvas.height);
  gfx.drawImage(source, 0, 0);
  const image = gfx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = new Uint32Array(image.data.buffer);
  for (let i = 0; i < pixels.length; i++) pixels[i] = snapPixel(lookup, pixels[i]);
  return image;
}

/**
 * A CSS colour as RGBA 0..1 with its RGB snapped to the palette (a flat patch's base), cached.
 * @param cache the snapped colours
 * @param lookup the palette lookup
 * @param parseColour CSS colour -> RGBA 0..1
 * @param colour the CSS colour
 * @returns the snapped RGBA
 */
function snappedColour(cache: Map<string, number[]>, lookup: Uint32Array,
    parseColour: (colour: string) => number[], colour: string) {
  let rgba = cache.get(colour);
  if (!rgba) {
    const [red, green, blue, alpha] = parseColour(colour);
    const pixel = snapPixel(lookup, Math.round(red * 255) | (Math.round(green * 255) << 8)
      | (Math.round(blue * 255) << 16));
    rgba = [(pixel & 255) / 255, ((pixel >> 8) & 255) / 255, ((pixel >> 16) & 255) / 255, alpha];
    cache.set(colour, rgba);
  }
  return rgba;
}

/**
 * Deletes every baked surface and snapped colour (a new palette makes them all out of date).
 * @param webgl the WebGL2 context
 * @param textures the baked surfaces
 * @param snapped the snapped colours
 */
function dropBaked(webgl: WebGL2RenderingContext, textures: SurfaceCache,
    snapped: Map<string, number[]>) {
  for (const byBase of textures.values()) {
    for (const entry of byBase.values()) webgl.deleteTexture(entry.tex);
  }
  textures.clear();
  snapped.clear();
}

/** The baked surfaces on the GPU: texture canvas -> base colour -> texture. */
type SurfaceCache = Map<HTMLCanvasElement, Map<string, SurfaceTex>>;

/**
 * A baked surface on the GPU (bakeSurface), uploaded the first time it is drawn: repeating,
 * mipmapped (trilinear when a texel is smaller than a screen pixel).
 * @param webgl the WebGL2 context
 * @param cache the baked surfaces
 * @param patch the patch (its texture and base colour)
 * @param lookup the palette lookup
 * @param frame the frame number
 * @returns the texture, bound
 */
function surfaceTexture(webgl: WebGL2RenderingContext, cache: SurfaceCache, patch: GroundPatch,
    lookup: Uint32Array, frame: number) {
  const source = patch.texture!;
  let byBase = cache.get(source);
  if (!byBase) cache.set(source, byBase = new Map());
  let entry = byBase.get(patch.base);
  if (!entry) {
    const tex = webgl.createTexture()!;
    webgl.bindTexture(webgl.TEXTURE_2D, tex);
    webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, source.width, source.height, 0, webgl.RGBA,
      webgl.UNSIGNED_BYTE, bakeSurface(source, patch.base, lookup).data);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.REPEAT);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.REPEAT);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR_MIPMAP_LINEAR);
    webgl.generateMipmap(webgl.TEXTURE_2D);
    entry = { tex, used: frame };
    byBase.set(patch.base, entry);
  }
  webgl.bindTexture(webgl.TEXTURE_2D, entry.tex);
  entry.used = frame;
  return entry.tex;
}

/**
 * Deletes the surface textures not drawn for SURFACE_IDLE_FRAMES.
 * @param webgl the WebGL2 context
 * @param cache the texture cache
 * @param frame the frame number
 */
function evictIdleTextures(webgl: WebGL2RenderingContext, cache: SurfaceCache, frame: number) {
  for (const [source, byBase] of cache) {
    for (const [base, entry] of byBase) {
      if (frame - entry.used > SURFACE_IDLE_FRAMES) {
        webgl.deleteTexture(entry.tex);
        byBase.delete(base);
      }
    }
    if (!byBase.size) cache.delete(source);
  }
}

/**
 * Binds the palette lookup on texture unit 1, uploaded (as a 32 x 32 x 32 integer texture) the
 * first time a lookup is seen.
 * @param webgl the WebGL2 context
 * @param palette the uploaded lookup, updated here
 * @param lookup the 32768 packed colours (tilesPalette.ts buildPalette)
 */
function bindPalette(webgl: WebGL2RenderingContext, palette: PaletteTex, lookup: Uint32Array) {
  webgl.activeTexture(webgl.TEXTURE1);
  if (palette.lookup === lookup) {
    webgl.bindTexture(webgl.TEXTURE_3D, palette.tex);
    webgl.activeTexture(webgl.TEXTURE0);
    return;
  }
  if (palette.tex) webgl.deleteTexture(palette.tex);
  const tex = webgl.createTexture()!;
  Object.assign(palette, { tex, lookup });
  webgl.bindTexture(webgl.TEXTURE_3D, tex);
  webgl.texImage3D(webgl.TEXTURE_3D, 0, webgl.R32UI, 32, 32, 32, 0, webgl.RED_INTEGER,
    webgl.UNSIGNED_INT, lookup);
  webgl.texParameteri(webgl.TEXTURE_3D, webgl.TEXTURE_MIN_FILTER, webgl.NEAREST);
  webgl.texParameteri(webgl.TEXTURE_3D, webgl.TEXTURE_MAG_FILTER, webgl.NEAREST);
  webgl.activeTexture(webgl.TEXTURE0);
}

/** The palette lookup on the GPU, and which lookup it holds. */
interface PaletteTex { lookup: Uint32Array | null; tex: WebGLTexture | null }

/** One frame's patches and the palette they are snapped to. */
export interface PaintList { patches: GroundPatch[]; count: number; palette: Uint32Array }

/** What one frame of painting needs: the canvas size and the world -> device px mapping. */
interface PaintView { width: number; height: number; camera: PaintCamera }

/**
 * The device-px box a patch covers, or null when it is off the canvas.
 * @param view the frame's mapping
 * @param patch the patch
 * @returns [left, top, width, height] in device px, or null
 */
function patchBox(view: PaintView, patch: GroundPatch) {
  const cosAbs = Math.abs(Math.cos(patch.rot)), sinAbs = Math.abs(Math.sin(patch.rot));
  const reachX = (patch.w / 2) * cosAbs + (patch.h / 2) * sinAbs;
  const reachY = (patch.w / 2) * sinAbs + (patch.h / 2) * cosAbs;
  const { camera, width, height } = view;
  const left = camera.screenX + (patch.x - reachX - camera.x) * camera.devPerMetre;
  const right = camera.screenX + (patch.x + reachX - camera.x) * camera.devPerMetre;
  const top = camera.screenY + (patch.y - reachY - camera.y) * camera.devPerMetre;
  const bottom = camera.screenY + (patch.y + reachY - camera.y) * camera.devPerMetre;
  if (right < 0 || bottom < 0 || left > width || top > height) return null;
  // one pixel of margin: the edge texel may reach a little past the exact box
  const boxLeft = Math.max(0, Math.floor(left) - 1), boxTop = Math.max(0, Math.floor(top) - 1);
  return [boxLeft, boxTop, Math.min(width, Math.ceil(right) + 1) - boxLeft,
    Math.min(height, Math.ceil(bottom) + 1) - boxTop];
}

/**
 * Creates the GPU ground painter on the GPU ground's WebGL2 context.
 * @param webgl the context of the GPU ground canvas
 * @param parseColour turns a CSS colour into RGBA 0..1 (glground.ts, cached)
 * @returns the painter, or null when its shader does not compile
 */
export function createGlPaint(webgl: WebGL2RenderingContext,
    parseColour: (colour: string) => number[]) {
  let program: WebGLProgram;
  try { program = buildPaintProgram(webgl); } catch { return null; }
  const vao = buildPaintQuad(webgl, program);
  const uniforms = {} as Uniforms;
  for (const name of UNIFORMS) uniforms[name] = webgl.getUniformLocation(program, name);
  const textures: SurfaceCache = new Map();
  let frameNo = 0;
  const palette: PaletteTex = { lookup: null, tex: null };
  const snapped = new Map<string, number[]>();
  const premultiplied = (location: WebGLUniformLocation | null, colour: string, snap = false) => {
    const [red, green, blue, alpha] = snap
      ? snappedColour(snapped, palette.lookup!, parseColour, colour) : parseColour(colour);
    webgl.uniform4f(location, red * alpha, green * alpha, blue * alpha, alpha);
  };

  /**
   * Sets the uniforms every patch of this frame shares.
   * @param view the frame's mapping
   */
  function frameUniforms(view: PaintView) {
    webgl.useProgram(program);
    webgl.bindVertexArray(vao);
    webgl.uniform2f(uniforms.screen, view.width, view.height);
    webgl.uniform1f(uniforms.canvasHeight, view.height);
    webgl.uniform2f(uniforms.cameraPx, view.camera.screenX, view.camera.screenY);
    webgl.uniform1f(uniforms.devPerMetre, view.camera.devPerMetre);
    webgl.uniform1f(uniforms.texPerMetre, TEX_PPM);
    webgl.uniform2f(uniforms.camTexel, wrapTexels(view.camera.x), wrapTexels(view.camera.y));
    webgl.uniform2f(uniforms.camFromOrigin, view.camera.x, view.camera.y);
    webgl.uniform1i(uniforms.tex, 0);
    webgl.uniform1i(uniforms.palette, 1);
  }

  /**
   * Draws one patch.
   * @param view the frame's mapping
   * @param patch the patch
   */
  function drawPatch(view: PaintView, patch: GroundPatch) {
    const box = patchBox(view, patch);
    if (!box) return;
    webgl.uniform4f(uniforms.rect, box[0], box[1], box[2], box[3]);
    webgl.uniform2f(uniforms.camFromPatch, view.camera.x - patch.x, view.camera.y - patch.y);
    webgl.uniform4f(uniforms.shape, patch.w / 2, patch.h / 2, Math.cos(patch.rot),
      Math.sin(patch.rot));
    webgl.uniform1f(uniforms.radius, Math.min(patch.radius, patch.w / 2, patch.h / 2));
    premultiplied(uniforms.base, patch.base, true);
    if (patch.texture) surfaceTexture(webgl, textures, patch, palette.lookup!, frameNo);
    webgl.uniform1f(uniforms.texSize, patch.texture ? patch.texture.width : 0);
    webgl.uniform1f(uniforms.gridSpacing, patch.gridSpacing);
    premultiplied(uniforms.gridColour, patch.gridColour);
    webgl.uniform1f(uniforms.glowRadius, patch.glowRadius);
    premultiplied(uniforms.glowInner, patch.glowInner);
    premultiplied(uniforms.glowOuter, patch.glowOuter);
    webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    /**
     * Paints the patches, in order, over what the canvas already holds.
     * @param size the GPU canvas size, device px
     * @param camera where the world lands on the canvas this frame
     * @param list the patches, back to front, and the palette
     */
    paint(size: { width: number; height: number }, camera: PaintCamera, list: PaintList) {
      frameNo++;
      if (palette.lookup !== list.palette) dropBaked(webgl, textures, snapped);
      bindPalette(webgl, palette, list.palette);
      const view: PaintView = { width: size.width, height: size.height, camera };
      frameUniforms(view);
      for (let i = 0; i < list.count; i++) drawPatch(view, list.patches[i]);
      evictIdleTextures(webgl, textures, frameNo);
    },
  };
}
