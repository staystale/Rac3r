// node tools/modmap.mjs src/lab.js [--out file]
// Survey of one ES module, to plan splitting it: top-level items, mutable (live-binding) exports, who imports what,
// the internal call graph and the level data. Report only; changes nothing.
// Limits: scope handling is by declared names in enclosing functions/blocks (good enough for a survey); a
// namespace import (import * as L) is counted by scanning for `L.name`; files acorn cannot parse (typed .ts) fall back to regex.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join, sep } from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outFile = oi >= 0 ? args[oi + 1] : null;
const target = resolve(args.find((a, i) => !a.startsWith('--') && i !== oi + 1) || 'src/lab.js');
const LEVEL_IDS = ['lab', 'test-track', 'knobhill', 'brands-snatch', 'brands-snatch-indy', 'sweaty-lamb', 'killder', 'slidden-hill',
  'castle-cum', 'thruston', 'grass-track', 'stock-car', 'naffcar', 'sandbox'];
const OPTS = { ecmaVersion: 'latest', sourceType: 'module', locations: true };

const src = readFileSync(target, 'utf8');
const lines = src.split(/\r?\n/);
const comments = [];
const ast = acorn.parse(src, { ...OPTS, onComment: comments });

// ---- banners: comment lines on their own line starting "// ----" / "// ====" or ALL-CAPS
const isCaps = (t) => /[A-Z]{3}/.test(t) && !/[a-z]/.test(t);
const banners = [];
for (const c of comments) {
  if (c.type !== 'Line') continue;
  const ln = c.loc.start.line;
  if (!lines[ln - 1].trim().startsWith('//')) continue;
  const text = lines[ln - 1].trim();
  if (/^\/\/\s?(----|====)/.test(text) || isCaps(text.replace(/^\/\/\s*/, ''))) banners.push({ line: ln, text });
}
const bannerFor = (line) => { let b = null; for (const x of banners) { if (x.line < line) b = x; else break; } return b; };

// ---- pattern helpers
function patNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) patNames(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements) patNames(q, out);
  else if (p.type === 'RestElement') patNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patNames(p.left, out);
  return out;
}

// ---- top-level items
const items = [];
const exportedNames = new Set();
const kindOfDecl = (d) => {
  if (d.type === 'FunctionDeclaration') return 'function';
  if (d.type === 'ClassDeclaration') return 'class';
  if (d.type === 'VariableDeclaration') return d.kind === 'var' ? 'var' : d.kind;
  return 'expression';
};
for (const node of ast.body) {
  let exported = false, d = node, defaultExport = false;
  if (node.type === 'ExportNamedDeclaration' && node.declaration) { exported = true; d = node.declaration; }
  else if (node.type === 'ExportDefaultDeclaration') { exported = true; defaultExport = true; d = node.declaration; }
  const it = { node, decl: d, exported, start: node.loc.start.line, end: node.loc.end.line, names: [], kind: 'expression' };
  if (node.type === 'ImportDeclaration') { it.kind = 'import'; it.names = node.specifiers.map((s) => s.local.name); }
  else if (node.type === 'ExportNamedDeclaration' && !node.declaration) {
    it.kind = 'export-list';
    it.names = node.specifiers.map((s) => s.exported.name);
    if (!node.source) for (const s of node.specifiers) exportedNames.add(s.exported.name);
  } else if (node.type === 'ExportAllDeclaration') it.kind = 'export-all';
  else {
    it.kind = kindOfDecl(d);
    if (d.type === 'VariableDeclaration') it.names = d.declarations.flatMap((x) => patNames(x.id));
    else if (d.id) it.names = [d.id.name];
    else if (defaultExport) it.names = ['default'];
    if (exported) for (const n of (defaultExport ? ['default'] : it.names)) exportedNames.add(n);
  }
  it.count = it.end - it.start + 1;
  it.banner = bannerFor(it.start);
  it.label = it.names.length ? it.names.join(', ') : '(' + node.type + ')';
  items.push(it);
}
// an `export { a, b }` list also exports earlier-declared local names
const topNames = new Map(); // name -> item
for (const it of items) if (it.kind !== 'export-list' && it.kind !== 'import') for (const n of it.names) topNames.set(n, it);
for (const it of items) if (it.kind === 'export-list' && !it.node.source) {
  for (const s of it.node.specifiers) { const t = topNames.get(s.local.name); if (t) t.exportedViaList = true; }
}
const isExported = (it) => it.exported || !!it.exportedViaList;

