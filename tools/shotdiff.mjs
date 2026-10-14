// shotdiff.mjs — compare two folders of screenshots pixel by pixel, so a refactor of the menus
// or HUD can be checked for visual changes. Runs the comparison in a headless browser canvas.
// Usage: node tools/shotdiff.mjs <dirA> <dirB> [--tolerance 0.1] [--out <diffDir>]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { launchBrowser } from "./lib/browser.mjs";

const CHANNEL_LIMIT = 8;

/**
 * Parse the command line.
 * @param {string[]} argv arguments after the script name
 * @returns {{dirA: string, dirB: string, tolerance: number, out: string|null}} options
 */
function parseArgs(argv) {
  const opts = { tolerance: 0.1, out: null };
  const dirs = [];
  for (let idx = 0; idx < argv.length; idx++) {
    if (argv[idx] === "--tolerance") opts.tolerance = Number(argv[++idx]);
    else if (argv[idx] === "--out") opts.out = argv[++idx];
    else dirs.push(argv[idx]);
  }
  if (dirs.length !== 2 || !Number.isFinite(opts.tolerance)) {
    console.error("usage: node tools/shotdiff.mjs <dirA> <dirB> [--tolerance N] [--out DIR]");
    process.exit(2);
  }
  return { dirA: dirs[0], dirB: dirs[1], tolerance: opts.tolerance, out: opts.out };
}

/**
 * List the PNG file names of a folder, sorted.
 * @param {string} dir folder path
 * @returns {string[]} sorted names
 */
function listPngs(dir) {
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort();
}

/**
 * Runs inside the browser: load a PNG data URL into an image.
 * @param {string} url data URL
 * @returns {Promise<HTMLImageElement>} the loaded image
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = url;
  });
}

/**
 * Runs inside the browser: draw an image on a canvas and read its pixels.
 * @param {HTMLImageElement} img the image
 * @returns {{canvas: HTMLCanvasElement, ctx: object, data: Uint8ClampedArray}} the pixels
 */
function readPixels(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, data: ctx.getImageData(0, 0, img.width, img.height).data };
}

/**
 * Runs inside the browser: compare two PNG data URLs.
 * @param {{urlA: string, urlB: string, limit: number, wantDiff: boolean}} job the images
 * @returns {Promise<object>} sizes, differing pixel count, total and optional diff image
 */
async function compareInPage(job) {
  const imgA = await loadImage(job.urlA);
  const imgB = await loadImage(job.urlB);
  const sizeA = [imgA.width, imgA.height];
  const sizeB = [imgB.width, imgB.height];
  if (sizeA[0] !== sizeB[0] || sizeA[1] !== sizeB[1]) {
    return { sizeA, sizeB, diff: 0, total: 0, image: null };
  }
  const picA = readPixels(imgA);
  const dataA = picA.data;
  const dataB = readPixels(imgB).data;
  const outData = picA.ctx.createImageData(sizeA[0], sizeA[1]);
  let diff = 0;
  for (let pos = 0; pos < dataA.length; pos += 4) {
    let differs = false;
    for (let chan = 0; chan < 4; chan++) {
      if (Math.abs(dataA[pos + chan] - dataB[pos + chan]) > job.limit) differs = true;
    }
    const grey = Math.round((dataA[pos] + dataA[pos + 1] + dataA[pos + 2]) / 6 + 85);
    if (differs) diff++;
    outData.data.set(differs ? [255, 0, 255, 255] : [grey, grey, grey, 255], pos);
  }
  picA.ctx.putImageData(outData, 0, 0);
  const image = job.wantDiff ? picA.canvas.toDataURL("image/png") : null;
  return { sizeA, sizeB, diff, total: sizeA[0] * sizeA[1], image };
}

/**
 * Turn a file into a PNG data URL.
 * @param {string} path file path
 * @returns {string} data URL
 */
function toDataUrl(path) {
  return "data:image/png;base64," + readFileSync(path).toString("base64");
}

/**
 * Compare one named file from both folders and print its line.
 * @param {object} page browser page
 * @param {string} name file name
 * @param {object} opts parsed options
 * @returns {Promise<boolean>} true when the file is within tolerance
 */
async function checkFile(page, name, opts) {
  const pathA = join(opts.dirA, name);
  const pathB = join(opts.dirB, name);
  if (!existsSync(pathB)) {
    console.log(`${name}  missing in ${opts.dirB}  FAIL`);
    return false;
  }
  const job = {
    urlA: toDataUrl(pathA),
    urlB: toDataUrl(pathB),
    limit: CHANNEL_LIMIT,
    wantDiff: opts.out !== null,
  };
  const res = await page.evaluate((arg) => window.compareInPage(arg), job);
  if (res.total === 0) {
    console.log(`${name}  size ${res.sizeA.join("x")} vs ${res.sizeB.join("x")}  FAIL`);
    return false;
  }
  const percent = (res.diff / res.total) * 100;
  const ok = percent <= opts.tolerance;
  console.log(`${name}  ${percent.toFixed(3)}%  ${ok ? "OK" : "DIFF"}`);
  if (!ok && res.image) {
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(join(opts.out, name), Buffer.from(res.image.split(",")[1], "base64"));
  }
  return ok;
}

/**
 * Entry point: compare every PNG of folder A with folder B.
 * @returns {Promise<void>} resolves after setting the exit code
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const names = listPngs(opts.dirA);
  const extra = listPngs(opts.dirB).filter((name) => !names.includes(name));
  const browser = await launchBrowser();
  let bad = 0;
  try {
    const page = await browser.newPage();
    const helpers = [loadImage, readPixels, compareInPage].join("\n");
    await page.addScriptTag({ content: helpers + "\nwindow.compareInPage = compareInPage;" });
    for (const name of names) if (!(await checkFile(page, name, opts))) bad++;
  } finally {
    await browser.close();
  }
  for (const name of extra) {
    console.log(`${name}  missing in ${opts.dirA}  FAIL`);
    bad++;
  }
  console.log(`shotdiff: ${names.length + extra.length} files, ${bad} over tolerance`);
  process.exitCode = bad > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
