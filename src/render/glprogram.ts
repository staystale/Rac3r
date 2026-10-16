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
