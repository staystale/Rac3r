// renamevar.mjs — scope-aware "variable -> object property" rename inside ONE function of ONE file.
//
// Usage:  node tools/renamevar.mjs <file> <function-name> <obj> <name...>
//   e.g.  node tools/renamevar.mjs src/render.ts createRenderer view ctx W H dpr PPM zoom noPatterns
//
// Inside the function declaration called <function-name>, every reference to one of <name...> that
// resolves to that function's own body-level binding becomes <obj>.<name>. Assignments, compound
// forms (+=, ++) and destructuring targets are renamed too. NOT touched: a parameter/local of the
// same name in an inner function or block (it keeps its own binding), property keys ({W: 1}),
// member names (a.W), method names and labels. A shorthand property {W} is expanded to {W: obj.W}.
// Only <file> is changed (source text is edited in place, byte for byte elsewhere). Prints the
// changed count per name and every skipped occurrence with the reason. Uses acorn + acorn-walk.
// The original declarations of the names must already be removed (they are reported as skipped).
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const [file, fnName, obj, ...names] = process.argv.slice(2);
if (!file || !fnName || !obj || !names.length) {
  console.error('usage: node tools/renamevar.mjs <file> <function-name> <obj> <name...>');
  process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
const children = (n) => {
  const out = [];
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) { for (const e of v) if (e && typeof e.type === 'string') out.push(e); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
};
function patternIds(p, out) {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier': out.push(p); break;
    case 'ObjectPattern': for (const q of p.properties) patternIds(q.type === 'RestElement' ? q.argument : q.value, out); break;
    case 'ArrayPattern': for (const q of p.elements) patternIds(q, out); break;
    case 'AssignmentPattern': patternIds(p.left, out); break;
    case 'RestElement': patternIds(p.argument, out); break;
    default: break;
  }
  return out;
}

// the function to edit
let target = null;
walk.simple(ast, { FunctionDeclaration(n) { if (n.id && n.id.name === fnName && !target) target = n; } });
if (!target) { console.error(`function ${fnName} not found in ${file}`); process.exit(1); }
for (const p of target.params) {
  for (const id of patternIds(p, [])) {
    if (names.includes(id.name)) { console.error(`${id.name} is a parameter of ${fnName}; refusing`); process.exit(1); }
  }
}

// every binding identifier node (declarations, params, function/class names, catch params)
const bindingNodes = new Set();
(function collect(n) {
  if (n.type === 'VariableDeclarator') patternIds(n.id, []).forEach((i) => bindingNodes.add(i));
  if (isFn(n)) {
    n.params.forEach((p) => patternIds(p, []).forEach((i) => bindingNodes.add(i)));
    if (n.id) bindingNodes.add(n.id);
  }
  if ((n.type === 'ClassDeclaration' || n.type === 'ClassExpression') && n.id) bindingNodes.add(n.id);
  if (n.type === 'CatchClause' && n.param) patternIds(n.param, []).forEach((i) => bindingNodes.add(i));
  children(n).forEach(collect);
})(target);

// names a node declares as a scope
function varNames(n, out) {            // var declarations hoisted to the enclosing function
  if (isFn(n)) return;
  if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d) => patternIds(d.id, []).forEach((i) => out.add(i.name)));
  children(n).forEach((c) => varNames(c, out));
}
function lexNames(stmts, out) {
  for (const s of stmts) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') s.declarations.forEach((d) => patternIds(d.id, []).forEach((i) => out.add(i.name)));
    else if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) out.add(s.id.name);
  }
}
const scopeCache = new Map();
function declared(n) {                 // Set of names declared by scope node n, or null if n is no scope
  if (scopeCache.has(n)) return scopeCache.get(n);
  let out = null;
  if (isFn(n)) {
    out = new Set();
    n.params.forEach((p) => patternIds(p, []).forEach((i) => out.add(i.name)));
    if (n.type === 'FunctionExpression' && n.id) out.add(n.id.name);
    if (n.body.type === 'BlockStatement') { varNames(n.body, out); lexNames(n.body.body, out); }
  } else if (n.type === 'BlockStatement') { out = new Set(); lexNames(n.body, out); }
  else if (n.type === 'ForStatement' && n.init && n.init.type === 'VariableDeclaration' && n.init.kind !== 'var') { out = new Set(); lexNames([n.init], out); }
  else if ((n.type === 'ForInStatement' || n.type === 'ForOfStatement') && n.left.type === 'VariableDeclaration' && n.left.kind !== 'var') { out = new Set(); lexNames([n.left], out); }
  else if (n.type === 'CatchClause') { out = new Set(); if (n.param) patternIds(n.param, []).forEach((i) => out.add(i.name)); }
  else if (n.type === 'SwitchStatement') { out = new Set(); n.cases.forEach((c) => lexNames(c.consequent, out)); }
  scopeCache.set(n, out);
  return out;
}

const changed = Object.fromEntries(names.map((n) => [n, 0]));
const skipped = [];
const edits = new Map();               // start offset -> { start, end, text }
const lineOf = (n) => n.loc.start.line;

const visit = (node, _st, anc) => {
  {
    if (!names.includes(node.name)) return;
    const parent = anc[anc.length - 2];
    const gp = anc[anc.length - 3];
    // not references at all
    if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return;
    if (parent && (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed) return;
    if (parent && (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement')) return;
    // an inner scope that declares the name wins
    for (let i = anc.length - 2; i >= 0; i--) {
      const a = anc[i];
      if (a === target) break;
      const d = declared(a);
      if (d && d.has(node.name)) { skipped.push(`${node.name} line ${lineOf(node)}: resolves to an inner binding (${a.type} at line ${lineOf(a)})`); return; }
    }
    if (bindingNodes.has(node)) { skipped.push(`${node.name} line ${lineOf(node)}: a declaration, not a reference`); return; }
    let shorthand = null;
    if (parent && parent.type === 'Property' && parent.shorthand) shorthand = parent;
    else if (parent && parent.type === 'AssignmentPattern' && parent.left === node && gp && gp.type === 'Property' && gp.shorthand && gp.value === parent) shorthand = gp;
    const start = shorthand ? shorthand.key.start : node.start;
    const end = shorthand ? shorthand.key.end : node.end;
    if (edits.has(start)) return;      // a shorthand reaches us twice (key and value)
    edits.set(start, { start, end, text: shorthand ? `${node.name}: ${obj}.${node.name}` : `${obj}.${node.name}` });
    changed[node.name]++;
  }
};
// VariablePattern is how acorn-walk reports declaration ids and assignment / destructuring targets
walk.ancestor(target, { Identifier: visit, VariablePattern: visit });

let out = src;
for (const e of [...edits.values()].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
if (out !== src) fs.writeFileSync(file, out);
for (const n of names) console.log(`${n}: ${changed[n]} changed`);
console.log(`skipped: ${skipped.length}`);
for (const s of skipped) console.log(`  ${s}`);
