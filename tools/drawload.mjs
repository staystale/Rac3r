// drawload.mjs - how much DRAWING a frame asks of the browser, per layer: what the phone's graphics
// chip must do after our JS has finished (Safari paints the 2D canvas and runs WebGL later, outside
// any timing the game can see). A phone screen recording showed frames held while our JS was on
// time; this counts the work instead of timing it, so a change can be proven on the laptop first.
//   WebGL (the GPU ground): draw calls and pixels covered per program (ground patches, tiles and
//     images, hill shading), clears, texture uploads and mipmap builds.
//   2D canvases: fills, strokes, images and path pieces, on the screen canvas, the art buffer, and
//     off-screen canvases (tiles, textures, sprites being painted).
// Phone size (440x732, dpr 3), a race with 3 AI on the autopilot; measured over a window of the
// race (default 8-13 s after the start: Castle Cum's corner 2, zoomed out at speed).
// node tools/drawload.mjs [level] [extra query, e.g. "skip=props"] [from s] [to s]
import { startServer, launchBrowser, gotoGame } from './lib/browser.mjs';

const level = process.argv[2] || 'castle-cum';
const extra = process.argv[3] ? '&' + process.argv[3].replace(/^[?&]/, '') : '';
const fromS = +(process.argv[4] || 8), toS = +(process.argv[5] || 13);

/** Page side, before the game loads: wraps the drawing calls and counts them. */
function installCounters() {
  const load = { frames: 0, gl: {}, canvas2d: {}, uploads: 0, uploadPx: 0, mipmaps: 0 };
  window.__drawload = load;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => raf((now) => { load.frames++; callback(now); });
  const glProto = WebGL2RenderingContext.prototype;
  const sources = new WeakMap(), programNames = new WeakMap();
  const nameOf = (source) => (source.includes('patchDistance') ? 'ground patches'
    : source.includes('snappedTexel') ? 'ground tiles + images'
      : /shade/i.test(source) ? 'hill shading' : 'other');
  const wrap = (proto, name, after) => {
    const original = proto[name];
    proto[name] = function wrapped(...args) {
      const out = original.apply(this, args);
      after.call(this, args, out);
      return out;
    };
  };
  wrap(glProto, 'shaderSource', function (args) { sources.set(args[0], args[1]); });
  wrap(glProto, 'attachShader', function (args) {
    const source = sources.get(args[1]) || '';
    if (source.includes('gl_FragCoord') || source.includes('out vec4')) {
      programNames.set(args[0], nameOf(source));
    }
  });
  wrap(glProto, 'getUniformLocation', function (args, location) {
    if (location) location.__name = args[1];
  });
  let program = null, rectArea = null;
  wrap(glProto, 'useProgram', function (args) { program = args[0]; rectArea = null; });
  wrap(glProto, 'uniform4f', function (args) {
    if (args[0] && args[0].__name === 'rect') rectArea = Math.abs(args[3] * args[4]);
  });
  const glEntry = (name) => (load.gl[name] ??= { calls: 0, pixels: 0 });
  wrap(glProto, 'drawArrays', function () {
    const entry = glEntry(programNames.get(program) || 'other');
    entry.calls++;
    entry.pixels += rectArea ?? this.drawingBufferWidth * this.drawingBufferHeight;
  });
  wrap(glProto, 'clear', function () {
    const entry = glEntry('clears');
    entry.calls++;
    entry.pixels += this.drawingBufferWidth * this.drawingBufferHeight;
  });
  wrap(glProto, 'texImage2D', function (args) {
    load.uploads++;
    const source = args[args.length - 1];
    load.uploadPx += source && source.width ? source.width * source.height : (args[3] * args[4]) || 0;
  });
  wrap(glProto, 'generateMipmap', function () { load.mipmaps++; });
  const ctxProto = CanvasRenderingContext2D.prototype;
  const kindOf = (canvas) => (canvas.isConnected ? 'screen canvas'
    : canvas === window.__drawloadArt ? 'art buffer' : 'off-screen (tiles, textures, sprites)');
  const entry2d = (canvas) => (load.canvas2d[kindOf(canvas)] ??= {
    fills: 0, strokes: 0, rects: 0, images: 0, texts: 0, pieces: 0,
  });
  // the art buffer: the big off-screen canvas copied onto the screen canvas every frame
  wrap(ctxProto, 'drawImage', function (args) {
    const source = args[0];
    if (this.canvas.isConnected && source instanceof HTMLCanvasElement && !source.isConnected
        && source.width * source.height > 50000) window.__drawloadArt = source;
  });
  for (const [name, field] of [['fill', 'fills'], ['stroke', 'strokes'], ['fillRect', 'rects'],
    ['strokeRect', 'rects'], ['clearRect', 'rects'], ['drawImage', 'images'],
    ['putImageData', 'images'], ['fillText', 'texts']]) {
    wrap(ctxProto, name, function () { entry2d(this.canvas)[field]++; });
  }
  for (const name of ['moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'roundRect', 'ellipse',
    'quadraticCurveTo', 'bezierCurveTo']) {
    if (ctxProto[name]) wrap(ctxProto, name, function () { entry2d(this.canvas).pieces++; });
  }
}

