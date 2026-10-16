// GPU SPRITES (?gpucars=1): the cars drawn by WebGL2 on the GPU ground's canvas at full screen
// resolution, turned and scaled there with the ground's sharp-pixel filter, so a car's pixels stay
// crisp squares at any angle and zoom instead of being re-snapped to the art-pixel grid each frame
// (which made them crawl; the owner chose this look, mockup B, tools/scratch/carmock.html).
// Everything under the cars (deck, marks, props, cones, particles) is still drawn into the art
// buffer, which is uploaded each frame and drawn over the ground first (whole art pixels, as the
// 2D blit drew it); overhead props and the HUD stay on the 2D canvas above.
import { buildProgram } from "./glprogram.ts";
import type { GpuCounts, GroundFrame } from "./glground.ts";

// a picture not drawn for this many frames loses its texture
const IDLE_FRAMES = 90;

const VERTEX = `#version 300 es
in vec2 corner;
uniform vec2 screen;     // canvas size, device px
uniform vec2 centre;     // where the picture's origin lands, device px
uniform vec2 size;       // the picture's size on screen, device px
uniform vec2 origin;     // the origin inside the picture, 0..1
uniform float angle;     // radians, clockwise on screen (as canvas rotate)
out vec2 uv;
void main() {
  uv = corner;
  vec2 local = (corner - origin) * size;
  float cosA = cos(angle), sinA = sin(angle);
  vec2 pos = centre + vec2(local.x * cosA - local.y * sinA, local.x * sinA + local.y * cosA);
  gl_Position = vec4(pos / screen * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;

// nearest: the art layer, whole art pixels; otherwise the sharp-pixel filter (glground.ts), or
// mipmaps when a picture pixel is under a screen pixel
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tex;
uniform vec2 texSize;
uniform float scale;     // screen px per picture pixel
uniform bool nearest;
out vec4 colour;
void main() {
  if (nearest) {
    colour = texelFetch(tex, ivec2(min(floor(uv * texSize), texSize - 1.0)), 0);
    return;
  }
  if (scale < 1.0) { colour = texture(tex, uv); return; }
  vec2 texel = uv * texSize;
  vec2 base = floor(texel);
  vec2 centre = fract(texel) - 0.5;
  vec2 region = vec2(0.5 - 0.5 / scale);
  vec2 offset = (centre - clamp(centre, -region, region)) * scale + 0.5;
  colour = texture(tex, (base + offset) / texSize);
}`;

/** Where one picture goes: its origin on screen (CSS px of the view), turn and texel size. */
export interface SpritePlace {
  x: number;              // CSS px
  y: number;
  angle: number;          // radians
  cssPerTexel: number;    // CSS px of the view per picture pixel
  originX: number;        // the origin inside the picture, picture px
  originY: number;
}

/** Where one quad goes, in device px, its turn, its scale and its filter. */
interface QuadPlace {
  centreX: number; centreY: number; width: number; height: number; originX: number;
  originY: number; angle: number; scale: number; nearest: boolean;
}

/** The sprite program, its quad and the picture textures. */
interface SpriteGl {
  webgl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  vao: WebGLVertexArrayObject | null;
  // one texture per picture canvas, re-uploaded on every draw (a car's picture changes per
  // frame); one not drawn for IDLE_FRAMES is deleted (highway traffic comes and goes)
  textures: Map<HTMLCanvasElement, { tex: WebGLTexture; used: number }>;
  counts: GpuCounts;
  frameNo: number;
}

/**
 * Builds the sprite program and its unit quad.
 * @param webgl the context
 * @param counts the shared upload / mipmap counters (the phone report)
 * @returns the sprite GL state
 */
function buildSpriteGl(webgl: WebGL2RenderingContext, counts: GpuCounts): SpriteGl {
  const program = buildProgram(webgl, VERTEX, FRAGMENT, 'sprite');
  const uniforms: SpriteGl['uniforms'] = {};
  for (const name of ['screen', 'centre', 'size', 'origin', 'angle', 'texSize', 'scale',
    'nearest', 'tex']) uniforms[name] = webgl.getUniformLocation(program, name);
  const vao = webgl.createVertexArray();
  webgl.bindVertexArray(vao);
  webgl.bindBuffer(webgl.ARRAY_BUFFER, webgl.createBuffer());
  webgl.bufferData(webgl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    webgl.STATIC_DRAW);
  const corner = webgl.getAttribLocation(program, 'corner');
  webgl.enableVertexAttribArray(corner);
  webgl.vertexAttribPointer(corner, 2, webgl.FLOAT, false, 0, 0);
  return { webgl, program, uniforms, vao, textures: new Map(), counts, frameNo: 0 };
}

/**
 * Uploads a canvas into its texture and binds it.
 * @param spriteGl the sprite GL state
 * @param source the canvas
 * @param mipmaps true to build mipmaps (drawn shrunk)
 */
