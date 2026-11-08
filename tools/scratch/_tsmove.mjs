// _tsmove.mjs - rename src .js files to .ts (git mv) and point every import at the new name (each
// relative specifier RESOLVED against its file, so hud/widgets.js and menu/widgets.js never mix),
// plus plain path mentions (src/x/y.js, x/y.js) in comments and docs.
// node tools/scratch/_tsmove.mjs src/a.js ...
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const files = process.argv.slice(2).map((f) => path.resolve(f));
const roots = ['src', 'tools', 'index.html', 'serve.mjs', 'eslint.config.js', 'CLAUDE.md', 'NOTES.md',
  'TODO.md', 'ENGINE.md', 'PLAN.md', 'README.md', 'CONTRIBUTING.md', '.github'];
const walk = (p, out) => {
  if (!fs.existsSync(p)) return out;
  if (fs.statSync(p).isDirectory()) {
    if (/node_modules|[\\/]\.git$|scratch|[\\/]dist$/.test(p)) return out;
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  } else if (/\.(m?js|ts|html|md|yml)$/.test(p)) out.push(path.resolve(p));
  return out;
};
const moved = new Map(files.map((f) => [f, f.replace(/\.js$/, '.ts')]));
for (const f of files) execFileSync('git', ['mv', f, moved.get(f)]);
const all = roots.flatMap((r) => walk(r, []));
const srcRoot = path.resolve('src');
let count = 0;
for (const p of all) {
  const s = fs.readFileSync(p, 'utf8');
  // relative import specifiers
  let t = s.replace(/(["'`])(\.{1,2}\/[^"'`\s]*?)\.js\1/g, (m, q, spec) => {
    const abs = path.resolve(path.dirname(p), spec + '.js');
    return moved.has(abs) ? `${q}${spec}.ts${q}` : m;
  });
  // plain mentions: src/x/y.js and x/y.js (relative to src), whole-path only
  for (const [from] of moved) {
    const rel = path.relative(srcRoot, from).split(path.sep).join('/');
    const relTs = rel.replace(/\.js$/, '.ts');
    t = t.replace(new RegExp(`(^|[^\\w/.])((?:src/)?)${rel.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'gm'),
      (m, pre, srcPre) => `${pre}${srcPre}${relTs}`);
  }
  if (t !== s) { fs.writeFileSync(p, t); count++; }
}
console.log(`moved ${files.length}, updated ${count} files`);
