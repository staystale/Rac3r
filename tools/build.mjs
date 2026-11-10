// build.mjs — bundle src/main.ts into dist/game.js (+ dist/index.html pointing at it).
import { build } from "esbuild";
import { rm, mkdir, readFile, writeFile, stat, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(dist, "game.js"),
  bundle: true,
  format: "esm",
  minify: true,
  sourcemap: true,
  target: "es2022",
});
// the static files the page loads (menu logo, pixel fonts: menu/pixelstyle.ts; the track
// thumbnails: menu/thumbfiles.ts)
await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
const html = await readFile(join(root, "index.html"), "utf8");
// the page loads either path (index.html); both are the one bundle here
await writeFile(join(dist, "index.html"),
  html.replaceAll("./src/main.ts", "./game.js").replaceAll("./__bundle.js", "./game.js"));
const size = (await stat(join(dist, "game.js"))).size;
console.log(`dist/game.js ${(size / 1024).toFixed(1)} KB`);
