// hunt.mjs — fuzz-drives the REAL game and catches the car going backwards or spinning, then dumps the
// seconds leading up to it. Kept permanently because it is the ONLY harness that has ever caught these:
// hand-written scenarios kept passing while the player kept hitting the bug.
//   node tools/hunt.mjs            general driving
//   node tools/hunt.mjs brake      braking-heavy
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const MODE = process.argv[2] || 'general';
const CAR = process.argv[3] || 'hatch-rwd';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:8080/?car=${CAR}&dev=1`);
await p.mouse.click(422, 195);
await p.waitForTimeout(200);

await p.evaluate(() => {
  const g = window.__game;
  window.__hunt = { hits: [], buf: [] };
  setInterval(() => {
    const c = g.car, t = c.t;
    window.__hunt.buf.push({
      t: +(performance.now()/1000).toFixed(2),
      kph: +(Math.hypot(c.vx,c.vy)*3.6).toFixed(0),
      vLong: +t.vLong.toFixed(2), beta: +(Math.atan2(t.vLat,t.vLong)*57.3).toFixed(0),
      yaw: +c.yawRate.toFixed(2), gear: c.gear, del: +(c.delta*57.3).toFixed(1),
      br: +g.in.brake.toFixed(2), th: +g.in.throttle.toFixed(2),
      hb: +(g.in.handbrake||0).toFixed(2), st: +g.in.steer.toFixed(2),
      lF: t.lockedF?1:0, lR: t.lockedR?1:0,
    });
    if (window.__hunt.buf.length > 70) window.__hunt.buf.shift();
    // FAILURE: travelling backwards at more than walking pace while NOT in reverse gear
    if (t.vLong < -2 && c.gear > 0 && window.__hunt.hits.length < 2) {
      window.__hunt.hits.push({ why: 'travelling backwards in a forward gear', w: window.__hunt.buf.slice() });
    }
  }, 50);
});

const down = new Set();
const press = async (k, ms) => { await p.keyboard.down(k); down.add(k); await p.waitForTimeout(ms); await p.keyboard.up(k); down.delete(k); };
const rnd = (n) => Math.floor(Math.random()*n);

for (let i = 0; i < 90; i++) {
  if (MODE === 'brake') {
    // accelerate, then brake hard while steering — the reported case
    await press('w', 1200 + rnd(2500));
    const steer = Math.random() < 0.5 ? 'a' : 'd';
    await p.keyboard.down(steer); await p.keyboard.down('s');
    await p.waitForTimeout(600 + rnd(2200));
    await p.keyboard.up('s'); await p.keyboard.up(steer);
    await p.waitForTimeout(200);
  } else {
    const k = ['w','s','a','d',' ','z'][rnd(6)];
    if (down.has(k)) { await p.keyboard.up(k); down.delete(k); }
    else { await p.keyboard.down(k); down.add(k); }
    await p.waitForTimeout(120 + rnd(500));
  }
  if (await p.evaluate(() => window.__hunt.hits.length)) break;
}
for (const k of down) await p.keyboard.up(k);
const out = await p.evaluate(() => window.__hunt.hits);
await b.close();

if (!out.length) console.log(`no failure found (${MODE}, ${CAR})`);
else {
  console.log(`CAUGHT: ${out[0].why}\n`);
  console.log('   t    kph  vLong  beta  yaw  gear  delta  brake  thr   hb  steer lF lR');
  for (const r of out[0].w.slice(-34))
    console.log([r.t,r.kph,r.vLong,r.beta,r.yaw,r.gear,r.del,r.br,r.th,r.hb,r.st,r.lF,r.lR].map(x=>String(x).padStart(6)).join(''));
}
if (errs.length) console.log('\nERRORS: ' + errs.join(' | '));
