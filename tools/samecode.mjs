// samecode.mjs - prove that a rename or a line split left the code identical.
//
// WHY IT WORKS: the bundle is built with whitespace minified (comments gone), then
// every declared binding is renamed to a canonical name ($1, $2 ...) in scope and
// declaration order, using eslint-scope. A rename keeps the scope structure and the
// declaration order, so every binding gets the same canonical name; comments and
// whitespace are gone, so a line split changes nothing. Any real change - a value,
// an operator, an added variable, reordered code - changes the text and the hash.
// (The esbuild identifier minifier is NOT used: it picks short names by character
// frequency, so a pure rename could change its output.)
//
//   node tools/samecode.mjs save   build, print sha256 + size, write .samecode
//   node tools/samecode.mjs        build again, print SAME or DIFFERENT (exit 1),
//                                  and list changed src files that are not in the
//                                  bundle (those must be checked by hand).
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const hashFile = join(root, ".samecode");

const result = await build({
  entryPoints: [join(root, "src/main.js")],
  bundle: true,
  format: "esm",
  minifyWhitespace: true,
  legalComments: "none",
  write: false,
  metafile: true,
  logLevel: "error",
});
const require = createRequire(import.meta.url);
const espree = require("espree");
const { analyze } = require("eslint-scope");

const code = result.outputFiles[0].text;
const ast = espree.parse(code, { ecmaVersion: "latest", sourceType: "module", range: true });
const scopeManager = analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
const edits = new Map();
let counter = 0;
for (const scope of scopeManager.scopes) {
  for (const variable of scope.variables) {
    if (variable.defs.length === 0) continue;
    counter += 1;
    const name = "$" + counter;
    for (const id of variable.identifiers) edits.set(id.range[0], [id.range[1], name]);
    for (const ref of variable.references) {
      edits.set(ref.identifier.range[0], [ref.identifier.range[1], name]);
    }
  }
}
let canonical = code;
for (const start of [...edits.keys()].sort((a, b) => b - a)) {
  const [end, name] = edits.get(start);
  canonical = canonical.slice(0, start) + name + canonical.slice(end);
}
const bytes = Buffer.from(canonical, "utf8");
const hash = createHash("sha256").update(bytes).digest("hex");
console.log(`samecode: sha256 ${hash} size ${bytes.length}`);

if (process.argv[2] === "save") {
  writeFileSync(hashFile, hash + "\n");
  console.log("samecode: saved to .samecode");
  process.exit(0);
}

function gitNames(command) {
  try {
    const out = execSync(command, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const changed = new Set([
  ...gitNames("git diff --name-only HEAD~1"),
  ...gitNames("git diff --name-only"),
]);
const inBundle = new Set(Object.keys(result.metafile.inputs));
const missing = [...changed].filter((file) => file.startsWith("src/") && !inBundle.has(file));
if (missing.length > 0) {
  console.log(`samecode: not in the bundle, check by hand: ${missing.join(", ")}`);
}

const saved = existsSync(hashFile) ? readFileSync(hashFile, "utf8").trim() : "";
if (saved === hash) {
  console.log("samecode: SAME");
} else {
  console.log("samecode: DIFFERENT");
  process.exit(1);
}
