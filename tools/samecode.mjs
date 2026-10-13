// samecode.mjs - prove that a rename or a line split left the code identical.
//
// WHY IT WORKS: the minifier mangles every local and top-level name, and drops
// comments and whitespace. So a pure rename of a local, or a split of one line
// into several, builds byte-identical code. If the hash of the minified bundle
// is the same before and after an edit, the edit changed no behaviour.
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

const root = fileURLToPath(new URL("../", import.meta.url));
const hashFile = join(root, ".samecode");

const result = await build({
  entryPoints: [join(root, "src/main.js")],
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "none",
  write: false,
  metafile: true,
  logLevel: "error",
});
const bytes = result.outputFiles[0].contents;
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
