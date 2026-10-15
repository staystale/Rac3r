// _aismoke.mjs — the REAL game with AI racing: a Knobhill race and a highway race, 25 s each; reports page errors, AI speeds, and
// any AI that the drive-out (aidriver.js) fired for / gave up on. node tools/_aismoke.mjs [base]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const base = (process.argv[2] || '').replace(/^live$/, '');
const b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
for (const level of (process.argv[3] || 'knobhill').split(',')) {
  await p.goto(`${srv.url}/${base}index.html?touch=1&guide=0&menu=0&level=${level}&ai=5`); await p.touchscreen.tap(422, 195);
  await p.waitForTimeout(12000);
  const r = await p.evaluate(() => { const g = window.__game; return (g.ai || []).map((a) => ({ v: +Math.hypot(a.car.vx, a.car.vy).toFixed(1), outs: a.drv.state.nOut || 0, gaveUp: !!a.drv.state.giveUp })); });
  console.log(`${level}: ${r.length} AI ${JSON.stringify(r)}`);
}
console.log(`page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
await b.close();
srv.stop();
