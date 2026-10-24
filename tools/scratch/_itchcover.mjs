// _itchcover.mjs <shot.png> <out.png> - the itch.io cover (630x500): a crop of a game screenshot
// with the RAC3R title in the menu's gold, rendered by the browser.
// node tools/scratch/_itchcover.mjs <dir>/3-knobhill-rain.png <dir>/cover-630x500.png
import { readFileSync } from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';

const [shot, out] = process.argv.slice(2);
const data = 'data:image/png;base64,' + readFileSync(shot).toString('base64');
const html = `<!doctype html><html><body style="margin:0;width:630px;height:500px;overflow:hidden;
  background:#111">
  <div style="position:absolute;inset:0;background:url(${data}) no-repeat;
    background-size:1300px auto;background-position:-180px -150px"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:190px;
    background:linear-gradient(transparent,rgba(10,12,16,0.92))"></div>
  <div style="position:absolute;left:34px;bottom:58px;font:900 92px/1 'Segoe UI',system-ui,sans-serif;
    letter-spacing:6px;color:#f0a830;text-shadow:4px 4px 0 #000">RAC3R</div>
  <div style="position:absolute;left:38px;bottom:30px;font:700 20px/1 'Segoe UI',system-ui,sans-serif;
    letter-spacing:3px;color:#e8e8e8">A DRIVING SANDBOX</div>
</body></html>`;
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 630, height: 500 } })).newPage();
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  console.log('cover', out);
} finally {
  await browser.close();
}
