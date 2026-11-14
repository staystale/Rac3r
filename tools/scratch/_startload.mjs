// _startload.mjs - WHERE A START AND A RESTART'S TIME GOES (scratch): the real game in the browser
// at phone size, a race launched as the menu launches it (__game.launch, n AI), then RESTART
// (__game.restart), each under the CPU profiler. Per event: the launch / restart call's own ms,
// then ms from the tap to the first frame painted, the loading screen gone, the fly-in's first and
// last frame, the countdown's start (the lights' clock first moving) and the green; and the
// profile's total ms in each part of the work (the level build, the cones, the field lined up,
// the fly-in's whole-level picture, the ground tiles, drawing frames, ...) and its top functions.
// [CPU=1] [AI=20] [RX=1: a rallycross race] node tools/scratch/_startload.mjs [level] [extra query, e.g. loadscreen=1]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'spa', extra = ''] = process.argv.slice(2);
const CPU = +(process.env.CPU || 1), AI = +(process.env.AI || 20), RX = process.env.RX === '1';
// s: the longest one event may take before the run gives up on it
const EVENT_LIMIT_S = 90;
// the parts of the work, by the function names the profile shows (inclusive time)
const PARTS = [
  ['launch (the whole call)', ['launch']], ['restart (the whole call)', ['doRestart']],
  ['level build: setLevel', ['setLevel']], ['  of it buildLevel', ['buildLevel']],
  ['  of it prepareLevel', ['prepareLevel']], ['createCones (new level)', ['createCones']],
  ['cones reset (resetCones)', ['resetCones']], ['field lined up: startField', ['startField']],
  ['  of it spawnAI', ['spawnAI']], ['selectCar', ['selectCar']],
  ['fly-in picture: paintOverview', ['paintOverview']], ['ground tiles: paintTile', ['paintTile']],
  ['startWeather', ['startWeather']], ['resetTrackside', ['resetTrackside']],
  ['clearWear', ['clearWear']], ['resetPuddles', ['resetPuddles']],
  ['resetCoverField', ['resetCoverField']], ['drawing frames: drawFrame', ['drawFrame']],
  ['sim steps: stepWorld', ['stepWorld']],
  ['loading pipeline', ['runLoading', 'stepLoading']],
  ['garbage collector', ['(garbage collector)']],
];

/**
 * Page side: a frame log from now on - each frame's time, the start's state, the fly-in, the
 * loading screen, tiles painted, sim steps.
 * @returns {void}
 */
