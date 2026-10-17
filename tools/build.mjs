// build.mjs — bundle src/main.js into dist/game.js (+ dist/index.html pointing at it).
import { build } from "esbuild";
import { rm, mkdir, readFile, writeFile, stat, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [join(root, "src/main.js")],
  outfile: join(dist, "game.js"),
  bundle: true,
  format: "esm",
  minify: true,
  sourcemap: true,
  target: "es2022",
});
// the menu recording and its still frame (src/game/menuvideo.js; tools/menuvideo.mjs makes them)
await cp(join(root, "media"), join(dist, "media"), { recursive: true });
const html = await readFile(join(root, "index.html"), "utf8");
// the page loads either path (index.html); both are the one bundle here
await writeFile(join(dist, "index.html"),
  html.replaceAll("./src/main.js", "./game.js").replaceAll("./__bundle.js", "./game.js"));
const size = (await stat(join(dist, "game.js"))).size;
console.log(`dist/game.js ${(size / 1024).toFixed(1)} KB`);