// ---- scope check: is `name` declared by this enclosing function/block/loop node?
function declaredIn(node, name) {
  const fn = /Function/.test(node.type);
  if (fn) {
    if (node.params.some((p) => patNames(p).includes(name))) return true;
    if (node.type === 'FunctionExpression' && node.id && node.id.name === name) return true;
    if (node.body.type === 'BlockStatement') {
      let found = false;
      walk.simple(node.body, {
        VariableDeclaration(v) { if (v.kind === 'var' && v.declarations.some((x) => patNames(x.id).includes(name))) found = true; },
      }, { ...walk.base, Function() {} });
      if (found) return true;
    }
  }
  if (node.type === 'CatchClause' && node.param && patNames(node.param).includes(name)) return true;
  if (node.type === 'BlockStatement' || node.type === 'StaticBlock') for (const s of node.body) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var' && s.declarations.some((x) => patNames(x.id).includes(name))) return true;
    if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id.name === name) return true;
  }
  if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
    const h = node.type === 'ForStatement' ? node.init : node.left;
    if (h && h.type === 'VariableDeclaration' && h.kind !== 'var' && h.declarations.some((x) => patNames(x.id).includes(name))) return true;
  }
  return false;
}
const shadowed = (ancestors, name) => ancestors.some((a) => declaredIn(a, name));

// ---- 2. assignments to exported top-level let/var names
const mutable = [];
for (const it of items) if ((it.kind === 'let' || it.kind === 'var') && isExported(it)) for (const n of it.names) mutable.push(n);
const assigns = new Map(mutable.map((n) => [n, []]));
const noteAssign = (name, line, ancestors) => {
  if (assigns.has(name) && !shadowed(ancestors, name)) assigns.get(name).push(line);
};
walk.fullAncestor(ast, (node, _st, ancestors) => {
  if (node.type === 'AssignmentExpression') for (const n of patNames(node.left)) noteAssign(n, node.loc.start.line, ancestors);
  else if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') noteAssign(node.argument.name, node.loc.start.line, ancestors);
  else if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && node.left.type !== 'VariableDeclaration')
    for (const n of patNames(node.left)) noteAssign(n, node.loc.start.line, ancestors);
});

// ---- 3. who imports what
function listFiles(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), s = statSync(p);
    if (s.isDirectory()) out.push(...listFiles(p));
    else if (/\.(js|ts)$/.test(f)) out.push(p);
  }
  return out;
}
const srcRoot = dirname(target);
const rel = (p) => relative(process.cwd(), p).split(sep).join('/');
const isTarget = (from, spec) => {
  if (!spec.startsWith('.')) return false;
  const p = resolve(dirname(from), spec);
  return p === target || p === target.replace(/\.[jt]s$/, '');
};
const users = new Map(); // export name -> Set(file)
const nsUsers = [];
const note = (name, file) => { if (!users.has(name)) users.set(name, new Set()); users.get(name).add(file); };
for (const f of listFiles(srcRoot)) {
  if (resolve(f) === target) continue;
  const code = readFileSync(f, 'utf8');
  let imps;
  try {
    const a = acorn.parse(code, OPTS);
    imps = [];
    for (const n of a.body) {
      if (n.type === 'ImportDeclaration') imps.push({ spec: n.source.value, names: n.specifiers.map((s) => s.type === 'ImportSpecifier' ? s.imported.name : s.type === 'ImportDefaultSpecifier' ? 'default' : '*:' + s.local.name) });
      else if ((n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source)
        imps.push({ spec: n.source.value, names: n.type === 'ExportAllDeclaration' ? ['*:'] : n.specifiers.map((s) => s.local.name) });
    }
  } catch {
    imps = [];
    for (const m of code.matchAll(/(?:import|export)\s+(?:type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
      const names = [];
      const ns = /\*\s+as\s+(\w+)/.exec(m[1]); if (ns) names.push('*:' + ns[1]);
      const br = /\{([^}]*)\}/.exec(m[1]);
      if (br) for (const part of br[1].split(',')) { const t = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]; if (t) names.push(t); }
      imps.push({ spec: m[2], names });
    }
  }
  for (const im of imps) {
    if (!isTarget(f, im.spec)) continue;
    for (const nm of im.names) {
      if (nm.startsWith('*:')) {
        const alias = nm.slice(2); nsUsers.push(rel(f));
        if (alias) for (const m of code.matchAll(new RegExp('\\b' + alias + '\\.(\\w+)', 'g'))) note(m[1], rel(f));
      } else note(nm, rel(f));
    }
  }
}

// ---- 4. internal call graph
const fnItems = []; // { name, node, item }
for (const it of items) {
  if (it.decl.type === 'FunctionDeclaration') fnItems.push({ name: it.names[0], node: it.decl, item: it });
  else if (it.decl.type === 'VariableDeclaration')
    for (const dc of it.decl.declarations)
      if (dc.id.type === 'Identifier' && dc.init && /^(Arrow)?FunctionExpression$/.test(dc.init.type)) fnItems.push({ name: dc.id.name, node: dc.init, item: it });
}
const refsOf = (fn) => {
  const refs = new Set();
  walk.ancestor(fn.node, {
    Identifier(node, _st, anc) {
      const parent = anc[anc.length - 2];
      if (parent) {
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
        if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed && !parent.shorthand) return;
        if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return;
      }
      if (node.name === fn.name || !topNames.has(node.name)) return;
      if (shadowed(anc.slice(0, -1), node.name)) return;
      refs.add(node.name);
    },
  });
  return refs;
};
const calls = fnItems.map((f) => ({ f, refs: [...refsOf(f)].sort() }));

