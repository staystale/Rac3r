// _paintshot.mjs - the garage PAINT shop at phone sizes (?carpaint: BODY / SECOND / THIRD / RIMS),
// a few parts picked, shots _paintshot-<w>x<h>.png. node tools/scratch/_paintshot.mjs [query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'carpaint=1', screen = 'PAINT'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [W, H] of [[844, 390], [390, 844]]) {
    const p = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true })).newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await gotoGame(p, `${server.url}/?touch=1&menu=1&guide=0&noaudio=1&${query}`);
    await p.waitForTimeout(2500);
    const tap = async (txt) => { await p.waitForTimeout(600); await p.locator('#menu button', { hasText: txt }).first().tap({ timeout: 30000 }); };
    await tap('TEST MODE'); await tap('OVALS'); await tap('Naffcar'); await tap('GARAGE'); await tap(screen);
    await p.waitForTimeout(800);
    // pick: SECOND green, THIRD blue, RIMS gold (by data-c), if those rows exist
    for (const [label, colour] of [['SECOND', '#2e7d32'], ['THIRD', '#2f6fd0'], ['COLOUR', '#c9a227'], ['BODY', '#d6d9df']]) {
      await p.evaluate(([lab, col]) => {
        const subs = [...document.querySelectorAll('#menu .sub')].filter((el) => el.textContent === lab);
        const grid = subs[0] && subs[0].nextElementSibling;
        const btn = grid && [...grid.querySelectorAll('button')].find((b) => b.dataset.c === col);
        if (btn) btn.click();
      }, [label, colour]);
      await p.waitForTimeout(250);
    }
    await p.evaluate(() => { const b = [...document.querySelectorAll('#menu button')].find((x) => x.textContent === 'SPLIT'); if (b) b.click(); });
    await p.waitForTimeout(250);
    const fits = await p.evaluate(() => { const m = document.querySelector('#menu'); const pane = m.querySelector('.pane') || m.firstElementChild; return { scrollH: pane ? pane.scrollHeight : 0, clientH: pane ? pane.clientHeight : 0, docScroll: document.documentElement.scrollHeight > innerHeight }; });
    await p.screenshot({ path: `tools/scratch/_paintshot-${screen}-${W}x${H}.png` });
    console.log(W + 'x' + H, JSON.stringify(fits), errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
  }
} finally { await browser.close(); server.stop(); }
