// serve a scratch folder on a local port and take one look at a page in it (same origin, so a
// canvas may read its own images, as on the published page)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { launchBrowser } from '../lib/browser.mjs';
const [dir, page0, out] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(buf); });
}).listen(8097);
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8097/' + page0); await page.waitForTimeout(3500);
  if (process.argv[5]) { await page.evaluate((sel) => document.querySelector(sel).scrollIntoView(), process.argv[5]); await page.waitForTimeout(300); }
  await page.screenshot({ path: out });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.close(); }
