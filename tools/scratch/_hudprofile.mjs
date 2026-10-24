// _hudprofile.mjs - where the HUD's time goes: a CPU profile (CDP, CPU x4) of Castle Cum with 5 AI
// and your car on autopilot, 12 s, the self time of every function in the HUD's files (hud.js,
// hud/*) and of the canvas calls they make (attributed to their caller), as a share of the HUD.
// node tools/scratch/_hudprofile.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const extra = process.argv[2] ? '&' + process.argv[2] : '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&bundle=0${extra}`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(async () => {
    const game = window.__game, { shared } = await import('/src/game/state.js');
    game.launch('castle-cum', game.car.spec.id, { ai: 5, diff: 2 });
    shared.settings.autopilot = true;
    await new Promise((done) => setTimeout(done, 8000));
  });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(12000);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
  // a sample counts for the nearest HUD function on its stack (canvas calls go to their caller)
  const isHud = (node) => /\/hud(\.js|\/)/.test(node.callFrame.url);
  const owner = (id) => {
    for (let at = id; at != null; at = parent.get(at)) if (isHud(byId.get(at))) return byId.get(at);
    return null;
  };
  const time = {};
  let hudTotal = 0, all = 0;
  profile.samples.forEach((id, i) => {
    const ms = (profile.timeDeltas[i] || 0) / 1000;
    all += ms;
    const node = owner(id);
    if (!node) return;
    const key = node.callFrame.functionName + ' ' + node.callFrame.url.split('/').pop()
      + ':' + node.callFrame.lineNumber;
    time[key] = (time[key] || 0) + ms;
    hudTotal += ms;
  });
  console.log(`HUD ${hudTotal.toFixed(0)} ms of ${all.toFixed(0)} ms profiled`
    + ` (${(100 * hudTotal / all).toFixed(1)} %); by function (self + the canvas calls it makes):`);
  for (const [key, ms] of Object.entries(time).sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`  ${(100 * ms / hudTotal).toFixed(1).padStart(5)} %  ${key}`);
  }
} finally {
  await browser.close();
  server.stop();
}
