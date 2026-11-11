// _moloadprof.mjs - WHERE A LEVEL'S LOAD GOES: a CPU profile (CDP) from launch(level) to its first
// frame, the functions by self time and by total (inclusive) time. node tools/scratch/_moloadprof.mjs
// [level] (CHECK_PORT) (scratch)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'moanaco';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  await page.evaluate(async (lv) => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
    window.__game.launch(lv, window.__game.car.spec.id, { ai: 0 });
    await frame(); await frame();
  }, level);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map(), parent = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
  const counts = new Map();
  for (const id of profile.samples) counts.set(id, (counts.get(id) || 0) + 1);
  const name = (node) => `${node.callFrame.functionName || '(anon)'} ${node.callFrame.url.split('/').slice(-2).join('/')}:${node.callFrame.lineNumber + 1}`;
  const total = new Map();
  for (const [id, count] of counts) {
    const node = byId.get(id), key = name(node);
    self.set(key, (self.get(key) || 0) + count);
    const seen = new Set();
    for (let at = id; at !== undefined; at = parent.get(at)) {
      const k = name(byId.get(at));
      if (seen.has(k)) continue;
      seen.add(k);
      total.set(k, (total.get(k) || 0) + count);
    }
  }
  const all = profile.samples.length, ms = (profile.endTime - profile.startTime) / 1000;
  const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `${(v / all * ms).toFixed(0).padStart(6)} ms ${k}`).join('\n');
  console.log(`${level}: ${ms.toFixed(0)} ms profiled\nSELF\n${top(self, 15)}\nTOTAL\n${top(total, 30)}`);
} finally {
  await browser.close();
  server.stop();
}
