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

const tscOk = runPart("tsc", "node_modules/typescript/bin/tsc", ["-p", "tsconfig.json"]);
const lintOk = runPart("lint", "tools/lint.mjs", []);

const bad = failed || !tscOk || !lintOk;
console.log(`verify: ${files.length} files, ${failed} failed`);
process.exit(bad ? 1 : 0);
