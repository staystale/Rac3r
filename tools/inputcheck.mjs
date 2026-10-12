// inputcheck.mjs — STUCK CONTROLS (user, 2026-10-04, iOS: rapid taps / holds / several fingers left pedals or steering ON).
// Real CDP touches at 844x390: every way a touch can go missing must leave nothing held, and an ordinary second finger
// must NOT release the first. Starts its own server. node tools/inputcheck.mjs
import { startServer, launchBrowser } from './lib/browser.mjs';
const W = 844, H = 390;
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(srv.url + '/?touch=1&guide=0&menu=0');
await p.touchscreen.tap(W / 2, H / 2); await p.waitForTimeout(300);
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: pts[i][2] ?? i })) });
const ped = await p.evaluate(() => { const h = window.__game.input.pedalHits(innerWidth, innerHeight); return Object.fromEntries(h.map(q => [q.name, [q.x, q.y]])); });
const held = () => p.evaluate(() => { const i = window.__game.input; return { thr: !!i.pedals.throttle, brk: !!i.pedals.brake, stick: i.stick.active }; });
const fails = [];
const expect = (name, got, want) => { const ok = Object.keys(want).every(k => got[k] === want[k]); console.log((ok ? 'OK   ' : 'FAIL ') + name, JSON.stringify(got)); if (!ok) fails.push(name); };
const clear = async () => { await touch('touchEnd', []).catch(() => {}); await p.evaluate(() => window.__game.input.releaseAll()); await p.waitForTimeout(50); };

// 1. throttle + stick held, then iOS cancels the whole touch stream
await touch('touchStart', [[...ped.throttle, 1], [150, 250, 2]]); await touch('touchMove', [[...ped.throttle, 1], [180, 250, 2]]);
expect('1a held: throttle + stick down', await held(), { thr: true, stick: true });
await touch('touchCancel', []); await p.waitForTimeout(50);
expect('1b touchcancel releases all', await held(), { thr: false, stick: false });
await clear();
// 2. held, then the page loses focus / is hidden (app switch, notification, control centre)
await touch('touchStart', [[...ped.brake, 1]]);
await p.evaluate(() => dispatchEvent(new Event('blur')));
expect('2 blur releases', await held(), { brk: false });
await clear();
// 3. a pointerdown whose pointerup never comes (what an iOS magnifier does), then the last finger leaves
await p.evaluate(([x, y]) => { const c = document.getElementById('c'); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' })); }, ped.throttle);
expect('3a ghost pointer holds throttle', await held(), { thr: true });
await touch('touchStart', [[400, 200, 5]]); await touch('touchEnd', []); await p.waitForTimeout(50);
expect('3b last finger up releases it', await held(), { thr: false });
await clear();
// 4. ORDINARY play: hold throttle, tap brake with a second finger, lift it -> throttle must stay held
await touch('touchStart', [[...ped.throttle, 1]]);
await touch('touchStart', [[...ped.throttle, 1], [...ped.brake, 2]]);
await touch('touchEnd', [[...ped.brake, 2]]); await p.waitForTimeout(50);   // CDP touchEnd lists the finger that lifts
expect('4 second finger up keeps throttle', await held(), { thr: true, brk: false });
await clear();
// 5. rapid taps x20 on throttle and brake alternately, then nothing held
for (let i = 0; i < 20; i++) { const q = i % 2 ? ped.brake : ped.throttle; await touch('touchStart', [[...q, 10 + i]]); await touch('touchEnd', []); }
await p.waitForTimeout(50);
expect('5 rapid taps leave nothing held', await held(), { thr: false, brk: false, stick: false });

if (errs.length) { console.log('PAGE ERRORS', errs); fails.push('page errors'); }
console.log(fails.length ? 'FAILED: ' + fails.join(', ') : 'ALL OK');
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
