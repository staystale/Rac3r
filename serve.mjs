// serve.mjs — static server, no-store so a phone refresh always gets current code (CLAUDE.md §5).
// ONE of these at a time. Port 8080; 8070 belongs to another project on this machine.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const full = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
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
    const body = await readFile(s.isDirectory() ? join(full, 'index.html') : full);
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
