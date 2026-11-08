// _logoexport.mjs - render the owner's logo with "A DRIVING SANDBOX" (the mockup's own code) and
// save it cropped and sized for the game: assets/logo.jpg
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { launchBrowser } from '../lib/browser.mjs';
const dir = process.argv[2];
const srv = http.createServer((req, res) => {
  const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/jpeg' }); res.end(buf); });
}).listen(8098);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:8098/_logoexport.html');
  const url = await page.evaluate(() => window.__out);
  fs.writeFileSync('assets/logo.jpg', Buffer.from(url.split(',')[1], 'base64'));
  console.log('assets/logo.jpg', fs.statSync('assets/logo.jpg').size, 'bytes');
} finally { await browser.close(); srv.close(); }
