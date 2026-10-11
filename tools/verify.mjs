import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const targets = [
  ["src", ".js"],
  ["tools", ".mjs"],
];

const files = [];
for (const [dir, ext] of targets) {
  const dirPath = fileURLToPath(new URL(`../${dir}/`, import.meta.url));
  let names = [];
  try {
    names = readdirSync(dirPath).filter((n) => n.endsWith(ext)).sort();
  } catch {
    names = [];
  }
  for (const n of names) files.push(`${dirPath}${n}`);
}

let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(file, "utf8"), encoding: "utf8" });
  if (r.status !== 0) {
    failed++;
    const rel = file.startsWith(root) ? file.slice(root.length) : file;
    console.log(`FAIL ${rel}`);
    const lines = (r.stderr || String(r.error || "")).split(/\r?\n/).slice(0, 3);
    for (const l of lines) console.log(`  ${l}`);
  }
}

console.log(`syntax: ${files.length} files, ${failed} failed`);

function runPart(label, script, args) {
  const r = spawnSync(process.execPath, [`${root}${script}`, ...args], { cwd: root, encoding: "utf8" });
  const out = `${r.stdout || ""}${r.stderr || ""}${r.error ? String(r.error) : ""}`.trimEnd();
  if (out) console.log(out);
  const ok = r.status === 0;
  console.log(`${label}: ${ok ? "ok" : "FAIL"}`);
  return ok;
}

// encoding check: text re-encoded wrongly (UTF-8 read as Windows-1252) shows U+FFFD or U+00E2 U+20AC
function collectText(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) collectText(`${p}/`, out);
    else if (/\.(js|ts|mjs|md|json)$/.test(e.name)) out.push(p);
  }
}
const textFiles = [];
for (const d of ["src", "tools"]) {
  try {
    collectText(fileURLToPath(new URL(`../${d}/`, import.meta.url)), textFiles);
  } catch {
    // directory missing
  }
}
const badSeq = "\u00e2\u20ac";
const badChar = "\ufffd";
let encHits = 0;
for (const file of textFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (l.includes(badChar) || l.includes(badSeq)) {
      encHits++;
      const rel = file.startsWith(root) ? file.slice(root.length) : file;
      console.log(`ENCODING ${rel}:${i + 1}`);
    }
  });
}
console.log(`encoding: ${textFiles.length} files, ${encHits} bad lines`);

const tscOk = runPart("tsc", "node_modules/typescript/bin/tsc", ["-p", "tsconfig.json"]);
const lintOk = runPart("lint", "tools/lint.mjs", []);

const parts = [];
if (failed) parts.push("syntax");
if (encHits) parts.push("encoding");
if (!tscOk) parts.push("tsc");
if (!lintOk) parts.push("lint");
console.log(parts.length ? `verify: FAIL (${parts.join(", ")})` : "verify: OK");
process.exit(parts.length ? 1 : 0);