/** Page side: a copy of the counters. */
const snapshot = () => JSON.parse(JSON.stringify(window.__drawload));

/**
 * The counters' change between two snapshots, per frame.
 * @param {object} before the first snapshot
 * @param {object} after the second
 * @param {number} screenPx the GPU canvas's pixels (to show pixels as screens)
 * @returns {string[]} report lines
 */
function perFrame(before, after, screenPx) {
  const frames = after.frames - before.frames;
  const lines = [`${frames} frames`];
  const delta = (a, b, key) => ((a?.[key] || 0) - (b?.[key] || 0)) / frames;
  lines.push('GPU ground (WebGL), per frame:');
  for (const name of Object.keys(after.gl)) {
    const calls = delta(after.gl[name], before.gl[name], 'calls');
    const screens = delta(after.gl[name], before.gl[name], 'pixels') / screenPx;
    lines.push(`  ${name.padEnd(24)} ${calls.toFixed(1).padStart(6)} draws  `
      + `${screens.toFixed(2).padStart(6)} screens of pixels`);
  }
  lines.push(`  uploads ${((after.uploads - before.uploads) / frames).toFixed(2)} a frame `
    + `(${((after.uploadPx - before.uploadPx) / frames / 1000).toFixed(0)} k px), mipmap builds `
    + `${((after.mipmaps - before.mipmaps) / frames).toFixed(2)}`);
  lines.push('2D canvases, per frame:');
  for (const name of Object.keys(after.canvas2d)) {
    const field = (key) => delta(after.canvas2d[name], before.canvas2d[name], key).toFixed(0);
    lines.push(`  ${name.padEnd(38)} fills ${field('fills')}, strokes ${field('strokes')}, `
      + `rects ${field('rects')}, images ${field('images')}, texts ${field('texts')}, `
      + `path pieces ${field('pieces')}`);
  }
  return lines;
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 732 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(installCounters);
  await gotoGame(page, `${server.url}/?touch=1&menu=0&guide=0&rules=0&level=${level}`
    + `&ai=3&autopilot=1${extra}`);
  await page.waitForTimeout(2000);
  await page.touchscreen.tap(220, 366);
  await page.waitForTimeout(fromS * 1000);
  const before = await page.evaluate(snapshot);
  const zoomFrom = await page.evaluate(() => window.__game.renderer.PPM);
  await page.waitForTimeout((toS - fromS) * 1000);
  const after = await page.evaluate(snapshot);
  const zoomTo = await page.evaluate(() => window.__game.renderer.PPM);
  const screenPx = await page.evaluate(() => {
    const gl = document.getElementById('glground');
    return gl ? gl.width * gl.height : 1;
  });
  console.log(`${level}${extra} | race ${fromS}-${toS} s | zoom ${zoomFrom.toFixed(1)} -> `
    + `${zoomTo.toFixed(1)} css px/m | GPU canvas ${screenPx} px`);
  for (const line of perFrame(before, after, screenPx)) console.log(line);
  await ctx.close();
} finally {
  await browser.close();
  server.stop();
}
