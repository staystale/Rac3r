// spotshots.mjs — photographs chosen [level, x, y, name] spots (edit the list) at 844x390 into shots/spotshots/; reports fps.
import { startServer, launchBrowser } from './lib/browser.mjs';
import { repoRoot } from './lib/paths.mjs';
import { mkdirSync } from 'node:fs';
const srv = await startServer();
process.on('exit', srv.stop);
const outDir = repoRoot + 'shots/spotshots/'; mkdirSync(outDir, { recursive: true });
const b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
for (const [lv, x, y, name] of [['thruston', -150, 0, 'inc-grass'], ['sandbox', 0, 0, 'inc-sandbox'], ['test-track', 30, 25, 'inc-gravelpad']]) {
  await p.goto(srv.url + '/?pc=1&guide=0&level=' + lv); await p.mouse.click(400, 200); await p.waitForTimeout(2600);
  await p.evaluate(([x, y]) => { const c = window.__game.car; c.x = x; c.y = y; c.vx = 0; c.vy = 0; window.__game.renderer.snap(c); }, [x, y]);
  await p.waitForTimeout(600);
  await p.screenshot({ path: outDir + 'shade-' + name + '.png' });
}
console.log('fps', await p.evaluate(() => window.__game.fps.toFixed(0)));
await b.close();
srv.stop();
