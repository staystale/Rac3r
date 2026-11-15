// _aidialshot.mjs - ?aipace=1's live AI DRIVERS dials in the test-mode pause menu: a Brands race with
// 5 AI, paused, AI DRIVERS opened; photographs the panel at 844x390 and 390x844 (top and scrolled to
// the end), then moves PACE and SKILL and checks the field's traits followed (paceK, skill), and
// that RESET puts them back. Prints page errors. Photos in tools/scratch/_aidials-*.png.
// node tools/scratch/_aidialshot.mjs   (CHECK_PORT as the browser tools)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = new URL('./', import.meta.url);

/** Page side: the field's first driver's traits. */
const traitsOf = () => {
  const traits = window.__game.ai[0].drv.traits;
  return { paceK: traits.paceK, skill: +traits.skill.toFixed(3) };
};

/** Page side: sets a dial's slider by its name and fires its input. */
function setDial([name, value]) {
  const rows = [...document.querySelectorAll('#menu .row')];
  const row = rows.find((item) => (item.textContent || '').startsWith(name));
  const input = row.querySelector('input[type=range]');
  input.value = String(value);
  input.dispatchEvent(new Event('input'));
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&aipace=1`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.__game.testMode = true;
      window.__game.launch('brands-snatch', 'hatch-rwd', { ai: 5 });
    });
    await page.waitForTimeout(2500);
    await page.keyboard.press('p');
    await page.waitForTimeout(500);
    const menuText = await page.evaluate(() => (document.querySelector('#menu')?.innerText || '')
      .replace(/\s+/g, ' ').slice(0, 300));
    console.log(`menu: ${menuText} | ai ${await page.evaluate(() => window.__game.ai.length)}`);
    await page.locator('#menu button', { hasText: 'AI DRIVERS' }).click();
    await page.waitForTimeout(400);
    const base = `_aidials-${width}x${height}`;
    await page.screenshot({ path: new URL(base + '-top.png', OUT).pathname.slice(1) });
    await page.evaluate(() => {
      const pane = document.querySelector('#menu .pane') || document.querySelector('#menu');
      pane.scrollTop = pane.scrollHeight;
      for (const item of document.querySelectorAll('#menu *')) {
        if (item.scrollHeight > item.clientHeight + 4) item.scrollTop = item.scrollHeight;
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: new URL(base + '-end.png', OUT).pathname.slice(1) });
    const before = await page.evaluate(traitsOf);
    await page.evaluate(setDial, ['PACE', 0.9]);
    await page.evaluate(setDial, ['SKILL', 0.9]);
    const moved = await page.evaluate(traitsOf);
    const words = await page.evaluate(() => [...document.querySelectorAll('#menu .row')]
      .map((row) => (row.textContent || '').trim()).filter((text) => /^(PACE|SKILL)/.test(text)));
    const resetButton = page.locator('#menu button').filter({ hasText: /^RESET$/ });
    const resets = await resetButton.count();
    await resetButton.click();
    await page.waitForTimeout(600);
    const reset = await page.evaluate(traitsOf);
    console.log(`${width}x${height}: before ${JSON.stringify(before)} | PACE 0.9 + SKILL 0.9`
      + ` ${JSON.stringify(moved)} ${JSON.stringify(words)} | RESET (${resets} found)`
      + ` ${JSON.stringify(reset)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
