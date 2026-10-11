// bundlecheck.mjs — build the bundle, load dist/index.html in a touch browser, fail on any error.
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer, launchBrowser } from "./lib/browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const b = spawnSync(process.execPath, ["tools/build.mjs"], { cwd: root, stdio: "inherit" });
if (b.status !== 0) process.exit(1);

let server, browser, failed = false;
try {
  server = await startServer();
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(server.url + "/dist/index.html?touch=1&guide=0");
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(3000);
  if (!(await page.evaluate(() => !!window.__game))) errors.push("window.__game is missing");
  if (errors.length) {
    for (const e of errors) console.error(e);
    failed = true;
  } else {
    const kb = (statSync(root + "dist/game.js").size / 1024).toFixed(1);
    console.log(`bundle OK, ${kb} KB`);
  }
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  await browser?.close();
  server?.stop();
}
process.exit(failed ? 1 : 0);