// ---- 5. level data
const levelHits = [];
for (const it of items) {
  if (it.kind === 'import' || it.kind === 'export-list') continue;
  const hit = new Set();
  const toks = it.names.join(' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-');
  for (const id of LEVEL_IDS) if (('-' + toks + '-').includes('-' + id + '-')) hit.add(id);
  if (it.kind !== 'function') {
    walk.simple(it.decl, {
      Literal(n) { if (typeof n.value === 'string' && LEVEL_IDS.includes(n.value)) hit.add(n.value); },
      TemplateLiteral(n) { if (n.expressions.length === 0 && LEVEL_IDS.includes(n.quasis[0].value.cooked)) hit.add(n.quasis[0].value.cooked); },
    });
  }
  if (hit.size) levelHits.push({ it, ids: [...hit] });
}

// ---- report
const out = [];
const P = (s = '') => out.push(s);
const range = (it) => `${it.start}-${it.end}`;
const real = items.filter((i) => i.kind !== 'import');
const exportsList = [...exportedNames].sort();
const unused = exportsList.filter((n) => !users.has(n));
const top10 = [...items].sort((a, b) => b.count - a.count || a.start - b.start).slice(0, 10);
P(`# Module map: ${rel(target)}`);
P();
P(`Generated by \`node tools/modmap.mjs ${rel(target)}${outFile ? ' --out ' + outFile : ''}\` (acorn, module, locations). ${lines.length} lines.`);
P();
P('## Summary');
P();
P(`- top-level items: ${items.length} (${real.length} excluding imports)`);
P(`- exports: ${exportsList.length}`);
P(`- mutable exports (exported let/var): ${mutable.length}`);
P(`- unused exports (imported by no other src file): ${unused.length}`);
P(`- files importing from it: ${new Set([...users.values()].flatMap((s) => [...s])).size}`);
P();
P('Ten largest items:');
P();
P('| # | item | kind | lines | count |');
P('|---|------|------|-------|-------|');
top10.forEach((it, i) => P(`| ${i + 1} | ${it.label} | ${it.kind} | ${range(it)} | ${it.count} |`));
P();
P('## 1. Top-level items (file order)');
P();
P('Columns: kind, name(s), lines, line count, exported. Grouped under the nearest preceding banner comment.');
let cur;
for (const it of items) {
  const b = it.banner ? it.banner.text : null;
  if (cur === undefined || b !== cur) {
    cur = b; P(); P(b ? `### ${b.replace(/^\/\/\s*/, '')} (line ${it.banner.line})` : '### (no banner)'); P();
    P('| kind | name(s) | lines | count | exported |'); P('|------|---------|-------|-------|----------|');
  }
  P(`| ${it.kind} | ${it.label.replace(/\|/g, '\\|')} | ${range(it)} | ${it.count} | ${isExported(it) ? 'yes' : 'no'} |`);
}
P();
P('## 2. Mutable exports (live bindings)');
P();
P('Exported let/var names and the lines in the file that assign them (declaration excluded; = += ++ etc.).');
P();
for (const n of mutable) { const l = assigns.get(n); P(`- ${n} (declared line ${topNames.get(n).start}): ${l.length ? 'assigned at ' + l.join(', ') : 'never reassigned in this file'}`); }
P();
P('## 3. Who uses what');
P();
P('### Per importing file');
P();
for (const f of [...new Set([...users.values()].flatMap((s) => [...s]))].sort())
  P(`- ${f}: ${[...users.entries()].filter(([, s]) => s.has(f)).map(([n]) => n).sort().join(', ')}`);
if (nsUsers.length) { P(); P(`Namespace imports (\`import * as\`, counted by \`alias.name\`): ${[...new Set(nsUsers)].join(', ')}`); }
P();
P('### Per export (most imported first)');
P();
const rows = exportsList.filter((n) => users.has(n)).map((n) => [n, [...users.get(n)].sort()]).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
for (const [n, fs] of rows) P(`- ${n}: ${fs.length} file${fs.length === 1 ? '' : 's'} - ${fs.join(', ')}`);
P();
P(`### Exports imported by nobody (${unused.length})`);
P();
P(unused.length ? unused.join(', ') : '(none)');
const notExported = [...users.keys()].filter((n) => !exportedNames.has(n) && n !== 'default');
if (notExported.length) { P(); P(`Imported by others but not exported here: ${notExported.sort().join(', ')}`); }
P();
P('## 4. Internal call graph');
P();
P('Each top-level function (declaration or const function/arrow) and the other top-level names of the file it references.');
P();
for (const { f, refs } of calls) P(`- ${f.name} (${range(f.item)}): ${refs.length ? refs.join(', ') : '(none)'}`);
P();
P('## 5. Level data');
P();
P('Top-level items whose name, or (non-function) string literals in the body, is a level id.');
P();
P('| name | lines | count | level ids |');
P('|------|-------|-------|-----------|');
for (const { it, ids } of levelHits) P(`| ${it.label.replace(/\|/g, '\\|')} | ${range(it)} | ${it.count} | ${ids.join(', ')} |`);
P();

const text = out.join('\n');
if (outFile) { writeFileSync(outFile, text); console.log(`wrote ${outFile}`); } else console.log(text);