function installFrameLog() {
  const game = window.__game, log = [];
  window.__frameLog = log;
  const screen = () => {
    const el = document.getElementById('loadscreen');
    return !!el && !el.classList.contains('gone') && !el.classList.contains('fading');
  };
  let lastStart = game.start, armedN = 0;
  const tick = (now) => {
    if (game.start !== lastStart) {
      lastStart = game.start;
      armedN++;
    }
    log.push({ now, armedN, wall: performance.now(), on: game.start.on, green: game.start.green,
      startT: game.start.t, flying: game.renderer.flying, screen: screen(),
      tiles: game.renderer.groundRenders, steps: game.stepsLastFrame || 0 });
    if (log.length < 20000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Page side: run one event (a launch or a restart) and wait for the green.
 * @param {[string, string, number, number]} args the event, level, AI count, limit s
 * @returns {Promise<object>} the call's ms and the frame log from it
 */
async function runEvent([kind, level, aiCount, limitS, isRx]) {
  const game = window.__game;
  const from = window.__frameLog.length, began = performance.now();
  const armedBefore = from ? window.__frameLog[from - 1].armedN : 0;
  const tilesBefore = game.renderer.groundRenders, tileMsBefore = game.renderer.tileMs;
  if (kind === 'launch') game.launch(level, 'hatch-rwd', { ai: aiCount, rx: isRx });
  else game.restart();
  const callMs = performance.now() - began;
  await new Promise((done) => {
    const check = () => {
      const greenAt = window.__frameLog.slice(from).find((frame) => frame.on && frame.green
        && frame.armedN > armedBefore);
      if (greenAt || performance.now() - began > limitS * 1000) done();
      else setTimeout(check, 100);
    };
    setTimeout(check, 100);
  });
  return { began, callMs, armedBefore, frames: window.__frameLog.slice(from),
    tiles: game.renderer.groundRenders - tilesBefore, tileMs: game.renderer.tileMs - tileMsBefore,
    ai: game.ai.length };
}

/**
 * The moments of an event from its frame log, ms after the tap.
 * @param {object} event the event's result
 * @returns {Record<string, number|null>} moment -> ms
 */
function moments(event) {
  const frames = event.frames.filter((frame) => frame.wall >= event.began);
  const armed = (frame) => frame.armedN > event.armedBefore;
  const at = (test) => {
    const frame = frames.find(test);
    return frame ? Math.round(frame.wall - event.began) : null;
  };
  const gaps = frames.map((frame, i) => (i ? frame.wall - frames[i - 1].wall : 0));
  return {
    'first frame painted': at(() => true),
    'loading screen gone (its fade begins)': at((frame) => !frame.screen),
    'fly-in first frame': at((frame) => frame.flying),
    'fly-in over': at((frame, i) => i > 0 && frames[i - 1].flying && !frame.flying),
    'field lined up (start armed)': at(armed),
    'countdown begins (lights clock moving)': at((frame) => armed(frame) && frame.on
      && frame.startT > 0),
    'green': at((frame) => armed(frame) && frame.on && frame.green),
    'worst frame ms': Math.round(Math.max(0, ...gaps.slice(1))),
    // the fly-in's frames once it shows (the screen gone): its first, and its worst
    'fly-in first frame ms': (() => {
      const at = frames.findIndex((frame, i) => i > 0 && frame.flying && !frame.screen);
      return at > 0 && at + 1 < frames.length ? Math.round(frames[at + 1].wall - frames[at].wall)
        : null;
    })(),
    'worst fly-in frame ms': Math.round(Math.max(0, ...gaps.filter((gap, i) => i > 0
      && frames[i - 1].flying && !frames[i - 1].screen))),
  };
}

/**
 * Inclusive ms per function name in a CPU profile, and the top self times.
 * @param {object} profile the CDP profile
 * @returns {{total: Map<string, number>, self: Map<string, number>}} ms by name
 */
function profileTimes(profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parentOf = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parentOf.set(child, node.id);
  const total = new Map(), self = new Map();
  profile.samples.forEach((id, i) => {
    const micros = profile.timeDeltas[i] || 0;
    const own = byId.get(id).callFrame;
    const ownName = `${own.functionName || '(anon)'} ${own.url.replace(/^.*\/src\//, '')}:${own.lineNumber + 1}`;
    self.set(ownName, (self.get(ownName) || 0) + micros / 1000);
    const seen = new Set();
    for (let at = id; at != null; at = parentOf.get(at)) {
      const name = byId.get(at).callFrame.functionName || '(anon)';
      if (seen.has(name)) continue;
      seen.add(name);
      total.set(name, (total.get(name) || 0) + micros / 1000);
    }
  });
  return { total, self };
}

/**
 * Print one event's report.
 * @param {string} title the event
 * @param {object} event its result
 * @param {object} profile its CPU profile
 */
function report(title, event, profile) {
  console.log(`== ${title}: ${levelId}${RX ? ' RX' : ''}, ${event.ai} AI, CPU x${CPU}${extra ? ', ' + extra : ''}`);
  console.log(`  the call itself ${event.callMs.toFixed(0)} ms; ground tiles painted ${event.tiles}`
    + ` (${event.tileMs.toFixed(0)} ms)`);
  for (const [name, ms] of Object.entries(moments(event))) console.log(`  ${name}: ${ms ?? '-'}`);
  const early = event.frames.filter((frame) => frame.wall >= event.began).slice(0, 8);
  console.log('  the first frames (ms after the tap, flags):', early.map((frame) =>
    Math.round(frame.wall - event.began) + (frame.screen ? 'S' : '') + (frame.flying ? 'F' : '')
    + (frame.armedN > event.armedBefore ? 'A' : '')).join(' '));
  const { total, self } = profileTimes(profile);
  console.log('  profile, inclusive ms:');
  for (const [label, names] of PARTS) {
    const ms = Math.max(0, ...names.map((name) => total.get(name) || 0));
    if (ms >= 1) console.log(`    ${label.padEnd(34)} ${ms.toFixed(0).padStart(6)}`);
  }
  console.log('  top self ms:');
  [...self].filter(([name]) => !name.startsWith('(idle)') && !name.startsWith('(program)'))
    .sort((one, two) => two[1] - one[1]).slice(0, 12)
    .forEach(([name, ms]) => console.log(`    ${ms.toFixed(0).padStart(6)}  ${name}`));
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1`
    + (extra ? '&' + extra : ''));
  await page.touchscreen.tap(400, 200);
  // the textures' idle warm-up (main.ts) done before the first event
  await page.waitForTimeout(4000 * CPU);
  await page.evaluate(installFrameLog);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  for (const kind of ['launch', 'restart']) {
    await cdp.send('Profiler.start');
    const event = await page.evaluate(runEvent, [kind, levelId, AI, EVENT_LIMIT_S, RX]);
    const { profile } = await cdp.send('Profiler.stop');
    report(kind === 'launch' ? 'START (launch)' : 'RESTART', event, profile);
    await page.waitForTimeout(3000);
  }
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}
