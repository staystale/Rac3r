// _volcheck.mjs — the pause menu's SOUND slider + MUTE (2026-10-07), in the real game: open pause, check the controls are there, drag the
// slider, mute, reload, and check both were REMEMBERED; photograph the pause pane. node tools/_volcheck.mjs [base]
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const base = (process.argv[2] || '').replace(/^live$/, '');
const b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const url = `${srv.url}/${base}index.html?touch=1&guide=0&menu=1&level=lab`;
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'BAD  ') + m); if (!c) bad++; };
async function openPause() {
  await p.goto(url); await p.waitForTimeout(1500);
  await p.evaluate(() => window.__game.launch('lab', 'saloon-rwd', {})); await p.waitForTimeout(1200);
  const started = true;
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  return started;
}
await openPause();
let has = await p.evaluate(() => ({ slider: !!document.querySelector('#menu input[type=range]'), mute: [...document.querySelectorAll('#menu button')].some((x) => /MUTE/.test(x.textContent)), paused: /PAUSED/.test(document.querySelector('#menu').textContent) }));
ok(has.paused, `pause menu open (${JSON.stringify(has)})`);
ok(has.slider && has.mute, 'SOUND slider + MUTE button in the pause menu');
await p.screenshot({ path: 'shots/look/vol-pause.png' });
await p.evaluate(() => { const s = document.querySelector('#menu input[type=range]'); s.value = 30; s.dispatchEvent(new Event('input')); });
const lbl1 = await p.evaluate(() => [...document.querySelectorAll('#menu div')].filter((d) => !d.children.length).map((d) => d.textContent).find((t) => /^SOUND /.test(t)));
ok(lbl1 === 'SOUND 30%', `slider -> label "${lbl1}", audio.volume ${await p.evaluate(() => window.__game.audio.volume)}`);
await p.evaluate(() => [...document.querySelectorAll('#menu button')].find((x) => /^MUTE$/.test(x.textContent)).click());
await p.waitForTimeout(400);
const st = await p.evaluate(() => ({ muted: window.__game.audio.muted, btn: [...document.querySelectorAll('#menu button')].some((x) => x.textContent === 'UNMUTE') }));
ok(st.muted && st.btn, `MUTE -> muted ${st.muted}, button reads UNMUTE ${st.btn}`);
await p.screenshot({ path: 'shots/look/vol-muted.png' });
// reload: remembered?
await p.goto(url); await p.waitForTimeout(1500);
const mem = await p.evaluate(() => ({ v: window.__game.audio.volume, m: window.__game.audio.muted }));
ok(Math.abs(mem.v - 0.3) < 1e-6 && mem.m, `after reload: volume ${mem.v}, muted ${mem.m}`);
await p.evaluate(() => { localStorage.removeItem('rac3r.vol'); localStorage.removeItem('rac3r.mute'); });
console.log(`page errors: ${errs.length ? errs.join(' / ') : 'none'}`); if (errs.length) bad++;
console.log(bad ? `VOLCHECK: ${bad} BAD` : 'VOLCHECK: ALL OK');
await b.close();
srv.stop();
