// Phase 2 survey: duplicated helpers and hidden globals. Report only; always exits 0.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { full } from "acorn-walk";
import { ESLint } from "eslint";
import globals from "globals";

const root = fileURLToPath(new URL("../", import.meta.url));
const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const out = resolve(root, outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : "shots/dupcheck.md");

const srcDir = resolve(root, "src");
const files = readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort();
const strip = (s) => s.replace(/\s+/g, "");
const byCount = (a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key));

const named = [];
const anon = [];
const constDecls = [];
const winUses = [];

function fnRecord(fn, name, file, src) {
  const body = fn.body;
  return {
    name,
    file,
    line: fn.loc.start.line,
    text: strip(src.slice(body.start, body.end)),
    lines: body.loc.end.line - body.loc.start.line + 1,
  };
}

function constValue(init) {
  if (init.type === "Literal" && (typeof init.value === "number" || typeof init.value === "string")) {
    return init.raw;
  }
  if (init.type === "UnaryExpression" && init.argument.type === "Literal"
    && typeof init.argument.value === "number" && (init.operator === "-" || init.operator === "+")) {
    return init.operator + init.argument.raw;
  }
  return null;
}

for (const file of files) {
  const rel = `src/${file}`;
  const src = readFileSync(resolve(srcDir, file), "utf8");
  const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const seen = new Set();
  const add = (fn, name) => {
    if (seen.has(fn)) return;
    seen.add(fn);
    const rec = fnRecord(fn, name, rel, src);
    anon.push(rec);
    if (name) named.push(rec);
  };
  const isFn = (n) => n && (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression");
  // Declarators first so named function expressions get their variable name.
  full(ast, (node) => {
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && isFn(node.init)) {
      add(node.init, node.id.name);
    }
  });
  full(ast, (node) => {
    if (node.type === "FunctionDeclaration") add(node, node.id && node.id.name);
    else if (isFn(node)) add(node, null);
    else if (node.type === "MemberExpression" && !node.computed) {
      const obj = node.object;
      if (obj.type === "Identifier" && (obj.name === "window" || obj.name === "globalThis")) {
        winUses.push({ name: node.property.name, file: rel });
      }
    }
  });
  for (const st of ast.body) {
    if (st.type !== "VariableDeclaration" || st.kind !== "const") continue;
    for (const d of st.declarations) {
      if (d.id.type !== "Identifier" || !d.init) continue;
      const value = constValue(d.init);
      if (value !== null) constDecls.push({ name: d.id.name, file: rel, line: d.loc.start.line, value });
    }
  }
}

const pushTo = (map, key, val) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(val);
};

// 1. duplicate functions
const groups = new Map();
for (const r of named) pushTo(groups, r.name, r);
const dupFns = [...groups]
  .filter(([, list]) => list.length >= 2)
  .map(([name, list]) => ({
    key: name,
    count: list.length,
    same: new Set(list.map((r) => r.text)).size === 1,
    locs: list.map((r) => `${r.file}:${r.line}`),
  }))
  .sort(byCount);

// 2. repeated small helpers by body
const bodies = new Map();
for (const r of anon) {
  if (r.lines > 5 || r.text === "{}") continue;
  pushTo(bodies, r.text, r);
}
const dupBodies = [...bodies]
  .filter(([, list]) => list.length >= 2)
  .map(([text, list]) => ({
    key: text.slice(0, 80),
    count: list.length,
    locs: list.map((r) => `${r.file}:${r.line}${r.name ? ` (${r.name})` : ""}`),
  }))
  .sort(byCount);

// 3. hidden globals
function tally(pairs) {
  const map = new Map();
  for (const [name, file] of pairs) {
    if (!map.has(name)) map.set(name, { count: 0, files: new Set() });
    const e = map.get(name);
    e.count++;
    e.files.add(file);
  }
  return [...map].map(([key, e]) => ({ key, count: e.count, files: [...e.files].sort() })).sort(byCount);
}
const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(["src"]);
const undefPairs = [];
for (const res of results) {
  const rel = res.filePath.slice(root.length).replace(/\\/g, "/");
  for (const m of res.messages) {
    if (m.ruleId !== "no-undef") continue;
    undefPairs.push([(/'(.+)' is not defined/.exec(m.message) || [])[1] || m.message, rel]);
  }
}
const undefList = tally(undefPairs);
const winList = tally(
  winUses.filter((u) => !Object.prototype.hasOwnProperty.call(globals.browser, u.name))
    .map((u) => [u.name, u.file]),
);

// 4. shared constants
const cgroups = new Map();
for (const c of constDecls) pushTo(cgroups, c.name, c);
const sharedConsts = [...cgroups]
  .filter(([, list]) => new Set(list.map((c) => c.file)).size >= 2)
  .map(([name, list]) => ({
    key: name,
    count: new Set(list.map((c) => c.file)).size,
    locs: list.map((c) => `${c.file}:${c.line} = ${c.value}`),
  }))
  .sort(byCount);

const md = ["# Phase 2 survey: duplicates and hidden globals", ""];
md.push("Generated by `node tools/dupcheck.mjs`. Scope: `src/*.js`.", "");
md.push("## 1. Duplicate functions", "", `${dupFns.length} entries`, "");
for (const e of dupFns) {
  md.push(`- \`${e.key}\` x${e.count} (${e.same ? "same" : "differs"}): ${e.locs.join(", ")}`);
}
md.push("", "## 2. Repeated small helper bodies (1-5 lines)", "", `${dupBodies.length} entries`, "");
for (const e of dupBodies) {
  md.push(`- x${e.count} \`${e.key.replace(/`/g, "'")}\`: ${e.locs.join(", ")}`);
}
md.push("", "## 3a. Undefined names (no-undef)", "", `${undefList.length} entries`, "");
for (const e of undefList) md.push(`- \`${e.key}\` x${e.count}: ${e.files.join(", ")}`);
md.push("", "## 3b. window / globalThis properties (non-browser)", "", `${winList.length} entries`, "");
for (const e of winList) md.push(`- \`${e.key}\` x${e.count}: ${e.files.join(", ")}`);
md.push("", "## 4. Shared constants (same name in 2+ files)", "", `${sharedConsts.length} entries`, "");
for (const e of sharedConsts) md.push(`- \`${e.key}\` in ${e.count} files: ${e.locs.join(", ")}`);
md.push("");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md.join("\n"));
console.log(`dupcheck: dupFns=${dupFns.length} dupBodies=${dupBodies.length} `
  + `undef=${undefList.length} windowProps=${winList.length} sharedConsts=${sharedConsts.length}`);
console.log("top dup names: " + dupFns.slice(0, 10).map((e) => `${e.key}(${e.count})`).join(", "));
console.log(`wrote ${out}`);
process.exit(0);