function uploadPicture(spriteGl: SpriteGl, source: HTMLCanvasElement, mipmaps: boolean) {
  const { webgl } = spriteGl;
  let entry = spriteGl.textures.get(source);
  if (!entry) {
    entry = { tex: webgl.createTexture()!, used: spriteGl.frameNo };
    spriteGl.textures.set(source, entry);
    webgl.bindTexture(webgl.TEXTURE_2D, entry.tex);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
    webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
  }
  entry.used = spriteGl.frameNo;
  webgl.activeTexture(webgl.TEXTURE0);
  webgl.bindTexture(webgl.TEXTURE_2D, entry.tex);
  webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, webgl.RGBA, webgl.UNSIGNED_BYTE, source);
  spriteGl.counts.uploads++;
  if (mipmaps) {
    webgl.generateMipmap(webgl.TEXTURE_2D);
    spriteGl.counts.mipmaps++;
  }
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER,
    mipmaps ? webgl.LINEAR_MIPMAP_LINEAR : webgl.LINEAR);
}

/**
 * Draws the bound texture as one quad.
 * @param spriteGl the sprite GL state
 * @param frame the frame mapping
 * @param texSize the picture size, px
 * @param place centre, size and origin in device px, the turn, the scale and the filter
 */
function drawQuad(spriteGl: SpriteGl, frame: GroundFrame, texSize: [number, number],
    place: QuadPlace) {
  const { webgl, uniforms } = spriteGl;
  webgl.useProgram(spriteGl.program);
  webgl.bindVertexArray(spriteGl.vao);
  webgl.disable(webgl.STENCIL_TEST);
  webgl.uniform2f(uniforms.screen, frame.width, frame.height);
  webgl.uniform2f(uniforms.centre, place.centreX, place.centreY);
  webgl.uniform2f(uniforms.size, place.width, place.height);
  webgl.uniform2f(uniforms.origin, place.originX, place.originY);
  webgl.uniform1f(uniforms.angle, place.angle);
  webgl.uniform2f(uniforms.texSize, texSize[0], texSize[1]);
  webgl.uniform1f(uniforms.scale, place.scale);
  webgl.uniform1i(uniforms.nearest, place.nearest ? 1 : 0);
  webgl.uniform1i(uniforms.tex, 0);
  webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
}

/**
 * Starts a frame of sprites: deletes the textures of pictures not drawn for IDLE_FRAMES.
 * @param spriteGl the sprite GL state
 */
function startSpriteFrame(spriteGl: SpriteGl) {
  spriteGl.frameNo++;
  for (const [source, entry] of spriteGl.textures) {
    if (spriteGl.frameNo - entry.used > IDLE_FRAMES) {
      spriteGl.webgl.deleteTexture(entry.tex);
      spriteGl.textures.delete(source);
    }
  }
}

/**
 * The GPU sprite drawer on the GPU ground's WebGL2 context.
 * @param webgl the context
 * @param frameOf the current frame's CSS px -> device px mapping (null outside a frame)
 * @param counts the shared upload / mipmap counters (the phone report)
 * @returns the drawer
 */
export function createGlSprites(webgl: WebGL2RenderingContext,
    frameOf: () => GroundFrame | null, counts: GpuCounts) {
  const spriteGl = buildSpriteGl(webgl, counts);
  return {
    /**
     * Draws this frame's art buffer over the ground: whole art pixels, shifted by the sub-pixel
     * camera remainder, exactly where the 2D blit put it. Starts the frame's sprites.
     * @param art the art buffer
     */
    drawLayer(art: HTMLCanvasElement) {
      const frame = frameOf();
      if (!frame || !art.width || !art.height) return;
      startSpriteFrame(spriteGl);
      uploadPicture(spriteGl, art, false);
      drawQuad(spriteGl, frame, [art.width, art.height], {
        centreX: frame.subX, centreY: frame.subY, width: art.width * frame.blockPx,
        height: art.height * frame.blockPx, originX: 0, originY: 0, angle: 0,
        scale: frame.blockPx, nearest: true,
      });
    },
    /**
     * Draws one picture turned and scaled at screen resolution.
     * @param source the picture
     * @param place where its origin lands, its turn and its texel size
     */
    drawPicture(source: HTMLCanvasElement, place: SpritePlace) {
      const frame = frameOf();
      if (!frame || !source.width || !source.height) return;
      const art = frame.artDpr * frame.blockPx, scale = place.cssPerTexel * art;
      uploadPicture(spriteGl, source, scale < 1);
      drawQuad(spriteGl, frame, [source.width, source.height], {
        centreX: place.x * art + frame.subX, centreY: place.y * art + frame.subY,
        width: source.width * scale, height: source.height * scale,
        originX: place.originX / source.width, originY: place.originY / source.height,
        angle: place.angle, scale, nearest: false,
      });
    },
    /** how many picture textures are on the GPU (tools) */
    get textureCount() { return spriteGl.textures.size; },
  };
}

export type GlSprites = ReturnType<typeof createGlSprites>;
