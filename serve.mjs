// serve.mjs — static server, no-store so a phone refresh always gets current code (CLAUDE.md §5).
// ONE of these at a time. Port 8080; 8070 belongs to another project on this machine.
import { createServer } from 'node:http';
import { appendFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const PORT = Number(process.env.PORT || 8080);
// ?report=1 (src/ui/report.ts): the phone's frame timings, one JSON line per post
const REPORT_LOG = process.env.RAC3R_REPORT_LOG || join(tmpdir(), 'rac3r-phone-report.jsonl');
const REPORT_MAX_BYTES = 2e6;   // a post is ~20 KB; refuse anything far bigger

/**
 * Appends one phone frame report to REPORT_LOG.
 * @param {import('node:http').IncomingMessage} req the POST
 * @param {import('node:http').ServerResponse} res the response
 */
function saveReport(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; if (body.length > REPORT_MAX_BYTES) req.destroy(); });
  req.on('end', async () => {
    try {
      const report = JSON.parse(body);
      const line = JSON.stringify({ at: new Date().toISOString(), ...report });
      await appendFile(REPORT_LOG, line + '\n');
      res.writeHead(204).end();
    } catch { res.writeHead(400).end(); }
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/__report') { saveReport(req, res); return; }
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    let full = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
    let tsPath = null;
    if (extname(full) === '.ts') tsPath = full;
    else if (extname(full) === '.js') {
      const ts = full.slice(0, -3) + '.ts';
      if (!(await stat(full).then(() => true, () => false)) && (await stat(ts).then(() => true, () => false))) tsPath = ts;
    }
    if (tsPath) {
      const esbuild = await import('esbuild');
      const src = await readFile(tsPath, 'utf8');
      let out;
      try {
        out = await esbuild.transform(src, {
          loader: 'ts', format: 'esm', sourcemap: 'inline', sourcefile: tsPath,
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(err && err.message || err));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      });
      res.end(out.code);
      return;
    }
    const s = await stat(full);
    if (s.isDirectory()) full = join(full, 'index.html');
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(full)] || 'application/octet-stream',
      // never let a phone cache a build; "that didn't change anything" must never be a stale file
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  }
}).listen(PORT, () => console.log(`the lab -> http://localhost:${PORT}`));
