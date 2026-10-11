import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
const baselinePath = fileURLToPath(new URL("./lint-baseline.json", import.meta.url));
const update = process.argv.includes("--update");

const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(["src"]);

const now = {};
let total = 0;
for (const r of results) {
  const file = relative(root, r.filePath).replace(/\\/g, "/");
  for (const m of r.messages) {
    const rule = m.ruleId || "parse-error";
    now[file] ??= {};
    now[file][rule] = (now[file][rule] || 0) + 1;
    total++;
  }
}

const sorted = {};
for (const f of Object.keys(now).sort()) {
  sorted[f] = {};
  for (const r of Object.keys(now[f]).sort()) sorted[f][r] = now[f][r];
}

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`lint: baseline updated, ${total} problems`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
let baseTotal = 0;
for (const f of Object.keys(baseline)) for (const r of Object.keys(baseline[f])) baseTotal += baseline[f][r];

let worse = 0;
for (const f of Object.keys(sorted)) {
  for (const r of Object.keys(sorted[f])) {
    const was = baseline[f]?.[r] || 0;
    if (sorted[f][r] > was) {
      worse++;
      console.log(`${f}  ${r}  ${was} -> ${sorted[f][r]}`);
      for (const res of results) {
        if (relative(root, res.filePath).replace(/\\/g, "/") !== f) continue;
        for (const m of res.messages) {
          if ((m.ruleId || "parse-error") === r) console.log(`    ${f}:${m.line}:${m.column} ${m.message}`);
        }
      }
    }
  }
}

console.log(`lint: ${total} problems, baseline ${baseTotal}`);
process.exit(worse ? 1 : 0);
