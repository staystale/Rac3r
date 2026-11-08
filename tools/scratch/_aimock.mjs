// _aimock.mjs - MOCKUP of the AI rework R3 (skill + risk + the K15 test sliders): the real test
// setup with an AI DRIVERS > button under the AI rows, then the AI DRIVERS panel built in the
// menu's own markup (h1, .row, .sub, buttons, range inputs). Phone shots, nothing wired.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
  const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(700); };
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
  await tap('VS AI');
  // 1: the setup with the new button under AI: CLASS CARS / AI: YOUR CAR
  await page.evaluate(() => {
    const rowOf = [...document.querySelectorAll('#menu button')].find((b) => b.textContent.includes('AI: YOUR CAR')).parentElement;
    const row = document.createElement('div'); row.className = 'row';
    const b = document.createElement('button'); b.textContent = 'AI DRIVERS ▸'; b.style.flex = '1'; row.appendChild(b);
    const note = document.createElement('div'); note.className = 'sub'; note.textContent = 'FROM REALISH · SKILL 0.50 · RISK 0.50';
    rowOf.after(row); row.after(note);
    rowOf.previousElementSibling.previousElementSibling.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/scratch/_aimock-1-setup.png' });
  // 2: the AI DRIVERS panel
  await page.evaluate(() => {
    const pane = document.querySelector('#menu .pane');
    for (const kid of [...pane.children]) kid.style.display = 'none';
    const add = (tag, html, cls, css) => { const e = document.createElement(tag); e.innerHTML = html; if (cls) e.className = cls; if (css) e.style.cssText = css; pane.appendChild(e); return e; };
    add('h1', 'AI DRIVERS');
    add('div', 'STARTS FROM THE DIFFICULTY. A SLIDER MOVES THE WHOLE FIELD - EACH DRIVER KEEPS ITS OWN PLACE IN IT, SO A BETTER DRIVER STAYS BETTER.', 'sub');
    const pre = add('div', '', 'row');
    for (const [n, on] of [['MOBILE', 0], ['GAME', 0], ['REALISH', 0], ['RICH', 0], ['REAL', 0], ['CUSTOM', 1]]) { const b = document.createElement('button'); b.textContent = n; if (on) b.classList.add('on'); pre.appendChild(b); }
    const slider = (label, val, word, note) => {
      const row = add('div', '', 'row', 'align-items:center');
      const l = document.createElement('div'); l.style.cssText = 'width:150px;font-size:12px'; l.innerHTML = label + '<br>' + word; row.appendChild(l);
      const i = document.createElement('input'); i.type = 'range'; i.min = 0; i.max = 100; i.value = val; i.style.cssText = 'flex:1;min-height:34px;accent-color:#ff7a2a'; row.appendChild(i);
      add('div', note, 'sub', 'margin-top:-6px');
    };
    slider('SKILL', 62, '0.62', 'PACE, LINE, REACTION, DODGING, FEWER ERRORS');
    slider('SPREAD', 50, 'MIXED', 'HOW DIFFERENT THE DRIVERS ARE: ALL ALIKE .. ROOKIES WITH PROS');
    // the field preview: each driver's skill on a 0-1 strip
    const strip = add('div', '', '', 'position:relative;display:block;box-sizing:border-box;width:100%;align-self:stretch;flex:0 0 26px;height:26px;min-height:26px;margin:6px 0 8px;background:#241c23;box-shadow:inset 0 0 0 2px #3a2018');
    const skills = [0.34, 0.41, 0.45, 0.48, 0.5, 0.53, 0.55, 0.57, 0.59, 0.6, 0.62, 0.63, 0.65, 0.67, 0.7, 0.72, 0.75, 0.79, 0.84, 0.93];
    for (const s of skills) { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:calc(${(s * 100).toFixed(1)}% - 3px);top:5px;width:6px;height:16px;background:${s > 0.75 ? '#4fd8ff' : s < 0.45 ? '#ff3a2a' : '#f6eee6'}`; strip.appendChild(d); }
    add('div', 'THE FIELD: 20 DRIVERS, SKILL 0.34 - 0.93 (RED ROOKIES, BLUE PROS)', 'sub', '');
    slider('RISK', 50, '0.50', 'LATER BRAKING, FASTER ENTRIES, SMALLER GAPS - QUICKER, AND MORE CRASHES');
    slider('AGGRESSION', 50, '0.50', 'GOES FOR GAPS, ATTACKS SOONER, BUMPS');
    slider('DEFENCE', 50, '0.50', 'COVERS THE INSIDE, HARD TO PASS');
    slider('MISTAKES', 50, 'x1.0', 'ERRORS A CORNER FOR EVERYONE - A BETTER DRIVER STILL MAKES FEWER');
    const r2 = add('div', '', 'row'); const rb = document.createElement('button'); rb.textContent = 'RESET TO REALISH'; rb.style.flex = '1'; r2.appendChild(rb);
    const r3 = add('div', '', 'row'); const bb = document.createElement('button'); bb.textContent = '◀ BACK'; bb.style.flex = '1'; r3.appendChild(bb);
    pane.scrollTop = 0; window.scrollTo(0, 0); pane.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tools/scratch/_aimock-2-panel.png' });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#menu button')].find((x) => x.textContent.includes('RESET TO')); b.scrollIntoView({ block: 'end' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/scratch/_aimock-3-panel-end.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
