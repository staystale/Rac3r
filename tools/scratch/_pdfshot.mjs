// _pdfshot.mjs - render page 1 of a local PDF to a PNG (pdf.js in the test browser)
import http from 'node:http'; import fs from 'node:fs';
import { launchBrowser } from '../lib/browser.mjs';
const [pdf, out, scale = '2'] = process.argv.slice(2);
const html = `<!doctype html><body style="margin:0"><canvas id=c></canvas>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
<script>pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
window.done=pdfjsLib.getDocument('/doc.pdf').promise.then(d=>d.getPage(1)).then(p=>{const v=p.getViewport({scale:${scale}});
const c=document.getElementById('c');c.width=v.width;c.height=v.height;return p.render({canvasContext:c.getContext('2d'),viewport:v}).promise.then(()=>[v.width,v.height]);});</script>`;
const srv = http.createServer((req, res) => {
  if (req.url === '/doc.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(fs.readFileSync(pdf)); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }
}).listen(8099);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:8099/');
  const [w, h] = await page.evaluate(() => window.done);
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  await (await page.$('#c')).screenshot({ path: out });
  console.log('rendered', w, h);
} finally { await browser.close(); srv.close(); }
