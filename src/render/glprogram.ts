// The shader program builder for the GPU layers (glground.ts; glpaint.ts and glshade.ts still
// build their own: fold them in).

/**
 * Compiles and links a WebGL2 shader program.
 * @param webgl the WebGL2 context
 * @param vertex the vertex shader source
 * @param fragment the fragment shader source
 * @param label what the program is, for the error message
 * @returns the program
 */
export function buildProgram(webgl: WebGL2RenderingContext, vertex: string, fragment: string,
    label: string) {
  const program = webgl.createProgram()!;
  for (const [kind, source] of [[webgl.VERTEX_SHADER, vertex], [webgl.FRAGMENT_SHADER, fragment]] as
      const) {
    const shader = webgl.createShader(kind)!;
    webgl.shaderSource(shader, source);
    webgl.compileShader(shader);
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
      throw new Error(label + ' shader: ' + webgl.getShaderInfoLog(shader));
    }
    webgl.attachShader(program, shader);
  }
  webgl.linkProgram(program);
  if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
    throw new Error(label + ' program: ' + webgl.getProgramInfoLog(program));
  }
  return program;
}

// WET GROUND (weather): wet ground reads DARKER and a little COOLER - water on asphalt, grass and
// dirt takes their light and dulls their colour. At full wetness a colour keeps 1 - WET_DARK of
// its light and moves WET_COOL of the way to a cool grey of the same brightness. Shared by the
// ground shaders (glground.ts tiles, glpaint.ts floor and zones) and the 2D fallback (wetTint);
// `wet` 0 leaves every colour exactly as it was.
const WET_DARK = 0.3, WET_COOL = 0.25;
const WET_GREY = [0.88, 0.96, 1.1];

/** The GLSL of the wet ground: a `wet` uniform (0..1) and `wetten(colour)`. */
export const WET_GLSL = `
uniform float wet;   // 0 dry .. 1 soaked (weather.ts)
vec4 wetten(vec4 shade) {
  if (wet <= 0.0) return shade;
  float luma = dot(shade.rgb, vec3(0.299, 0.587, 0.114));
  vec3 cool = mix(shade.rgb, luma * vec3(${WET_GREY.join(', ')}), ${WET_COOL} * wet);
  return vec4(cool * (1.0 - ${WET_DARK} * wet), shade.a);
}`;

/**
 * The colour to MULTIPLY dry ground by to make it look this wet (the 2D ground, which cannot
 * grey a colour: darker and slightly bluer).
 * @param wetness 0..1
 * @returns an rgb() CSS colour
 */
export function wetTint(wetness: number): string {
  const light = 1 - WET_DARK * wetness;
  const channel = (grey: number) =>
    Math.round(255 * Math.min(1, light * (1 + (grey - 1) * WET_COOL * wetness)));
  return `rgb(${channel(WET_GREY[0])},${channel(WET_GREY[1])},${channel(WET_GREY[2])})`;
}
